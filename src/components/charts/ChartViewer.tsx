"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TrendingUp, BarChart3, PieChart as PieIcon, Activity } from "lucide-react";

export type ChartType = "line" | "bar" | "area" | "pie" | "scatter";

interface ChartDataPoint {
  [key: string]: string | number;
}

interface ChartViewerProps {
  data: ChartDataPoint[];
  type?: ChartType;
  xKey?: string;
  yKeys?: string[];
  title?: string;
  theme?: "light" | "dark";
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  colors?: string[];
  className?: string;
}

const DEFAULT_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

const PIE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#6366f1",
  "#14b8a6",
];

function getChartIcon(type: ChartType) {
  switch (type) {
    case "line":
      return TrendingUp;
    case "bar":
      return BarChart3;
    case "pie":
      return PieIcon;
    default:
      return Activity;
  }
}

function inferKeys(data: ChartDataPoint[]): { xKey: string; yKeys: string[] } {
  if (!data || data.length === 0) {
    return { xKey: "x", yKeys: ["y"] };
  }

  const firstItem = data[0];
  const keys = Object.keys(firstItem);

  // Find string keys (likely x-axis) and numeric keys (likely y-axis)
  const stringKeys = keys.filter((k) => typeof firstItem[k] === "string");
  const numericKeys = keys.filter((k) => typeof firstItem[k] === "number");

  const xKey = stringKeys[0] || keys[0];
  const yKeys = numericKeys.length > 0 ? numericKeys : keys.filter((k) => k !== xKey);

  return { xKey, yKeys };
}

export function ChartViewer({
  data,
  type = "line",
  xKey: propXKey,
  yKeys: propYKeys,
  title,
  theme = "light",
  height = 300,
  showLegend = true,
  showGrid = true,
  colors = DEFAULT_COLORS,
  className = "",
}: ChartViewerProps) {
  const { xKey, yKeys } = useMemo(() => {
    if (propXKey && propYKeys) {
      return { xKey: propXKey, yKeys: propYKeys };
    }
    return inferKeys(data);
  }, [data, propXKey, propYKeys]);

  const isDark = theme === "dark";
  const axisColor = isDark ? "#71717a" : "#a1a1aa";
  const gridColor = isDark ? "#27272a" : "#e4e4e7";
  const tooltipBg = isDark ? "#18181b" : "#ffffff";
  const tooltipBorder = isDark ? "#3f3f46" : "#e4e4e7";

  const ChartIcon = getChartIcon(type);

  if (!data || data.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        <ChartIcon size={32} className="text-zinc-400 mb-2" />
        <p className="text-sm text-zinc-500">No data to display</p>
      </div>
    );
  }

  const renderChart = () => {
    switch (type) {
      case "line":
        return (
          <LineChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />}
            <XAxis
              dataKey={xKey}
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 11 }}
              tickLine={{ stroke: axisColor }}
            />
            <YAxis
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 11 }}
              tickLine={{ stroke: axisColor }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            {showLegend && <Legend wrapperStyle={{ fontSize: "12px" }} />}
            {yKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: colors[i % colors.length] }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        );

      case "bar":
        return (
          <BarChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />}
            <XAxis
              dataKey={xKey}
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 11 }}
              tickLine={{ stroke: axisColor }}
            />
            <YAxis
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 11 }}
              tickLine={{ stroke: axisColor }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            {showLegend && <Legend wrapperStyle={{ fontSize: "12px" }} />}
            {yKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[i % colors.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case "area":
        return (
          <AreaChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />}
            <XAxis
              dataKey={xKey}
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 11 }}
              tickLine={{ stroke: axisColor }}
            />
            <YAxis
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 11 }}
              tickLine={{ stroke: axisColor }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            {showLegend && <Legend wrapperStyle={{ fontSize: "12px" }} />}
            {yKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[i % colors.length]}
                fill={colors[i % colors.length]}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        );

      case "pie":
        const pieDataKey = yKeys[0] || "value";
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={pieDataKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={height / 3}
              label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={{ stroke: axisColor }}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            {showLegend && <Legend wrapperStyle={{ fontSize: "12px" }} />}
          </PieChart>
        );

      case "scatter":
        return (
          <ScatterChart>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />}
            <XAxis
              dataKey={xKey}
              type="number"
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 11 }}
              tickLine={{ stroke: axisColor }}
              name={xKey}
            />
            <YAxis
              dataKey={yKeys[0]}
              type="number"
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 11 }}
              tickLine={{ stroke: axisColor }}
              name={yKeys[0]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: "6px",
                fontSize: "12px",
              }}
              cursor={{ strokeDasharray: "3 3" }}
            />
            {showLegend && <Legend wrapperStyle={{ fontSize: "12px" }} />}
            <Scatter
              name={yKeys[0]}
              data={data}
              fill={colors[0]}
            />
          </ScatterChart>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 ${className}`}>
      {/* Header */}
      {title && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
          <ChartIcon size={16} className="text-blue-500" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {title}
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Footer with data summary */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500">
        <span>{data.length} data points</span>
        <span className="capitalize">{type} chart</span>
      </div>
    </div>
  );
}

export type { ChartDataPoint, ChartViewerProps };
