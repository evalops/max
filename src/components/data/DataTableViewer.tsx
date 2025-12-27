"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Table,
  ChevronUp,
  ChevronDown,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface DataRow {
  [key: string]: string | number | boolean | null | undefined;
}

interface ColumnDef {
  key: string;
  label?: string;
  width?: string | number;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  format?: (value: unknown) => string;
}

interface DataTableViewerProps {
  data: DataRow[];
  columns?: ColumnDef[];
  title?: string;
  theme?: "light" | "dark";
  pageSize?: number;
  searchable?: boolean;
  sortable?: boolean;
  striped?: boolean;
  compact?: boolean;
  showRowNumbers?: boolean;
  onExport?: () => void;
  className?: string;
}

type SortDirection = "asc" | "desc" | null;

interface SortConfig {
  key: string;
  direction: SortDirection;
}

function inferColumns(data: DataRow[]): ColumnDef[] {
  if (!data || data.length === 0) return [];
  const firstRow = data[0];
  return Object.keys(firstRow).map((key) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
    sortable: true,
  }));
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    // Format large numbers with commas
    if (Math.abs(value) >= 1000) {
      return value.toLocaleString();
    }
    // Format decimals nicely
    if (!Number.isInteger(value)) {
      return value.toFixed(2);
    }
    return value.toString();
  }
  return String(value);
}

export function DataTableViewer({
  data,
  columns: propColumns,
  title,
  theme = "light",
  pageSize = 10,
  searchable = true,
  sortable = true,
  striped = true,
  compact = false,
  showRowNumbers = false,
  onExport,
  className = "",
}: DataTableViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "", direction: null });
  const [currentPage, setCurrentPage] = useState(1);

  const columns = useMemo(() => {
    return propColumns || inferColumns(data);
  }, [data, propColumns]);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(query))
    );
  }, [data, searchQuery]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortConfig]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key: string) => {
    if (!sortable) return;
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      if (prev.direction === "desc") return { key: "", direction: null };
      return { key, direction: "asc" };
    });
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
      return;
    }
    // Default CSV export
    const headers = columns.map((c) => c.label || c.key).join(",");
    const rows = sortedData.map((row) =>
      columns
        .map((c) => {
          const val = row[c.key];
          const str = formatValue(val);
          // Escape quotes and wrap in quotes if contains comma
          if (str.includes(",") || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "data"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const _isDark = theme === "dark";

  if (!data || data.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        <Table size={32} className="mb-2 text-zinc-400" />
        <p className="text-sm text-zinc-500">No data to display</p>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center gap-2">
          <Table size={16} className="text-emerald-500" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {title || "Data Table"}
          </span>
          <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-700">
            {sortedData.length} rows
          </span>
        </div>

        <div className="flex items-center gap-2">
          {searchable && (
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search..."
                className="w-36 rounded border border-zinc-300 bg-white py-1 pl-7 pr-3 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              />
            </div>
          )}

          <button
            onClick={handleExport}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          >
            <Download size={12} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
              {showRowNumbers && (
                <th className="w-12 px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  #
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sortConfig.key === col.key;
                const canSort = sortable && col.sortable !== false;

                return (
                  <th
                    key={col.key}
                    className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 ${
                      canSort
                        ? "cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-300"
                        : ""
                    }`}
                    style={{ width: col.width }}
                    onClick={() => canSort && handleSort(col.key)}
                  >
                    <div
                      className={`flex items-center gap-1 ${
                        col.align === "center"
                          ? "justify-center"
                          : col.align === "right"
                            ? "justify-end"
                            : ""
                      }`}
                    >
                      <span>{col.label || col.key}</span>
                      {canSort && (
                        <span className="flex flex-col">
                          <ChevronUp
                            size={10}
                            className={`${
                              isSorted && sortConfig.direction === "asc"
                                ? "text-blue-500"
                                : "text-zinc-300 dark:text-zinc-600"
                            }`}
                          />
                          <ChevronDown
                            size={10}
                            className={`-mt-1 ${
                              isSorted && sortConfig.direction === "desc"
                                ? "text-blue-500"
                                : "text-zinc-300 dark:text-zinc-600"
                            }`}
                          />
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <AnimatePresence>
              {paginatedData.map((row, rowIndex) => {
                const globalIndex = (currentPage - 1) * pageSize + rowIndex;
                return (
                  <motion.tr
                    key={globalIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`${
                      striped && rowIndex % 2 === 1 ? "bg-zinc-50/50 dark:bg-zinc-800/30" : ""
                    } transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800`}
                  >
                    {showRowNumbers && (
                      <td
                        className={`px-3 ${compact ? "py-1" : "py-2"} font-mono text-xs text-zinc-400`}
                      >
                        {globalIndex + 1}
                      </td>
                    )}
                    {columns.map((col) => {
                      const value = row[col.key];
                      const formatted = col.format ? col.format(value) : formatValue(value);

                      return (
                        <td
                          key={col.key}
                          className={`px-3 ${compact ? "py-1" : "py-2"} text-zinc-700 dark:text-zinc-300 ${
                            col.align === "center"
                              ? "text-center"
                              : col.align === "right"
                                ? "text-right"
                                : ""
                          } ${typeof value === "number" ? "font-mono" : ""}`}
                        >
                          {formatted}
                        </td>
                      );
                    })}
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="text-xs text-zinc-500">
            Showing {(currentPage - 1) * pageSize + 1} -{" "}
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="rounded p-1 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-700"
            >
              <ChevronsLeft size={14} className="text-zinc-500" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded p-1 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-700"
            >
              <ChevronLeft size={14} className="text-zinc-500" />
            </button>

            <span className="px-2 text-xs text-zinc-500">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded p-1 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-700"
            >
              <ChevronRight size={14} className="text-zinc-500" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="rounded p-1 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-700"
            >
              <ChevronsRight size={14} className="text-zinc-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { DataRow, ColumnDef, DataTableViewerProps };
