import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  Wallet,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ArrowRightLeft,
  QrCode,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { useWeb3 } from "../context/Web3Context";
import { getProducts, updateTheftStatus, transferProduct } from "../services/api";
import TransactionStatus from "../components/common/TransactionStatus";
import QRViewerModal from "../components/common/QRViewerModal";

export const CustomerVault = () => {
  const {
    account,
    contract,
    contractAddress,
    isDemoMode,
    simulateTx,
    explorerUrl,
    verifyContractCode,
    getAmoyGasOverrides,
  } = useWeb3();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Transfer modal state
  const [transferTarget, setTransferTarget] = useState(null);
  const [buyerAddress, setBuyerAddress] = useState("");

  // QR modal state
  const [qrProduct, setQrProduct] = useState(null);

  const [txState, setTxState] = useState({ status: "idle", txHash: null, error: null });

  useEffect(() => {
    if (account) {
      fetchMyProducts();
    }
  }, [account]);

  const fetchMyProducts = async () => {
    if (!account) return;
    try {
      setLoading(true);
      const res = await getProducts({ customer_address: account });
      setProducts(res.data || []);
    } catch (err) {
      console.warn("Failed to load customer vault:", err);
    } finally {
      setLoading(false);
    }
  };

  // Peer-to-peer secondary resale transfer
  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!transferTarget || !buyerAddress || (!isDemoMode && !contract)) return;

    if (transferTarget.is_stolen) {
      setTxState({ status: "error", error: "Cannot transfer a product currently flagged as stolen." });
      return;
    }

    if (!ethers.isAddress(buyerAddress.trim())) {
      setTxState({ status: "error", error: "Please enter a valid recipient Polygon wallet address." });
      return;
    }

    setTxState({ status: "pending", txHash: null, error: null });

    try {
      const tokenId = Number(transferTarget.token_id);
      const to = buyerAddress.trim();

      if (isDemoMode) {
        const txHash = await simulateTx(`Transfer Token #${tokenId} to ${to}`);
        setTxState({ status: "pending", txHash, error: null });

        await transferProduct(tokenId, {
          customer_address: to,
          tx_hash: txHash,
        });

        setTxState({ status: "success", txHash, error: null });
        setTransferTarget(null);
        setBuyerAddress("");
        fetchMyProducts();
        return;
      }

      if (verifyContractCode) {
        await verifyContractCode(contractAddress);
      }

      const gasOverrides = getAmoyGasOverrides ? getAmoyGasOverrides(150000n) : undefined;

      // safeTransferFrom(from, to, tokenId) with Polygon Amoy gas overrides
      const tx = await contract["safeTransferFrom(address,address,uint256)"](
        account,
        to,
        tokenId,
        gasOverrides
      );
      setTxState({ status: "pending", txHash: tx.hash, error: null });

      await tx.wait();

      // Keep SQLite ownership synchronized
      try {
        await transferProduct(tokenId, {
          customer_address: to,
          tx_hash: tx.hash,
        });
      } catch (syncErr) {
        console.warn("[CustomerVault] Backend ownership sync warning:", syncErr.message);
      }

      setTxState({ status: "success", txHash: tx.hash, error: null });
      setTransferTarget(null);
      setBuyerAddress("");
      fetchMyProducts();
    } catch (err) {
      console.error("Resale transfer failed:", err);
      const reason = err.reason || err.shortMessage || err.message || "Transfer failed. (Ensure token is not flagged stolen).";
      setTxState({ status: "error", txHash: null, error: reason });
    }
  };

  // Toggle anti-theft lock
  const handleToggleTheft = async (product) => {
    if (!isDemoMode && !contract) return;
    setTxState({ status: "pending", txHash: null, error: null });

    try {
      const tokenId = Number(product.token_id);

      if (isDemoMode) {
        const txHash = await simulateTx(
          product.is_stolen
            ? `Recover Token #${tokenId}`
            : `Report Token #${tokenId} Stolen`
        );
        setTxState({ status: "pending", txHash, error: null });

        await updateTheftStatus(tokenId, {
          is_stolen: !product.is_stolen,
          tx_hash: txHash,
        });

        setTxState({ status: "success", txHash, error: null });
        fetchMyProducts();
        return;
      }

      if (verifyContractCode) {
        await verifyContractCode(contractAddress);
      }

      const gasOverrides = getAmoyGasOverrides ? getAmoyGasOverrides(100000n) : undefined;
      let tx;

      if (product.is_stolen) {
        // Recover with gas overrides
        tx = await contract.recoverStolen(tokenId, gasOverrides);
      } else {
        // Report Stolen with gas overrides
        tx = await contract.reportStolen(tokenId, gasOverrides);
      }

      setTxState({ status: "pending", txHash: tx.hash, error: null });
      await tx.wait();

      // Sync with backend
      await updateTheftStatus(tokenId, {
        is_stolen: !product.is_stolen,
        tx_hash: tx.hash,
      });

      setTxState({ status: "success", txHash: tx.hash, error: null });
      fetchMyProducts();
    } catch (err) {
      console.error("Theft status toggle failed:", err);
      const reason = err.reason || err.shortMessage || err.message || "Failed to update theft status on-chain.";
      setTxState({ status: "error", txHash: null, error: reason });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 w-fit">
          <Wallet className="w-3.5 h-3.5 text-[#0D7E6B]" />
          <span>My Digital Vault</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
          Registered Products & Digital Warranties
        </h1>
        <p className="text-sm text-slate-500">
          Your personal verifiable product collection. Transfer ownership on secondary resale or lock stolen assets on-chain.
        </p>
      </div>

      {!account ? (
        <div className="p-12 bg-white rounded-3xl border border-dashed border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Wallet className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Connect Your Wallet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Please connect your MetaMask wallet to view and manage your authenticated digital warranty passes.
          </p>
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-xs text-slate-400">Loading your owned products...</div>
      ) : products.length === 0 ? (
        <div className="p-12 bg-white rounded-3xl border border-dashed border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#0D7E6B] flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Products Registered Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            When you purchase an item from an authorized retailer, your warranty NFT will automatically appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((item) => {
            const isStolen = Boolean(item.is_stolen);

            return (
              <div
                key={item.id}
                className={`p-6 rounded-3xl bg-white border transition-all shadow-sm flex flex-col justify-between space-y-5 ${
                  isStolen ? "border-rose-300 ring-2 ring-rose-100" : "border-slate-100 hover:shadow-md"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono">
                      Token #{item.token_id}
                    </span>
                    {isStolen ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-1 animate-pulse">
                        <ShieldAlert className="w-3 h-3" />
                        <span>STOLEN (LOCKED)</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#0D7E6B] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-base">{item.product_name}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{item.serial_number}</p>

                  <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Model:</span>
                      <span className="font-medium text-slate-800">{item.model}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Coverage:</span>
                      <span className="font-medium text-slate-800">{item.duration_days} Days</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {/* View QR Code */}
                  <button
                    onClick={() => setQrProduct(item)}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5 text-slate-500" />
                    <span>View QR Pass</span>
                  </button>

                  <div className="flex gap-2">
                    {/* Resale Transfer Button */}
                    <button
                      onClick={() => setTransferTarget(item)}
                      disabled={isStolen}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>Resale</span>
                    </button>

                    {/* Anti-Theft Lock Button */}
                    <button
                      onClick={() => handleToggleTheft(item)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                        isStolen
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                      }`}
                    >
                      <ShieldAlert className="w-3 h-3" />
                      <span>{isStolen ? "Recover" : "Report Stolen"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resale Transfer Modal */}
      {transferTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 mb-1">
                <ArrowRightLeft className="w-4 h-4" />
                <span>Secondary Market Resale Transfer</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Transfer Token #{transferTarget.token_id}
              </h3>
              <p className="text-xs text-slate-400">
                {transferTarget.product_name} · {transferTarget.serial_number}
              </p>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Buyer's Polygon Wallet Address *
                </label>
                <input
                  type="text"
                  required
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  placeholder="0x... Buyer Ethereum address"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  The original warranty duration and remaining coverage countdown are automatically preserved for the buyer.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={txState.status === "pending"}
                  className="flex-1 py-2.5 rounded-xl bg-[#0D7E6B] hover:bg-[#0B6858] text-white text-xs font-bold shadow-sm transition-all"
                >
                  Sign & Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Viewer Modal */}
      <QRViewerModal
        isOpen={Boolean(qrProduct)}
        onClose={() => setQrProduct(null)}
        product={qrProduct}
        tokenId={qrProduct?.token_id}
        serialNumber={qrProduct?.serial_number}
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

export default CustomerVault;
