"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn, parseMarkdownLine } from "@/lib/utils";
import type { Document } from "@/types";

interface DocumentViewerProps {
  document: Document;
  className?: string;
}

interface ParsedLine {
  type: "heading" | "bold" | "bullet" | "normal" | "empty";
  level?: number;
  content: string;
  raw: string;
}

function parseBoldText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-ink-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export function DocumentViewer({ document, className }: DocumentViewerProps) {
  const lines = useMemo(() => {
    return document.content.split("\n").map((line): ParsedLine => {
      if (line.trim() === "") {
        return { type: "empty", content: "", raw: line };
      }

      const parsed = parseMarkdownLine(line);
      return { ...parsed, raw: line };
    });
  }, [document.content]);

  return (
    <div className={cn("h-full overflow-auto bg-white p-6", className)}>
      {/* Document title */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-6 border-b border-ink-100 pb-4"
      >
        <h1 className="font-mono text-sm font-medium tracking-wide text-ink-500">
          {document.filename}
        </h1>
      </motion.div>

      {/* Document content */}
      <div className="space-y-1 font-mono text-sm leading-relaxed">
        {lines.map((line, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.01 }}
          >
            {line.type === "empty" && <div className="h-4" />}

            {line.type === "heading" && (
              <h2
                className={cn(
                  "font-semibold text-terminal-green",
                  line.level === 1 && "mb-3 mt-4 text-xl",
                  line.level === 2 && "mb-2 mt-3 text-lg",
                  line.level === 3 && "mb-2 mt-3 text-base"
                )}
              >
                {"#".repeat(line.level || 1)} {line.content}
              </h2>
            )}

            {line.type === "bold" && (
              <p className="text-ink-700">{parseBoldText(line.content)}</p>
            )}

            {line.type === "bullet" && (
              <div className="flex gap-2 pl-2 text-ink-700">
                <span className="text-ink-400">−</span>
                <span>{parseBoldText(line.content)}</span>
              </div>
            )}

            {line.type === "normal" && (
              <p className="text-ink-700">{line.content}</p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
