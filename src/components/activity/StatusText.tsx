"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatusTextProps {
  text: string;
  index: number;
  className?: string;
}

export function StatusText({ text, index, className }: StatusTextProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 + 0.1 }}
      className={cn("py-3 pl-10", className)}
    >
      <p className="text-sm leading-relaxed text-ink-600">{text}</p>
    </motion.div>
  );
}
