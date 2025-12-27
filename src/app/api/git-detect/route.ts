import { type NextRequest } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface GitDetectRequest {
  cwd: string;
}

interface GitDetectResponse {
  repo: string | null;
  branch: string | null;
  isGitRepo: boolean;
}

/**
 * Parse a git remote URL to extract owner/repo
 */
function parseGitRemote(remoteUrl: string): string | null {
  // SSH format: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/([^/.]+)/);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }

  // HTTPS/Git protocol format: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) {
    return `${httpsMatch[1]}/${httpsMatch[2]}`;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GitDetectRequest;
    const { cwd } = body;

    if (!cwd) {
      return Response.json({ repo: null, branch: null, isGitRepo: false });
    }

    // Check if it's a git repo
    try {
      await execAsync("git rev-parse --git-dir", { cwd });
    } catch {
      return Response.json({ repo: null, branch: null, isGitRepo: false });
    }

    const response: GitDetectResponse = {
      repo: null,
      branch: null,
      isGitRepo: true,
    };

    // Get the current branch
    try {
      const { stdout: branchOutput } = await execAsync(
        "git branch --show-current",
        { cwd }
      );
      response.branch = branchOutput.trim() || null;
    } catch {
      // Not on a branch (detached HEAD)
      try {
        const { stdout: headOutput } = await execAsync(
          "git rev-parse --short HEAD",
          { cwd }
        );
        response.branch = headOutput.trim() || null;
      } catch {
        // Ignore
      }
    }

    // Get the remote URL (prefer origin, fall back to first remote)
    try {
      const { stdout: remoteOutput } = await execAsync(
        "git remote get-url origin 2>/dev/null || git remote get-url $(git remote | head -1) 2>/dev/null",
        { cwd }
      );
      const remoteUrl = remoteOutput.trim();
      if (remoteUrl) {
        response.repo = parseGitRemote(remoteUrl);
      }
    } catch {
      // No remote configured
    }

    return Response.json(response);
  } catch (error) {
    console.error("Git detect error:", error);
    return Response.json({ repo: null, branch: null, isGitRepo: false });
  }
}
