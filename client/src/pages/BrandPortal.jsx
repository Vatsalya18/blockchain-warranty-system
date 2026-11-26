import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  Tag,
  PlusCircle,
  Package,
  Sparkles,
  ExternalLink,
  Lock,
  ArrowRight,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { useWeb3 } from "../context/Web3Context";
import { createProduct, getProducts } from "../services/api";
import TransactionStatus from "../components/common/TransactionStatus";

export const BrandPortal = ({ onGoToAdmin }) => {
  const {
    account,
    contract,
    contractAddress,
    isDemoMode,
    simulateTx,
    roles,
    isAmoyNetwork,
    explorerUrl,
    verifyContractCode,
    getAmoyGasOverrides,
  } = useWeb3();

  const [form, setForm] = useState({
    serialNumber: "",
    productName: "Samsung Galaxy S24 Ultra",
    model: "SM-S928B",
    retailerAddress: "",
    durationDays: 730,
    tokenURI: "ipfs://QmZtmD2qtQgLzzpkNdFiPbnCj83p8xBrandMeta",
  });

  const [txState, setTxState] = useState({ status: "idle", txHash: null, error: null });
  const [mintedList, setMintedList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // Generate random serial
  const generateSerial = () => {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    setForm((prev) => ({
      ...prev,
      serialNumber: `SN-S24U-${randomHex}`,
    }));
  };

  useEffect(() => {
    generateSerial();
    fetchMintedProducts();
  }, [account]);

  useEffect(() => {
    if (isDemoMode && account && !form.retailerAddress) {
      setForm((prev) => ({ ...prev, retailerAddress: account }));
    }
  }, [isDemoMode, account]);

  const fetchMintedProducts = async () => {
    try {
      setLoadingList(true);
      const res = await getProducts();
      setMintedList(res.data || []);
    } catch (e) {
      console.warn("Failed to load products:", e);
    } finally {
      setLoadingList(false);
    }
  };

  const handleMint = async (e) => {
    e.preventDefault();
    if (!account || (!isDemoMode && !contract)) {
      setTxState({ status: "error", error: "Please connect your authorized Brand wallet first." });
      return;
    }

    if (!form.serialNumber.trim() || !form.retailerAddress.trim()) {
      setTxState({ status: "error", error: "Serial number and retailer address are required." });
      return;
    }

    if (!ethers.isAddress(form.retailerAddress.trim())) {
      setTxState({ status: "error", error: "Invalid retailer Ethereum address format." });
      return;
    }

    setTxState({ status: "pending", txHash: null, error: null });

    try {
      const serialHash = ethers.keccak256(ethers.toUtf8Bytes(form.serialNumber.trim()));
      const durationDays = Number(form.durationDays);

      if (isDemoMode) {
        // Determine next incremental tokenId from backend SQLite records
        const latestRes = await getProducts().catch(() => ({ data: mintedList }));
        const existingProducts = latestRes?.data || mintedList || [];
        const maxTokenId = existingProducts.reduce(
          (max, item) => Math.max(max, Number(item.token_id) || 0),
          0
        );
        const mintedTokenId = maxTokenId > 0 ? maxTokenId + 1 : (Date.now() % 100000) || 1;

        const txHash = await simulateTx(`Mint Product NFT #${mintedTokenId}`);
        setTxState({ status: "pending", txHash, error: null });

        await createProduct({
          token_id: mintedTokenId,
          serial_number: form.serialNumber.trim(),
          serial_hash: serialHash,
          product_name: form.productName.trim(),
          model: form.model.trim(),
          brand_address: account,
          retailer_address: form.retailerAddress.trim(),
          duration_days: durationDays,
          token_uri: form.tokenURI.trim(),
          tx_hash: txHash,
        });

        setTxState({ status: "success", txHash, error: null });
        generateSerial();
        fetchMintedProducts();
        return;
      }

      if (verifyContractCode) {
        await verifyContractCode(contractAddress);
      }

      const gasOverrides = getAmoyGasOverrides ? getAmoyGasOverrides(250000n) : undefined;

      // 1. Submit transaction to Polygon Amoy with explicit gas overrides
      const tx = await contract.mintProduct(
        form.retailerAddress.trim(),
        serialHash,
        form.tokenURI.trim(),
        durationDays,
        gasOverrides
      );

      setTxState({ status: "pending", txHash: tx.hash, error: null });

      // 2. Wait for confirmation
      const receipt = await tx.wait();

      // 3. Extract tokenId from ProductMinted event
      let mintedTokenId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === "ProductMinted") {
            mintedTokenId = Number(parsed.args.tokenId);
            break;
          }
        } catch (e) {
          // continue
        }
      }

      // 4. Synchronize with SQLite Backend
      await createProduct({
        token_id: mintedTokenId,
        serial_number: form.serialNumber.trim(),
        serial_hash: serialHash,
        product_name: form.productName.trim(),
        model: form.model.trim(),
        brand_address: account,
        retailer_address: form.retailerAddress.trim(),
        duration_days: durationDays,
        token_uri: form.tokenURI.trim(),
        tx_hash: tx.hash,
      });

      setTxState({ status: "success", txHash: tx.hash, error: null });
      generateSerial();
      fetchMintedProducts();
    } catch (err) {
      console.error("Minting failed:", err);
      const reason = err.reason || err.shortMessage || err.message || "Mint transaction failed.";
      setTxState({ status: "error", txHash: null, error: reason });
    }
  };

  const isBrand = roles.isBrand;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200 w-fit">
          <Tag className="w-3.5 h-3.5" />
          <span>Manufacturer & Brand Origin Registry</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
          Mint Digital Warranty NFTs
        </h1>
        <p className="text-sm text-slate-500">
          Issue tamper-proof ERC-721 product certificates directly into authorized retailer custody wallets.
        </p>
      </div>

      {/* Permission Warning */}
      {!isBrand && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-amber-900">
            <Lock className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Connected wallet ({account ? `${account.substring(0, 8)}...` : "None"}) does not hold <strong>BRAND_ROLE</strong> on-chain.
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Minting Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-[#0D7E6B]" />
              <span>Issue Single Warranty Pass</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">ERC-721 Token</span>
          </div>

          <form onSubmit={handleMint} className="space-y-4">
            {/* Serial Number with Generator */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700">Physical Serial Number *</label>
                <button
                  type="button"
                  onClick={generateSerial}
                  className="text-[11px] text-[#0D7E6B] font-semibold flex items-center gap-1 hover:underline"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Auto-Generate</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                placeholder="e.g. SN-S24U-99214"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Will be hashed with <code>keccak256</code> before being placed on the blockchain for privacy.
              </p>
            </div>

            {/* Product Name & Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={form.productName}
                  onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  placeholder="e.g. Sony Bravia XR 65"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Model Code *</label>
                <input
                  type="text"
                  required
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="e.g. XR-65A80L"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
                />
              </div>
            </div>

            {/* Destination Retailer Wallet */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700">Destination Retailer Wallet *</label>
                {account && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, retailerAddress: account })}
                    className="text-[10px] text-slate-400 hover:text-[#0D7E6B] underline"
                  >
                    Use my wallet for demo
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                value={form.retailerAddress}
                onChange={(e) => setForm({ ...form, retailerAddress: e.target.value })}
                placeholder="0x... Retailer Ethereum address"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
              />
            </div>

            {/* Warranty Duration & Metadata URI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty Days *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">IPFS Metadata URI</label>
                <input
                  type="text"
                  value={form.tokenURI}
                  onChange={(e) => setForm({ ...form, tokenURI: e.target.value })}
                  placeholder="ipfs://Qm..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!isBrand || txState.status === "pending"}
              className="w-full py-3 rounded-xl bg-[#0D7E6B] hover:bg-[#0B6858] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 mt-2"
            >
              <Package className="w-4 h-4" />
              <span>
                {txState.status === "pending"
                  ? isDemoMode
                    ? "Simulating Mint..."
                    : "Signing in MetaMask..."
                  : isDemoMode
                    ? "Mint Demo Warranty NFT (Gasless)"
                    : "Mint & Anchor on Polygon"}
              </span>
            </button>
          </form>
        </div>

        {/* Recently Minted Units */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Recent Brand Units</h3>
              <span className="text-xs text-slate-400">{mintedList.length} items</span>
            </div>

            {loadingList ? (
              <div className="text-center py-8 text-xs text-slate-400">Loading units...</div>
            ) : mintedList.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl p-4">
                No products minted yet. Issue your first warranty card using the form.
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {mintedList.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{item.product_name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-bold">
                          #{item.token_id}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {item.serial_number}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                        {item.is_activated ? "Activated" : "In Custody"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            Mints are verifiable instantly via the Public Verify portal.
          </div>
        </div>
      </div>

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

export default BrandPortal;
