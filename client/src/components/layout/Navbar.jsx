import React from "react";
import {
  ShieldCheck,
  Search,
  Tag,
  Store,
  Wallet,
  Wrench,
  Settings,
  AlertTriangle,
  LogOut,
  Lock,
  Sparkles,
} from "lucide-react";
import { useWeb3 } from "../../context/Web3Context";

export const Navbar = ({ activeTab, setActiveTab }) => {
  const {
    account,
    isAmoyNetwork,
    isDemoMode,
    toggleDemoMode,
    connectWallet,
    disconnectWallet,
    switchToAmoy,
    isConnecting,
    roles,
  } = useWeb3();

  const truncateAddress = (addr) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const navItems = [
    { id: "verify", label: "Public Verify", icon: Search },
    { id: "brand", label: "Brand Portal", icon: Tag, roleKey: "isBrand", roleLabel: "Brand" },
    { id: "retailer", label: "Retailer POS", icon: Store, roleKey: "isRetailer", roleLabel: "Retailer" },
    { id: "customer", label: "Customer Vault", icon: Wallet },
    { id: "service", label: "Service Center", icon: Wrench, roleKey: "isServiceCenter", roleLabel: "Service" },
    { id: "admin", label: "Admin Roles", icon: Settings, roleKey: "isAdmin", roleLabel: "Admin" },
  ];

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-3">
          {/* Left: Brand Identity */}
          <div
            onClick={() => setActiveTab("verify")}
            className="flex items-center gap-3 cursor-pointer shrink-0 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#0D7E6B] group-hover:bg-[#0B6858] flex items-center justify-center text-white font-extrabold text-xl shadow-sm transition-colors">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-slate-900 tracking-tight">
                  WarrantyChain
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-[#0D7E6B] font-bold border border-emerald-200">
                  ERC-721
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {isDemoMode ? "Gasless Simulation Mode" : "Polygon Amoy Product Ownership"}
              </p>
            </div>
          </div>

          {/* Middle: Role & Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isLocked = !isDemoMode && item.roleKey && account && !roles[item.roleKey];

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all relative ${
                    isActive
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#0D7E6B]" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                  {isLocked && (
                    <Lock className="w-2.5 h-2.5 text-slate-400 ml-0.5" title="Requires on-chain role" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Demo Mode Pill, Network & Wallet Status */}
          <div className="flex items-center gap-2">
            {/* Prominent Demo Mode Toggle Pill */}
            <button
              type="button"
              onClick={toggleDemoMode}
              title={
                isDemoMode
                  ? "Demo Mode Active: Gasless local simulation synced with SQLite. Click to switch to Live Web3."
                  : "Click to enable Gasless Demo Simulation Mode (no MetaMask or POL needed)."
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                isDemoMode
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-200"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isDemoMode ? "text-amber-200 animate-pulse" : "text-slate-500"}`} />
              <span>Demo Mode: {isDemoMode ? "ON" : "OFF"}</span>
            </button>

            {/* Network Badge (Live Web3 only when connected, or Demo indicator) */}
            {account && !isDemoMode && (
              isAmoyNetwork ? (
                <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-purple-600" />
                  <span>Polygon Amoy</span>
                </div>
              ) : (
                <button
                  onClick={switchToAmoy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Switch to Amoy</span>
                </button>
              )
            )}

            {/* Wallet Button */}
            {account ? (
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
                    isDemoMode
                      ? "bg-emerald-50/70 border-emerald-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isDemoMode ? "bg-emerald-500 animate-pulse" : "bg-emerald-500"
                    }`}
                  />
                  <span className="font-mono font-bold text-slate-800">
                    {truncateAddress(account)}
                  </span>
                  {/* Active role pills */}
                  <div className="hidden sm:flex gap-1 ml-0.5">
                    {roles.isAdmin && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                        ADMIN
                      </span>
                    )}
                    {roles.isBrand && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 text-purple-800 font-bold">
                        BRAND
                      </span>
                    )}
                    {roles.isRetailer && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 text-blue-800 font-bold">
                        RETAIL
                      </span>
                    )}
                    {roles.isServiceCenter && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-teal-100 text-teal-800 font-bold">
                        SERVICE
                      </span>
                    )}
                  </div>
                </div>

                {!isDemoMode && (
                  <button
                    onClick={disconnectWallet}
                    title="Disconnect Wallet"
                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0D7E6B] hover:bg-[#0B6858] text-white text-xs font-semibold shadow-sm transition-all"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>{isConnecting ? "Connecting..." : "Connect MetaMask"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="lg:hidden flex items-center justify-between overflow-x-auto py-2 border-t border-slate-100 gap-1 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition-all ${
                  isActive
                    ? "bg-[#0D7E6B] text-white font-bold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
