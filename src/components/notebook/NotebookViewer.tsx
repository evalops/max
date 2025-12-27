"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  Code,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Image as ImageIcon,
  Table,
  Copy,
  Check,
  ChevronsDown,
  ChevronsUp,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Terminal,
  Hash,
} from "lucide-react";

// ANSI color codes to CSS classes
const ANSI_COLORS: Record<string, string> = {
  "30": "text-zinc-900 dark:text-zinc-100",
  "31": "text-red-600 dark:text-red-400",
  "32": "text-green-600 dark:text-green-400",
  "33": "text-yellow-600 dark:text-yellow-400",
  "34": "text-blue-600 dark:text-blue-400",
  "35": "text-purple-600 dark:text-purple-400",
  "36": "text-cyan-600 dark:text-cyan-400",
  "37": "text-zinc-600 dark:text-zinc-300",
  "90": "text-zinc-500",
  "91": "text-red-500",
  "92": "text-green-500",
  "93": "text-yellow-500",
  "94": "text-blue-500",
  "95": "text-purple-500",
  "96": "text-cyan-500",
  "97": "text-zinc-400",
};

const ANSI_BG_COLORS: Record<string, string> = {
  "40": "bg-zinc-900",
  "41": "bg-red-900/50",
  "42": "bg-green-900/50",
  "43": "bg-yellow-900/50",
  "44": "bg-blue-900/50",
  "45": "bg-purple-900/50",
  "46": "bg-cyan-900/50",
  "47": "bg-zinc-100 dark:bg-zinc-800",
};

interface NotebookCell {
  cell_type: "code" | "markdown" | "raw";
  source: string | string[];
  execution_count?: number | null;
  outputs?: NotebookOutput[];
  metadata?: {
    execution?: {
      "iopub.execute_input"?: string;
      "iopub.status.busy"?: string;
      "iopub.status.idle"?: string;
      "shell.execute_reply"?: string;
    };
    scrolled?: boolean;
    tags?: string[];
    [key: string]: unknown;
  };
  id?: string;
}

interface NotebookOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  name?: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
  execution_count?: number;
  metadata?: Record<string, unknown>;
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
      file_extension?: string;
      mimetype?: string;
    };
    title?: string;
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
  filename?: string;
}

function normalizeSource(source: string | string[]): string {
  return Array.isArray(source) ? source.join("") : source;
}

// Parse ANSI escape codes and convert to styled spans
function parseAnsiText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentClasses: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the escape code
    if (match.index > lastIndex) {
      const segment = text.slice(lastIndex, match.index);
      if (currentClasses.length > 0) {
        parts.push(
          <span key={parts.length} className={currentClasses.join(" ")}>
            {segment}
          </span>
        );
      } else {
        parts.push(segment);
      }
    }

    // Parse the escape codes
    const codes = match[1].split(";").filter(Boolean);
    for (const code of codes) {
      if (code === "0") {
        currentClasses = [];
      } else if (code === "1") {
        currentClasses.push("font-bold");
      } else if (code === "3") {
        currentClasses.push("italic");
      } else if (code === "4") {
        currentClasses.push("underline");
      } else if (ANSI_COLORS[code]) {
        // Remove any existing text color
        currentClasses = currentClasses.filter((c) => !c.startsWith("text-"));
        currentClasses.push(ANSI_COLORS[code]);
      } else if (ANSI_BG_COLORS[code]) {
        currentClasses = currentClasses.filter((c) => !c.startsWith("bg-"));
        currentClasses.push(ANSI_BG_COLORS[code]);
      }
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const segment = text.slice(lastIndex);
    if (currentClasses.length > 0) {
      parts.push(
        <span key={parts.length} className={currentClasses.join(" ")}>
          {segment}
        </span>
      );
    } else {
      parts.push(segment);
    }
  }

  return parts.length > 0 ? parts : [text];
}

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded transition-colors ${
        copied
          ? "text-green-500 bg-green-500/10"
          : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      } ${className}`}
      title={copied ? "Copied!" : "Copy code"}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function ExecutionIndicator({
  executionCount,
  hasError,
  executionTime,
}: {
  executionCount?: number | null;
  hasError?: boolean;
  executionTime?: string;
}) {
  const Icon = hasError ? XCircle : executionCount ? CheckCircle2 : Clock;
  const color = hasError
    ? "text-red-500"
    : executionCount
      ? "text-green-500"
      : "text-zinc-400";

  return (
    <div className="flex items-center gap-1.5">
      <Icon size={12} className={color} />
      <span className="font-mono text-xs text-zinc-400">
        [{executionCount ?? " "}]
      </span>
      {executionTime && (
        <span className="text-[10px] text-zinc-400">
          {executionTime}
        </span>
      )}
    </div>
  );
}

function MarkdownCell({ source, theme }: { source: string; theme: "light" | "dark" }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none py-2 prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-pre:bg-zinc-100 dark:prose-pre:bg-zinc-800 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;

            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <SyntaxHighlighter
                language={match[1]}
                style={theme === "dark" ? oneDark : oneLight}
                customStyle={{
                  margin: 0,
                  padding: "0.75rem",
                  fontSize: "0.8rem",
                  borderRadius: "0.375rem",
                }}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
                {children}
              </td>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {children}
              </a>
            );
          },
          img({ src, alt }) {
            return (
              <img
                src={src}
                alt={alt || ""}
                className="max-w-full h-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
              />
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 italic text-zinc-600 dark:text-zinc-400">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

function CodeCell({
  source,
  executionCount,
  outputs,
  theme,
  showLineNumbers,
  language,
  cellIndex,
}: {
  source: string;
  executionCount?: number | null;
  outputs?: NotebookOutput[];
  theme: "light" | "dark";
  showLineNumbers: boolean;
  language: string;
  cellIndex: number;
}) {
  const [isOutputExpanded, setIsOutputExpanded] = useState(true);
  const hasOutputs = outputs && outputs.length > 0;
  const hasError = outputs?.some((o) => o.output_type === "error");

  return (
    <div className={`rounded-lg overflow-hidden border ${
      hasError
        ? "border-red-300 dark:border-red-800"
        : "border-zinc-200 dark:border-zinc-700"
    }`}>
      {/* Code input */}
      <div className="flex group relative">
        <div className={`w-14 shrink-0 flex flex-col items-center py-2 border-r ${
          hasError
            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
        }`}>
          <ExecutionIndicator executionCount={executionCount} hasError={hasError} />
        </div>
        <div className="flex-1 overflow-x-auto relative">
          <SyntaxHighlighter
            language={language}
            style={theme === "dark" ? oneDark : oneLight}
            showLineNumbers={showLineNumbers}
            lineNumberStyle={{
              minWidth: "2.5em",
              paddingRight: "1em",
              color: theme === "dark" ? "#52525b" : "#a1a1aa",
              userSelect: "none",
            }}
            customStyle={{
              margin: 0,
              padding: "0.75rem",
              background: "transparent",
              fontSize: "0.8rem",
            }}
          >
            {source}
          </SyntaxHighlighter>
          <CopyButton
            text={source}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </div>

      {/* Outputs */}
      {hasOutputs && (
        <div className={`border-t ${
          hasError ? "border-red-200 dark:border-red-800" : "border-zinc-200 dark:border-zinc-700"
        }`}>
          <button
            onClick={() => setIsOutputExpanded(!isOutputExpanded)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-xs ${
              hasError
                ? "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                : "bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
            }`}
          >
            {isOutputExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Terminal size={12} />
            <span>Output</span>
            {outputs.length > 1 && <span className="text-zinc-400">({outputs.length})</span>}
          </button>

          <AnimatePresence>
            {isOutputExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="p-3 space-y-2 max-h-[500px] overflow-auto bg-white dark:bg-zinc-900">
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
        className={`text-xs font-mono p-3 rounded overflow-x-auto whitespace-pre-wrap ${
          isError
            ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
            : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        }`}
      >
        {parseAnsiText(text)}
      </pre>
    );
  }

  if (output.output_type === "error") {
    return (
      <div className="rounded-lg overflow-hidden border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium text-sm border-b border-red-200 dark:border-red-800">
          <AlertCircle size={14} />
          <span>{output.ename}</span>
          {output.evalue && (
            <span className="font-normal text-red-600 dark:text-red-400">: {output.evalue}</span>
          )}
        </div>
        {output.traceback && output.traceback.length > 0 && (
          <pre className="text-xs font-mono p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 overflow-x-auto whitespace-pre-wrap">
            {output.traceback.map((line, i) => (
              <div key={i}>{parseAnsiText(line)}</div>
            ))}
          </pre>
        )}
      </div>
    );
  }

  if (output.output_type === "execute_result" || output.output_type === "display_data") {
    const data = output.data || {};

    // SVG output
    if (data["image/svg+xml"]) {
      const svg = normalizeSource(data["image/svg+xml"]);
      return (
        <div className="flex flex-col items-center gap-2">
          <div
            className="max-w-full overflow-auto rounded border border-zinc-200 dark:border-zinc-700 bg-white p-2"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      );
    }

    // Image output (PNG/JPEG/GIF)
    if (data["image/png"] || data["image/jpeg"] || data["image/gif"]) {
      const format = data["image/png"] ? "png" : data["image/jpeg"] ? "jpeg" : "gif";
      const imgData = data[`image/${format}`];
      const imgSrc = `data:image/${format};base64,${
        Array.isArray(imgData) ? imgData.join("") : imgData
      }`;

      return (
        <div className="flex flex-col items-center gap-2">
          <img
            src={imgSrc}
            alt="Cell output"
            className="max-w-full h-auto rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm"
          />
        </div>
      );
    }

    // LaTeX output
    if (data["text/latex"]) {
      const latex = normalizeSource(data["text/latex"]);
      return (
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded overflow-x-auto">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {latex}
          </ReactMarkdown>
        </div>
      );
    }

    // HTML output
    if (data["text/html"]) {
      const html = normalizeSource(data["text/html"]);
      return (
        <div className="overflow-x-auto">
          <div
            className="prose prose-sm dark:prose-invert max-w-none notebook-html-output [&_table]:border-collapse [&_table]:w-full [&_th]:bg-zinc-100 [&_th]:dark:bg-zinc-800 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:border [&_th]:border-zinc-200 [&_th]:dark:border-zinc-700 [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_td]:border [&_td]:border-zinc-200 [&_td]:dark:border-zinc-700"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      );
    }

    // Markdown output
    if (data["text/markdown"]) {
      const md = normalizeSource(data["text/markdown"]);
      return (
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded">
          <MarkdownCell source={md} theme={theme} />
        </div>
      );
    }

    // JSON output
    if (data["application/json"]) {
      const json = data["application/json"];
      const formatted = typeof json === "string" ? json : JSON.stringify(json, null, 2);
      return (
        <pre className="text-xs font-mono p-3 rounded bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 overflow-x-auto">
          <SyntaxHighlighter
            language="json"
            style={theme === "dark" ? oneDark : oneLight}
            customStyle={{ margin: 0, padding: 0, background: "transparent" }}
          >
            {formatted}
          </SyntaxHighlighter>
        </pre>
      );
    }

    // Plain text output (fallback)
    if (data["text/plain"]) {
      const text = normalizeSource(data["text/plain"]);
      return (
        <pre className="text-xs font-mono p-3 rounded bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap">
          {parseAnsiText(text)}
        </pre>
      );
    }
  }

  return null;
}

function RawCell({ source }: { source: string }) {
  return (
    <pre className="text-xs font-mono p-3 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 overflow-x-auto border border-zinc-200 dark:border-zinc-700">
      {source}
    </pre>
  );
}

export function NotebookViewer({
  notebook,
  theme = "light",
  showLineNumbers = true,
  collapsible = true,
  maxHeight,
  className = "",
  filename,
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

  const toggleCell = useCallback((index: number) => {
    setCollapsedCells((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedCells(new Set());
  }, []);

  const collapseAll = useCallback(() => {
    if (notebookData) {
      setCollapsedCells(new Set(notebookData.cells.map((_, i) => i)));
    }
  }, [notebookData]);

  if (!notebookData) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 ${className}`}>
        <AlertCircle size={32} className="text-red-500 mb-2" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Failed to parse notebook</p>
      </div>
    );
  }

  const kernel = notebookData.metadata?.kernelspec?.display_name || "Python";
  const language = notebookData.metadata?.language_info?.name || "python";
  const version = notebookData.metadata?.language_info?.version;
  const title = notebookData.metadata?.title || filename;

  const codeCells = notebookData.cells.filter((c) => c.cell_type === "code").length;
  const markdownCells = notebookData.cells.filter((c) => c.cell_type === "markdown").length;

  return (
    <div
      className={`bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden ${className}`}
      style={maxHeight ? { maxHeight, overflow: "auto" } : undefined}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-700 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-zinc-800 dark:to-zinc-800">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                <FileText size={16} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200 text-sm">
                    {title || "Jupyter Notebook"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Play size={10} />
                    {kernel}
                  </span>
                  {version && (
                    <span className="flex items-center gap-1">
                      <Hash size={10} />
                      {version}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Code size={12} />
                {codeCells}
              </span>
              <span className="flex items-center gap-1">
                <FileText size={12} />
                {markdownCells}
              </span>
            </div>

            {collapsible && (
              <div className="flex items-center border-l border-zinc-300 dark:border-zinc-600 pl-3">
                <button
                  onClick={expandAll}
                  className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors"
                  title="Expand all cells"
                >
                  <ChevronsDown size={14} />
                </button>
                <button
                  onClick={collapseAll}
                  className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors"
                  title="Collapse all cells"
                >
                  <ChevronsUp size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cells */}
      <div className="p-4 space-y-3">
        {notebookData.cells.map((cell, index) => {
          const source = normalizeSource(cell.source);
          const isCollapsed = collapsedCells.has(index);

          // Skip empty cells
          if (!source.trim()) return null;

          const cellContent = () => {
            switch (cell.cell_type) {
              case "code":
                return (
                  <CodeCell
                    source={source}
                    executionCount={cell.execution_count}
                    outputs={cell.outputs}
                    theme={theme}
                    showLineNumbers={showLineNumbers}
                    language={language}
                    cellIndex={index}
                  />
                );
              case "markdown":
                return (
                  <div className="pl-4 border-l-2 border-orange-300 dark:border-orange-700">
                    <MarkdownCell source={source} theme={theme} />
                  </div>
                );
              case "raw":
                return <RawCell source={source} />;
              default:
                return null;
            }
          };

          if (collapsible) {
            return (
              <div key={cell.id || index} className="group">
                <button
                  onClick={() => toggleCell(index)}
                  className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 mb-1 transition-colors"
                >
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <span className="flex items-center gap-1.5">
                    {cell.cell_type === "code" ? (
                      <>
                        <Code size={11} className="text-blue-500" />
                        <span>Code</span>
                        {cell.execution_count && (
                          <span className="text-zinc-400 font-mono">[{cell.execution_count}]</span>
                        )}
                      </>
                    ) : cell.cell_type === "markdown" ? (
                      <>
                        <FileText size={11} className="text-orange-500" />
                        <span>Markdown</span>
                      </>
                    ) : (
                      <>
                        <Terminal size={11} className="text-zinc-500" />
                        <span>Raw</span>
                      </>
                    )}
                  </span>
                  {isCollapsed && (
                    <span className="text-zinc-400 truncate max-w-xs">
                      {source.split("\n")[0].substring(0, 50)}
                      {source.length > 50 && "..."}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {cellContent()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          return (
            <div key={cell.id || index}>
              {cellContent()}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2 text-xs text-zinc-500 flex items-center justify-between">
        <span>
          nbformat {notebookData.nbformat}.{notebookData.nbformat_minor}
        </span>
        <span>
          {notebookData.cells.length} cells
        </span>
      </div>
    </div>
  );
}

export type { NotebookData, NotebookCell, NotebookOutput };
