"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ExternalLink, Sparkles, Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn, truncate, formatTimestamp } from "@/lib/utils";
import { ActivityIcon, StatusDot } from "@/components/icons/ActivityIcons";
import type { ActivityItem as ActivityItemType } from "@/types";

interface ActivityItemProps {
  activity: ActivityItemType;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  showTimestamp?: boolean;
  compact?: boolean;
}

export function ActivityItem({
  activity,
  index,
  isExpanded,
  onToggle,
  showTimestamp = true,
  compact = false,
}: ActivityItemProps) {
  const [copied, setCopied] = useState(false);
  const hasChildren = activity.children && activity.children.length > 0;
  const isExpandable = hasChildren || activity.description;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `${activity.title}${activity.description ? `: ${activity.description}` : ""}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className={cn("group relative", compact ? "pb-2" : "pb-4")}
    >
      {/* Timeline connector line */}
      <div
        className={cn(
          "absolute left-[13px] top-9 w-px bg-gradient-to-b from-ink-200 to-transparent",
          compact ? "h-[calc(100%-16px)]" : "h-[calc(100%-20px)]"
        )}
      />

      <div className="relative flex gap-3">
        <ActivityIcon type={activity.type} />

        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <button
              onClick={onToggle}
              disabled={!isExpandable}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 text-left",
                isExpandable && "cursor-pointer"
              )}
            >
              <span
                className={cn(
                  "truncate font-mono text-sm text-ink-800",
                  activity.status === "running" && "font-medium"
                )}
              >
                {activity.title}
              </span>
              {activity.status === "running" && <StatusDot status="running" />}
              {isExpandable && (
                <ChevronDown
                  size={14}
                  className={cn(
                    "shrink-0 text-ink-400 transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )}
                />
              )}
            </button>

            <div className="flex shrink-0 items-center gap-1">
              {/* Copy button - visible on hover */}
              <button
                onClick={handleCopy}
                className="rounded p-1 text-ink-300 opacity-0 transition-all hover:bg-ink-100 hover:text-ink-500 group-hover:opacity-100"
                title="Copy"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>

              {showTimestamp && (
                <span className="font-mono text-xs text-ink-400">
                  {activity.duration || formatTimestamp(activity.timestamp)}
                </span>
              )}
            </div>
          </div>

          {/* Description preview when collapsed */}
          {!isExpanded && activity.description && (
            <p className="mt-0.5 truncate text-xs text-ink-400">
              {truncate(activity.description, 60)}
            </p>
          )}

          {/* Expandable content */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                {/* Description */}
                {activity.description && (
                  <p className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-ink-50 p-3 font-mono text-xs leading-relaxed text-ink-600">
                    {activity.description}
                  </p>
                )}

                {/* Children items */}
                {activity.children && activity.children.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {activity.children.map((child, childIndex) => (
                      <motion.div
                        key={child.id}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: childIndex * 0.05 }}
                        className="flex items-center gap-2"
                      >
                        {child.type === "knowledge" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-terminal-amber/10 px-2.5 py-1 font-mono text-xs text-terminal-amber">
                            <Sparkles size={12} />
                            {child.title}
                            {child.isExpanded !== undefined && (
                              <ChevronDown
                                size={12}
                                className={cn(
                                  "opacity-60 transition-transform",
                                  child.isExpanded && "rotate-180"
                                )}
                              />
                            )}
                          </span>
                        )}
                        {child.type === "file" && (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-ink-100 px-2.5 py-1 font-mono text-xs text-ink-700">
                            {truncate(child.title, 50)}
                          </span>
                        )}
                        {child.type === "info" && (
                          <span className="text-xs text-ink-500">{child.title}</span>
                        )}
                        {child.link && (
                          <a
                            href={child.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-terminal-blue hover:underline"
                          >
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
