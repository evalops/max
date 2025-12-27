"use client";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
};

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-ink-200 border-t-terminal-blue",
        sizes[size],
        className
      )}
    />
  );
}

export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-ink-400"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

export function ThinkingIndicator({ text = "Thinking" }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-500">
      <LoadingSpinner size="sm" />
      <span className="animate-pulse">{text}</span>
    </div>
  );
}
