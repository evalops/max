"use client";

import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, Wrench, Play, CheckCircle, XCircle, Clock, Trash2, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { ToolRunCard } from "./ToolRunCard";
import type { ToolRunFilterState } from "@/types/artifacts";

const statusFilters: {
  value: ToolRunFilterState["status"];
  label: string;
  icon: typeof Play;
  color: string;
}[] = [
  { value: "all", label: "All", icon: Filter, color: "text-ink-500" },
  { value: "active", label: "Active", icon: Play, color: "text-terminal-blue" },
  { value: "pending", label: "Pending", icon: Clock, color: "text-ink-400" },
  { value: "completed", label: "Completed", icon: CheckCircle, color: "text-terminal-green" },
  { value: "errors", label: "Errors", icon: XCircle, color: "text-red-500" },
];

export function ToolRunsPanel() {
  const { toolRunFilter, setToolRunFilter, getFilteredToolRuns, clearToolRuns, toolRuns } =
    useAppStore();

  // Include toolRuns and toolRunFilter as deps for proper cache invalidation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredRuns = useMemo(() => getFilteredToolRuns(), [toolRuns, toolRunFilter]);

  // Get counts for each status
  const statusCounts = useMemo(() => {
    return {
      all: toolRuns.length,
      active: toolRuns.filter((r) => r.status === "running").length,
      pending: toolRuns.filter((r) => r.status === "pending").length,
      completed: toolRuns.filter((r) => r.status === "succeeded").length,
      errors: toolRuns.filter((r) => r.status === "failed" || r.status === "cancelled").length,
    };
  }, [toolRuns]);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="border-b border-ink-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-terminal-amber" />
            <h2 className="font-semibold text-ink-800">Tool Runs</h2>
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">
              {filteredRuns.length}
            </span>
          </div>
          {toolRuns.length > 0 && (
            <button
              onClick={clearToolRuns}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-ink-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 size={12} />
              Clear
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={toolRunFilter.query}
            onChange={(e) => setToolRunFilter({ query: e.target.value })}
            placeholder="Search tool runs..."
            className="w-full rounded-lg border border-ink-200 bg-ink-50 py-2 pl-9 pr-3 text-sm text-ink-700 placeholder:text-ink-400 focus:border-terminal-amber focus:outline-none focus:ring-1 focus:ring-terminal-amber/30"
          />
        </div>

        {/* Status filters */}
        <div className="mt-3 flex flex-wrap gap-1">
          {statusFilters.map((filter) => {
            const count = statusCounts[filter.value];
            const Icon = filter.icon;
            const isActive = toolRunFilter.status === filter.value;

            return (
              <button
                key={filter.value}
                onClick={() => setToolRunFilter({ status: filter.value })}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all",
                  isActive ? "bg-ink-800 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                )}
              >
                <Icon size={12} className={isActive ? "text-white" : filter.color} />
                {filter.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px]",
                      isActive ? "bg-white/20" : "bg-ink-200"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {filteredRuns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="rounded-full bg-ink-100 p-4">
              <Wrench size={24} className="text-ink-400" />
            </div>
            <h3 className="mt-4 font-medium text-ink-600">No tool runs</h3>
            <p className="mt-1 max-w-xs text-sm text-ink-400">
              {toolRunFilter.query || toolRunFilter.status !== "all"
                ? "No runs match your filters. Try adjusting your search."
                : "Tool executions will appear here as the agent works."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {filteredRuns.map((run) => (
                <ToolRunCard key={run.id} run={run} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
