"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  FileCode,
  FileJson,
  File,
  ChevronDown,
  Download,
  Trash2,
  History,
  Copy,
  Check,
  Clock,
  Tag,
} from "lucide-react";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";
import { getArtifactRevisions } from "@/lib/storage";
import type { Artifact, ArtifactRevision, ArtifactKind } from "@/types/artifacts";

interface ArtifactCardProps {
  artifact: Artifact;
  onDelete?: (id: string) => void;
  onRestore?: (revisionId: string) => void;
  onSelect?: (artifact: Artifact) => void;
  isSelected?: boolean;
}

const kindIcons: Record<ArtifactKind, typeof FileText> = {
  text: FileText,
  markdown: FileText,
  html: FileCode,
  code: FileCode,
  json: FileJson,
  image: File,
};

const kindColors: Record<ArtifactKind, string> = {
  text: "text-ink-500",
  markdown: "text-terminal-blue",
  html: "text-terminal-purple",
  code: "text-terminal-green",
  json: "text-terminal-amber",
  image: "text-pink-500",
};

export function ArtifactCard({
  artifact,
  onDelete,
  onRestore,
  onSelect,
  isSelected,
}: ArtifactCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<ArtifactRevision[]>([]);
  const [copied, setCopied] = useState(false);

  const Icon = kindIcons[artifact.kind] || File;
  const iconColor = kindColors[artifact.kind] || "text-ink-500";

  const handleToggleHistory = () => {
    if (!showHistory) {
      // Lazy load revisions
      const revs = getArtifactRevisions(artifact.id);
      setRevisions(revs);
    }
    setShowHistory(!showHistory);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied or unavailable
    }
  };

  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: artifact.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Truncate preview
  const previewLines = artifact.content.split("\n").slice(0, 12);
  const previewContent = previewLines.join("\n");
  const isTruncated = artifact.content.split("\n").length > 12 || artifact.content.length > 800;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group rounded-xl border bg-white transition-all",
        isSelected
          ? "border-terminal-blue ring-2 ring-terminal-blue/20"
          : "border-ink-200 hover:border-ink-300"
      )}
    >
      {/* Header */}
      <div
        className="flex cursor-pointer items-center gap-3 p-4"
        onClick={() => onSelect?.(artifact)}
      >
        <div className={cn("shrink-0", iconColor)}>
          <Icon size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium text-ink-800">{artifact.title}</h3>
            {artifact.language && (
              <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-500">
                {artifact.language}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-ink-400">{artifact.filename}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="rounded p-1.5 text-ink-400 opacity-0 transition-all hover:bg-ink-100 hover:text-ink-600 group-hover:opacity-100"
            title="Copy content"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="rounded p-1.5 text-ink-400 opacity-0 transition-all hover:bg-ink-100 hover:text-ink-600 group-hover:opacity-100"
            title="Download"
          >
            <Download size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleHistory();
            }}
            className="rounded p-1.5 text-ink-400 opacity-0 transition-all hover:bg-ink-100 hover:text-ink-600 group-hover:opacity-100"
            title="History"
          >
            <History size={14} />
          </button>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(artifact.id);
              }}
              className="rounded p-1.5 text-ink-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="ml-1 rounded p-1.5 text-ink-400 transition-all hover:bg-ink-100 hover:text-ink-600"
          >
            <ChevronDown
              size={14}
              className={cn("transition-transform", isExpanded && "rotate-180")}
            />
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 px-4 py-2 text-xs text-ink-400">
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {formatRelativeTime(new Date(artifact.updatedAt))}
        </span>
        {artifact.tags && artifact.tags.length > 0 && (
          <span className="flex items-center gap-1">
            <Tag size={12} />
            {artifact.tags.slice(0, 3).join(", ")}
            {artifact.tags.length > 3 && ` +${artifact.tags.length - 3}`}
          </span>
        )}
        {artifact.agentContext?.intent && (
          <span className="rounded bg-terminal-amber/10 px-1.5 py-0.5 text-terminal-amber">
            {artifact.agentContext.intent}
          </span>
        )}
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Preview */}
            <div className="border-t border-ink-100 p-4">
              <pre className="overflow-x-auto rounded-lg bg-ink-50 p-3 font-mono text-xs leading-relaxed text-ink-700">
                {truncate(previewContent, 800)}
                {isTruncated && (
                  <span className="text-ink-400">
                    {"\n"}... ({artifact.content.length} chars total)
                  </span>
                )}
              </pre>
            </div>

            {/* Agent context */}
            {artifact.agentContext && (
              <div className="border-t border-ink-100 p-4">
                <h4 className="mb-2 text-xs font-medium text-ink-500">Agent Context</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {artifact.agentContext.persona && (
                    <div>
                      <span className="text-ink-400">Persona:</span>{" "}
                      <span className="text-ink-600">{artifact.agentContext.persona}</span>
                    </div>
                  )}
                  {artifact.agentContext.intent && (
                    <div>
                      <span className="text-ink-400">Intent:</span>{" "}
                      <span className="text-ink-600">{artifact.agentContext.intent}</span>
                    </div>
                  )}
                  {artifact.agentContext.confidence !== undefined && (
                    <div>
                      <span className="text-ink-400">Confidence:</span>{" "}
                      <span className="text-ink-600">
                        {Math.round(artifact.agentContext.confidence * 100)}%
                      </span>
                    </div>
                  )}
                </div>
                {artifact.agentContext.reasoning && (
                  <p className="mt-2 text-xs italic text-ink-500">
                    {artifact.agentContext.reasoning}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Revision history */}
        {showHistory && revisions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-ink-100"
          >
            <div className="p-4">
              <h4 className="mb-3 text-xs font-medium text-ink-500">
                Revision History ({revisions.length})
              </h4>
              <div className="space-y-2">
                {revisions.slice(0, 5).map((rev) => (
                  <div
                    key={rev.id}
                    className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2"
                  >
                    <div className="text-xs">
                      <span className="font-medium text-ink-600">{rev.source}</span>
                      <span className="ml-2 text-ink-400">
                        {formatRelativeTime(new Date(rev.createdAt))}
                      </span>
                    </div>
                    {onRestore && (
                      <button
                        onClick={() => onRestore(rev.id)}
                        className="text-xs text-terminal-blue hover:underline"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                ))}
                {revisions.length > 5 && (
                  <p className="text-xs text-ink-400">
                    +{revisions.length - 5} more revisions
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
