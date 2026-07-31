"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
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

import {
  parseSeriesKey,
  seriesKey,
  type ChartMonth,
  type Series,
} from "@/lib/chart-series";

export type { ChartMonth, Series };

interface Props {
  data: ChartMonth[];
  varieties: string[];
}

const SERIES_LABEL: Record<Series, string> = {
  actual: "Recorded",
  forecast: "Expected",
};

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

  // Split the payload back into its two series, so a month holding both never
  // presents them as a single number.
  const bySeries: Record<
    Series,
    { variety: string; value: number; fill: string }[]
  > = { actual: [], forecast: [] };

  for (const p of payload) {
    if (!(p.value > 0)) continue;
    const parsed = parseSeriesKey(p.name);
    if (!parsed) continue;
    bySeries[parsed.series].push({
      variety: parsed.variety,
      value: p.value,
      fill: p.fill,
    });
  }

  const sections = (["actual", "forecast"] as Series[]).filter(
    (s) => bySeries[s].length > 0
  );
  if (sections.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-[180px]">
      <p className="font-semibold text-gray-900 mb-2">{label}</p>

      {sections.map((series, idx) => {
        const rows = bySeries[series];
        const total = rows.reduce((s, r) => s + r.value, 0);
        return (
          <div
            key={series}
            className={idx > 0 ? "border-t border-gray-100 mt-2 pt-2" : ""}
          >
            <p
              className={`text-xs font-medium mb-1 ${
                series === "actual" ? "text-gray-500" : "text-green-700"
              }`}
            >
              {SERIES_LABEL[series]}
            </p>
            {rows.map((r) => (
              <div
                key={r.variety}
                className="flex justify-between gap-4 text-gray-700"
              >
                <span className="flex items-center gap-1.5">
                  {/* Match the bar: recorded is drawn faded, so its swatch is
                      too, or the tooltip contradicts the legend. */}
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{
                      background: r.fill,
                      opacity: series === "actual" ? 0.45 : 1,
                    }}
                  />
                  {r.variety}
                </span>
                <span className="font-medium">{Math.round(r.value)} lbs</span>
              </div>
            ))}
            {selected === "all" && rows.length > 1 && (
              <div className="flex justify-between gap-4 font-semibold text-gray-900 mt-1">
                <span>Total</span>
                <span>{Math.round(total)} lbs</span>
              </div>
            )}
          </div>
        );
      })}
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

  const actualMonths = data.filter((d) => Boolean(d.isActual));
  const firstActualLabel = actualMonths[0]?.monthLabel;
  const lastActualLabel = actualMonths[actualMonths.length - 1]?.monthLabel;
  const firstForecastLabel = data.find((d) => !d.isActual)?.monthLabel;

  const lastIndex = visibleVarieties.length - 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
      <h2 className="font-semibold text-gray-900 mb-1">9-Month Overview</h2>
      <p className="text-xs text-gray-500 mb-3">
        Faded = recorded weight · solid = forecast · tap a variety to filter
      </p>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        <button
          onClick={() => setSelected("all")}
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors active:scale-95 ${
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
          barCategoryGap="12%"
          barGap={2}
        >
          {/* Shade the months that are wholly in the past */}
          {firstActualLabel && lastActualLabel && (
            <ReferenceArea
              x1={firstActualLabel}
              x2={lastActualLabel}
              fill="#f3f4f6"
              fillOpacity={1}
            />
          )}

          {/* Dashed divider where projection starts */}
          {firstForecastLabel && (
            <ReferenceLine
              x={firstForecastLabel}
              stroke="#d1d5db"
              strokeDasharray="4 2"
            />
          )}

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
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />

          {/* Two stacks per month. Recorded is drawn lighter than expected so a
              pair reads as one variety in two states, not two varieties. Every
              month reserves both slots, which is why a month carrying a single
              series renders narrower and off-centre — see ADR 0013. */}
          {visibleVarieties.map((variety, i) => (
            <Bar
              key={seriesKey(variety, "actual")}
              dataKey={seriesKey(variety, "actual")}
              stackId="actual"
              fill={colorMap[variety]}
              fillOpacity={0.45}
              radius={i === lastIndex ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
          {visibleVarieties.map((variety, i) => (
            <Bar
              key={seriesKey(variety, "forecast")}
              dataKey={seriesKey(variety, "forecast")}
              stackId="forecast"
              fill={colorMap[variety]}
              radius={i === lastIndex ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Recorded / Expected legend */}
      <div className="flex gap-4 mt-2 justify-end text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm bg-green-600"
            style={{ opacity: 0.45 }}
          />
          Recorded (weight log)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-600" />
          Expected (forecast)
        </span>
      </div>
    </div>
  );
}
