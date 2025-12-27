"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";

interface DiffLine {
  type: "header" | "context" | "addition" | "deletion" | "hunk" | "empty";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

interface DiffFile {
  oldPath: string;
  newPath: string;
  status: "added" | "deleted" | "modified" | "renamed";
  additions: number;
  deletions: number;
  lines: DiffLine[];
}

interface DiffViewerProps {
  diff: string;
  maxHeight?: string;
  showStats?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

/**
 * Parse a unified diff string into structured data
 */
function parseDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = diff.split("\n");
  let currentFile: DiffFile | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // File header: diff --git a/path b/path
    if (line.startsWith("diff --git")) {
      if (currentFile) {
        files.push(currentFile);
      }
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      currentFile = {
        oldPath: match?.[1] || "",
        newPath: match?.[2] || "",
        status: "modified",
        additions: 0,
        deletions: 0,
        lines: [],
      };
      continue;
    }

    if (!currentFile) continue;

    // New file mode
    if (line.startsWith("new file mode")) {
      currentFile.status = "added";
      continue;
    }

    // Deleted file mode
    if (line.startsWith("deleted file mode")) {
      currentFile.status = "deleted";
      continue;
    }

    // Rename detection
    if (line.startsWith("rename from") || line.startsWith("similarity index")) {
      currentFile.status = "renamed";
      continue;
    }

    // Skip index, ---/+++ lines but capture for context
    if (line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++ ")) {
      currentFile.lines.push({ type: "header", content: line });
      continue;
    }

    // Hunk header: @@ -start,count +start,count @@
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[2], 10);
      }
      currentFile.lines.push({ type: "hunk", content: line });
      continue;
    }

    // Context line (starts with space or is the line itself)
    if (line.startsWith(" ") || (!line.startsWith("+") && !line.startsWith("-") && line.length > 0)) {
      currentFile.lines.push({
        type: "context",
        content: line.startsWith(" ") ? line.slice(1) : line,
        oldLineNum: oldLineNum++,
        newLineNum: newLineNum++,
      });
      continue;
    }

    // Addition
    if (line.startsWith("+") && !line.startsWith("+++")) {
      currentFile.additions++;
      currentFile.lines.push({
        type: "addition",
        content: line.slice(1),
        newLineNum: newLineNum++,
      });
      continue;
    }

    // Deletion
    if (line.startsWith("-") && !line.startsWith("---")) {
      currentFile.deletions++;
      currentFile.lines.push({
        type: "deletion",
        content: line.slice(1),
        oldLineNum: oldLineNum++,
      });
      continue;
    }

    // Empty line
    if (line === "") {
      currentFile.lines.push({ type: "empty", content: "" });
    }
  }

  if (currentFile) {
    files.push(currentFile);
  }

  return files;
}

/**
 * Get file extension for syntax hints
 */
function getFileExtension(path: string): string {
  return path.split(".").pop()?.toLowerCase() || "";
}

/**
 * Get status icon and color
 */
function getStatusInfo(status: DiffFile["status"]) {
  switch (status) {
    case "added":
      return { icon: "➕", color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" };
    case "deleted":
      return { icon: "➖", color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" };
    case "renamed":
      return { icon: "📝", color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-900/20" };
    default:
      return { icon: "📄", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" };
  }
}

export function DiffViewer({
  diff,
  maxHeight = "500px",
  showStats = true,
  collapsed = false,
  onToggleCollapse,
  className = "",
}: DiffViewerProps) {
  const files = useMemo(() => parseDiff(diff), [diff]);

  const totalStats = useMemo(() => {
    return files.reduce(
      (acc, file) => ({
        additions: acc.additions + file.additions,
        deletions: acc.deletions + file.deletions,
        files: acc.files + 1,
      }),
      { additions: 0, deletions: 0, files: 0 }
    );
  }, [files]);

  if (files.length === 0) {
    return (
      <div className={`text-zinc-500 text-sm p-4 ${className}`}>
        No diff to display
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden ${className}`}>
      {/* Stats Header */}
      {showStats && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {totalStats.files} file{totalStats.files !== 1 ? "s" : ""} changed
            </span>
            <span className="text-green-600 dark:text-green-400">
              +{totalStats.additions}
            </span>
            <span className="text-red-600 dark:text-red-400">
              -{totalStats.deletions}
            </span>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {collapsed ? "Expand" : "Collapse"}
            </button>
          )}
        </div>
      )}

      {/* Files */}
      {!collapsed && (
        <div style={{ maxHeight }} className="overflow-auto">
          {files.map((file, fileIndex) => {
            const statusInfo = getStatusInfo(file.status);
            const ext = getFileExtension(file.newPath || file.oldPath);

            return (
              <motion.div
                key={`${file.oldPath}-${file.newPath}-${fileIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: fileIndex * 0.05 }}
                className="border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
              >
                {/* File Header */}
                <div className={`flex items-center gap-2 px-4 py-2 ${statusInfo.bg}`}>
                  <span>{statusInfo.icon}</span>
                  <span className="font-mono text-sm text-zinc-800 dark:text-zinc-200 truncate">
                    {file.status === "renamed" && file.oldPath !== file.newPath
                      ? `${file.oldPath} → ${file.newPath}`
                      : file.newPath || file.oldPath}
                  </span>
                  <div className="ml-auto flex items-center gap-2 text-xs">
                    {file.additions > 0 && (
                      <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
                    )}
                    {file.deletions > 0 && (
                      <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
                    )}
                    {ext && (
                      <span className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-400">
                        {ext}
                      </span>
                    )}
                  </div>
                </div>

                {/* Diff Lines */}
                <div className="font-mono text-xs overflow-x-auto">
                  <table className="w-full border-collapse">
                    <tbody>
                      {file.lines.map((line, lineIndex) => {
                        if (line.type === "header") {
                          return null; // Skip header lines in display
                        }

                        if (line.type === "hunk") {
                          return (
                            <tr
                              key={lineIndex}
                              className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                            >
                              <td
                                colSpan={3}
                                className="px-4 py-1 text-xs"
                              >
                                {line.content}
                              </td>
                            </tr>
                          );
                        }

                        const bgColor =
                          line.type === "addition"
                            ? "bg-green-50 dark:bg-green-900/20"
                            : line.type === "deletion"
                            ? "bg-red-50 dark:bg-red-900/20"
                            : "";

                        const textColor =
                          line.type === "addition"
                            ? "text-green-800 dark:text-green-200"
                            : line.type === "deletion"
                            ? "text-red-800 dark:text-red-200"
                            : "text-zinc-700 dark:text-zinc-300";

                        const lineNumColor = "text-zinc-400 dark:text-zinc-600";

                        return (
                          <tr key={lineIndex} className={`${bgColor} hover:bg-zinc-100 dark:hover:bg-zinc-800/50`}>
                            <td className={`w-10 px-2 py-0 text-right select-none ${lineNumColor} border-r border-zinc-200 dark:border-zinc-700`}>
                              {line.oldLineNum || ""}
                            </td>
                            <td className={`w-10 px-2 py-0 text-right select-none ${lineNumColor} border-r border-zinc-200 dark:border-zinc-700`}>
                              {line.newLineNum || ""}
                            </td>
                            <td className={`px-4 py-0 whitespace-pre ${textColor}`}>
                              <span className="select-none mr-2 text-zinc-400">
                                {line.type === "addition" ? "+" : line.type === "deletion" ? "-" : " "}
                              </span>
                              {line.content || " "}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { parseDiff, type DiffFile, type DiffLine };
