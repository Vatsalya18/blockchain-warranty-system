import React, { useState } from "react";
import { Web3Provider, useWeb3 } from "./context/Web3Context";
import Navbar from "./components/layout/Navbar";
import PublicVerify from "./pages/PublicVerify";
import BrandPortal from "./pages/BrandPortal";
import RetailerPortal from "./pages/RetailerPortal";
import CustomerVault from "./pages/CustomerVault";
import ServiceCenterPortal from "./pages/ServiceCenterPortal";
import AdminManager from "./pages/AdminManager";
import { ShieldCheck, ExternalLink, Activity } from "lucide-react";

function MainContent() {
  const [activeTab, setActiveTab] = useState("verify");
  const { contractAddress, explorerUrl } = useWeb3();

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans selection:bg-[#0D7E6B]/10 selection:text-[#0D7E6B]">
      {/* Top Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "verify" && <PublicVerify />}
        {activeTab === "brand" && (
          <BrandPortal onGoToAdmin={() => setActiveTab("admin")} />
        )}
        {activeTab === "retailer" && (
          <RetailerPortal onGoToAdmin={() => setActiveTab("admin")} />
        )}
        {activeTab === "customer" && <CustomerVault />}
        {activeTab === "service" && (
          <ServiceCenterPortal onGoToAdmin={() => setActiveTab("admin")} />
        )}
        {activeTab === "admin" && <AdminManager />}
      </main>

      {/* Global Application Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-[#0D7E6B] flex items-center justify-center text-white">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-slate-800">WarrantyChain</span>
            <span>—</span>
            <span>Blockchain-Based Digital Warranty & Ownership System</span>
          </div>

          <div className="flex items-center gap-4">
            {contractAddress && (
              <a
                href={`${explorerUrl}/address/${contractAddress}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-purple-600 hover:text-purple-700 font-mono transition-colors"
                title="View contract on PolygonScan Amoy"
              >
                <Activity className="w-3.5 h-3.5 text-purple-500" />
                <span>
                  Contract: {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                </span>
                <ExternalLink className="w-3 h-3 text-purple-400" />
              </a>
            )}
            <span className="hidden md:inline text-slate-300">|</span>
            <span className="text-slate-400">Polygon Amoy Testnet (Chain ID 80002)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <Web3Provider>
      <MainContent />
    </Web3Provider>
  );
}

export default App;
