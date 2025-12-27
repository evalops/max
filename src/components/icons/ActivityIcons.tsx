"use client";

import {
  Terminal,
  Github,
  FileText,
  FilePlus,
  FileEdit,
  Brain,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityType } from "@/types";

interface ActivityIconProps {
  type: ActivityType;
  className?: string;
  size?: number;
}

const iconMap: Record<ActivityType, LucideIcon> = {
  command: Terminal,
  github: Github,
  file_read: FileText,
  file_write: FileEdit,
  file_create: FilePlus,
  thinking: Brain,
  knowledge: Sparkles,
  error: AlertCircle,
  success: CheckCircle2,
};

const colorMap: Record<ActivityType, string> = {
  command: "text-terminal-green",
  github: "text-ink-700",
  file_read: "text-terminal-blue",
  file_write: "text-terminal-purple",
  file_create: "text-terminal-purple",
  thinking: "text-terminal-amber",
  knowledge: "text-terminal-amber",
  error: "text-red-500",
  success: "text-terminal-green",
};

const bgMap: Record<ActivityType, string> = {
  command: "bg-terminal-green/10",
  github: "bg-ink-100",
  file_read: "bg-terminal-blue/10",
  file_write: "bg-terminal-purple/10",
  file_create: "bg-terminal-purple/10",
  thinking: "bg-terminal-amber/10",
  knowledge: "bg-terminal-amber/10",
  error: "bg-red-50",
  success: "bg-terminal-green/10",
};

export function ActivityIcon({ type, className, size = 16 }: ActivityIconProps) {
  const Icon = iconMap[type];

  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg",
        bgMap[type],
        className
      )}
    >
      <Icon size={size} className={cn(colorMap[type])} strokeWidth={1.75} />
    </div>
  );
}

export function StatusDot({
  status,
}: {
  status: "running" | "completed" | "error";
}) {
  return (
    <span
      className={cn("inline-block size-2 rounded-full", {
        "animate-pulse-subtle bg-terminal-blue": status === "running",
        "bg-status-success": status === "completed",
        "bg-red-500": status === "error",
      })}
    />
  );
}
