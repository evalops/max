"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Play,
  Code,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Image as ImageIcon,
  Table,
} from "lucide-react";

interface NotebookCell {
  cell_type: "code" | "markdown";
  source: string | string[];
  execution_count?: number | null;
  outputs?: NotebookOutput[];
  metadata?: Record<string, unknown>;
  id?: string;
}

interface NotebookOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  name?: string; // stdout, stderr
  text?: string | string[];
  data?: Record<string, string | string[]>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

interface NotebookData {
  cells: NotebookCell[];
  metadata?: {
    kernelspec?: {
      display_name: string;
      language: string;
      name: string;
    };
    language_info?: {
      name: string;
      version?: string;
    };
  };
  nbformat: number;
  nbformat_minor: number;
}

interface NotebookViewerProps {
  notebook: NotebookData | string;
  theme?: "light" | "dark";
  showLineNumbers?: boolean;
  collapsible?: boolean;
  maxHeight?: string;
  className?: string;
}

function normalizeSource(source: string | string[]): string {
  return Array.isArray(source) ? source.join("") : source;
}

function MarkdownCell({ source }: { source: string }) {
  // Simple markdown rendering (could be enhanced with a proper markdown parser)
  const html = source
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-3">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono">$1</code>')
    .replace(/\n/g, '<br/>');

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none py-2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function CodeCell({
  source,
  executionCount,
  outputs,
  theme,
  showLineNumbers,
}: {
  source: string;
  executionCount?: number | null;
  outputs?: NotebookOutput[];
  theme: "light" | "dark";
  showLineNumbers: boolean;
}) {
  const [isOutputExpanded, setIsOutputExpanded] = useState(true);
  const hasOutputs = outputs && outputs.length > 0;

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      {/* Code input */}
      <div className="flex">
        <div className="w-12 flex-shrink-0 bg-zinc-50 dark:bg-zinc-800 flex items-start justify-center py-2 border-r border-zinc-200 dark:border-zinc-700">
          <span className="text-xs text-zinc-400 font-mono">
            [{executionCount ?? " "}]
          </span>
        </div>
        <div className="flex-1 overflow-x-auto">
          <SyntaxHighlighter
            language="python"
            style={theme === "dark" ? oneDark : oneLight}
            showLineNumbers={showLineNumbers}
            customStyle={{
              margin: 0,
              padding: "0.75rem",
              background: "transparent",
              fontSize: "0.8rem",
            }}
          >
            {source}
          </SyntaxHighlighter>
        </div>
      </div>

      {/* Outputs */}
      {hasOutputs && (
        <div className="border-t border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setIsOutputExpanded(!isOutputExpanded)}
            className="w-full flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-xs text-zinc-500"
          >
            {isOutputExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Output ({outputs.length})
          </button>

          <AnimatePresence>
            {isOutputExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 space-y-2 max-h-96 overflow-auto bg-white dark:bg-zinc-900">
                  {outputs.map((output, i) => (
                    <OutputRenderer key={i} output={output} theme={theme} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function OutputRenderer({ output, theme }: { output: NotebookOutput; theme: "light" | "dark" }) {
  if (output.output_type === "stream") {
    const text = normalizeSource(output.text || "");
    const isError = output.name === "stderr";

    return (
      <pre
        className={`text-xs font-mono p-2 rounded overflow-x-auto ${
          isError
            ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
            : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        }`}
      >
        {text}
      </pre>
    );
  }

  if (output.output_type === "error") {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded p-3">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium text-sm mb-2">
          <AlertCircle size={14} />
          {output.ename}: {output.evalue}
        </div>
        {output.traceback && (
          <pre className="text-xs font-mono text-red-700 dark:text-red-300 overflow-x-auto">
            {output.traceback.join("\n").replace(/\x1b\[[0-9;]*m/g, "")}
          </pre>
        )}
      </div>
    );
  }

  if (output.output_type === "execute_result" || output.output_type === "display_data") {
    const data = output.data || {};

    // Image output
    if (data["image/png"] || data["image/jpeg"]) {
      const imgData = data["image/png"] || data["image/jpeg"];
      const imgSrc = `data:image/${data["image/png"] ? "png" : "jpeg"};base64,${
        Array.isArray(imgData) ? imgData.join("") : imgData
      }`;

      return (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <ImageIcon size={12} />
            <span>Image output</span>
          </div>
          <img
            src={imgSrc}
            alt="Cell output"
            className="max-w-full h-auto rounded border border-zinc-200 dark:border-zinc-700"
          />
        </div>
      );
    }

    // HTML output
    if (data["text/html"]) {
      const html = normalizeSource(data["text/html"]);
      return (
        <div className="overflow-x-auto">
          <div className="flex items-center gap-1 text-xs text-zinc-500 mb-2">
            <Table size={12} />
            <span>HTML output</span>
          </div>
          <div
            className="prose prose-sm dark:prose-invert max-w-none notebook-html-output"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      );
    }

    // Plain text output
    if (data["text/plain"]) {
      const text = normalizeSource(data["text/plain"]);
      return (
        <pre className="text-xs font-mono p-2 rounded bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 overflow-x-auto">
          {text}
        </pre>
      );
    }
  }

  return null;
}

export function NotebookViewer({
  notebook,
  theme = "light",
  showLineNumbers = true,
  collapsible = true,
  maxHeight,
  className = "",
}: NotebookViewerProps) {
  const [collapsedCells, setCollapsedCells] = useState<Set<number>>(new Set());

  const notebookData: NotebookData | null = useMemo(() => {
    if (typeof notebook === "string") {
      try {
        return JSON.parse(notebook);
      } catch {
        return null;
      }
    }
    return notebook;
  }, [notebook]);

  if (!notebookData) {
    return (
      <div className={`p-4 text-center text-zinc-500 ${className}`}>
        Failed to parse notebook
      </div>
    );
  }

  const kernel = notebookData.metadata?.kernelspec?.display_name || "Unknown Kernel";
  const _language = notebookData.metadata?.language_info?.name || "python";

  const toggleCell = (index: number) => {
    setCollapsedCells((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div
      className={`bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 ${className}`}
      style={maxHeight ? { maxHeight, overflow: "auto" } : undefined}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2 text-sm">
          <FileText size={16} className="text-orange-500" />
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Jupyter Notebook
          </span>
          <span className="text-xs text-zinc-500 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded">
            {kernel}
          </span>
        </div>
        <div className="text-xs text-zinc-500">
          {notebookData.cells.length} cells
        </div>
      </div>

      {/* Cells */}
      <div className="p-4 space-y-3">
        {notebookData.cells.map((cell, index) => {
          const source = normalizeSource(cell.source);
          const isCollapsed = collapsedCells.has(index);

          if (collapsible) {
            return (
              <div key={cell.id || index} className="group">
                <button
                  onClick={() => toggleCell(index)}
                  className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 mb-1"
                >
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <span className="flex items-center gap-1">
                    {cell.cell_type === "code" ? (
                      <>
                        <Code size={10} />
                        <span>Code</span>
                        {cell.execution_count && (
                          <span className="text-zinc-500">[{cell.execution_count}]</span>
                        )}
                      </>
                    ) : (
                      <>
                        <FileText size={10} />
                        <span>Markdown</span>
                      </>
                    )}
                  </span>
                </button>

                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      {cell.cell_type === "code" ? (
                        <CodeCell
                          source={source}
                          executionCount={cell.execution_count}
                          outputs={cell.outputs}
                          theme={theme}
                          showLineNumbers={showLineNumbers}
                        />
                      ) : (
                        <div className="pl-4 border-l-2 border-zinc-200 dark:border-zinc-700">
                          <MarkdownCell source={source} />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          return (
            <div key={cell.id || index}>
              {cell.cell_type === "code" ? (
                <CodeCell
                  source={source}
                  executionCount={cell.execution_count}
                  outputs={cell.outputs}
                  theme={theme}
                  showLineNumbers={showLineNumbers}
                />
              ) : (
                <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <MarkdownCell source={source} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { NotebookData, NotebookCell, NotebookOutput };
