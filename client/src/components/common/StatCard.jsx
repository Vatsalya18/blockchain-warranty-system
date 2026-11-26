import React from "react";
import { ArrowUpRight, TrendingUp } from "lucide-react";

const colorStyles = {
  peach: "bg-[#FDF5EC] border-[#F8D7BE]/50 text-slate-800",
  lavender: "bg-[#EEF2FF] border-[#D0D7F7]/50 text-slate-800",
  mint: "bg-[#F0FDF4] border-[#C6F6D5]/50 text-slate-800",
  sky: "bg-[#F0F9FF] border-[#BAE6FD]/50 text-slate-800",
  coral: "bg-[#FEF2F2] border-[#FECACA]/50 text-slate-800",
};

export const StatCard = ({
  title,
  value,
  trend,
  color = "peach",
  icon: Icon,
}) => {
  const selectedStyle = colorStyles[color] || colorStyles.peach;

  return (
    <div
      className={`p-5 rounded-2xl border transition-all duration-200 hover:shadow-sm flex flex-col justify-between ${selectedStyle}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-600 tracking-wide">
          {title}
        </span>
        <div className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center text-slate-700 shadow-2xs">
          {Icon ? <Icon className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
        </div>
      </div>

      <div>
        <div className="text-2xl font-bold text-slate-900 tracking-tight">
          {value}
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <TrendingUp className="w-3 h-3" />
            <span>{trend}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
