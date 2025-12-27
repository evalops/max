"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Package, FolderOpen, Filter, SortAsc, SortDesc, Grid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { ArtifactCard } from "./ArtifactCard";
import type { Artifact, ArtifactKind } from "@/types/artifacts";

type SortField = "updatedAt" | "createdAt" | "title" | "kind";
type SortOrder = "asc" | "desc";
type ViewMode = "grid" | "list";

const kindFilters: { value: ArtifactKind | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "code", label: "Code" },
  { value: "markdown", label: "Markdown" },
  { value: "json", label: "JSON" },
  { value: "text", label: "Text" },
  { value: "html", label: "HTML" },
  { value: "image", label: "Image" },
];

export function ArtifactsPanel() {
  const { artifacts, removeArtifact, session } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<ArtifactKind | "all">("all");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort artifacts
  const filteredArtifacts = useMemo(() => {
    let result = [...artifacts];

    // Filter by session if active
    if (session.sessionId) {
      result = result.filter((a) => a.sessionId === session.sessionId);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.filename.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q) ||
          a.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Filter by kind
    if (kindFilter !== "all") {
      result = result.filter((a) => a.kind === kindFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "updatedAt":
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "kind":
          comparison = a.kind.localeCompare(b.kind);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [artifacts, session.sessionId, searchQuery, kindFilter, sortField, sortOrder]);

  const handleDelete = (id: string) => {
    removeArtifact(id);
    if (selectedArtifact?.id === id) {
      setSelectedArtifact(null);
    }
  };

  const handleSelect = (artifact: Artifact) => {
    setSelectedArtifact(artifact.id === selectedArtifact?.id ? null : artifact);
  };

  const toggleSort = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="border-b border-ink-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-terminal-purple" />
            <h2 className="font-semibold text-ink-800">Artifacts</h2>
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">
              {filteredArtifacts.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded p-1.5 transition-colors",
                viewMode === "list"
                  ? "bg-terminal-purple/10 text-terminal-purple"
                  : "text-ink-400 hover:bg-ink-100"
              )}
              title="List view"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded p-1.5 transition-colors",
                viewMode === "grid"
                  ? "bg-terminal-purple/10 text-terminal-purple"
                  : "text-ink-400 hover:bg-ink-100"
              )}
              title="Grid view"
            >
              <Grid size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artifacts..."
            className="w-full rounded-lg border border-ink-200 bg-ink-50 py-2 pl-9 pr-3 text-sm text-ink-700 placeholder:text-ink-400 focus:border-terminal-purple focus:outline-none focus:ring-1 focus:ring-terminal-purple/30"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "mt-2 flex items-center gap-1.5 text-xs transition-colors",
            showFilters ? "text-terminal-purple" : "text-ink-400 hover:text-ink-600"
          )}
        >
          <Filter size={12} />
          {showFilters ? "Hide filters" : "Show filters"}
        </button>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex flex-wrap gap-2">
                {/* Kind filter */}
                <select
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value as ArtifactKind | "all")}
                  className="rounded border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600 focus:border-terminal-purple focus:outline-none"
                >
                  {kindFilters.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>

                {/* Sort field */}
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  className="rounded border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600 focus:border-terminal-purple focus:outline-none"
                >
                  <option value="updatedAt">Updated</option>
                  <option value="createdAt">Created</option>
                  <option value="title">Title</option>
                  <option value="kind">Type</option>
                </select>

                {/* Sort order */}
                <button
                  onClick={toggleSort}
                  className="flex items-center gap-1 rounded border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600 hover:bg-ink-50"
                >
                  {sortOrder === "asc" ? <SortAsc size={12} /> : <SortDesc size={12} />}
                  {sortOrder === "asc" ? "Oldest first" : "Newest first"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {filteredArtifacts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="rounded-full bg-ink-100 p-4">
              <FolderOpen size={24} className="text-ink-400" />
            </div>
            <h3 className="mt-4 font-medium text-ink-600">No artifacts yet</h3>
            <p className="mt-1 max-w-xs text-sm text-ink-400">
              {searchQuery || kindFilter !== "all"
                ? "No artifacts match your filters. Try adjusting your search."
                : "Artifacts created during agent sessions will appear here."}
            </p>
          </div>
        ) : (
          <div
            className={cn(viewMode === "grid" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3")}
          >
            <AnimatePresence mode="popLayout">
              {filteredArtifacts.map((artifact) => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  onDelete={handleDelete}
                  onSelect={handleSelect}
                  isSelected={selectedArtifact?.id === artifact.id}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
