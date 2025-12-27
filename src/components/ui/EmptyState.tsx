"use client";

import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-ink-100">
        <Icon size={28} className="text-ink-400" strokeWidth={1.5} />
      </div>
      <h3 className="mb-2 font-display text-lg font-semibold text-ink-800">{title}</h3>
      <p className="mb-6 max-w-sm text-sm leading-relaxed text-ink-500">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-700"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
