import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  Store,
  CheckCircle2,
  Lock,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Package,
} from "lucide-react";
import { useWeb3 } from "../context/Web3Context";
import { getProducts, activateProduct } from "../services/api";
import TransactionStatus from "../components/common/TransactionStatus";

export const RetailerPortal = ({ onGoToAdmin }) => {
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

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customerAddress, setCustomerAddress] = useState("");

  const [txState, setTxState] = useState({ status: "idle", txHash: null, error: null });

  useEffect(() => {
    fetchInventory();
  }, [account]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await getProducts();
      // Filter for items held in custody by this retailer or all unactivated items
      const allItems = res.data || [];
      setInventory(allItems);
    } catch (err) {
      console.warn("Failed to load retailer inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateAndSell = async (e) => {
    e.preventDefault();
    if (!selectedProduct || (!isDemoMode && !contract)) return;

    if (!customerAddress || !ethers.isAddress(customerAddress.trim())) {
      setTxState({ status: "error", error: "Please enter a valid customer Polygon wallet address." });
      return;
    }

    setTxState({ status: "pending", txHash: null, error: null });

    try {
      const tokenId = Number(selectedProduct.token_id);
      const custAddr = customerAddress.trim();

      if (isDemoMode) {
        const txHash = await simulateTx(`Activate & Sell Token #${tokenId}`);
        setTxState({ status: "pending", txHash, error: null });

        await activateProduct(tokenId, {
          customer_address: custAddr,
          tx_hash: txHash,
        });

        setTxState({ status: "success", txHash, error: null });
        setSelectedProduct(null);
        setCustomerAddress("");
        fetchInventory();
        return;
      }

      if (verifyContractCode) {
        await verifyContractCode(contractAddress);
      }

      const gasOverrides = getAmoyGasOverrides ? getAmoyGasOverrides(180000n) : undefined;

      // 1. Submit on-chain activateAndSell with Polygon Amoy gas overrides
      const tx = await contract.activateAndSell(tokenId, custAddr, gasOverrides);
      setTxState({ status: "pending", txHash: tx.hash, error: null });

      // 2. Wait for confirmation
      await tx.wait();

      // 3. Synchronize with SQLite Backend
      await activateProduct(tokenId, {
        customer_address: custAddr,
        tx_hash: tx.hash,
      });

      setTxState({ status: "success", txHash: tx.hash, error: null });
      setSelectedProduct(null);
      setCustomerAddress("");
      fetchInventory();
    } catch (err) {
      console.error("Activation failed:", err);
      const reason = err.reason || err.shortMessage || err.message || "Point-of-sale activation failed.";
      setTxState({ status: "error", txHash: null, error: reason });
    }
  };

  const isRetailer = roles.isRetailer;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 w-fit">
          <Store className="w-3.5 h-3.5" />
          <span>Point-of-Sale (POS) Terminal</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
          Retailer Inventory & Activation
        </h1>
        <p className="text-sm text-slate-500">
          Activate warranty coverage and transfer token ownership to customers at point-of-sale.
        </p>
      </div>

      {/* Permission Warning */}
      {!isRetailer && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-amber-900">
            <Lock className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Connected wallet ({account ? `${account.substring(0, 8)}...` : "None"}) does not hold <strong>RETAILER_ROLE</strong> on-chain.
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

      {/* Inventory Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            Stock Inventory in Custody ({inventory.length})
          </h3>
          <button
            onClick={fetchInventory}
            className="text-xs text-[#0D7E6B] font-semibold hover:underline"
          >
            Refresh Stock
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">Loading stock inventory...</div>
        ) : inventory.length === 0 ? (
          <div className="p-8 bg-white border border-dashed border-slate-200 rounded-3xl text-center text-xs text-slate-400">
            No inventory found in store custody. Ask brand manager to mint tokens to your retailer address.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventory.map((item) => (
              <div
                key={item.id}
                className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-200 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono">
                      Token #{item.token_id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.is_activated
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.is_activated ? "Activated" : "Unactivated"}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm">{item.product_name}</h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{item.serial_number}</p>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Coverage: <strong>{item.duration_days} Days</strong>
                  </p>
                </div>

                <div>
                  {item.is_activated ? (
                    <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono truncate">
                      Owner: {item.customer_address}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedProduct(item);
                        setCustomerAddress("");
                      }}
                      disabled={!isRetailer}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#0D7E6B] hover:bg-[#0B6858] disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Activate & Sell</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Point of Sale Activation Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0D7E6B] mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>POS Point of Sale Checkout</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Activate Token #{selectedProduct.token_id}
              </h3>
              <p className="text-xs text-slate-400">
                {selectedProduct.product_name} · {selectedProduct.serial_number}
              </p>
            </div>

            <form onSubmit={handleActivateAndSell} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Customer Polygon Wallet Address *
                  </label>
                  {account && (
                    <button
                      type="button"
                      onClick={() => setCustomerAddress(account)}
                      className="text-[10px] text-slate-400 hover:text-[#0D7E6B] underline"
                    >
                      Use my wallet for demo
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="0x... Customer address to receive ownership"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7E6B]/20 focus:border-[#0D7E6B]"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  The warranty countdown starts immediately upon block confirmation.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={txState.status === "pending"}
                  className="flex-1 py-2.5 rounded-xl bg-[#0D7E6B] hover:bg-[#0B6858] text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Execute POS Sale</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

export default RetailerPortal;
