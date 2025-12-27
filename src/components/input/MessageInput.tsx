"use client";

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Github,
  Mic,
  Square,
  Zap,
  Database,
  Send,
  Paperclip,
  Command,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  agentName: string;
  onSend: (message: string) => void;
  onStop?: () => void;
  isProcessing?: boolean;
  isLiveMode?: boolean;
  hasApiKey?: boolean;
  className?: string;
}

const suggestedPrompts = [
  "Help me refactor this code",
  "Write tests for the utils",
  "Find and fix bugs",
  "Explain how this works",
];

export function MessageInput({
  agentName,
  onSend,
  onStop,
  isProcessing = false,
  isLiveMode = false,
  hasApiKey = false,
  className,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Cmd/Ctrl + K to focus input
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to blur
      if (e.key === "Escape") {
        inputRef.current?.blur();
        setShowSuggestions(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSend = useCallback(() => {
    if (message.trim() && !isProcessing) {
      onSend(message.trim());
      setMessage("");
      setShowSuggestions(false);
    }
  }, [message, onSend, isProcessing]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const canSend = message.trim() && (!isLiveMode || hasApiKey);

  return (
    <div className={cn("border-t border-paper-400/50 bg-paper-100 p-4", className)}>
      {/* Suggestions dropdown */}
      <AnimatePresence>
        {showSuggestions && !message && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-3 rounded-xl border border-paper-400 bg-white p-2 shadow-soft"
          >
            <p className="mb-2 px-2 text-xs font-medium text-ink-400">Suggestions</p>
            <div className="grid grid-cols-2 gap-1">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestionClick(prompt)}
                  className="rounded-lg px-3 py-2 text-left text-sm text-ink-600 transition-colors hover:bg-paper-100"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input container */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border bg-white px-4 py-2.5 shadow-soft transition-all",
          isProcessing
            ? "border-terminal-blue/30 ring-2 ring-terminal-blue/10"
            : "border-paper-400 focus-within:border-ink-300 focus-within:shadow-elevated"
        )}
      >
        {/* Attachment button */}
        <button
          className="shrink-0 rounded-md p-1 text-ink-400 transition-colors hover:bg-paper-200 hover:text-ink-600"
          title="Attach file"
        >
          <Paperclip size={18} />
        </button>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={
            isLiveMode && !hasApiKey
              ? "Add API key in settings to start..."
              : `Message ${agentName}...`
          }
          disabled={isProcessing}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Keyboard shortcut hint */}
          {!message && !isProcessing && (
            <div className="mr-2 hidden items-center gap-1 text-xs text-ink-300 sm:flex">
              <kbd className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[10px]">
                <Command size={10} className="inline" />K
              </kbd>
              <span>to focus</span>
            </div>
          )}

          {/* GitHub button */}
          <button
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-paper-200 hover:text-ink-600"
            title="Import from GitHub"
          >
            <Github size={18} />
          </button>

          {/* Microphone button */}
          <button
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-paper-200 hover:text-ink-600"
            title="Voice input"
          >
            <Mic size={18} />
          </button>

          {/* Stop/Send button */}
          {isProcessing ? (
            <motion.button
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              onClick={onStop}
              className="ml-1 flex size-8 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
              title="Stop"
            >
              <Square size={14} fill="currentColor" />
            </motion.button>
          ) : (
            <motion.button
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                "ml-1 flex size-8 items-center justify-center rounded-full transition-all",
                canSend
                  ? "bg-ink-900 text-white hover:bg-ink-700"
                  : "bg-ink-200 text-ink-400"
              )}
              title={canSend ? "Send (Enter)" : isLiveMode && !hasApiKey ? "API key required" : "Type a message"}
            >
              <Send size={14} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Mode indicator and keyboard hint */}
      <div className="mt-3 flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          {isLiveMode ? (
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                hasApiKey
                  ? "bg-terminal-green/10 text-terminal-green"
                  : "bg-terminal-amber/10 text-terminal-amber"
              )}
            >
              <Zap size={12} />
              {hasApiKey ? "Live" : "Live (No API key)"}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-terminal-blue/10 px-2.5 py-1 text-xs font-medium text-terminal-blue">
              <Database size={12} />
              Demo Mode
            </span>
          )}
        </div>

        {/* Enter hint */}
        <div className="flex items-center gap-1 text-xs text-ink-300">
          <CornerDownLeft size={12} />
          <span>to send</span>
        </div>
      </div>
    </div>
  );
}
