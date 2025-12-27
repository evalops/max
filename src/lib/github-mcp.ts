/**
 * GitHub MCP Server - Consolidated tools for GitHub interaction
 *
 * OPTIMIZATION: Reduced from 20 tools to 4 tools to minimize context usage.
 * Each tool uses an 'action' parameter to handle multiple operations.
 *
 * Tools:
 * - github_repo: Repository operations (info, clone, files, search, compare, fork, star)
 * - github_issues: Issue operations (list, get, create, update, comment)
 * - github_prs: Pull request operations (list, get, create, merge, branch)
 * - github_ci: CI/CD and notifications (actions, notifications)
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
  options: { accept?: string; method?: string; body?: string } = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: options.accept || "application/vnd.github.v3+json",
  };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${GITHUB_API}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: options.body,
  });
}

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

// Helper to format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ============================================================================
// CONSOLIDATED TOOL 1: Repository Operations
// ============================================================================

const githubRepoTool = tool(
  "github_repo",
  `Repository operations - info, files, search, clone, compare, fork, star.

Actions:
- info: Get comprehensive repository information
- clone: Clone repository to local filesystem
- list_files: List files and directories in a path
- read_file: Read file contents from repository
- search_code: Search for code across repositories
- file_history: Get commit history for a file
- compare: Compare two branches, tags, or commits
- fork: Fork a repository
- star: Star or unstar a repository

Examples:
- Get repo info: {action: "info", repo: "owner/repo"}
- Clone: {action: "clone", repo: "owner/repo", branch: "main"}
- List files: {action: "list_files", repo: "owner/repo", path: "src"}
- Read file: {action: "read_file", repo: "owner/repo", path: "README.md"}
- Search code: {action: "search_code", query: "function handleAuth", repo: "owner/repo"}
- File history: {action: "file_history", repo: "owner/repo", path: "src/index.ts"}
- Compare: {action: "compare", repo: "owner/repo", base: "main", head: "feature"}
- Fork: {action: "fork", repo: "owner/repo"}
- Star: {action: "star", repo: "owner/repo", star: true}`,
  {
    action: z
      .enum([
        "info",
        "clone",
        "list_files",
        "read_file",
        "search_code",
        "file_history",
        "compare",
        "fork",
        "star",
      ])
      .describe("Action to perform"),
    repo: z.string().describe("Repository in owner/repo format"),
    // For list_files, read_file, file_history
    path: z.string().optional().describe("Path to file or directory"),
    ref: z.string().optional().describe("Branch, tag, or commit SHA"),
    // For read_file
    startLine: z.number().optional().describe("Starting line number"),
    endLine: z.number().optional().describe("Ending line number"),
    // For search_code
    query: z.string().optional().describe("Search query"),
    language: z.string().optional().describe("Filter by language"),
    extension: z.string().optional().describe("Filter by extension"),
    // For list_files
    recursive: z.boolean().optional().describe("List recursively"),
    pattern: z.string().optional().describe("Filter pattern"),
    // For clone
    branch: z.string().optional().describe("Branch to clone"),
    directory: z.string().optional().describe("Target directory"),
    shallow: z.boolean().optional().describe("Shallow clone"),
    // For compare
    base: z.string().optional().describe("Base branch/commit"),
    head: z.string().optional().describe("Head branch/commit"),
    includeDiff: z.boolean().optional().describe("Include diff"),
    // For fork
    organization: z.string().optional().describe("Org to fork to"),
    // For star
    star: z.boolean().optional().describe("true to star, false to unstar"),
    // Pagination
    perPage: z.number().optional().describe("Results per page"),
    page: z.number().optional().describe("Page number"),
  },
  async (args, extra) => {
    const context = extra as { githubToken?: string; cwd?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    switch (args.action) {
      case "info": {
        const response = await githubFetch(`/repos/${args.repo}`, token);
        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const r = await response.json();
        let result = `# ${r.full_name}\n\n${r.description || "_No description_"}\n\n`;
        result += `| Stat | Value |\n|------|-------|\n`;
        result += `| Stars | ${r.stargazers_count.toLocaleString()} |\n`;
        result += `| Forks | ${r.forks_count.toLocaleString()} |\n`;
        result += `| Issues | ${r.open_issues_count.toLocaleString()} |\n\n`;
        result += `**Language:** ${r.language || "N/A"}\n`;
        result += `**Default Branch:** \`${r.default_branch}\`\n`;
        result += `**License:** ${r.license?.name || "None"}\n`;
        result += `**Updated:** ${formatRelativeTime(r.updated_at)}\n`;
        result += `**URL:** ${r.html_url}`;

        // Fetch languages
        try {
          const langResponse = await githubFetch(`/repos/${args.repo}/languages`, token);
          if (langResponse.ok) {
            const languages = await langResponse.json();
            const total = Object.values(languages).reduce(
              (a: number, b: unknown) => a + (b as number),
              0
            );
            const langBreakdown = Object.entries(languages)
              .map(([lang, bytes]) => `${lang}: ${(((bytes as number) / total) * 100).toFixed(1)}%`)
              .slice(0, 5)
              .join(" | ");
            if (langBreakdown) result += `\n\n**Languages:** ${langBreakdown}`;
          }
        } catch {
          /* ignore */
        }

        // Fetch recent commits
        try {
          const commitsResponse = await githubFetch(
            `/repos/${args.repo}/commits?per_page=5`,
            token
          );
          if (commitsResponse.ok) {
            const commits = await commitsResponse.json();
            if (commits.length > 0) {
              result += `\n\n## Recent Commits\n`;
              for (const commit of commits) {
                const sha = commit.sha.substring(0, 7);
                const message = commit.commit.message.split("\n")[0].substring(0, 50);
                const author = commit.author?.login || commit.commit.author.name;
                result += `- \`${sha}\` ${message} (@${author})\n`;
              }
            }
          }
        } catch {
          /* ignore */
        }

        return { content: [{ type: "text", text: result }] };
      }

      case "clone": {
        const cwd = context?.cwd || process.cwd();
        const repoName = args.directory || args.repo.split("/")[1];
        const targetPath = path.join(cwd, repoName);

        try {
          await fs.access(targetPath);
          return {
            content: [{ type: "text", text: `Directory ${repoName} already exists.` }],
            isError: true,
          };
        } catch {
          /* doesn't exist, good */
        }

        const cloneUrl = `https://${token}@github.com/${args.repo}.git`;
        let cmd = `git clone`;
        if (args.shallow !== false) cmd += ` --depth 1`;
        if (args.branch) cmd += ` --branch ${args.branch}`;
        cmd += ` "${cloneUrl}" "${repoName}"`;

        try {
          await execAsync(cmd, { cwd });
          const { stdout: branchOutput } = await execAsync("git branch --show-current", {
            cwd: targetPath,
          });
          const { stdout: commitOutput } = await execAsync("git log -1 --format='%h %s'", {
            cwd: targetPath,
          });

          return {
            content: [
              {
                type: "text",
                text: `Cloned **${args.repo}** to ${targetPath}\n\nBranch: ${branchOutput.trim()}\nCommit: ${commitOutput.trim()}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Clone failed: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }

      case "list_files": {
        const dirPath = args.path || "";

        if (args.recursive) {
          const treeRef = args.ref || "HEAD";
          const response = await githubFetch(
            `/repos/${args.repo}/git/trees/${treeRef}?recursive=1`,
            token
          );
          if (!response.ok) {
            const error = await response.json();
            return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
          }

          const data = await response.json();
          const items = data.tree
            .filter((item: { path: string }) => {
              if (dirPath && !item.path.startsWith(dirPath)) return false;
              if (args.pattern && !item.path.includes(args.pattern)) return false;
              return true;
            })
            .slice(0, 100);

          const result = items
            .map((item: { type: string; path: string; size?: number }) => {
              const icon = item.type === "tree" ? "📁" : "📄";
              const size = item.type === "blob" && item.size ? ` (${formatSize(item.size)})` : "";
              return `${icon} ${item.path}${size}`;
            })
            .join("\n");

          return {
            content: [
              { type: "text", text: `📁 **${args.repo}/${dirPath || "(root)"}**\n\n${result}` },
            ],
          };
        }

        const endpoint = args.ref
          ? `/repos/${args.repo}/contents/${dirPath}?ref=${args.ref}`
          : `/repos/${args.repo}/contents/${dirPath}`;
        const response = await githubFetch(endpoint, token);

        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
          return {
            content: [{ type: "text", text: "Path is a file, use read_file action." }],
            isError: true,
          };
        }

        const items = data
          .filter((item: { name: string }) => !args.pattern || item.name.includes(args.pattern))
          .sort((a: { type: string; name: string }, b: { type: string; name: string }) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === "dir" ? -1 : 1;
          });

        const result = items
          .map((item: { type: string; name: string; size: number }) => {
            const icon = item.type === "dir" ? "📁" : "📄";
            const size = item.type === "file" ? ` (${formatSize(item.size)})` : "";
            return `${icon} ${item.name}${size}`;
          })
          .join("\n");

        return {
          content: [
            { type: "text", text: `📁 **${args.repo}/${dirPath || "(root)"}**\n\n${result}` },
          ],
        };
      }

      case "read_file": {
        if (!args.path) {
          return {
            content: [{ type: "text", text: "path is required for read_file" }],
            isError: true,
          };
        }

        const endpoint = args.ref
          ? `/repos/${args.repo}/contents/${args.path}?ref=${args.ref}`
          : `/repos/${args.repo}/contents/${args.path}`;
        const response = await githubFetch(endpoint, token);

        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const data = await response.json();
        if (data.type !== "file") {
          return {
            content: [{ type: "text", text: "Path is a directory, use list_files." }],
            isError: true,
          };
        }

        if (data.content === undefined && data.download_url) {
          return {
            content: [
              { type: "text", text: `File too large (${formatSize(data.size)}). Clone the repo.` },
            ],
            isError: true,
          };
        }

        let content = Buffer.from(data.content, "base64").toString("utf-8");
        const totalLines = content.split("\n").length;

        if (args.startLine || args.endLine) {
          const lines = content.split("\n");
          const start = (args.startLine || 1) - 1;
          const end = args.endLine || lines.length;
          content = lines.slice(start, end).join("\n");
        }

        let result = `📄 **${args.path}**${args.ref ? ` (${args.ref})` : ""}\n`;
        result += `Size: ${formatSize(data.size)} | Lines: ${totalLines}\n`;
        result += `\n\`\`\`\n${content}\n\`\`\``;

        return { content: [{ type: "text", text: result }] };
      }

      case "search_code": {
        if (!args.query) {
          return {
            content: [{ type: "text", text: "query is required for search_code" }],
            isError: true,
          };
        }

        let searchQuery = args.query;
        if (args.repo) searchQuery += ` repo:${args.repo}`;
        if (args.language) searchQuery += ` language:${args.language}`;
        if (args.extension) searchQuery += ` extension:${args.extension}`;

        const perPage = args.perPage || 30;
        const page = args.page || 1;
        const response = await githubFetch(
          `/search/code?q=${encodeURIComponent(searchQuery)}&per_page=${perPage}&page=${page}`,
          token,
          { accept: "application/vnd.github.text-match+json" }
        );

        if (!response.ok) {
          const error = await response.json();
          return {
            content: [{ type: "text", text: `Search failed: ${error.message}` }],
            isError: true,
          };
        }

        const data = await response.json();
        const results = data.items?.map(
          (item: {
            path: string;
            repository: { full_name: string };
            html_url: string;
            text_matches?: Array<{ fragment: string }>;
          }) => {
            const result: Record<string, unknown> = {
              path: item.path,
              repo: item.repository.full_name,
              url: item.html_url,
            };
            if (item.text_matches?.length) {
              result.matches = item.text_matches.slice(0, 2).map((m: { fragment: string }) => ({
                fragment: m.fragment?.substring(0, 150),
              }));
            }
            return result;
          }
        );

        return {
          content: [
            {
              type: "text",
              text: `Found ${data.total_count} results for "${args.query}":\n\n${JSON.stringify(results, null, 2)}`,
            },
          ],
        };
      }

      case "file_history": {
        if (!args.path) {
          return {
            content: [{ type: "text", text: "path is required for file_history" }],
            isError: true,
          };
        }

        const perPage = args.perPage || 20;
        let endpoint = `/repos/${args.repo}/commits?path=${encodeURIComponent(args.path)}&per_page=${perPage}`;
        if (args.ref) endpoint += `&sha=${args.ref}`;

        const response = await githubFetch(endpoint, token);
        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const commits = await response.json();
        let result = `# History of ${args.path}\n\n`;

        for (const commit of commits) {
          const sha = commit.sha.substring(0, 7);
          const message = commit.commit.message.split("\n")[0];
          const author = commit.author?.login || commit.commit.author.name;
          const time = formatRelativeTime(commit.commit.author.date);
          result += `\`${sha}\` ${message}\n  └ @${author} · ${time}\n\n`;
        }

        return { content: [{ type: "text", text: result }] };
      }

      case "compare": {
        if (!args.base || !args.head) {
          return {
            content: [{ type: "text", text: "base and head are required for compare" }],
            isError: true,
          };
        }

        const response = await githubFetch(
          `/repos/${args.repo}/compare/${args.base}...${args.head}`,
          token
        );
        if (!response.ok) {
          const error = await response.json();
          return {
            content: [{ type: "text", text: `Compare failed: ${error.message}` }],
            isError: true,
          };
        }

        const data = await response.json();
        let result = `# Comparing ${args.base}...${args.head}\n\n`;
        result += `**Status:** ${data.status}\n`;
        result += `**Ahead:** ${data.ahead_by} | **Behind:** ${data.behind_by}\n`;
        result += `**Commits:** ${data.total_commits} | **Files:** ${data.files?.length || 0}\n\n`;

        if (data.commits?.length) {
          result += `## Commits\n`;
          for (const commit of data.commits.slice(0, 15)) {
            const sha = commit.sha.substring(0, 7);
            const message = commit.commit.message.split("\n")[0].substring(0, 50);
            result += `- \`${sha}\` ${message}\n`;
          }
        }

        if (data.files?.length) {
          result += `\n## Files Changed\n`;
          let additions = 0,
            deletions = 0;
          for (const file of data.files.slice(0, 20)) {
            const icon = file.status === "added" ? "+" : file.status === "removed" ? "-" : "~";
            result += `${icon} \`${file.filename}\` (+${file.additions}/-${file.deletions})\n`;
            additions += file.additions;
            deletions += file.deletions;
          }
          result += `\n**Total:** +${additions}/-${deletions}`;
        }

        if (args.includeDiff) {
          const diffResponse = await githubFetch(
            `/repos/${args.repo}/compare/${args.base}...${args.head}`,
            token,
            { accept: "application/vnd.github.v3.diff" }
          );
          if (diffResponse.ok) {
            const diff = await diffResponse.text();
            const truncated =
              diff.length > 10000 ? diff.substring(0, 10000) + "\n...(truncated)" : diff;
            result += `\n\n## Diff\n\`\`\`diff\n${truncated}\n\`\`\``;
          }
        }

        return { content: [{ type: "text", text: result }] };
      }

      case "fork": {
        const payload: Record<string, unknown> = {};
        if (args.organization) payload.organization = args.organization;

        const response = await githubFetch(`/repos/${args.repo}/forks`, token, {
          method: "POST",
          body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
        });

        if (!response.ok) {
          const error = await response.json();
          return {
            content: [{ type: "text", text: `Fork failed: ${error.message}` }],
            isError: true,
          };
        }

        const fork = await response.json();
        return {
          content: [{ type: "text", text: `🍴 Forked to ${fork.full_name}\n${fork.html_url}` }],
        };
      }

      case "star": {
        if (args.star === undefined) {
          return {
            content: [{ type: "text", text: "star (true/false) is required" }],
            isError: true,
          };
        }

        const response = await githubFetch(`/user/starred/${args.repo}`, token, {
          method: args.star ? "PUT" : "DELETE",
        });

        if (!response.ok && response.status !== 204) {
          return {
            content: [{ type: "text", text: `Failed to ${args.star ? "star" : "unstar"}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: args.star ? `⭐ Starred ${args.repo}` : `Unstarred ${args.repo}`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown action: ${args.action}` }],
          isError: true,
        };
    }
  }
);

// ============================================================================
// CONSOLIDATED TOOL 2: Issue Operations
// ============================================================================

const githubIssuesTool = tool(
  "github_issues",
  `Issue operations - list, get, create, update, add comments.

Actions:
- list: List issues with filters
- get: Get detailed issue information
- create: Create a new issue
- update: Update an existing issue
- comment: Add a comment to an issue

Examples:
- List open issues: {action: "list", repo: "owner/repo"}
- List bugs: {action: "list", repo: "owner/repo", labels: ["bug"]}
- Get issue: {action: "get", repo: "owner/repo", number: 123}
- Create issue: {action: "create", repo: "owner/repo", title: "Bug report", body: "Description"}
- Close issue: {action: "update", repo: "owner/repo", number: 123, state: "closed"}
- Add comment: {action: "comment", repo: "owner/repo", number: 123, body: "Thanks!"}`,
  {
    action: z.enum(["list", "get", "create", "update", "comment"]).describe("Action to perform"),
    repo: z.string().describe("Repository in owner/repo format"),
    number: z.number().optional().describe("Issue number (for get/update/comment)"),
    // For list
    state: z.enum(["open", "closed", "all"]).optional().describe("Filter by state"),
    labels: z.array(z.string()).optional().describe("Filter by labels"),
    assignee: z.string().optional().describe("Filter by assignee"),
    creator: z.string().optional().describe("Filter by creator"),
    search: z.string().optional().describe("Search in title/body"),
    sort: z.enum(["created", "updated", "comments"]).optional(),
    // For create/update
    title: z.string().optional().describe("Issue title"),
    body: z.string().optional().describe("Issue body"),
    assignees: z.array(z.string()).optional().describe("Assignees to set"),
    milestone: z.number().optional().describe("Milestone number"),
    // For get
    includeComments: z.boolean().optional().describe("Include comments"),
    includeTimeline: z.boolean().optional().describe("Include timeline"),
    // Pagination
    perPage: z.number().optional(),
    page: z.number().optional(),
  },
  async (args, extra) => {
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    switch (args.action) {
      case "list": {
        const state = args.state || "open";
        const perPage = args.perPage || 30;
        const page = args.page || 1;

        if (args.search) {
          let searchQuery = `${args.search} repo:${args.repo} is:issue`;
          if (state !== "all") searchQuery += ` is:${state}`;
          if (args.labels?.length) args.labels.forEach((l) => (searchQuery += ` label:"${l}"`));
          if (args.assignee) searchQuery += ` assignee:${args.assignee}`;

          const response = await githubFetch(
            `/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=${perPage}&page=${page}`,
            token
          );

          if (!response.ok) {
            const error = await response.json();
            return {
              content: [{ type: "text", text: `Search failed: ${error.message}` }],
              isError: true,
            };
          }

          const data = await response.json();
          const issues = data.items.filter(
            (item: { pull_request?: unknown }) => !item.pull_request
          );
          return formatIssuesList(issues, data.total_count, args.repo, args.search);
        }

        let endpoint = `/repos/${args.repo}/issues?state=${state}&sort=${args.sort || "created"}&per_page=${perPage}&page=${page}`;
        if (args.labels?.length) endpoint += `&labels=${args.labels.join(",")}`;
        if (args.assignee) endpoint += `&assignee=${args.assignee}`;
        if (args.creator) endpoint += `&creator=${args.creator}`;

        const response = await githubFetch(endpoint, token);
        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const data = await response.json();
        const issues = data.filter((item: { pull_request?: unknown }) => !item.pull_request);
        return formatIssuesList(issues, issues.length, args.repo);
      }

      case "get": {
        if (!args.number) {
          return { content: [{ type: "text", text: "number is required for get" }], isError: true };
        }

        const response = await githubFetch(`/repos/${args.repo}/issues/${args.number}`, token);
        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const issue = await response.json();
        const assignees =
          issue.assignees?.map((a: { login: string }) => `@${a.login}`).join(", ") || "None";

        let result = `# Issue #${issue.number}: ${issue.title}\n\n`;
        result += `**State:** ${issue.state === "open" ? "🟢 Open" : "🔴 Closed"}\n`;
        result += `**Author:** @${issue.user.login}\n`;
        result += `**Assignees:** ${assignees}\n`;
        result += `**Labels:** ${issue.labels.map((l: { name: string }) => `\`${l.name}\``).join(", ") || "None"}\n`;
        result += `**Created:** ${formatRelativeTime(issue.created_at)}\n`;
        result += `**URL:** ${issue.html_url}\n\n`;
        result += `## Description\n\n${issue.body || "_No description_"}\n`;

        if (args.includeComments !== false && issue.comments > 0) {
          const commentsResponse = await githubFetch(
            `/repos/${args.repo}/issues/${args.number}/comments?per_page=15`,
            token
          );
          if (commentsResponse.ok) {
            const comments = await commentsResponse.json();
            result += `\n## Comments (${issue.comments})\n`;
            for (const comment of comments) {
              result += `\n---\n**@${comment.user.login}** · ${formatRelativeTime(comment.created_at)}\n\n${comment.body}\n`;
            }
            if (issue.comments > 15) {
              result += `\n_... and ${issue.comments - 15} more comments_`;
            }
          }
        }

        return { content: [{ type: "text", text: result }] };
      }

      case "create": {
        if (!args.title) {
          return {
            content: [{ type: "text", text: "title is required for create" }],
            isError: true,
          };
        }

        const payload: Record<string, unknown> = { title: args.title };
        if (args.body) payload.body = args.body;
        if (args.labels?.length) payload.labels = args.labels;
        if (args.assignees?.length) payload.assignees = args.assignees;
        if (args.milestone) payload.milestone = args.milestone;

        const response = await githubFetch(`/repos/${args.repo}/issues`, token, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const issue = await response.json();
        return {
          content: [
            {
              type: "text",
              text: `✅ Created issue #${issue.number}: ${issue.title}\n${issue.html_url}`,
            },
          ],
        };
      }

      case "update": {
        if (!args.number) {
          return {
            content: [{ type: "text", text: "number is required for update" }],
            isError: true,
          };
        }

        const payload: Record<string, unknown> = {};
        if (args.title !== undefined) payload.title = args.title;
        if (args.body !== undefined) payload.body = args.body;
        if (args.state !== undefined) payload.state = args.state;
        if (args.labels !== undefined) payload.labels = args.labels;
        if (args.assignees !== undefined) payload.assignees = args.assignees;
        if (args.milestone !== undefined) payload.milestone = args.milestone;

        const response = await githubFetch(`/repos/${args.repo}/issues/${args.number}`, token, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const issue = await response.json();
        return {
          content: [{ type: "text", text: `✅ Updated #${args.number}\n${issue.html_url}` }],
        };
      }

      case "comment": {
        if (!args.number || !args.body) {
          return {
            content: [{ type: "text", text: "number and body are required for comment" }],
            isError: true,
          };
        }

        const response = await githubFetch(
          `/repos/${args.repo}/issues/${args.number}/comments`,
          token,
          {
            method: "POST",
            body: JSON.stringify({ body: args.body }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const comment = await response.json();
        return {
          content: [
            { type: "text", text: `✅ Added comment to #${args.number}\n${comment.html_url}` },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown action: ${args.action}` }],
          isError: true,
        };
    }
  }
);

function formatIssuesList(
  issues: Array<{
    number: number;
    title: string;
    state: string;
    user: { login: string };
    labels: Array<{ name: string }>;
    comments: number;
    created_at: string;
    updated_at: string;
  }>,
  total: number,
  repo: string,
  search?: string
) {
  let result = `📋 **Issues in ${repo}**${search ? ` matching "${search}"` : ""}\n`;
  result += `Found ${total} issues\n\n`;

  for (const issue of issues) {
    const stateIcon = issue.state === "open" ? "🟢" : "🔴";
    const labels = issue.labels.map((l) => l.name).join(", ");
    result += `**#${issue.number}** ${issue.title}\n`;
    result += `  ${stateIcon} ${issue.state} | @${issue.user.login} | 💬 ${issue.comments}`;
    if (labels) result += `\n  🏷️ ${labels}`;
    result += `\n  Created ${formatRelativeTime(issue.created_at)}\n\n`;
  }

  return { content: [{ type: "text", text: result }] };
}

// ============================================================================
// CONSOLIDATED TOOL 3: Pull Request Operations
// ============================================================================

const githubPRsTool = tool(
  "github_prs",
  `Pull request operations - list, get, create, merge, create branch.

Actions:
- list: List pull requests with filters
- get: Get detailed PR information with diff
- create: Create a new pull request
- merge: Merge a pull request
- branch: Create a new branch

Examples:
- List open PRs: {action: "list", repo: "owner/repo"}
- Get PR with diff: {action: "get", repo: "owner/repo", number: 123}
- Create PR: {action: "create", repo: "owner/repo", title: "Feature", head: "feature", base: "main"}
- Merge PR: {action: "merge", repo: "owner/repo", number: 123, mergeMethod: "squash"}
- Create branch: {action: "branch", repo: "owner/repo", branch: "feature/new", from: "main"}`,
  {
    action: z.enum(["list", "get", "create", "merge", "branch"]).describe("Action to perform"),
    repo: z.string().describe("Repository in owner/repo format"),
    number: z.number().optional().describe("PR number (for get/merge)"),
    // For list
    state: z.enum(["open", "closed", "all"]).optional(),
    base: z.string().optional().describe("Filter by base branch"),
    head: z.string().optional().describe("Head branch (for list filter or create)"),
    author: z.string().optional().describe("Filter by author"),
    search: z.string().optional().describe("Search in title/body"),
    // For create
    title: z.string().optional().describe("PR title"),
    body: z.string().optional().describe("PR description"),
    draft: z.boolean().optional().describe("Create as draft"),
    // For merge
    mergeMethod: z.enum(["merge", "squash", "rebase"]).optional(),
    commitTitle: z.string().optional().describe("Merge commit title"),
    commitMessage: z.string().optional().describe("Merge commit message"),
    // For branch
    branch: z.string().optional().describe("New branch name"),
    from: z.string().optional().describe("Source branch/commit"),
    // For get
    includeDiff: z.boolean().optional().describe("Include diff"),
    includeFiles: z.boolean().optional().describe("Include file list"),
    includeReviews: z.boolean().optional().describe("Include reviews"),
    // Pagination
    perPage: z.number().optional(),
    page: z.number().optional(),
  },
  async (args, extra) => {
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    switch (args.action) {
      case "list": {
        const state = args.state || "open";
        const perPage = args.perPage || 30;
        const page = args.page || 1;

        if (args.search || args.author) {
          let searchQuery = `repo:${args.repo} is:pr`;
          if (args.search) searchQuery = `${args.search} ${searchQuery}`;
          if (state !== "all") searchQuery += ` is:${state}`;
          if (args.author) searchQuery += ` author:${args.author}`;
          if (args.base) searchQuery += ` base:${args.base}`;

          const response = await githubFetch(
            `/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=${perPage}&page=${page}`,
            token
          );

          if (!response.ok) {
            const error = await response.json();
            return {
              content: [{ type: "text", text: `Search failed: ${error.message}` }],
              isError: true,
            };
          }

          const data = await response.json();
          return formatPRsList(data.items, data.total_count, args.repo, args.search);
        }

        let endpoint = `/repos/${args.repo}/pulls?state=${state}&per_page=${perPage}&page=${page}`;
        if (args.head) endpoint += `&head=${args.head}`;
        if (args.base) endpoint += `&base=${args.base}`;

        const response = await githubFetch(endpoint, token);
        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const prs = await response.json();
        return formatPRsList(prs, prs.length, args.repo);
      }

      case "get": {
        if (!args.number) {
          return { content: [{ type: "text", text: "number is required for get" }], isError: true };
        }

        const response = await githubFetch(`/repos/${args.repo}/pulls/${args.number}`, token);
        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const pr = await response.json();
        const stateIcon = pr.merged ? "🟣 Merged" : pr.state === "open" ? "🟢 Open" : "🔴 Closed";

        let result = `# PR #${pr.number}: ${pr.title}\n\n`;
        result += `**State:** ${stateIcon}${pr.draft ? " (Draft)" : ""}\n`;
        result += `**Author:** @${pr.user.login}\n`;
        result += `**Branch:** \`${pr.head.ref}\` → \`${pr.base.ref}\`\n`;
        result += `**Mergeable:** ${pr.mergeable === null ? "Checking..." : pr.mergeable ? "✅ Yes" : "❌ No"}\n`;
        result += `**Changes:** +${pr.additions}/-${pr.deletions} in ${pr.changed_files} files\n`;
        result += `**Created:** ${formatRelativeTime(pr.created_at)}\n`;
        result += `**URL:** ${pr.html_url}\n\n`;
        result += `## Description\n\n${pr.body || "_No description_"}\n`;

        // Fetch reviews
        if (args.includeReviews !== false) {
          try {
            const reviewsResponse = await githubFetch(
              `/repos/${args.repo}/pulls/${args.number}/reviews`,
              token
            );
            if (reviewsResponse.ok) {
              const reviews = await reviewsResponse.json();
              const significant = reviews.filter(
                (r: { state: string; body?: string }) => r.state !== "COMMENTED" || r.body
              );
              if (significant.length > 0) {
                result += `\n## Reviews\n`;
                for (const review of significant.slice(0, 10)) {
                  const icon =
                    review.state === "APPROVED"
                      ? "✅"
                      : review.state === "CHANGES_REQUESTED"
                        ? "🔴"
                        : "💬";
                  result += `${icon} **@${review.user.login}** - ${review.state.toLowerCase()}\n`;
                }
              }
            }
          } catch {
            /* ignore */
          }
        }

        // Fetch files
        if (args.includeFiles !== false) {
          try {
            const filesResponse = await githubFetch(
              `/repos/${args.repo}/pulls/${args.number}/files?per_page=50`,
              token
            );
            if (filesResponse.ok) {
              const files = await filesResponse.json();
              result += `\n## Files Changed (${files.length})\n`;
              for (const file of files.slice(0, 20)) {
                const icon = file.status === "added" ? "+" : file.status === "removed" ? "-" : "~";
                result += `${icon} \`${file.filename}\` (+${file.additions}/-${file.deletions})\n`;
              }
              if (files.length > 20) result += `_... and ${files.length - 20} more_\n`;
            }
          } catch {
            /* ignore */
          }
        }

        // Fetch diff
        if (args.includeDiff) {
          try {
            const diffResponse = await githubFetch(
              `/repos/${args.repo}/pulls/${args.number}`,
              token,
              { accept: "application/vnd.github.v3.diff" }
            );
            if (diffResponse.ok) {
              const diff = await diffResponse.text();
              const truncated =
                diff.length > 10000 ? diff.substring(0, 10000) + "\n...(truncated)" : diff;
              result += `\n## Diff\n\`\`\`diff\n${truncated}\n\`\`\``;
            }
          } catch {
            /* ignore */
          }
        }

        return { content: [{ type: "text", text: result }] };
      }

      case "create": {
        if (!args.title || !args.head || !args.base) {
          return {
            content: [{ type: "text", text: "title, head, and base are required for create" }],
            isError: true,
          };
        }

        const payload: Record<string, unknown> = {
          title: args.title,
          head: args.head,
          base: args.base,
          draft: args.draft || false,
        };
        if (args.body) payload.body = args.body;

        const response = await githubFetch(`/repos/${args.repo}/pulls`, token, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const pr = await response.json();
        return {
          content: [
            { type: "text", text: `✅ Created PR #${pr.number}: ${pr.title}\n${pr.html_url}` },
          ],
        };
      }

      case "merge": {
        if (!args.number) {
          return {
            content: [{ type: "text", text: "number is required for merge" }],
            isError: true,
          };
        }

        // Check PR status first
        const prResponse = await githubFetch(`/repos/${args.repo}/pulls/${args.number}`, token);
        if (!prResponse.ok) {
          return { content: [{ type: "text", text: "Failed to get PR details" }], isError: true };
        }

        const pr = await prResponse.json();
        if (pr.state !== "open") {
          return {
            content: [{ type: "text", text: `PR is already ${pr.merged ? "merged" : "closed"}` }],
            isError: true,
          };
        }
        if (pr.mergeable === false) {
          return { content: [{ type: "text", text: "PR has merge conflicts" }], isError: true };
        }

        const payload: Record<string, unknown> = { merge_method: args.mergeMethod || "merge" };
        if (args.commitTitle) payload.commit_title = args.commitTitle;
        if (args.commitMessage) payload.commit_message = args.commitMessage;

        const response = await githubFetch(
          `/repos/${args.repo}/pulls/${args.number}/merge`,
          token,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          return {
            content: [{ type: "text", text: `Merge failed: ${error.message}` }],
            isError: true,
          };
        }

        const result = await response.json();
        return {
          content: [
            {
              type: "text",
              text: `✅ Merged PR #${args.number} (${args.mergeMethod || "merge"})\nSHA: ${result.sha?.substring(0, 7)}`,
            },
          ],
        };
      }

      case "branch": {
        if (!args.branch) {
          return { content: [{ type: "text", text: "branch name is required" }], isError: true };
        }

        // Get SHA to branch from
        let sha: string;
        if (args.from && args.from.match(/^[a-f0-9]{40}$/i)) {
          sha = args.from;
        } else {
          // Get default branch if not specified
          const repoResponse = await githubFetch(`/repos/${args.repo}`, token);
          if (!repoResponse.ok) {
            return { content: [{ type: "text", text: "Failed to get repo info" }], isError: true };
          }
          const repoData = await repoResponse.json();
          const sourceBranch = args.from || repoData.default_branch;

          const refResponse = await githubFetch(
            `/repos/${args.repo}/git/ref/heads/${sourceBranch}`,
            token
          );
          if (!refResponse.ok) {
            return {
              content: [{ type: "text", text: `Branch ${sourceBranch} not found` }],
              isError: true,
            };
          }
          const ref = await refResponse.json();
          sha = ref.object.sha;
        }

        const response = await githubFetch(`/repos/${args.repo}/git/refs`, token, {
          method: "POST",
          body: JSON.stringify({ ref: `refs/heads/${args.branch}`, sha }),
        });

        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        return {
          content: [
            {
              type: "text",
              text: `✅ Created branch \`${args.branch}\` from ${args.from || "default"}\nSHA: ${sha.substring(0, 7)}`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown action: ${args.action}` }],
          isError: true,
        };
    }
  }
);

function formatPRsList(
  prs: Array<{
    number: number;
    title: string;
    state: string;
    merged_at?: string;
    draft?: boolean;
    user: { login: string };
    head: { ref: string };
    base: { ref: string };
    additions?: number;
    deletions?: number;
    changed_files?: number;
    created_at: string;
  }>,
  total: number,
  repo: string,
  search?: string
) {
  let result = `🔀 **Pull Requests in ${repo}**${search ? ` matching "${search}"` : ""}\n`;
  result += `Found ${total} PRs\n\n`;

  for (const pr of prs) {
    const stateIcon = pr.merged_at ? "🟣" : pr.state === "open" ? "🟢" : "🔴";
    const draft = pr.draft ? " [DRAFT]" : "";
    result += `**#${pr.number}** ${pr.title}${draft}\n`;
    result += `  ${stateIcon} ${pr.merged_at ? "merged" : pr.state} | @${pr.user.login}\n`;
    result += `  ${pr.head.ref} → ${pr.base.ref}`;
    if (pr.additions !== undefined) result += ` | +${pr.additions}/-${pr.deletions}`;
    result += `\n  Created ${formatRelativeTime(pr.created_at)}\n\n`;
  }

  return { content: [{ type: "text", text: result }] };
}

// ============================================================================
// CONSOLIDATED TOOL 4: CI/CD and Notifications
// ============================================================================

const githubCITool = tool(
  "github_ci",
  `CI/CD and notification operations - workflow runs, notifications.

Actions:
- actions: List GitHub Actions workflow runs
- notifications: Get your GitHub notifications

Examples:
- Recent runs: {action: "actions", repo: "owner/repo"}
- Failed runs: {action: "actions", repo: "owner/repo", status: "failure"}
- Workflow runs: {action: "actions", repo: "owner/repo", workflow: "ci.yml"}
- Get notifications: {action: "notifications"}
- Participating only: {action: "notifications", participating: true}`,
  {
    action: z.enum(["actions", "notifications"]).describe("Action to perform"),
    repo: z.string().optional().describe("Repository (required for actions)"),
    // For actions
    workflow: z.string().optional().describe("Workflow file name or ID"),
    branch: z.string().optional().describe("Filter by branch"),
    status: z
      .enum([
        "completed",
        "action_required",
        "cancelled",
        "failure",
        "neutral",
        "skipped",
        "stale",
        "success",
        "timed_out",
        "in_progress",
        "queued",
        "requested",
        "waiting",
        "pending",
      ])
      .optional(),
    event: z.string().optional().describe("Filter by trigger event"),
    // For notifications
    all: z.boolean().optional().describe("Include read notifications"),
    participating: z.boolean().optional().describe("Only participating"),
    // Pagination
    perPage: z.number().optional(),
  },
  async (args, extra) => {
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    switch (args.action) {
      case "actions": {
        if (!args.repo) {
          return {
            content: [{ type: "text", text: "repo is required for actions" }],
            isError: true,
          };
        }

        const perPage = args.perPage || 20;
        let endpoint = args.workflow
          ? `/repos/${args.repo}/actions/workflows/${args.workflow}/runs?per_page=${perPage}`
          : `/repos/${args.repo}/actions/runs?per_page=${perPage}`;

        if (args.branch) endpoint += `&branch=${args.branch}`;
        if (args.status) endpoint += `&status=${args.status}`;
        if (args.event) endpoint += `&event=${args.event}`;

        const response = await githubFetch(endpoint, token);
        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const data = await response.json();
        const runs = data.workflow_runs || [];

        let result = `# GitHub Actions - ${args.repo}\n`;
        result += `Found ${data.total_count} runs${args.branch ? ` on ${args.branch}` : ""}\n\n`;

        for (const run of runs) {
          const icon =
            run.conclusion === "success"
              ? "✅"
              : run.conclusion === "failure"
                ? "❌"
                : run.conclusion === "cancelled"
                  ? "⏹️"
                  : run.status === "in_progress"
                    ? "🔄"
                    : "⏳";

          const duration =
            run.updated_at && run.created_at
              ? Math.round(
                  (new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()) / 1000
                )
              : null;
          const durationStr = duration ? `${Math.floor(duration / 60)}m ${duration % 60}s` : "";

          result += `${icon} **${run.name}** #${run.run_number}\n`;
          result += `  ${run.conclusion || run.status} | ${run.event} | \`${run.head_branch}\``;
          if (durationStr) result += ` | ⏱️ ${durationStr}`;
          result += `\n  ${run.head_commit?.message?.split("\n")[0].substring(0, 50) || "No message"}\n\n`;
        }

        return { content: [{ type: "text", text: result }] };
      }

      case "notifications": {
        const all = args.all || false;
        const participating = args.participating || false;
        const perPage = args.perPage || 30;

        const response = await githubFetch(
          `/notifications?all=${all}&participating=${participating}&per_page=${perPage}`,
          token
        );

        if (!response.ok) {
          const error = await response.json();
          return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
        }

        const notifications = await response.json();

        if (notifications.length === 0) {
          return { content: [{ type: "text", text: "🔔 No notifications" }] };
        }

        let result = `# 🔔 Notifications (${notifications.length})\n\n`;

        // Group by repository
        const byRepo = new Map<string, typeof notifications>();
        for (const n of notifications) {
          const repo = n.repository.full_name;
          if (!byRepo.has(repo)) byRepo.set(repo, []);
          byRepo.get(repo)!.push(n);
        }

        for (const [repo, repoNotifications] of byRepo) {
          result += `## ${repo}\n`;
          for (const n of repoNotifications) {
            const icon =
              n.subject.type === "Issue"
                ? "🐛"
                : n.subject.type === "PullRequest"
                  ? "🔀"
                  : n.subject.type === "Release"
                    ? "🏷️"
                    : "📌";
            const unread = n.unread ? "🔵" : "⚪";
            result += `${unread} ${icon} ${n.subject.title}\n`;
            result += `  ${n.reason} · ${formatRelativeTime(n.updated_at)}\n`;
          }
          result += "\n";
        }

        return { content: [{ type: "text", text: result }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown action: ${args.action}` }],
          isError: true,
        };
    }
  }
);

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Create the GitHub MCP server with consolidated tools
 *
 * Reduced from 20 tools to 4:
 * - github_repo: Repository operations
 * - github_issues: Issue operations
 * - github_prs: Pull request operations
 * - github_ci: CI/CD and notifications
 */
export function createGitHubMcpServer(githubToken: string, cwd?: string) {
  const toolContext = { githubToken, cwd };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapTool = (toolDef: any) => ({
    ...toolDef,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: any) => toolDef.handler(args, toolContext),
  });

  return createSdkMcpServer({
    name: "github",
    version: "2.0.0",
    tools: [
      wrapTool(githubRepoTool),
      wrapTool(githubIssuesTool),
      wrapTool(githubPRsTool),
      wrapTool(githubCITool),
    ],
  });
}
