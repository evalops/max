"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  Zap,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from "lucide-react";
import { useAppStore } from "@/store";

const formatCurrency = (value: number) => {
  if (value < 0.01) {
    return `$${value.toFixed(4)}`;
  }
  return `$${value.toFixed(2)}`;
};

const formatTokens = (value: number) => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
};

export function CostPanel() {
  const { costTimeline, getTotalCost, clearCostTimeline } = useAppStore();

  const stats = useMemo(() => {
    const totalCost = getTotalCost();
    const totalInputTokens = costTimeline.reduce((sum, e) => sum + e.inputTokens, 0);
    const totalOutputTokens = costTimeline.reduce((sum, e) => sum + e.outputTokens, 0);
    const totalCacheReadTokens = costTimeline.reduce((sum, e) => sum + e.cacheReadTokens, 0);
    const totalCacheWriteTokens = costTimeline.reduce((sum, e) => sum + e.cacheWriteTokens, 0);

    // Calculate cost breakdown
    const inputCost = costTimeline.reduce((sum, e) => sum + e.cost.input, 0);
    const outputCost = costTimeline.reduce((sum, e) => sum + e.cost.output, 0);
    const cacheCost = costTimeline.reduce(
      (sum, e) => sum + e.cost.cacheRead + e.cost.cacheWrite,
      0
    );

    // Get recent trend (last 5 entries)
    const recentEntries = costTimeline.slice(-5);
    const avgRecentCost =
      recentEntries.length > 0
        ? recentEntries.reduce((sum, e) => sum + e.cost.total, 0) / recentEntries.length
        : 0;

    // Calculate cache savings (rough estimate)
    const estimatedSavings = totalCacheReadTokens * 0.000003; // Assuming ~$3/1M for cached reads vs normal

    return {
      totalCost,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheWriteTokens,
      inputCost,
      outputCost,
      cacheCost,
      avgRecentCost,
      estimatedSavings,
      turnCount: costTimeline.length,
    };
  }, [costTimeline, getTotalCost]);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="border-b border-ink-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-terminal-green" />
            <h2 className="font-semibold text-ink-800">Session Cost</h2>
          </div>
          {costTimeline.length > 0 && (
            <button
              onClick={clearCostTimeline}
              className="text-xs text-ink-400 hover:text-ink-600"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {costTimeline.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="rounded-full bg-ink-100 p-4">
              <BarChart3 size={24} className="text-ink-400" />
            </div>
            <h3 className="mt-4 font-medium text-ink-600">No cost data yet</h3>
            <p className="mt-1 max-w-xs text-sm text-ink-400">
              Cost tracking will begin when the agent starts processing.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Total Cost */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-gradient-to-br from-terminal-green/10 to-terminal-blue/10 p-4"
            >
              <div className="text-sm text-ink-500">Total Cost</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-ink-800">
                  {formatCurrency(stats.totalCost)}
                </span>
                <span className="text-sm text-ink-400">
                  across {stats.turnCount} turns
                </span>
              </div>
              {stats.avgRecentCost > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-ink-500">
                  <TrendingUp size={12} />
                  ~{formatCurrency(stats.avgRecentCost)} per turn (recent avg)
                </div>
              )}
            </motion.div>

            {/* Cost breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-ink-200 p-3">
                <div className="flex items-center gap-1.5 text-xs text-ink-500">
                  <ArrowDownRight size={12} className="text-terminal-blue" />
                  Input
                </div>
                <div className="mt-1 text-lg font-semibold text-ink-700">
                  {formatCurrency(stats.inputCost)}
                </div>
                <div className="text-xs text-ink-400">
                  {formatTokens(stats.totalInputTokens)} tokens
                </div>
              </div>

              <div className="rounded-lg border border-ink-200 p-3">
                <div className="flex items-center gap-1.5 text-xs text-ink-500">
                  <ArrowUpRight size={12} className="text-terminal-purple" />
                  Output
                </div>
                <div className="mt-1 text-lg font-semibold text-ink-700">
                  {formatCurrency(stats.outputCost)}
                </div>
                <div className="text-xs text-ink-400">
                  {formatTokens(stats.totalOutputTokens)} tokens
                </div>
              </div>
            </div>

            {/* Cache stats */}
            {(stats.totalCacheReadTokens > 0 || stats.totalCacheWriteTokens > 0) && (
              <div className="rounded-lg border border-terminal-green/30 bg-terminal-green/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-terminal-green">
                  <Database size={12} />
                  Cache Performance
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-ink-400">Read:</span>{" "}
                    <span className="font-medium text-ink-600">
                      {formatTokens(stats.totalCacheReadTokens)}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-400">Write:</span>{" "}
                    <span className="font-medium text-ink-600">
                      {formatTokens(stats.totalCacheWriteTokens)}
                    </span>
                  </div>
                </div>
                {stats.estimatedSavings > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-terminal-green">
                    <Zap size={10} />
                    Est. savings: {formatCurrency(stats.estimatedSavings)}
                  </div>
                )}
              </div>
            )}

            {/* Recent entries */}
            <div>
              <h4 className="mb-2 text-xs font-medium text-ink-500">
                Recent Activity
              </h4>
              <div className="space-y-1.5">
                {costTimeline.slice(-5).reverse().map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-ink-600">
                        {entry.model}
                      </div>
                      <div className="text-[10px] text-ink-400">
                        {entry.toolNames.length > 0
                          ? entry.toolNames.slice(0, 2).join(", ") +
                            (entry.toolNames.length > 2
                              ? ` +${entry.toolNames.length - 2}`
                              : "")
                          : "No tools"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-ink-700">
                        {formatCurrency(entry.cost.total)}
                      </div>
                      <div className="text-[10px] text-ink-400">
                        {formatTokens(entry.inputTokens + entry.outputTokens)} tok
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
