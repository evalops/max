"use client";

import { useRef, useEffect } from "react";
import {
  MoreHorizontal,
  Copy,
  Settings,
  Trash2,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useExpandable } from "@/hooks";
import { useAppStore } from "@/store";
import { ActivityItem } from "./ActivityItem";
import { StatusText } from "./StatusText";
import { EmptyState } from "@/components/ui";
import type { ActivityItem as ActivityItemType } from "@/types";

interface ActivityGroup {
  type: "activity" | "status";
  data: ActivityItemType | string;
}

interface ActivityPanelProps {
  activities: ActivityItemType[];
  statusTexts?: { afterId: string; text: string }[];
  agentName: string;
  version?: string;
  className?: string;
  onSettingsClick?: () => void;
}

export function ActivityPanel({
  activities,
  statusTexts = [],
  agentName,
  version = "v0.1",
  className,
  onSettingsClick,
}: ActivityPanelProps) {
  const { isExpanded, toggle, expandAll, collapseAll } = useExpandable();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { settings, clearActivities, clearStatusTexts, session } = useAppStore();

  // Auto-scroll to top when new activities are added
  useEffect(() => {
    if (settings.autoScroll && scrollRef.current && activities.length > 0) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activities.length, settings.autoScroll]);

  // Create a flat list that interleaves activities with status texts
  const items: ActivityGroup[] = [];

  activities.forEach((activity) => {
    items.push({ type: "activity", data: activity });

    // Check if there's a status text after this activity
    const statusText = statusTexts.find((st) => st.afterId === activity.id);
    if (statusText) {
      items.push({ type: "status", data: statusText.text });
    }
  });

  const handleCopyTranscript = async () => {
    try {
      const transcript = activities
        .map((a) => `[${a.type}] ${a.title}${a.description ? `: ${a.description}` : ""}`)
        .join("\n");
      await navigator.clipboard.writeText(transcript);
    } catch {
      // Clipboard access denied or unavailable
    }
  };

  const handleClearAll = () => {
    clearActivities();
    clearStatusTexts();
  };

  const allActivityIds = activities.map((a) => a.id);

  return (
    <div className={cn("flex h-full flex-col bg-paper-100", className)}>
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-paper-400/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-ink-800 to-ink-900">
            <span className="text-xs font-bold text-white">M</span>
          </div>
          <span className="font-display text-sm font-medium text-ink-800">{agentName}</span>
          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-500">
            {version}
          </span>
          <button
            className="ml-1 text-ink-400 hover:text-ink-600"
            aria-label="Agent options"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Session indicator */}
          {session.isRunning && (
            <div className="mr-2 flex items-center gap-1.5 rounded-full bg-terminal-green/10 px-2 py-1">
              <div className="size-1.5 animate-pulse rounded-full bg-terminal-green" />
              <span className="text-xs font-medium text-terminal-green">Running</span>
            </div>
          )}

          <button
            onClick={handleCopyTranscript}
            disabled={activities.length === 0}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-paper-300 hover:text-ink-600 disabled:opacity-50"
            title="Copy transcript"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={handleClearAll}
            disabled={activities.length === 0}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-paper-300 hover:text-ink-600 disabled:opacity-50"
            title="Clear activities"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onSettingsClick}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-paper-300 hover:text-ink-600"
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <div className="relative">
            <button
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-paper-300 hover:text-ink-600"
              title="More options"
              aria-label="More options"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Expand/Collapse controls */}
      {activities.length > 0 && (
        <div className="flex items-center justify-between border-b border-paper-400/30 px-4 py-2">
          <span className="text-xs text-ink-400">
            {activities.length} {activities.length === 1 ? "activity" : "activities"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => expandAll(allActivityIds)}
              className="text-xs text-ink-500 hover:text-ink-700"
              aria-label="Expand all activities"
            >
              Expand all
            </button>
            <span className="text-ink-300" aria-hidden="true">·</span>
            <button
              onClick={() => collapseAll()}
              className="text-xs text-ink-500 hover:text-ink-700"
              aria-label="Collapse all activities"
            >
              Collapse all
            </button>
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No activity yet"
            description="Send a message to Max to start a new task. Activity will appear here as the agent works."
            className="h-full"
          />
        ) : (
          <div className="p-4">
            <AnimatePresence initial={false}>
              {items.map((item, index) => {
                if (item.type === "status") {
                  return (
                    <StatusText
                      key={`status-${index}`}
                      text={item.data as string}
                      index={index}
                    />
                  );
                }

                const activity = item.data as ActivityItemType;
                return (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    index={index}
                    isExpanded={isExpanded(activity.id)}
                    onToggle={() => toggle(activity.id)}
                    showTimestamp={settings.showTimestamps}
                    compact={settings.compactMode}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
