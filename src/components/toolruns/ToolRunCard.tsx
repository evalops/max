"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  type LucideIcon,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  Terminal,
  AlertTriangle,
  Info,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ToolRun, ToolRunStatus } from "@/types/artifacts";

interface ToolRunCardProps {
  run: ToolRun;
  isCompact?: boolean;
}

const statusConfig: Record<
  ToolRunStatus,
  { icon: LucideIcon; color: string; bgColor: string; label: string }
> = {
  pending: {
    icon: Clock,
    color: "text-ink-400",
    bgColor: "bg-ink-100",
    label: "Pending",
  },
  running: {
    icon: Loader2,
    color: "text-terminal-blue",
    bgColor: "bg-terminal-blue/10",
    label: "Running",
  },
  succeeded: {
    icon: CheckCircle,
    color: "text-terminal-green",
    bgColor: "bg-terminal-green/10",
    label: "Succeeded",
  },
  failed: {
    icon: XCircle,
    color: "text-red-500",
    bgColor: "bg-red-50",
    label: "Failed",
  },
  cancelled: {
    icon: XCircle,
    color: "text-terminal-amber",
    bgColor: "bg-terminal-amber/10",
    label: "Cancelled",
  },
};

const logLevelIcons = {
  info: Info,
  warn: AlertTriangle,
  error: XCircle,
};

const logLevelColors = {
  info: "text-ink-500",
  warn: "text-terminal-amber",
  error: "text-red-500",
};

export function ToolRunCard({ run, isCompact = false }: ToolRunCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedArgs, setCopiedArgs] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const config = statusConfig[run.status];
  const StatusIcon = config.icon;

  const duration = run.completedAt && run.startedAt
    ? `${((run.completedAt - run.startedAt) / 1000).toFixed(2)}s`
    : run.startedAt
      ? "..."
      : null;

  const handleCopyArgs = async () => {
    if (run.args) {
      try {
        await navigator.clipboard.writeText(JSON.stringify(run.args, null, 2));
        setCopiedArgs(true);
        setTimeout(() => setCopiedArgs(false), 2000);
      } catch {
        // Clipboard access denied or unavailable
      }
    }
  };

  const handleCopyOutput = async () => {
    if (run.output) {
      try {
        await navigator.clipboard.writeText(run.output);
        setCopiedOutput(true);
        setTimeout(() => setCopiedOutput(false), 2000);
      } catch {
        // Clipboard access denied or unavailable
      }
    }
  };

  if (isCompact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 transition-all",
          config.bgColor,
          "border-transparent"
        )}
      >
        <StatusIcon
          size={14}
          className={cn(config.color, run.status === "running" && "animate-spin")}
        />
        <span className="flex-1 truncate text-sm font-medium text-ink-700">
          {run.label}
        </span>
        {duration && (
          <span className="text-xs text-ink-400">{duration}</span>
        )}
      </div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-xl border border-ink-200 bg-white transition-all hover:border-ink-300"
    >
      {/* Header */}
      <div
        className="flex cursor-pointer items-center gap-3 p-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={cn("shrink-0 rounded-lg p-2", config.bgColor)}>
          <StatusIcon
            size={16}
            className={cn(config.color, run.status === "running" && "animate-spin")}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium text-ink-800">{run.label}</h3>
            <span className={cn("text-xs", config.color)}>{config.label}</span>
          </div>
          <p className="truncate text-xs text-ink-400">
            {run.name} • {formatRelativeTime(new Date(run.createdAt))}
            {duration && ` • ${duration}`}
          </p>
        </div>

        {/* Progress bar */}
        {run.status === "running" && run.progress !== null && (
          <div className="w-24">
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
              <motion.div
                className="h-full bg-terminal-blue"
                initial={{ width: 0 }}
                animate={{ width: `${run.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-ink-400">{run.progress}%</p>
          </div>
        )}

        <button
          className="shrink-0 rounded p-1.5 text-ink-400 transition-all hover:bg-ink-100"
        >
          <ChevronDown
            size={14}
            className={cn("transition-transform", isExpanded && "rotate-180")}
          />
        </button>
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Arguments */}
            {run.args && Object.keys(run.args).length > 0 && (
              <div className="border-t border-ink-100 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-medium text-ink-500">Arguments</h4>
                  <button
                    onClick={handleCopyArgs}
                    className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
                  >
                    {copiedArgs ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-ink-50 p-3 font-mono text-xs text-ink-700">
                  {JSON.stringify(run.args, null, 2)}
                </pre>
              </div>
            )}

            {/* Output */}
            {run.output && (
              <div className="border-t border-ink-100 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-medium text-ink-500">Output</h4>
                  <button
                    onClick={handleCopyOutput}
                    className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
                  >
                    {copiedOutput ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <pre className="max-h-48 overflow-auto rounded-lg bg-ink-50 p-3 font-mono text-xs text-ink-700">
                  {run.output}
                </pre>
              </div>
            )}

            {/* Error */}
            {run.error && (
              <div className="border-t border-ink-100 p-4">
                <h4 className="mb-2 text-xs font-medium text-red-500">Error</h4>
                <pre className="overflow-x-auto rounded-lg bg-red-50 p-3 font-mono text-xs text-red-600">
                  {run.error}
                </pre>
              </div>
            )}

            {/* Logs */}
            {run.logs.length > 0 && (
              <div className="border-t border-ink-100 p-4">
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-500">
                  <Terminal size={12} />
                  Logs ({run.logs.length})
                </h4>
                <div className="max-h-48 space-y-1 overflow-auto rounded-lg bg-ink-900 p-3">
                  {run.logs.map((log) => {
                    const LogIcon = logLevelIcons[log.level];
                    return (
                      <div key={log.id} className="flex items-start gap-2 font-mono text-xs">
                        <span className="shrink-0 text-ink-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <LogIcon
                          size={12}
                          className={cn("mt-0.5 shrink-0", logLevelColors[log.level])}
                        />
                        <span className="text-ink-300">{log.message}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
