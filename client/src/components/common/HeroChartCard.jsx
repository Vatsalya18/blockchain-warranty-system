import React, { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

export const HeroChartCard = ({
  title = "Warranty Activity",
  metric = "1,670 Units",
  trend = "+2.5%",
}) => {
  const [timeframe, setTimeframe] = useState("7 Days");

  const bars = [
    { day: "10 Jun", height: "45%", value: "24K" },
    { day: "11 Jun", height: "70%", value: "35K" },
    { day: "12 Jun", height: "92%", value: "48K" },
    { day: "13 Jun", height: "55%", value: "28K", isHatched: true }, // Highlighted selected state from reference
    { day: "14 Jun", height: "48%", value: "25K" },
    { day: "15 Jun", height: "78%", value: "39K" },
    { day: "16 Jun", height: "65%", value: "32K" },
  ];

  return (
    <div className="bg-[#0D7E6B] text-white p-6 rounded-3xl shadow-sm flex flex-col justify-between relative overflow-hidden">
      {/* Header Row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white/95">{title}</h3>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold tracking-tight">{metric}</span>
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-semibold text-white">
              {trend}
            </span>
          </div>
        </div>

        {/* Filter Dropdown Pill */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-medium text-white transition-colors">
          <Calendar className="w-3.5 h-3.5" />
          <span>{timeframe}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-80" />
        </button>
      </div>

      {/* Chart Canvas */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-end justify-between gap-2 h-40">
          {/* Y Axis Legend */}
          <div className="flex flex-col justify-between h-full text-[10px] text-white/60 font-mono pr-2">
            <span>50K</span>
            <span>40K</span>
            <span>30K</span>
            <span>20K</span>
            <span>10K</span>
            <span>0K</span>
          </div>

          {/* Bar Columns */}
          <div className="flex-1 flex items-end justify-around h-full gap-2 pt-2">
            {bars.map((bar, index) => (
              <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group">
                <div
                  style={{ height: bar.height }}
                  className={`w-full max-w-[34px] rounded-t-xl transition-all duration-300 relative ${
                    bar.isHatched
                      ? "bg-[#FEF3C7] bg-hatch-pattern shadow-sm"
                      : "bg-[#FEF3C7] hover:bg-white"
                  }`}
                  title={`${bar.day}: ${bar.value}`}
                />
                <span className="text-[11px] text-white/80 mt-2 font-medium">
                  {bar.day}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroChartCard;
