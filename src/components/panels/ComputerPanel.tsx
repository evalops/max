"use client";

import { motion } from "framer-motion";
import {
  Monitor,
  Minimize2,
  Maximize2,
  X,
  FileEdit,
  Terminal,
  Globe,
  FolderOpen,
  DollarSign,
  Clock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { DocumentViewer } from "@/components/document/DocumentViewer";
import { TaskProgress } from "@/components/tasks/TaskProgress";
import { EmptyState, ThinkingIndicator } from "@/components/ui";
import type { AgentState, Document, Task } from "@/types";

interface ComputerPanelProps {
  agent: AgentState;
  document: Document | null;
  tasks: Task[];
  className?: string;
}

const activityIcons: Record<string, typeof FileEdit> = {
  Editor: FileEdit,
  Terminal: Terminal,
  Browser: Globe,
  "File Explorer": FolderOpen,
};

export function ComputerPanel({ agent, document, tasks, className }: ComputerPanelProps) {
  const { session, settings } = useAppStore();

  const ActivityIcon = activityIcons[agent.currentActivity] || FileEdit;

  return (
    <div className={cn("flex h-full flex-col overflow-hidden bg-ink-900", className)}>
      {/* Window header - dark theme */}
      <header className="flex shrink-0 items-center justify-between border-b border-ink-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <Monitor size={16} className="text-ink-400" />
          <span className="font-display text-sm font-medium text-paper-100">
            {agent.name}&apos;s Computer
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button className="rounded p-1 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-300">
            <Minimize2 size={14} />
          </button>
          <button className="rounded p-1 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-300">
            <Maximize2 size={14} />
          </button>
          <button className="rounded p-1 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-300">
            <X size={14} />
          </button>
        </div>
      </header>

      {/* Activity indicator bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-ink-700 bg-ink-800/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <ActivityIcon size={14} className="text-terminal-blue" />
            {agent.isThinking && (
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-terminal-amber"
              />
            )}
          </div>
          <span className="font-mono text-xs text-ink-300">
            {agent.name} is using{" "}
            <span className="text-paper-200">{agent.currentActivity}</span>
          </span>
        </div>
        {agent.currentFile && (
          <span className="max-w-[200px] truncate font-mono text-xs text-ink-400">
            {agent.currentFile}
          </span>
        )}
      </div>

      {/* Session stats bar (when live mode) */}
      {settings.dataMode === "live" && session.sessionId && (
        <div className="flex shrink-0 items-center gap-4 border-b border-ink-700 bg-ink-800 px-4 py-2">
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            <Clock size={12} />
            <span>
              {session.startTime
                ? `${Math.floor((Date.now() - session.startTime) / 1000)}s`
                : "--"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            <Zap size={12} />
            <span>{session.turnCount} turns</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            <DollarSign size={12} />
            <span>${session.totalCost.toFixed(4)}</span>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        {/* Document viewer or thinking state */}
        {agent.isThinking ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="size-12 rounded-full border-2 border-ink-200 border-t-terminal-blue"
            />
            <ThinkingIndicator text={session.currentTask ? "Working on task..." : "Thinking..."} />
            {session.currentTask && (
              <p className="max-w-sm text-center text-sm text-ink-400">
                {session.currentTask.length > 100
                  ? session.currentTask.substring(0, 100) + "..."
                  : session.currentTask}
              </p>
            )}
          </div>
        ) : document ? (
          <div className="flex-1 overflow-auto">
            <DocumentViewer document={document} />
          </div>
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="No document open"
            description="Documents and files created or viewed by Max will appear here."
            className="flex-1"
          />
        )}

        {/* Task progress footer */}
        {tasks.length > 0 && <TaskProgress tasks={tasks} />}
      </div>
    </div>
  );
}
