"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PALETTE = [
  "#16a34a", // green-600
  "#d97706", // amber-600
  "#2563eb", // blue-600
  "#7c3aed", // violet-600
  "#0891b2", // cyan-600
  "#db2777", // pink-600
  "#ea580c", // orange-600
];

export interface ChartMonth {
  monthLabel: string;
  [variety: string]: number | string;
}

interface Props {
  data: ChartMonth[];
  varieties: string[];
}

function CustomTooltip({
  active,
  payload,
  label,
  selected,
}: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?: string;
  selected: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const visible = payload.filter((p) => p.value > 0);
  const total = visible.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-gray-900 mb-2">{label}</p>
      {visible.map((p) => (
        <div key={p.name} className="flex justify-between gap-4 text-gray-700">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: p.fill }}
            />
            {p.name}
          </span>
          <span className="font-medium">{Math.round(p.value)} lbs</span>
        </div>
      ))}
      {selected === "all" && visible.length > 1 && (
        <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between font-semibold text-gray-900">
          <span>Total</span>
          <span>{Math.round(total)} lbs</span>
        </div>
      )}
    </div>
  );
}

export function ForecastChart({ data, varieties }: Props) {
  const [selected, setSelected] = useState<string>("all");

  if (data.length === 0) return null;

  const colorMap: Record<string, string> = {};
  varieties.forEach((v, i) => {
    colorMap[v] = PALETTE[i % PALETTE.length];
  });

  const visibleVarieties =
    selected === "all" ? varieties : varieties.filter((v) => v === selected);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
      <h2 className="font-semibold text-gray-900 mb-1">6-Month Outlook</h2>
      <p className="text-xs text-gray-500 mb-3">Expected pounds · tap a variety to filter</p>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        <button
          onClick={() => setSelected("all")}
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            selected === "all"
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-300"
          }`}
        >
          All
        </button>
        {varieties.map((v, i) => {
          const color = PALETTE[i % PALETTE.length];
          const isSelected = selected === v;
          return (
            <button
              key={v}
              onClick={() => setSelected(isSelected ? "all" : v)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                isSelected
                  ? "text-white border-transparent"
                  : "bg-white text-gray-600 border-gray-300"
              }`}
              style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
            >
              <span
                className="inline-block w-2 h-2 rounded-sm shrink-0"
                style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.7)" : color }}
              />
              {v}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 0, right: 4, left: -18, bottom: 0 }}
          barCategoryGap="25%"
        >
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<CustomTooltip selected={selected} />}
            cursor={{ fill: "#f3f4f6" }}
          />
          {visibleVarieties.map((variety, i) => (
            <Bar
              key={variety}
              dataKey={variety}
              stackId="a"
              fill={colorMap[variety]}
              radius={
                i === visibleVarieties.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
