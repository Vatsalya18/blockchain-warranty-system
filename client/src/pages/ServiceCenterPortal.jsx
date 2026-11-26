import React, { useState } from "react";
import {
  Wrench,
  Camera,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Lock,
  ExternalLink,
  PlusCircle,
} from "lucide-react";
import { useWeb3 } from "../context/Web3Context";
import { logServiceRecord, verifyProduct } from "../services/api";
import TransactionStatus from "../components/common/TransactionStatus";
import QRScannerModal from "../components/common/QRScannerModal";

export const ServiceCenterPortal = ({ onGoToAdmin }) => {
  const {
    account,
    contract,
    contractAddress,
    isDemoMode,
    simulateTx,
    roles,
    explorerUrl,
    verifyContractCode,
    getAmoyGasOverrides,
  } = useWeb3();

  const [tokenIdInput, setTokenIdInput] = useState("");
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [form, setForm] = useState({
    serviceType: "Screen Replacement",
    notes: "Replaced damaged display assembly with OEM genuine panel.",
    ipfsReportCid: "QmServiceReportCID99214Test",
  });

  const [txState, setTxState] = useState({ status: "idle", txHash: null, error: null });

  const inspectDevice = async (idToInspect) => {
    const id = idToInspect || tokenIdInput;
    if (!id || (!isDemoMode && !contract)) return;

    setInspecting(true);
    setDeviceInfo(null);

    try {
      const tokenId = Number(id);

      if (isDemoMode) {
        const apiRes = await verifyProduct(id);
        const prod = apiRes?.data?.product;

        if (!prod) {
          setDeviceInfo({ error: `Product #${id} not found in SQLite registry. Mint it in Brand Portal first.` });
          return;
        }

        const isActivated = Boolean(prod.is_activated);
        const isStolen = Boolean(prod.is_stolen);
        let isValid = false;

        if (isActivated && !isStolen) {
          const rawStart = prod.activation_date || prod.created_at;
          const startMs = rawStart
            ? new Date(rawStart.includes("T") ? rawStart : rawStart.replace(" ", "T") + "Z").getTime()
            : Date.now();
          const expiryMs = startMs + (Number(prod.duration_days) || 365) * 86400 * 1000;
          isValid = expiryMs > Date.now();
        }

        setDeviceInfo({
          tokenId: prod.token_id,
          isActivated,
          isValid,
          isStolen,
          currentOwner: prod.customer_address || prod.retailer_address || prod.brand_address,
          history: apiRes?.data?.serviceHistory?.localRecords || [],
          product: prod,
        });
        return;
      }

      const onChainData = await contract.verifyProductByTokenId(tokenId);
      const history = await contract.getServiceHistory(tokenId);
      const apiRes = await verifyProduct(id);

      setDeviceInfo({
        tokenId,
        isActivated: onChainData.isActivated,
        isValid: onChainData.isValid,
        isStolen: onChainData.isStolen,
        currentOwner: onChainData.currentOwner,
        history,
        product: apiRes?.data?.product,
      });
    } catch (err) {
      console.error("Device inspection failed:", err);
      setDeviceInfo({ error: "Token not found on-chain or not yet minted." });
    } finally {
      setInspecting(false);
    }
  };

  const handleRecordService = async (e) => {
    e.preventDefault();
    if (!tokenIdInput || (!isDemoMode && !contract)) return;

    setTxState({ status: "pending", txHash: null, error: null });

    try {
      const tokenId = Number(tokenIdInput);

      if (isDemoMode) {
        // Validate product existence and anti-theft lock from backend
        const apiRes = await verifyProduct(tokenId);
        const prod = apiRes?.data?.product;

        if (!prod) {
          setTxState({
            status: "error",
            txHash: null,
            error: `Product Token #${tokenId} does not exist in backend registry.`,
          });
          return;
        }

        if (prod.is_stolen) {
          setTxState({
            status: "error",
            txHash: null,
            error: "🚨 Stolen product detected! Repair recording is strictly blocked.",
          });
          return;
        }

        const txHash = await simulateTx(`Record Service on Token #${tokenId}`);
        setTxState({ status: "pending", txHash, error: null });

        await logServiceRecord(tokenId, {
          service_center_address: account,
          service_type: form.serviceType,
          notes: form.notes,
          ipfs_report_cid: form.ipfsReportCid.trim(),
          tx_hash: txHash,
        });

        setTxState({ status: "success", txHash, error: null });
        inspectDevice(tokenId);
        return;
      }

      if (verifyContractCode) {
        await verifyContractCode(contractAddress);
      }

      const gasOverrides = getAmoyGasOverrides ? getAmoyGasOverrides(200000n) : undefined;

      // 1. Submit on-chain recordService (tokenId, serviceType, notes, ipfsReportCID) with gas overrides
      const tx = await contract.recordService(
        tokenId,
        form.serviceType,
        form.notes || "Device serviced and verified",
        form.ipfsReportCid.trim(),
        gasOverrides
      );

      setTxState({ status: "pending", txHash: tx.hash, error: null });
      await tx.wait();

      // 2. Synchronize with SQLite Backend
      await logServiceRecord(tokenId, {
        service_center_address: account,
        service_type: form.serviceType,
        notes: form.notes,
        ipfs_report_cid: form.ipfsReportCid.trim(),
        tx_hash: tx.hash,
      });

      setTxState({ status: "success", txHash: tx.hash, error: null });
      inspectDevice(tokenId);
    } catch (err) {
      console.error("Service recording failed:", err);
      const reason = err.reason || err.shortMessage || err.message || "Failed to log service on-chain.";
      setTxState({ status: "error", txHash: null, error: reason });
    }
  };

  const isServiceCenter = roles.isServiceCenter;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200 w-fit">
          <Wrench className="w-3.5 h-3.5 text-[#0D7E6B]" />
          <span>Authorized Service Station Terminal</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
          Service Diagnostics & Repair Logging
        </h1>
        <p className="text-sm text-slate-500">
          Verify device warranty eligibility and write permanent, append-only service records directly to the blockchain.
        </p>
      </div>

      {/* Permission Warning */}
      {!isServiceCenter && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-amber-900">
            <Lock className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Connected wallet ({account ? `${account.substring(0, 8)}...` : "None"}) does not hold <strong>SERVICE_CENTER_ROLE</strong> on-chain.
            </span>
          </div>
          <button
            onClick={onGoToAdmin}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 transition-colors"
          >
            Grant Role in Admin Manager
          </button>
        </div>
      )}

      {/* Device Lookup Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Step 1: Check In Device</h3>
        <div className="flex gap-2">
          <input
            type="number"
            value={tokenIdInput}
            onChange={(e) => setTokenIdInput(e.target.value)}
            placeholder="Enter Device Token ID (e.g. 1)..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
          />
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
            title="Scan Device QR"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => inspectDevice()}
            disabled={inspecting || !tokenIdInput}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition-all"
          >
            {inspecting ? "Inspecting..." : "Check Status"}
          </button>
        </div>

        {/* Live Device Inspection Result */}
        {deviceInfo && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            {deviceInfo.error ? (
              <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-700 text-xs">
                {deviceInfo.error}
              </div>
            ) : deviceInfo.isStolen ? (
              <div className="p-4 rounded-2xl bg-rose-600 text-white flex items-center gap-3 animate-pulse">
                <ShieldAlert className="w-6 h-6 shrink-0" />
                <div>
                  <div className="font-extrabold text-sm">🚨 STOLEN DEVICE DETECTED</div>
                  <div className="text-xs text-rose-100">
                    This unit has been reported as stolen. The smart contract will strictly reject any repair recording.
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    {deviceInfo.product?.product_name || `Token ID #${deviceInfo.tokenId}`}
                  </div>
                  <div className="text-slate-400 font-mono text-[11px]">
                    Owner: {deviceInfo.currentOwner}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {deviceInfo.isValid ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-[#0D7E6B] font-bold text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Warranty Valid</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-700 font-bold text-xs">
                      Warranty Lapsed / Out of Scope
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Repair Entry Form */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
          <PlusCircle className="w-4 h-4 text-[#0D7E6B]" />
          <span>Step 2: Log Certified Repair on Polygon Amoy</span>
        </h3>

        <form onSubmit={handleRecordService} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Token ID *
              </label>
              <input
                type="number"
                required
                value={tokenIdInput}
                onChange={(e) => setTokenIdInput(e.target.value)}
                placeholder="Token ID"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Service / Repair Type *
              </label>
              <select
                value={form.serviceType}
                onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
              >
                <option value="Screen Replacement">Screen Replacement</option>
                <option value="Battery Replacement">Battery Replacement</option>
                <option value="Motherboard Diagnostics">Motherboard Diagnostics</option>
                <option value="Firmware Update">Firmware Update</option>
                <option value="Camera Module Repair">Camera Module Repair</option>
                <option value="Speaker / Microphone Service">Speaker / Microphone Service</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Technician Diagnosis & Notes *
            </label>
            <textarea
              rows={2}
              required
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              IPFS Report CID / Diagnostic Hash
            </label>
            <input
              type="text"
              required
              value={form.ipfsReportCid}
              onChange={(e) => setForm({ ...form, ipfsReportCid: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
            />
          </div>

          <button
            type="submit"
            disabled={!isServiceCenter || !tokenIdInput || txState.status === "pending"}
            className="w-full py-3 rounded-xl bg-[#0D7E6B] hover:bg-[#0B6858] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all"
          >
            {txState.status === "pending"
              ? isDemoMode
                ? "Simulating Repair Record..."
                : "Signing Repair Record..."
              : isDemoMode
                ? "Log Demo Repair Record (Gasless)"
                : "Anchor Repair on-chain"}
          </button>
        </form>
      </div>

      {/* QR Scanner */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(val) => {
          setTokenIdInput(val);
          inspectDevice(val);
        }}
      />

      {/* Transaction Modal */}
      <TransactionStatus
        status={txState.status}
        txHash={txState.txHash}
        error={txState.error}
        explorerUrl={explorerUrl}
        onClose={() => setTxState({ status: "idle", txHash: null, error: null })}
      />
    </div>
  );
};

export default ServiceCenterPortal;
