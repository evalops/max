"use client";

import { useState, useCallback, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Github,
  Mic,
  MicOff,
  Square,
  Zap,
  Send,
  Paperclip,
  Command,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GitHubImportModal } from "@/components/github";
import { useAppStore } from "@/store";

interface MessageInputProps {
  agentName: string;
  onSend: (message: string) => void;
  onStop?: () => void;
  isProcessing?: boolean;
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
  hasApiKey = false,
  className,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { settings } = useAppStore();

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

  const handleGitHubImport = (content: string) => {
    setMessage((prev) => prev + (prev ? "\n\n" : "") + content);
    inputRef.current?.focus();
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const fileInfo = `File: ${file.name}\n\`\`\`\n${content.substring(0, 10000)}${content.length > 10000 ? "\n... (truncated)" : ""}\n\`\`\``;
      setMessage((prev) => prev + (prev ? "\n\n" : "") + fileInfo);
      inputRef.current?.focus();
    };
    reader.readAsText(file);
    // Reset the input so the same file can be selected again
    e.target.value = "";
  };

  const toggleVoiceRecording = useCallback(() => {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in your browser. Try Chrome or Edge.");
      return;
    }

    if (isRecording) {
      // Stop recording
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    // Start recording
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }
      setMessage(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (finalTranscript.trim()) {
        setMessage(finalTranscript.trim());
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const canSend = message.trim() && hasApiKey;
  const hasGitHubToken = !!settings.githubToken;

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
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="shrink-0 rounded-md p-1 text-ink-400 transition-colors hover:bg-paper-200 hover:text-ink-600 disabled:cursor-not-allowed disabled:opacity-50"
          title="Attach file"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept=".txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.css,.scss,.html,.xml,.yaml,.yml,.toml,.sh,.bash"
          className="hidden"
        />

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
            !hasApiKey
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
            onClick={() => setShowGitHubModal(true)}
            disabled={isProcessing}
            className={cn(
              "rounded-md p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              hasGitHubToken
                ? "text-ink-400 hover:bg-paper-200 hover:text-ink-600"
                : "text-ink-300 opacity-50"
            )}
            title={hasGitHubToken ? "Import from GitHub" : "Add GitHub token in settings"}
          >
            <Github size={18} />
          </button>

          {/* Microphone button */}
          <button
            onClick={toggleVoiceRecording}
            disabled={isProcessing}
            className={cn(
              "rounded-md p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              isRecording
                ? "bg-red-100 text-red-500 hover:bg-red-200"
                : "text-ink-400 hover:bg-paper-200 hover:text-ink-600"
            )}
            title={isRecording ? "Stop recording" : "Voice input"}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
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
              title={canSend ? "Send (Enter)" : !hasApiKey ? "API key required" : "Type a message"}
            >
              <Send size={14} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Mode indicator and keyboard hint */}
      <div className="mt-3 flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              hasApiKey
                ? "bg-terminal-green/10 text-terminal-green"
                : "bg-terminal-amber/10 text-terminal-amber"
            )}
          >
            <Zap size={12} />
            {hasApiKey ? "Ready" : "API key required"}
          </span>
        </div>

        {/* Enter hint */}
        <div className="flex items-center gap-1 text-xs text-ink-300">
          <CornerDownLeft size={12} />
          <span>to send</span>
        </div>
      </div>

      {/* GitHub Import Modal */}
      <GitHubImportModal
        isOpen={showGitHubModal}
        onClose={() => setShowGitHubModal(false)}
        onImport={handleGitHubImport}
      />
    </div>
  );
}
