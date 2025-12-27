"use client";

import { useCallback, useEffect } from "react";
import { useAppStore } from "@/store";

interface GitRemoteInfo {
  repo: string | null; // owner/repo format
  branch: string | null;
}

/**
 * Parse a git remote URL to extract owner/repo
 */
function parseGitRemote(remoteUrl: string): string | null {
  // Handle various git remote formats:
  // - git@github.com:owner/repo.git
  // - https://github.com/owner/repo.git
  // - https://github.com/owner/repo
  // - git://github.com/owner/repo.git

  // SSH format
  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/([^/.]+)/);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }

  // HTTPS/Git protocol format
  const httpsMatch = remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) {
    return `${httpsMatch[1]}/${httpsMatch[2]}`;
  }

  return null;
}

/**
 * Hook for auto-detecting GitHub repo from the working directory's git remote
 */
export function useGitDetect() {
  const { settings, githubContext, setGitHubContext, setCurrentRepo } = useAppStore();

  /**
   * Detect git repo info from the working directory
   */
  const detectRepo = useCallback(async (): Promise<GitRemoteInfo> => {
    const workingDir = settings.workingDirectory;

    if (!workingDir || workingDir === "/") {
      return { repo: null, branch: null };
    }

    try {
      // Call a simple API endpoint to detect git info
      const response = await fetch("/api/git-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd: workingDir }),
      });

      if (!response.ok) {
        return { repo: null, branch: null };
      }

      const data = await response.json();
      return {
        repo: data.repo || null,
        branch: data.branch || null,
      };
    } catch {
      return { repo: null, branch: null };
    }
  }, [settings.workingDirectory]);

  /**
   * Auto-detect and set the current repo
   */
  const autoDetect = useCallback(async () => {
    const { repo, branch } = await detectRepo();
    if (repo) {
      setCurrentRepo(repo, true);
      if (branch) {
        setGitHubContext({ currentBranch: branch });
      }
    }
  }, [detectRepo, setCurrentRepo, setGitHubContext]);

  /**
   * Manually set the current repo (not auto-detected)
   */
  const setRepo = useCallback(
    (repo: string | null) => {
      setCurrentRepo(repo, false);
    },
    [setCurrentRepo]
  );

  /**
   * Clear the current repo
   */
  const clearRepo = useCallback(() => {
    setCurrentRepo(null, false);
    setGitHubContext({ currentBranch: null });
  }, [setCurrentRepo, setGitHubContext]);

  // Auto-detect on mount and when working directory changes
  useEffect(() => {
    // Only auto-detect if we don't already have a manually set repo
    if (!githubContext.currentRepo || githubContext.autoDetected) {
      autoDetect();
    }
  }, [settings.workingDirectory]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    currentRepo: githubContext.currentRepo,
    currentBranch: githubContext.currentBranch,
    recentRepos: githubContext.recentRepos,
    isAutoDetected: githubContext.autoDetected,
    detectRepo,
    autoDetect,
    setRepo,
    clearRepo,
  };
}

export { parseGitRemote };
