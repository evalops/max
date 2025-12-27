"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  GitBranch,
  GitPullRequest,
  AlertCircle,
  PlayCircle,
  Search,
  FileText,
  Star,
  GitFork,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { useAppStore } from "@/store";
import { useGitDetect } from "@/hooks/useGitDetect";
import { RepoSwitcher } from "./RepoSwitcher";
import { EmptyState } from "@/components/ui";
import type { ToolRun } from "@/types";

interface GitHubPanelProps {
  className?: string;
}

// Map GitHub tool names to icons and descriptions
const githubToolInfo: Record<string, { icon: typeof GitBranch; label: string; color: string }> = {
  github_search_code: { icon: Search, label: "Search Code", color: "text-blue-500" },
  github_read_file: { icon: FileText, label: "Read File", color: "text-green-500" },
  github_list_files: { icon: FileText, label: "List Files", color: "text-green-500" },
  github_list_issues: { icon: AlertCircle, label: "List Issues", color: "text-orange-500" },
  github_get_issue: { icon: AlertCircle, label: "Get Issue", color: "text-orange-500" },
  github_list_prs: { icon: GitPullRequest, label: "List PRs", color: "text-purple-500" },
  github_get_pr: { icon: GitPullRequest, label: "Get PR", color: "text-purple-500" },
  github_clone_repo: { icon: GitFork, label: "Clone Repo", color: "text-cyan-500" },
  github_repo_info: { icon: FileText, label: "Repo Info", color: "text-blue-500" },
  github_compare: { icon: GitBranch, label: "Compare", color: "text-purple-500" },
  github_actions: { icon: PlayCircle, label: "Actions", color: "text-green-500" },
  github_file_history: { icon: FileText, label: "File History", color: "text-blue-500" },
  github_notifications: { icon: AlertCircle, label: "Notifications", color: "text-yellow-500" },
  github_create_issue: { icon: AlertCircle, label: "Create Issue", color: "text-green-500" },
  github_add_comment: { icon: MessageSquare, label: "Add Comment", color: "text-blue-500" },
  github_create_branch: { icon: GitBranch, label: "Create Branch", color: "text-purple-500" },
  github_create_pr: { icon: GitPullRequest, label: "Create PR", color: "text-green-500" },
  github_merge_pr: { icon: GitPullRequest, label: "Merge PR", color: "text-purple-500" },
  github_update_issue: { icon: AlertCircle, label: "Update Issue", color: "text-yellow-500" },
  github_star: { icon: Star, label: "Star Repo", color: "text-yellow-500" },
  github_fork: { icon: GitFork, label: "Fork Repo", color: "text-cyan-500" },
};

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function extractRepoFromToolRun(run: ToolRun): string | null {
  if (run.args && typeof run.args === "object") {
    const args = run.args as Record<string, unknown>;
    if (typeof args.repo === "string") {
      return args.repo;
    }
  }
  return null;
}

export function GitHubPanel({ className = "" }: GitHubPanelProps) {
  const { toolRuns, settings } = useAppStore();
  const { currentRepo, currentBranch } = useGitDetect();

  // Filter GitHub-related tool runs
  const githubToolRuns = useMemo(() => {
    return toolRuns.filter((run) => run.name.startsWith("github_")).slice(0, 50); // Limit to 50 most recent
  }, [toolRuns]);

  // Group by repo
  const runsByRepo = useMemo(() => {
    const groups: Record<string, ToolRun[]> = {};
    for (const run of githubToolRuns) {
      const repo = extractRepoFromToolRun(run) || "Unknown";
      if (!groups[repo]) groups[repo] = [];
      groups[repo].push(run);
    }
    return groups;
  }, [githubToolRuns]);

  // Stats
  const stats = useMemo(() => {
    const byTool: Record<string, number> = {};
    let success = 0;
    let error = 0;

    for (const run of githubToolRuns) {
      byTool[run.name] = (byTool[run.name] || 0) + 1;
      if (run.status === "succeeded") success++;
      else if (run.status === "failed") error++;
    }

    return { byTool, success, error, total: githubToolRuns.length };
  }, [githubToolRuns]);

  const hasGitHubToken = !!settings.githubToken;

  if (!hasGitHubToken) {
    return (
      <div className={`flex h-full flex-col items-center justify-center p-6 ${className}`}>
        <div className="mb-4 rounded-full bg-zinc-100 p-3 dark:bg-zinc-800">
          <svg className="size-8 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium text-zinc-800 dark:text-zinc-200">
          Connect GitHub
        </h3>
        <p className="mb-4 text-center text-sm text-zinc-500">
          Add a GitHub token in settings to enable GitHub tools.
        </p>
        <p className="text-center text-xs text-zinc-400">
          The agent can search code, manage issues & PRs, and more.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Header with repo switcher */}
      <div className="shrink-0 border-b border-zinc-200 p-3 dark:border-zinc-700">
        <RepoSwitcher className="w-full" />
        {currentRepo && currentBranch && (
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            <GitBranch size={12} />
            <span>{currentBranch}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="shrink-0 border-b border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">
              {stats.total} GitHub operation{stats.total !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-3">
              {stats.success > 0 && (
                <span className="text-green-600 dark:text-green-400">✓ {stats.success}</span>
              )}
              {stats.error > 0 && (
                <span className="text-red-600 dark:text-red-400">✗ {stats.error}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto">
        {githubToolRuns.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No GitHub activity"
            description="GitHub operations will appear here as the agent uses them."
            className="h-full"
          />
        ) : (
          <div className="p-2">
            {Object.entries(runsByRepo).map(([repo, runs]) => (
              <div key={repo} className="mb-4">
                {/* Repo header */}
                <div className="flex items-center gap-2 px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <svg className="size-3" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
                  </svg>
                  <span className="truncate font-medium">{repo}</span>
                </div>

                {/* Tool runs for this repo */}
                <div className="space-y-1">
                  {runs.map((run) => {
                    const info = githubToolInfo[run.name] || {
                      icon: GitBranch,
                      label: run.name,
                      color: "text-zinc-500",
                    };
                    const Icon = info.icon;

                    return (
                      <motion.div
                        key={run.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <div
                          className={`rounded p-1 ${run.status === "failed" ? "bg-red-100 dark:bg-red-900/30" : "bg-zinc-100 dark:bg-zinc-800"}`}
                        >
                          <Icon
                            size={12}
                            className={run.status === "failed" ? "text-red-500" : info.color}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            {info.label}
                          </div>
                          {run.output && (
                            <div className="truncate text-[10px] text-zinc-400">
                              {typeof run.output === "string"
                                ? run.output.substring(0, 50)
                                : "Completed"}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-[10px] text-zinc-400">
                          {formatTime(run.createdAt)}
                        </div>
                        {run.status === "running" && (
                          <div className="size-1.5 animate-pulse rounded-full bg-blue-500" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions footer */}
      {currentRepo && (
        <div className="shrink-0 border-t border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2">
            <a
              href={`https://github.com/${currentRepo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
            >
              <ExternalLink size={12} />
              <span>Open on GitHub</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
