"use client";

import { motion } from "framer-motion";
import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

interface TaskItemProps {
  task: Task;
  index: number;
}

export function TaskItem({ task, index }: TaskItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-3 py-1.5"
    >
      {/* Status indicator */}
      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
        {task.status === "completed" && (
          <div className="flex size-5 items-center justify-center rounded-full bg-status-success">
            <Check size={12} className="text-white" strokeWidth={3} />
          </div>
        )}
        {task.status === "in_progress" && (
          <div className="relative flex size-5 items-center justify-center">
            <div className="absolute size-5 animate-ping rounded-full bg-status-pending opacity-20" />
            <div className="size-2.5 rounded-full bg-status-pending" />
          </div>
        )}
        {task.status === "pending" && (
          <div className="flex size-5 items-center justify-center text-status-waiting">
            <Clock size={14} strokeWidth={2} />
          </div>
        )}
      </div>

      {/* Task content */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-tight",
            task.status === "completed" && "text-ink-500",
            task.status === "in_progress" && "font-medium text-ink-800",
            task.status === "pending" && "text-ink-500"
          )}
        >
          {task.title}
        </p>
        {task.status === "in_progress" && task.duration && (
          <p className="mt-0.5 flex items-center gap-2 font-mono text-xs text-ink-400">
            <span>{task.duration}</span>
            {task.statusText && (
              <>
                <span className="text-ink-300">·</span>
                <span className="animate-typing">{task.statusText}</span>
              </>
            )}
          </p>
        )}
      </div>
    </motion.div>
  );
}
