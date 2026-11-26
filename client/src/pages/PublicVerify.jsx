import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  Search,
  Camera,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  User,
  QrCode,
  ExternalLink,
  Wrench,
  CheckCircle2,
  Calendar,
  Package,
} from "lucide-react";
import { verifyProduct } from "../services/api";
import { useWeb3 } from "../context/Web3Context";
import QRScannerModal from "../components/common/QRScannerModal";
import QRViewerModal from "../components/common/QRViewerModal";

export const PublicVerify = () => {
  const { contract, explorerUrl, isDemoMode } = useWeb3();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);

  // Auto-verify if URL has ?verify=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyParam = params.get("verify");
    if (verifyParam) {
      setQuery(verifyParam);
      handleSearch(verifyParam);
    }
  }, []);

  const handleSearch = async (searchTarget) => {
    const target = (searchTarget || query || "").trim();
    if (!target) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // 1. Call Backend API
      const apiRes = await verifyProduct(target);
      const apiData = apiRes?.data;

      // 2. Perform live on-chain check via contract if available (skip in Demo Mode)
      let directOnChain = null;
      if (!isDemoMode && contract) {
        try {
          const isNumeric = /^\d+$/.test(target);
          if (isNumeric) {
            const tokenId = Number(target);
            const onChainData = await contract.verifyProductByTokenId(tokenId);
            const history = await contract.getServiceHistory(tokenId);
            directOnChain = {
              tokenId,
              serialNumberHash: onChainData.serialNumberHash,
              currentOwner: onChainData.currentOwner,
              isActivated: onChainData.isActivated,
              isValid: onChainData.isValid,
              isStolen: onChainData.isStolen,
              activationDate: Number(onChainData.activationDate),
              durationDays: Number(onChainData.durationDays),
              expiryTimestamp: Number(onChainData.expiryTimestamp),
              serviceRecords: history,
            };
          } else {
            let sHash = target;
            if (!ethers.isHexString(target, 32)) {
              sHash = ethers.keccak256(ethers.toUtf8Bytes(target));
            }
            const onChainData = await contract.verifyProductBySerial(sHash);
            if (onChainData.exists) {
              const history = await contract.getServiceHistory(onChainData.tokenId);
              directOnChain = {
                tokenId: Number(onChainData.tokenId),
                currentOwner: onChainData.currentOwner,
                isActivated: onChainData.isActivated,
                isValid: onChainData.isValid,
                isStolen: onChainData.isStolen,
                activationDate: Number(onChainData.activationDate),
                durationDays: Number(onChainData.durationDays),
                expiryTimestamp: Number(onChainData.expiryTimestamp),
                serviceRecords: history,
              };
            }
          }
        } catch (onChainErr) {
          console.warn("Direct contract lookup skipped/failed:", onChainErr.message);
        }
      }

      setResult({
        api: apiData,
        directOnChain,
      });
    } catch (err) {
      console.error("Verification failed:", err);
      setError(err.response?.data?.error?.message || "Failed to query verification records.");
    } finally {
      setLoading(false);
    }
  };

  const product = result?.api?.product;
  const onChain = isDemoMode
    ? null
    : result?.directOnChain || (result?.api?.onChain?.tokenId ? result.api.onChain : null);
  const isAuthentic = Boolean(product || (onChain && onChain.tokenId > 0));

  const isStolen = Boolean(onChain ? onChain.isStolen : product?.is_stolen);
  const isActivated = Boolean(onChain ? onChain.isActivated : product?.is_activated);

  // Live 1-second ticker for warranty countdown
  useEffect(() => {
    if (!isActivated) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isActivated]);

  // Compute remaining warranty duration
  const calculateRemaining = () => {
    if (!isActivated) return null;
    let expiry = 0;
    if (onChain?.expiryTimestamp) {
      expiry = onChain.expiryTimestamp * 1000;
    } else if (product) {
      const startRaw = product.activation_date || product.created_at;
      if (startRaw) {
        const isoDate = startRaw.includes("T") ? startRaw : startRaw.replace(" ", "T") + "Z";
        const startMs = new Date(isoDate).getTime();
        if (!Number.isNaN(startMs)) {
          expiry = startMs + (Number(product.duration_days) || 365) * 86400 * 1000;
        }
      }
    }
    if (!expiry) return null;

    const diff = expiry - now;
    if (diff <= 0) return { expired: true, text: "Expired" };

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return {
      expired: false,
      days,
      hours,
      mins,
      secs,
      text: `${days}d ${hours}h ${mins}m ${secs}s remaining`,
    };
  };

  const remaining = calculateRemaining();

  const serviceHistory = isDemoMode
    ? result?.api?.serviceHistory?.localRecords || []
    : [
        ...(result?.api?.serviceHistory?.localRecords || []),
        ...(onChain?.serviceRecords || []),
      ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#0D7E6B]">
          <ShieldCheck className="w-4 h-4" />
          <span>Zero-Knowledge Authenticity & Warranty Verification</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Verify Product Authenticity & Ownership
        </h1>
        <p className="text-sm text-slate-500 max-w-xl mx-auto">
          Scan the physical device QR code or enter the product serial number to verify its ERC-721 digital warranty card directly on Polygon Amoy.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="max-w-2xl mx-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(query);
          }}
          className="relative flex items-center shadow-md rounded-2xl bg-white border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#0D7E6B]/30 focus-within:border-[#0D7E6B] transition-all"
        >
          <div className="pl-4 text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Serial Number or Token ID (e.g. SN-S24U-99214 or 1)..."
            className="w-full py-4 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <div className="flex items-center gap-1.5 pr-2">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              title="Scan QR with camera"
              className="p-2.5 rounded-xl text-slate-500 hover:text-[#0D7E6B] hover:bg-emerald-50 transition-colors"
            >
              <Camera className="w-5 h-5" />
            </button>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#0D7E6B] hover:bg-[#0B6858] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
          </div>
        </form>

        {/* Quick Demo Chips */}
        <div className="mt-2.5 flex items-center justify-center gap-2 text-xs text-slate-400">
          <span>Quick checks:</span>
          <button
            type="button"
            onClick={() => {
              setQuery("1");
              handleSearch("1");
            }}
            className="underline hover:text-[#0D7E6B]"
          >
            Token #1
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => {
              setQuery("SN-S24U-JIIT-99214");
              handleSearch("SN-S24U-JIIT-99214");
            }}
            className="underline hover:text-[#0D7E6B]"
          >
            Sample Serial
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-2xl mx-auto p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Verification Results View */}
      {result && (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Stolen Alert Banner */}
          {isStolen && (
            <div className="p-4 rounded-2xl bg-rose-600 text-white shadow-lg flex items-center gap-3 animate-pulse">
              <ShieldAlert className="w-7 h-7 shrink-0" />
              <div>
                <div className="text-sm font-extrabold uppercase tracking-wide">
                  🚨 Stolen Product Reported
                </div>
                <div className="text-xs text-rose-100 mt-0.5">
                  This product has been flagged as stolen by its rightful owner. On-chain ownership transfers and authorized service center repairs are permanently locked.
                </div>
              </div>
            </div>
          )}

          {/* Main Verification Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
            {/* Header: Authenticity Badge + Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    isAuthentic
                      ? "bg-emerald-50 text-[#0D7E6B] border border-emerald-200"
                      : "bg-rose-50 text-rose-600 border border-rose-200"
                  }`}
                >
                  {isAuthentic ? <ShieldCheck className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-900">
                      {isAuthentic ? "Officially Verified Authenticity" : "Counterfeit / Unregistered"}
                    </span>
                    {isAuthentic && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#0D7E6B] text-[10px] font-extrabold uppercase">
                        Genuine
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {isAuthentic
                      ? isDemoMode
                        ? "Verified against SQLite backend registry (Gasless Demo Simulation Mode)."
                        : "Minted & anchored by authorized Brand on Polygon Amoy blockchain."
                      : "No valid ERC-721 warranty card found for this serial identifier."}
                  </p>
                </div>
              </div>

              {isAuthentic && (
                <button
                  onClick={() => setIsQROpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-2xs self-start"
                >
                  <QrCode className="w-4 h-4 text-slate-500" />
                  <span>View QR Pass</span>
                </button>
              )}
            </div>

            {/* Product & Warranty State Grid */}
            {isAuthentic && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Product Information */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Product Specification
                  </h4>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Product Name:</span>
                      <span className="font-bold text-slate-900">
                        {product?.product_name || "Official Blockchain Asset"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Model:</span>
                      <span className="font-medium text-slate-800">
                        {product?.model || "Verified Model"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Token ID:</span>
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        #{onChain?.tokenId || product?.token_id}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Serial Number:</span>
                      <span className="font-mono text-slate-700">
                        {product?.serial_number || "Cryptographically Hashed"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Duration Coverage:</span>
                      <span className="font-medium text-slate-800">
                        {onChain?.durationDays || product?.duration_days || 365} Days
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Warranty Coverage & Ownership */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Warranty & Ownership
                  </h4>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Warranty Status:</span>
                      {isStolen ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-xs">
                          LOCKED (STOLEN)
                        </span>
                      ) : !isActivated ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-xs">
                          UNACTIVATED (IN STOCK)
                        </span>
                      ) : remaining?.expired ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold text-xs">
                          EXPIRED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#0D7E6B] font-bold text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>ACTIVE COVERAGE</span>
                        </span>
                      )}
                    </div>

                    {isActivated && remaining && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Remaining Time:</span>
                        <span className="font-bold text-slate-900 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#0D7E6B]" />
                          <span>{remaining.text}</span>
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col gap-1 text-xs pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500">Current Owner:</span>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-800 text-[11px] truncate max-w-[200px]">
                          {onChain?.currentOwner || product?.customer_address || product?.retailer_address}
                        </span>
                        {(onChain?.currentOwner || product?.customer_address) && (
                          <a
                            href={`${explorerUrl}/address/${onChain?.currentOwner || product?.customer_address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#0D7E6B] hover:underline inline-flex items-center gap-0.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {product?.tx_hash && (
                      <div className="flex justify-between items-center text-xs pt-1">
                        <span className="text-slate-500">
                          {isDemoMode ? "Simulated Tx Hash:" : "Blockchain Record:"}
                        </span>
                        {isDemoMode ? (
                          <span className="font-mono text-[11px] text-slate-600">
                            {product.tx_hash.substring(0, 12)}...
                          </span>
                        ) : (
                          <a
                            href={`${explorerUrl}/tx/${product.tx_hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[11px] text-[#0D7E6B] hover:underline flex items-center gap-1"
                          >
                            <span>{product.tx_hash.substring(0, 10)}...</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Service & Repair History Timeline */}
            {isAuthentic && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-slate-500" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Authorized Service & Repair Timeline ({serviceHistory.length})
                    </h4>
                  </div>
                </div>

                {serviceHistory.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 text-slate-400 text-xs text-center border border-dashed border-slate-200">
                    No repairs or maintenance recorded on-chain yet. Device is in original factory condition.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {serviceHistory.map((rec, index) => (
                      <div
                        key={index}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{rec.service_type || rec.serviceType}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                              Certified
                            </span>
                          </div>
                          {rec.notes && <p className="text-slate-600 text-[11px]">{rec.notes}</p>}
                          <div className="text-[10px] text-slate-400 font-mono">
                            Center: {rec.service_center_address || rec.serviceCenter}
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-end justify-between sm:justify-center text-right shrink-0">
                          <span className="text-slate-400 text-[10px]">
                            {rec.created_at || (rec.timestamp ? new Date(rec.timestamp * 1000).toLocaleDateString() : "Logged")}
                          </span>
                          {(rec.ipfs_report_cid || rec.ipfsReportCid) && (
                            <a
                              href={`https://gateway.pinata.cloud/ipfs/${rec.ipfs_report_cid || rec.ipfsReportCid}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-[#0D7E6B] font-semibold hover:underline flex items-center gap-0.5 mt-0.5"
                            >
                              <span>Report CID</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(decodedText) => {
          setQuery(decodedText);
          handleSearch(decodedText);
        }}
      />

      {/* QR Code Pass Modal */}
      <QRViewerModal
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
        product={product}
        tokenId={onChain?.tokenId || product?.token_id}
        serialNumber={product?.serial_number}
      />
    </div>
  );
};

export default PublicVerify;
