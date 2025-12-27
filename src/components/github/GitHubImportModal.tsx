"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Github,
  Search,
  GitPullRequest,
  CircleDot,
  ChevronRight,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGitHub, type GitHubRepo, type GitHubIssue, type GitHubPR } from "@/hooks/useGitHub";

interface GitHubImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (content: string) => void;
}

type View = "repos" | "repo-detail" | "issues" | "prs" | "issue-detail" | "pr-detail";

export function GitHubImportModal({ isOpen, onClose, onImport }: GitHubImportModalProps) {
  const {
    hasToken,
    isLoading,
    error,
    getRepos,
    searchRepos,
    getIssues,
    getIssue,
    getPRs,
    getPR,
    getPRDiff,
  } = useGitHub();

  const [view, setView] = useState<View>("repos");
  const [searchQuery, setSearchQuery] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [prs, setPrs] = useState<GitHubPR[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [selectedPR, setSelectedPR] = useState<GitHubPR | null>(null);
  const [prDiff, setPrDiff] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    const data = await getRepos({ type: "all", sort: "updated" });
    setRepos(data);
  }, [getRepos]);

  // Load repos on mount
  useEffect(() => {
    if (isOpen && hasToken && repos.length === 0) {
      loadRepos();
    }
  }, [isOpen, hasToken, repos.length, loadRepos]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadRepos();
      return;
    }
    const data = await searchRepos(searchQuery);
    setRepos(data);
  };

  const handleSelectRepo = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setView("repo-detail");

    const [owner, name] = repo.full_name.split("/");
    const [issuesData, prsData] = await Promise.all([
      getIssues(owner, name),
      getPRs(owner, name),
    ]);
    setIssues(issuesData);
    setPrs(prsData);
  };

  const handleSelectIssue = async (issue: GitHubIssue) => {
    if (!selectedRepo) return;
    const [owner, name] = selectedRepo.full_name.split("/");
    const fullIssue = await getIssue(owner, name, issue.number);
    if (fullIssue) {
      setSelectedIssue(fullIssue);
      setView("issue-detail");
    }
  };

  const handleSelectPR = async (pr: GitHubPR) => {
    if (!selectedRepo) return;
    const [owner, name] = selectedRepo.full_name.split("/");
    const [fullPR, diff] = await Promise.all([
      getPR(owner, name, pr.number),
      getPRDiff(owner, name, pr.number),
    ]);
    if (fullPR) {
      setSelectedPR(fullPR);
      setPrDiff(diff);
      setView("pr-detail");
    }
  };

  const handleImportIssue = () => {
    if (!selectedIssue || !selectedRepo) return;
    const content = `GitHub Issue: ${selectedRepo.full_name}#${selectedIssue.number}

**${selectedIssue.title}**

${selectedIssue.body || "No description provided."}

---
Labels: ${selectedIssue.labels.map((l) => l.name).join(", ") || "None"}
State: ${selectedIssue.state}
URL: ${selectedIssue.html_url}`;

    onImport(content);
    onClose();
  };

  const handleImportPR = () => {
    if (!selectedPR || !selectedRepo) return;
    let content = `GitHub Pull Request: ${selectedRepo.full_name}#${selectedPR.number}

**${selectedPR.title}**

${selectedPR.body || "No description provided."}

Branch: ${selectedPR.head.ref} → ${selectedPR.base.ref}
State: ${selectedPR.state}
URL: ${selectedPR.html_url}`;

    if (prDiff) {
      content += `\n\n---\n**Diff:**\n\`\`\`diff\n${prDiff.substring(0, 10000)}${prDiff.length > 10000 ? "\n... (truncated)" : ""}\n\`\`\``;
    }

    onImport(content);
    onClose();
  };

  const goBack = useCallback(() => {
    switch (view) {
      case "repo-detail":
      case "issues":
      case "prs":
        setView("repos");
        setSelectedRepo(null);
        setIssues([]);
        setPrs([]);
        break;
      case "issue-detail":
        setView("repo-detail");
        setSelectedIssue(null);
        break;
      case "pr-detail":
        setView("repo-detail");
        setSelectedPR(null);
        setPrDiff(null);
        break;
    }
  }, [view]);

  const resetModal = useCallback(() => {
    setView("repos");
    setSearchQuery("");
    setSelectedRepo(null);
    setSelectedIssue(null);
    setSelectedPR(null);
    setPrDiff(null);
    setIssues([]);
    setPrs([]);
  }, []);

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink-200 px-6 py-4">
            <div className="flex items-center gap-3">
              {view !== "repos" && (
                <button
                  onClick={goBack}
                  className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <Github size={24} className="text-ink-700" />
              <h2 className="text-lg font-semibold text-ink-800">
                {view === "repos" && "Import from GitHub"}
                {view === "repo-detail" && selectedRepo?.name}
                {view === "issue-detail" && `Issue #${selectedIssue?.number}`}
                {view === "pr-detail" && `PR #${selectedPR?.number}`}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto p-6">
            {!hasToken ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle size={48} className="mb-4 text-terminal-amber" />
                <h3 className="text-lg font-medium text-ink-700">GitHub Token Required</h3>
                <p className="mt-2 max-w-sm text-sm text-ink-500">
                  Add a GitHub Personal Access Token in Settings to import from GitHub.
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle size={48} className="mb-4 text-red-500" />
                <h3 className="text-lg font-medium text-ink-700">Error</h3>
                <p className="mt-2 max-w-sm text-sm text-ink-500">{error}</p>
              </div>
            ) : (
              <>
                {/* Repos View */}
                {view === "repos" && (
                  <>
                    <div className="mb-4 flex gap-2">
                      <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                          placeholder="Search repositories..."
                          className="w-full rounded-lg border border-ink-200 py-2 pl-10 pr-4 text-sm focus:border-terminal-blue focus:outline-none focus:ring-2 focus:ring-terminal-blue/20"
                        />
                      </div>
                      <button
                        onClick={handleSearch}
                        className="rounded-lg bg-ink-800 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700"
                      >
                        Search
                      </button>
                    </div>

                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-ink-400" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {repos.map((repo) => (
                          <button
                            key={repo.id}
                            onClick={() => handleSelectRepo(repo)}
                            className="flex w-full items-center justify-between rounded-lg border border-ink-200 p-4 text-left transition-colors hover:bg-ink-50"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-ink-800">{repo.full_name}</span>
                                {repo.private && (
                                  <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-500">
                                    Private
                                  </span>
                                )}
                              </div>
                              {repo.description && (
                                <p className="mt-1 truncate text-sm text-ink-500">{repo.description}</p>
                              )}
                            </div>
                            <ChevronRight size={16} className="shrink-0 text-ink-400" />
                          </button>
                        ))}
                        {repos.length === 0 && !isLoading && (
                          <p className="py-8 text-center text-sm text-ink-400">No repositories found</p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Repo Detail View */}
                {view === "repo-detail" && selectedRepo && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <a
                        href={selectedRepo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-terminal-blue hover:underline"
                      >
                        View on GitHub <ExternalLink size={12} />
                      </a>
                    </div>

                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-ink-400" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {/* Issues */}
                        <div className="rounded-lg border border-ink-200 p-4">
                          <div className="mb-3 flex items-center gap-2">
                            <CircleDot size={16} className="text-terminal-green" />
                            <span className="font-medium text-ink-700">Open Issues</span>
                            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">
                              {issues.length}
                            </span>
                          </div>
                          <div className="max-h-60 space-y-2 overflow-y-auto">
                            {issues.slice(0, 10).map((issue) => (
                              <button
                                key={issue.id}
                                onClick={() => handleSelectIssue(issue)}
                                className="w-full rounded-md p-2 text-left text-sm hover:bg-ink-50"
                              >
                                <span className="text-ink-400">#{issue.number}</span>{" "}
                                <span className="text-ink-700">{issue.title}</span>
                              </button>
                            ))}
                            {issues.length === 0 && (
                              <p className="text-sm text-ink-400">No open issues</p>
                            )}
                          </div>
                        </div>

                        {/* PRs */}
                        <div className="rounded-lg border border-ink-200 p-4">
                          <div className="mb-3 flex items-center gap-2">
                            <GitPullRequest size={16} className="text-terminal-purple" />
                            <span className="font-medium text-ink-700">Open PRs</span>
                            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">
                              {prs.length}
                            </span>
                          </div>
                          <div className="max-h-60 space-y-2 overflow-y-auto">
                            {prs.slice(0, 10).map((pr) => (
                              <button
                                key={pr.id}
                                onClick={() => handleSelectPR(pr)}
                                className="w-full rounded-md p-2 text-left text-sm hover:bg-ink-50"
                              >
                                <span className="text-ink-400">#{pr.number}</span>{" "}
                                <span className="text-ink-700">{pr.title}</span>
                              </button>
                            ))}
                            {prs.length === 0 && (
                              <p className="text-sm text-ink-400">No open PRs</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Issue Detail View */}
                {view === "issue-detail" && selectedIssue && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium text-ink-800">{selectedIssue.title}</h3>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            selectedIssue.state === "open"
                              ? "bg-terminal-green/10 text-terminal-green"
                              : "bg-terminal-purple/10 text-terminal-purple"
                          )}
                        >
                          {selectedIssue.state}
                        </span>
                        {selectedIssue.labels.map((label) => (
                          <span
                            key={label.name}
                            className="rounded-full px-2 py-0.5 text-xs"
                            style={{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }}
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg bg-ink-50 p-4">
                      <p className="whitespace-pre-wrap text-sm text-ink-700">
                        {selectedIssue.body || "No description provided."}
                      </p>
                    </div>

                    <button
                      onClick={handleImportIssue}
                      className="w-full rounded-lg bg-terminal-blue px-4 py-2.5 font-medium text-white hover:bg-terminal-blue/90"
                    >
                      Import Issue
                    </button>
                  </div>
                )}

                {/* PR Detail View */}
                {view === "pr-detail" && selectedPR && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium text-ink-800">{selectedPR.title}</h3>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            selectedPR.state === "open"
                              ? "bg-terminal-green/10 text-terminal-green"
                              : "bg-terminal-purple/10 text-terminal-purple"
                          )}
                        >
                          {selectedPR.state}
                        </span>
                        <span className="text-xs text-ink-500">
                          {selectedPR.head.ref} → {selectedPR.base.ref}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-ink-50 p-4">
                      <p className="whitespace-pre-wrap text-sm text-ink-700">
                        {selectedPR.body || "No description provided."}
                      </p>
                    </div>

                    {prDiff && (
                      <div className="rounded-lg border border-ink-200 p-4">
                        <h4 className="mb-2 text-sm font-medium text-ink-700">Diff Preview</h4>
                        <pre className="max-h-40 overflow-auto rounded bg-ink-900 p-3 font-mono text-xs text-ink-100">
                          {prDiff.substring(0, 2000)}
                          {prDiff.length > 2000 && "\n... (truncated)"}
                        </pre>
                      </div>
                    )}

                    <button
                      onClick={handleImportPR}
                      className="w-full rounded-lg bg-terminal-blue px-4 py-2.5 font-medium text-white hover:bg-terminal-blue/90"
                    >
                      Import PR
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
