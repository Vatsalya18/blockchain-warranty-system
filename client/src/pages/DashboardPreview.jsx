import React, { useState } from "react";
import {
  Download,
  CreditCard,
  ShoppingBag,
  MoreHorizontal,
  Home,
  Wifi,
  Zap,
  Smartphone,
  Fuel,
  ShieldCheck,
  QrCode,
  Tag,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import StatCard from "../components/common/StatCard";
import HeroChartCard from "../components/common/HeroChartCard";

export const DashboardPreview = () => {
  const [selectedRole, setSelectedRole] = useState("Brand");

  const recentTransactions = [
    {
      id: 1,
      title: "Batch NFT Minting #402",
      subtitle: "50 Units · Samsung Galaxy S24",
      amount: "Gas: 0.012 MATIC",
      type: "mint",
      icon: CreditCard,
    },
    {
      id: 2,
      title: "Point-of-Sale Activation",
      subtitle: "Token #1042 · Customer 0x89...21a",
      amount: "Active 730d",
      type: "sale",
      icon: ShoppingBag,
    },
    {
      id: 3,
      title: "Service Center Repair",
      subtitle: "Token #984 · Screen Replacement",
      amount: "Logged on-chain",
      type: "service",
      icon: Wrench,
    },
  ];

  const categoryCards = [
    { name: "Smartphones", count: "1,240 Units", color: "bg-[#EEF2FF]", icon: Smartphone },
    { name: "Laptops", count: "820 Units", color: "bg-[#FDF5EC]", icon: Home },
    { name: "Televisions", count: "310 Units", color: "bg-[#F0FDF4]", icon: Zap },
    { name: "Audio Gear", count: "450 Units", color: "bg-[#F0F9FF]", icon: Wifi },
    { name: "Appliances", count: "190 Units", color: "bg-[#FEF2F2]", icon: Fuel },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Greeting Row (Matching Reference Top Section) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back
          </h2>
          <p className="text-sm text-slate-400 font-normal mt-0.5">
            Welcome to dashboard · Polygon Amoy Ecosystem Overview
          </p>
        </div>

        {/* Role Switcher Pill for Phase 1 Demo */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-2xl shadow-2xs self-start">
          {["Admin", "Brand", "Retailer", "Customer", "Service"].map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedRole === role
                  ? "bg-[#0D7E6B] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Split Analytics Grid (Matching Reference Image) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: 2x2 Pastel Metric Cards Grid */}
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            title="Total Minted Inventory"
            value="40,543"
            trend="+3.5% than last month"
            color="peach"
          />
          <StatCard
            title="Active Warranties"
            value="21,340"
            trend="+7.5% than last month"
            color="lavender"
          />
          <StatCard
            title="Registered Retailers"
            value="15,560"
            trend="+10% than last month"
            color="mint"
          />
          <StatCard
            title="Repairs Completed"
            value="1,670"
            trend="+2.5% than last month"
            color="sky"
          />
        </div>

        {/* Right: Signature Emerald Hero Chart Card */}
        <div className="lg:col-span-6">
          <HeroChartCard
            title="Product Warranty Activity"
            metric="1,670 Units"
            trend="+2.5%"
          />
        </div>
      </div>

      {/* Row 2: Secondary Content (Matching Reference Bottom Section) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Recent Activity List Card */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">
              Recent Transactions
            </h3>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 flex-1 flex flex-col justify-around">
            {recentTransactions.map((tx) => {
              const TxIcon = tx.icon;
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2 border-b border-slate-50 last:border-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700">
                      <TxIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {tx.title}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {tx.subtitle}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-800 font-mono">
                    {tx.amount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Categorical Breakdown Row */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">
              Products by Category
            </h3>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            {categoryCards.map((cat, idx) => {
              const CatIcon = cat.icon;
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl ${cat.color} flex flex-col items-start justify-between min-h-[110px] transition-all hover:scale-[1.02]`}
                >
                  <div className="w-8 h-8 rounded-xl bg-white/80 flex items-center justify-center text-slate-700 mb-3">
                    <CatIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {cat.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {cat.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPreview;
