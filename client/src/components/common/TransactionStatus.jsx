import React from "react";
import { CheckCircle2, AlertCircle, Loader2, ExternalLink, X, Sparkles } from "lucide-react";
import { useWeb3 } from "../../context/Web3Context";

export const TransactionStatus = ({ status, txHash, error, explorerUrl, onClose }) => {
  const { isDemoMode } = useWeb3();

  if (!status || status === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        {isDemoMode && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#0D7E6B] text-[10px] font-bold mb-2">
            <Sparkles className="w-3 h-3" />
            <span>Demo Mode · Gasless Simulation</span>
          </div>
        )}

        {status === "pending" && (
          <div className="my-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center text-[#0D7E6B] mb-4 mx-auto">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {isDemoMode ? "Simulating Transaction..." : "Transaction Pending"}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {isDemoMode
                ? "Generating simulated Polygon Amoy receipt and syncing state with SQLite backend."
                : "Please confirm the transaction in MetaMask and wait for confirmation on Polygon Amoy."}
            </p>
            {txHash && !isDemoMode && (
              <a
                href={`${explorerUrl}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#0D7E6B] font-semibold hover:underline"
              >
                <span>View on PolygonScan</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {status === "success" && (
          <div className="my-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {isDemoMode ? "Simulated Transaction Confirmed!" : "Transaction Confirmed!"}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {isDemoMode
                ? "Gasless simulation succeeded and state was persisted to the Express + SQLite backend."
                : "State successfully updated on Polygon Amoy and synced with backend database."}
            </p>
            {txHash && (
              isDemoMode ? (
                <div className="mt-3 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-mono">
                  Simulated Tx: {txHash.substring(0, 14)}...{txHash.substring(txHash.length - 8)}
                </div>
              ) : (
                <a
                  href={`${explorerUrl}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#0D7E6B] font-semibold hover:bg-slate-100 transition-colors"
                >
                  <span>Verify on PolygonScan</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )
            )}
            <div className="mt-5">
              <button
                onClick={onClose}
                className="w-full px-5 py-2.5 rounded-xl bg-[#0D7E6B] hover:bg-[#0B6858] text-white text-xs font-semibold shadow-sm transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="my-3">
            <div className="w-16 h-16 rounded-full bg-rose-50 border-4 border-rose-200 flex items-center justify-center text-rose-600 mb-4 mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Transaction Failed</h3>
            <p className="text-xs text-rose-600 mt-1 max-w-xs font-mono bg-rose-50/70 p-2.5 rounded-xl border border-rose-100 text-left overflow-auto max-h-24">
              {error || "An unknown error occurred during transaction execution."}
            </p>
            <div className="mt-5">
              <button
                onClick={onClose}
                className="w-full px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionStatus;
