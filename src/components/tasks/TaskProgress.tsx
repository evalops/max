"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TaskItem } from "./TaskItem";
import type { Task } from "@/types";

interface TaskProgressProps {
  tasks: Task[];
  className?: string;
}

export function TaskProgress({ tasks, className }: TaskProgressProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount = tasks.length;

  return (
    <div className={cn("border-t border-ink-100 bg-white", className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-5 py-3 transition-colors hover:bg-paper-50"
      >
        <span className="font-display text-sm font-semibold text-ink-800">Task progress</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-ink-500">
            {completedCount}/{totalCount}
          </span>
          <ChevronDown
            size={16}
            className={cn(
              "text-ink-400 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Task list */}
      <motion.div
        initial={false}
        animate={{
          height: isExpanded ? "auto" : 0,
          opacity: isExpanded ? 1 : 0,
        }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="space-y-1 px-5 pb-4">
          {tasks.map((task, index) => (
            <TaskItem key={task.id} task={task} index={index} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
