/**
 * GitHub MCP Server - Custom tools for the agent to interact with GitHub
 *
 * This creates an in-process MCP server that exposes GitHub tools to the agent,
 * allowing it to search code, read files, browse issues/PRs, and clone repos.
 */

import { z } from "zod";
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-code";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);

// GitHub API base URL
const GITHUB_API = "https://api.github.com";

// Helper to make GitHub API requests
async function githubFetch(
  endpoint: string,
  token: string,
  options: { accept?: string } = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: options.accept || "application/vnd.github.v3+json",
  };

  return fetch(`${GITHUB_API}${endpoint}`, { headers });
}

// Tool: Search code across GitHub
const searchCodeTool = tool(
  "github_search_code",
  `Search for code across GitHub repositories.

Use this to find specific code patterns, functions, or implementations in repositories.
Returns file paths and code snippets matching the query.

Examples:
- Search for a function: {query: "function handleAuth", repo: "owner/repo"}
- Search for imports: {query: "import React", repo: "facebook/react"}`,
  {
    query: z.string().describe("The search query (code, function names, etc.)"),
    repo: z.string().optional().describe("Limit search to specific repo (owner/repo format)"),
    language: z.string().optional().describe("Filter by programming language"),
    perPage: z.number().min(1).max(100).default(30).optional(),
  },
  async (args, extra) => {
    const { query, repo, language, perPage = 30 } = args;
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    let searchQuery = query;
    if (repo) searchQuery += ` repo:${repo}`;
    if (language) searchQuery += ` language:${language}`;

    const response = await githubFetch(
      `/search/code?q=${encodeURIComponent(searchQuery)}&per_page=${perPage}`,
      token
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        content: [{ type: "text", text: `GitHub API error: ${error.message || response.statusText}` }],
        isError: true,
      };
    }

    const data = await response.json();
    const results = data.items?.map((item: any) => ({
      path: item.path,
      repo: item.repository.full_name,
      url: item.html_url,
      score: item.score,
    }));

    return {
      content: [
        {
          type: "text",
          text: `Found ${data.total_count} results:\n\n${JSON.stringify(results, null, 2)}`,
        },
      ],
    };
  }
);

// Tool: Read file from GitHub repo
const readFileTool = tool(
  "github_read_file",
  `Read a file's contents from a GitHub repository.

Use this to view source code, configuration files, or documentation from any public or accessible private repo.

Examples:
- Read README: {repo: "owner/repo", path: "README.md"}
- Read source file: {repo: "owner/repo", path: "src/index.ts", ref: "main"}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    path: z.string().describe("Path to the file in the repository"),
    ref: z.string().optional().describe("Branch, tag, or commit SHA (defaults to default branch)"),
  },
  async (args, extra) => {
    const { repo, path: filePath, ref } = args;
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    const endpoint = ref
      ? `/repos/${repo}/contents/${filePath}?ref=${ref}`
      : `/repos/${repo}/contents/${filePath}`;

    const response = await githubFetch(endpoint, token);

    if (!response.ok) {
      const error = await response.json();
      return {
        content: [{ type: "text", text: `Failed to read file: ${error.message || response.statusText}` }],
        isError: true,
      };
    }

    const data = await response.json();

    if (data.type !== "file") {
      return {
        content: [{ type: "text", text: `Path is a ${data.type}, not a file. Use github_list_files for directories.` }],
        isError: true,
      };
    }

    // Decode base64 content
    const content = Buffer.from(data.content, "base64").toString("utf-8");

    return {
      content: [
        {
          type: "text",
          text: `File: ${repo}/${filePath}${ref ? ` (${ref})` : ""}\nSize: ${data.size} bytes\n\n${content}`,
        },
      ],
    };
  }
);

// Tool: List files in a directory
const listFilesTool = tool(
  "github_list_files",
  `List files and directories in a GitHub repository path.

Use this to explore repository structure before reading specific files.

Examples:
- List root: {repo: "owner/repo", path: ""}
- List src folder: {repo: "owner/repo", path: "src"}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    path: z.string().default("").describe("Directory path (empty for root)"),
    ref: z.string().optional().describe("Branch, tag, or commit SHA"),
  },
  async (args, extra) => {
    const { repo, path: dirPath, ref } = args;
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    const endpoint = ref
      ? `/repos/${repo}/contents/${dirPath}?ref=${ref}`
      : `/repos/${repo}/contents/${dirPath}`;

    const response = await githubFetch(endpoint, token);

    if (!response.ok) {
      const error = await response.json();
      return {
        content: [{ type: "text", text: `Failed to list files: ${error.message || response.statusText}` }],
        isError: true,
      };
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return {
        content: [{ type: "text", text: "Path is a file, not a directory. Use github_read_file instead." }],
        isError: true,
      };
    }

    const items = data.map((item: any) => ({
      name: item.name,
      type: item.type,
      size: item.size,
      path: item.path,
    }));

    // Sort: directories first, then files
    items.sort((a: any, b: any) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "dir" ? -1 : 1;
    });

    return {
      content: [
        {
          type: "text",
          text: `Contents of ${repo}/${dirPath || "(root)"}:\n\n${items
            .map((i: any) => `${i.type === "dir" ? "📁" : "📄"} ${i.name}${i.type === "file" ? ` (${i.size} bytes)` : ""}`)
            .join("\n")}`,
        },
      ],
    };
  }
);

// Tool: List issues
const listIssuesTool = tool(
  "github_list_issues",
  `List issues from a GitHub repository.

Use this to see open bugs, feature requests, or discussions in a repo.

Examples:
- List open issues: {repo: "owner/repo"}
- List bugs: {repo: "owner/repo", labels: ["bug"]}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    state: z.enum(["open", "closed", "all"]).default("open").optional(),
    labels: z.array(z.string()).optional().describe("Filter by labels"),
    perPage: z.number().min(1).max(100).default(30).optional(),
  },
  async (args, extra) => {
    const { repo, state = "open", labels, perPage = 30 } = args;
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    let endpoint = `/repos/${repo}/issues?state=${state}&per_page=${perPage}`;
    if (labels?.length) endpoint += `&labels=${labels.join(",")}`;

    const response = await githubFetch(endpoint, token);

    if (!response.ok) {
      const error = await response.json();
      return {
        content: [{ type: "text", text: `Failed to list issues: ${error.message || response.statusText}` }],
        isError: true,
      };
    }

    const data = await response.json();
    // Filter out PRs (they come through issues endpoint)
    const issues = data.filter((item: any) => !item.pull_request);

    const formatted = issues.map((issue: any) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      author: issue.user.login,
      labels: issue.labels.map((l: any) => l.name),
      comments: issue.comments,
      created: issue.created_at,
      url: issue.html_url,
    }));

    return {
      content: [
        {
          type: "text",
          text: `Found ${formatted.length} issues in ${repo}:\n\n${formatted
            .map((i: any) => `#${i.number}: ${i.title} [${i.state}] by @${i.author} (${i.comments} comments)`)
            .join("\n")}`,
        },
      ],
    };
  }
);

// Tool: Get issue details
const getIssueTool = tool(
  "github_get_issue",
  `Get detailed information about a specific GitHub issue.

Use this to read the full issue description, comments, and metadata.

Examples:
- Get issue: {repo: "owner/repo", number: 123}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    number: z.number().describe("Issue number"),
    includeComments: z.boolean().default(true).optional(),
  },
  async (args, extra) => {
    const { repo, number, includeComments = true } = args;
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    const response = await githubFetch(`/repos/${repo}/issues/${number}`, token);

    if (!response.ok) {
      const error = await response.json();
      return {
        content: [{ type: "text", text: `Failed to get issue: ${error.message || response.statusText}` }],
        isError: true,
      };
    }

    const issue = await response.json();

    let result = `# Issue #${issue.number}: ${issue.title}

**State:** ${issue.state}
**Author:** @${issue.user.login}
**Created:** ${issue.created_at}
**Labels:** ${issue.labels.map((l: any) => l.name).join(", ") || "None"}
**URL:** ${issue.html_url}

## Description

${issue.body || "No description provided."}`;

    if (includeComments && issue.comments > 0) {
      const commentsResponse = await githubFetch(`/repos/${repo}/issues/${number}/comments`, token);
      if (commentsResponse.ok) {
        const comments = await commentsResponse.json();
        result += `\n\n## Comments (${comments.length})\n`;
        for (const comment of comments.slice(0, 10)) {
          result += `\n---\n**@${comment.user.login}** (${comment.created_at}):\n${comment.body}\n`;
        }
        if (comments.length > 10) {
          result += `\n... and ${comments.length - 10} more comments`;
        }
      }
    }

    return { content: [{ type: "text", text: result }] };
  }
);

// Tool: List PRs
const listPRsTool = tool(
  "github_list_prs",
  `List pull requests from a GitHub repository.

Use this to see pending code changes, reviews, and contributions.

Examples:
- List open PRs: {repo: "owner/repo"}
- List merged PRs: {repo: "owner/repo", state: "closed"}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    state: z.enum(["open", "closed", "all"]).default("open").optional(),
    perPage: z.number().min(1).max(100).default(30).optional(),
  },
  async (args, extra) => {
    const { repo, state = "open", perPage = 30 } = args;
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    const response = await githubFetch(`/repos/${repo}/pulls?state=${state}&per_page=${perPage}`, token);

    if (!response.ok) {
      const error = await response.json();
      return {
        content: [{ type: "text", text: `Failed to list PRs: ${error.message || response.statusText}` }],
        isError: true,
      };
    }

    const prs = await response.json();

    const formatted = prs.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      author: pr.user.login,
      branch: `${pr.head.ref} → ${pr.base.ref}`,
      draft: pr.draft,
      created: pr.created_at,
      url: pr.html_url,
    }));

    return {
      content: [
        {
          type: "text",
          text: `Found ${formatted.length} PRs in ${repo}:\n\n${formatted
            .map((p: any) => `#${p.number}: ${p.title} [${p.state}${p.draft ? ", draft" : ""}] by @${p.author} (${p.branch})`)
            .join("\n")}`,
        },
      ],
    };
  }
);

// Tool: Get PR details with diff
const getPRTool = tool(
  "github_get_pr",
  `Get detailed information about a specific pull request, including the diff.

Use this to review code changes, understand what a PR does, and see review status.

Examples:
- Get PR: {repo: "owner/repo", number: 123}
- Get PR without full diff: {repo: "owner/repo", number: 123, includeDiff: false}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    number: z.number().describe("PR number"),
    includeDiff: z.boolean().default(true).optional(),
  },
  async (args, extra) => {
    const { repo, number, includeDiff = true } = args;
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    const response = await githubFetch(`/repos/${repo}/pulls/${number}`, token);

    if (!response.ok) {
      const error = await response.json();
      return {
        content: [{ type: "text", text: `Failed to get PR: ${error.message || response.statusText}` }],
        isError: true,
      };
    }

    const pr = await response.json();

    let result = `# PR #${pr.number}: ${pr.title}

**State:** ${pr.state}${pr.merged ? " (merged)" : ""}${pr.draft ? " (draft)" : ""}
**Author:** @${pr.user.login}
**Branch:** ${pr.head.ref} → ${pr.base.ref}
**Created:** ${pr.created_at}
**Changed Files:** ${pr.changed_files} (+${pr.additions}/-${pr.deletions})
**URL:** ${pr.html_url}

## Description

${pr.body || "No description provided."}`;

    if (includeDiff) {
      const diffResponse = await githubFetch(
        `/repos/${repo}/pulls/${number}`,
        token,
        { accept: "application/vnd.github.v3.diff" }
      );
      if (diffResponse.ok) {
        const diff = await diffResponse.text();
        // Truncate if too long
        const maxDiffLength = 10000;
        const truncatedDiff = diff.length > maxDiffLength
          ? diff.substring(0, maxDiffLength) + "\n\n... (diff truncated)"
          : diff;
        result += `\n\n## Diff\n\n\`\`\`diff\n${truncatedDiff}\n\`\`\``;
      }
    }

    return { content: [{ type: "text", text: result }] };
  }
);

// Tool: Clone repository
const cloneRepoTool = tool(
  "github_clone_repo",
  `Clone a GitHub repository to the local filesystem.

Use this when you need to work with a repository's files directly.
The repo will be cloned to the working directory.

Examples:
- Clone: {repo: "owner/repo"}
- Clone specific branch: {repo: "owner/repo", branch: "develop"}
- Clone to specific dir: {repo: "owner/repo", directory: "my-project"}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    branch: z.string().optional().describe("Branch to clone (defaults to default branch)"),
    directory: z.string().optional().describe("Target directory name (defaults to repo name)"),
    shallow: z.boolean().default(true).optional().describe("Shallow clone (faster, less disk space)"),
  },
  async (args, extra) => {
    const { repo, branch, directory, shallow = true } = args;
    const context = extra as { githubToken?: string; cwd?: string };
    const token = context?.githubToken;
    const cwd = context?.cwd || process.cwd();

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    const repoName = directory || repo.split("/")[1];
    const targetPath = path.join(cwd, repoName);

    // Check if directory already exists
    try {
      await fs.access(targetPath);
      return {
        content: [
          {
            type: "text",
            text: `Directory ${repoName} already exists. Use a different directory name or delete the existing one.`,
          },
        ],
        isError: true,
      };
    } catch {
      // Directory doesn't exist, good to proceed
    }

    // Build clone command
    const cloneUrl = `https://${token}@github.com/${repo}.git`;
    let cmd = `git clone`;
    if (shallow) cmd += ` --depth 1`;
    if (branch) cmd += ` --branch ${branch}`;
    cmd += ` "${cloneUrl}" "${repoName}"`;

    try {
      await execAsync(cmd, { cwd });

      // Get some basic info about the cloned repo
      const { stdout: branchOutput } = await execAsync("git branch --show-current", {
        cwd: targetPath,
      });
      const { stdout: commitOutput } = await execAsync("git log -1 --oneline", {
        cwd: targetPath,
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully cloned ${repo} to ${targetPath}

Branch: ${branchOutput.trim()}
Latest commit: ${commitOutput.trim()}

You can now use Read, Edit, Glob, Grep and other tools to work with the repository files.
The repo is located at: ${targetPath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get repository info
const repoInfoTool = tool(
  "github_repo_info",
  `Get information about a GitHub repository.

Use this to understand what a repository is about, its stats, and metadata.

Examples:
- Get repo info: {repo: "owner/repo"}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
  },
  async (args, extra) => {
    const { repo } = args;
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    const response = await githubFetch(`/repos/${repo}`, token);

    if (!response.ok) {
      const error = await response.json();
      return {
        content: [{ type: "text", text: `Failed to get repo: ${error.message || response.statusText}` }],
        isError: true,
      };
    }

    const r = await response.json();

    return {
      content: [
        {
          type: "text",
          text: `# ${r.full_name}

${r.description || "No description"}

**Language:** ${r.language || "Not specified"}
**Stars:** ${r.stargazers_count} | **Forks:** ${r.forks_count} | **Watchers:** ${r.watchers_count}
**Open Issues:** ${r.open_issues_count}
**Default Branch:** ${r.default_branch}
**License:** ${r.license?.name || "None"}
**Created:** ${r.created_at}
**Last Updated:** ${r.updated_at}
**URL:** ${r.html_url}

${r.homepage ? `**Homepage:** ${r.homepage}` : ""}
${r.topics?.length ? `**Topics:** ${r.topics.join(", ")}` : ""}`,
        },
      ],
    };
  }
);

/**
 * Create the GitHub MCP server with all tools
 */
export function createGitHubMcpServer(githubToken: string, cwd?: string) {
  // Create context that will be passed to tool handlers
  const toolContext = { githubToken, cwd };

  // Wrap tools to inject context
  const wrapTool = (toolDef: any) => ({
    ...toolDef,
    handler: (args: any) => toolDef.handler(args, toolContext),
  });

  return createSdkMcpServer({
    name: "github",
    version: "1.0.0",
    tools: [
      wrapTool(searchCodeTool),
      wrapTool(readFileTool),
      wrapTool(listFilesTool),
      wrapTool(listIssuesTool),
      wrapTool(getIssueTool),
      wrapTool(listPRsTool),
      wrapTool(getPRTool),
      wrapTool(cloneRepoTool),
      wrapTool(repoInfoTool),
    ],
  });
}
