"use client";

import { useState, useCallback } from "react";
import { useAppStore } from "@/store";

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  private: boolean;
  updated_at: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  html_url: string;
  created_at: string;
  user: {
    login: string;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed" | "merged";
  html_url: string;
  created_at: string;
  user: {
    login: string;
  };
  head: {
    ref: string;
  };
  base: {
    ref: string;
  };
}

export interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  content?: string;
  encoding?: string;
}

export interface GitHubError {
  message: string;
  status: number;
}

export function useGitHub() {
  const { settings } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasToken = !!settings.githubToken;

  const fetchGitHub = useCallback(
    async <T>(endpoint: string): Promise<T> => {
      if (!settings.githubToken) {
        throw new Error("GitHub token not configured");
      }

      const response = await fetch(`https://api.github.com${endpoint}`, {
        headers: {
          Authorization: `Bearer ${settings.githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `GitHub API error: ${response.status}`);
      }

      return response.json();
    },
    [settings.githubToken]
  );

  const getRepos = useCallback(
    async (options?: { type?: "all" | "owner" | "member"; sort?: "updated" | "pushed" | "full_name" }) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          type: options?.type || "owner",
          sort: options?.sort || "updated",
          per_page: "30",
        });
        const repos = await fetchGitHub<GitHubRepo[]>(`/user/repos?${params}`);
        return repos;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch repos");
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [fetchGitHub]
  );

  const searchRepos = useCallback(
    async (query: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchGitHub<{ items: GitHubRepo[] }>(
          `/search/repositories?q=${encodeURIComponent(query)}&per_page=20`
        );
        return result.items;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to search repos");
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [fetchGitHub]
  );

  const getIssues = useCallback(
    async (owner: string, repo: string, state: "open" | "closed" | "all" = "open") => {
      setIsLoading(true);
      setError(null);
      try {
        const issues = await fetchGitHub<GitHubIssue[]>(
          `/repos/${owner}/${repo}/issues?state=${state}&per_page=30`
        );
        // Filter out PRs (they come through the issues endpoint)
        return issues.filter((issue) => !("pull_request" in issue));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch issues");
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [fetchGitHub]
  );

  const getIssue = useCallback(
    async (owner: string, repo: string, issueNumber: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const issue = await fetchGitHub<GitHubIssue>(
          `/repos/${owner}/${repo}/issues/${issueNumber}`
        );
        return issue;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch issue");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchGitHub]
  );

  const getPRs = useCallback(
    async (owner: string, repo: string, state: "open" | "closed" | "all" = "open") => {
      setIsLoading(true);
      setError(null);
      try {
        const prs = await fetchGitHub<GitHubPR[]>(
          `/repos/${owner}/${repo}/pulls?state=${state}&per_page=30`
        );
        return prs;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch PRs");
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [fetchGitHub]
  );

  const getPR = useCallback(
    async (owner: string, repo: string, prNumber: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const pr = await fetchGitHub<GitHubPR>(
          `/repos/${owner}/${repo}/pulls/${prNumber}`
        );
        return pr;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch PR");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchGitHub]
  );

  const getPRDiff = useCallback(
    async (owner: string, repo: string, prNumber: number) => {
      if (!settings.githubToken) {
        throw new Error("GitHub token not configured");
      }

      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
          {
            headers: {
              Authorization: `Bearer ${settings.githubToken}`,
              Accept: "application/vnd.github.v3.diff",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch PR diff: ${response.status}`);
        }

        return response.text();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch PR diff");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [settings.githubToken]
  );

  const getFileContent = useCallback(
    async (owner: string, repo: string, path: string, ref?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const endpoint = ref
          ? `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
          : `/repos/${owner}/${repo}/contents/${path}`;
        const file = await fetchGitHub<GitHubFile>(endpoint);

        // Decode base64 content
        if (file.content && file.encoding === "base64") {
          file.content = atob(file.content.replace(/\n/g, ""));
        }

        return file;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch file");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchGitHub]
  );

  const getDirectoryContents = useCallback(
    async (owner: string, repo: string, path: string = "", ref?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const endpoint = ref
          ? `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
          : `/repos/${owner}/${repo}/contents/${path}`;
        const contents = await fetchGitHub<GitHubFile[]>(endpoint);
        return contents;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch directory");
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [fetchGitHub]
  );

  const parseGitHubUrl = useCallback((url: string) => {
    // Parse URLs like:
    // https://github.com/owner/repo
    // https://github.com/owner/repo/issues/123
    // https://github.com/owner/repo/pull/456
    // https://github.com/owner/repo/blob/main/path/to/file
    const match = url.match(
      /github\.com\/([^/]+)\/([^/]+)(?:\/(issues|pull|blob)\/(\d+|[^/]+)(?:\/(.+))?)?/
    );

    if (!match) return null;

    const [, owner, repo, type, numberOrRef, path] = match;
    return {
      owner,
      repo: repo.replace(/\.git$/, ""),
      type: type as "issues" | "pull" | "blob" | undefined,
      number: type === "issues" || type === "pull" ? parseInt(numberOrRef) : undefined,
      ref: type === "blob" ? numberOrRef : undefined,
      path,
    };
  }, []);

  return {
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
    getFileContent,
    getDirectoryContents,
    parseGitHubUrl,
  };
}
