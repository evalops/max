"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
  type DragEvent,
} from "react";
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
  X,
  FileCode,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GitHubImportModal } from "@/components/github";
import { useAppStore } from "@/store";

interface Attachment {
  id: string;
  name: string;
  content: string;
  type: "file" | "image" | "github";
  size: number;
}

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

// File extension to language mapping
const extToLang: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  cpp: "cpp",
  c: "c",
  h: "c",
  css: "css",
  scss: "scss",
  html: "html",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  sh: "bash",
};

const ACCEPTED_FILE_TYPES = [
  ".txt",
  ".md",
  ".json",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".css",
  ".scss",
  ".html",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".sh",
  ".bash",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
];

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const dragCounterRef = useRef(0);
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
      // Cmd/Ctrl + V for paste (handled natively, but we track it)
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        // Paste handling is done via onPaste event
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const formatAttachmentsForMessage = useCallback(() => {
    if (attachments.length === 0) return "";

    return attachments
      .map((att) => {
        if (att.type === "github") {
          return att.content;
        }
        const ext = att.name.split(".").pop() || "";
        const lang = extToLang[ext] || ext;
        if (att.type === "image") {
          return `[Image: ${att.name}]`;
        }
        return `**File: ${att.name}**\n\`\`\`${lang}\n${att.content}\n\`\`\``;
      })
      .join("\n\n");
  }, [attachments]);

  const handleSend = useCallback(() => {
    const attachmentContent = formatAttachmentsForMessage();
    const fullMessage = [message.trim(), attachmentContent].filter(Boolean).join("\n\n");

    if (fullMessage && !isProcessing) {
      onSend(fullMessage);
      setMessage("");
      setAttachments([]);
      setShowSuggestions(false);
    }
  }, [message, formatAttachmentsForMessage, onSend, isProcessing]);

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
    const id = `gh-${Date.now()}`;
    setAttachments((prev) => [
      ...prev,
      {
        id,
        name: "GitHub Import",
        content,
        type: "github",
        size: content.length,
      },
    ]);
    inputRef.current?.focus();
  };

  const processFile = async (file: File): Promise<Attachment | null> => {
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    const isImage = IMAGE_EXTENSIONS.includes(ext);

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const truncatedContent = isImage
          ? content
          : content.substring(0, 15000) + (content.length > 15000 ? "\n... (truncated)" : "");

        resolve({
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          content: truncatedContent,
          type: isImage ? "image" : "file",
          size: file.size,
        });
      };
      reader.onerror = () => resolve(null);

      if (isImage) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      const attachment = await processFile(file);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    inputRef.current?.focus();
    e.target.value = "";
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
      if (ACCEPTED_FILE_TYPES.includes(ext)) {
        const attachment = await processFile(file);
        if (attachment) {
          newAttachments.push(attachment);
        }
      }
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];

    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      const newAttachments: Attachment[] = [];
      for (const file of files) {
        const attachment = await processFile(file);
        if (attachment) {
          newAttachments.push(attachment);
        }
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  const toggleVoiceRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in your browser. Try Chrome or Edge.");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings.voiceLanguage;

    let finalTranscript = message; // Start with existing message

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? " " : "") + transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      setMessage(finalTranscript + (interimTranscript ? " " + interimTranscript : ""));
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording, message, settings.voiceLanguage]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const canSend = (message.trim() || attachments.length > 0) && hasApiKey;
  const hasGitHubToken = !!settings.githubToken;

  const getAttachmentIcon = (att: Attachment) => {
    if (att.type === "image") return <ImageIcon size={12} />;
    if (att.type === "github") return <Github size={12} />;
    return <FileCode size={12} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={cn("border-t border-paper-400/50 bg-paper-100 p-4", className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-terminal-blue/10"
          >
            <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-terminal-blue bg-white p-8 shadow-lg">
              <Upload size={48} className="text-terminal-blue" />
              <span className="text-lg font-medium text-terminal-blue">Drop files to attach</span>
              <span className="text-sm text-ink-500">Supports code files, text, and images</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachments */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => (
                <motion.div
                  key={att.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={cn(
                    "group relative flex items-center gap-2 rounded-lg border",
                    att.type === "image"
                      ? "border-terminal-purple/30 bg-terminal-purple/5 p-1"
                      : att.type === "github"
                        ? "border-ink-300 bg-ink-50 px-3 py-1.5"
                        : "border-terminal-green/30 bg-terminal-green/5 px-3 py-1.5"
                  )}
                >
                  {att.type === "image" ? (
                    <>
                      {/* Image thumbnail */}
                      <img
                        src={att.content}
                        alt={att.name}
                        className="size-12 rounded object-cover"
                      />
                      <div className="flex flex-col gap-0.5 pr-6">
                        <span className="max-w-24 truncate text-xs font-medium text-ink-700">
                          {att.name}
                        </span>
                        <span className="text-[10px] text-ink-400">{formatFileSize(att.size)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span
                        className={cn(
                          att.type === "github" ? "text-ink-600" : "text-terminal-green"
                        )}
                      >
                        {getAttachmentIcon(att)}
                      </span>
                      <span className="max-w-32 truncate text-xs font-medium text-ink-700">
                        {att.name}
                      </span>
                      <span className="text-xs text-ink-400">{formatFileSize(att.size)}</span>
                    </>
                  )}
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className={cn(
                      "rounded p-0.5 text-ink-400 opacity-0 transition-all hover:bg-ink-200 hover:text-ink-600 group-hover:opacity-100",
                      att.type === "image" && "absolute right-1 top-1 bg-white/80"
                    )}
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {showSuggestions && !message && attachments.length === 0 && (
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
            : isDragging
              ? "border-terminal-blue ring-2 ring-terminal-blue/20"
              : "border-paper-400 focus-within:border-ink-300 focus-within:shadow-elevated"
        )}
      >
        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="shrink-0 rounded-md p-1 text-ink-400 transition-colors hover:bg-paper-200 hover:text-ink-600 disabled:cursor-not-allowed disabled:opacity-50"
          title="Attach files (or drag & drop)"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept={ACCEPTED_FILE_TYPES.join(",")}
          multiple
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
          onPaste={handlePaste}
          placeholder={
            !hasApiKey
              ? "Add API key in settings to start..."
              : attachments.length > 0
                ? "Add a message or send attachments..."
                : `Message ${agentName}...`
          }
          disabled={isProcessing}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Keyboard shortcut hint */}
          {!message && !isProcessing && attachments.length === 0 && (
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
                canSend ? "bg-ink-900 text-white hover:bg-ink-700" : "bg-ink-200 text-ink-400"
              )}
              title={
                canSend
                  ? "Send (Enter)"
                  : !hasApiKey
                    ? "API key required"
                    : "Type a message or attach files"
              }
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

          {/* Recording indicator */}
          {isRecording && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-600"
            >
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="size-2 rounded-full bg-red-500"
              />
              Recording...
            </motion.span>
          )}

          {/* Attachment count */}
          {attachments.length > 0 && !isRecording && (
            <span className="flex items-center gap-1.5 rounded-full bg-terminal-blue/10 px-2.5 py-1 text-xs font-medium text-terminal-blue">
              <Paperclip size={12} />
              {attachments.length} file{attachments.length > 1 ? "s" : ""}
            </span>
          )}
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
