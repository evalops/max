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

// Tool: Search code across GitHub
const searchCodeTool = tool(
  "github_search_code",
  `Search for code across GitHub repositories.

Use this to find specific code patterns, functions, or implementations in repositories.
Returns file paths and code snippets matching the query.

Supports advanced GitHub search syntax:
- "function handleAuth" - exact phrase
- language:typescript - filter by language
- extension:tsx - filter by file extension
- path:src/components - filter by path
- filename:index - filter by filename

Examples:
- Search for a function: {query: "function handleAuth", repo: "owner/repo"}
- Search for imports: {query: "import React", repo: "facebook/react", extension: "tsx"}
- Search in path: {query: "useState", repo: "owner/repo", path: "src/hooks"}`,
  {
    query: z.string().describe("The search query (code, function names, etc.)"),
    repo: z.string().optional().describe("Limit search to specific repo (owner/repo format)"),
    language: z.string().optional().describe("Filter by programming language (typescript, python, go, etc.)"),
    extension: z.string().optional().describe("Filter by file extension (tsx, py, go, etc.)"),
    path: z.string().optional().describe("Filter by path prefix (src/components, lib/, etc.)"),
    filename: z.string().optional().describe("Filter by filename pattern"),
    sort: z.enum(["best-match", "indexed"]).default("best-match").optional().describe("Sort order"),
    perPage: z.number().min(1).max(100).default(30).optional(),
    page: z.number().min(1).default(1).optional().describe("Page number for pagination"),
  },
  async (args, extra) => {
    const { query, repo, language, extension, path: pathFilter, filename, sort = "best-match", perPage = 30, page = 1 } = args;
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    // Build advanced search query
    let searchQuery = query;
    if (repo) searchQuery += ` repo:${repo}`;
    if (language) searchQuery += ` language:${language}`;
    if (extension) searchQuery += ` extension:${extension}`;
    if (pathFilter) searchQuery += ` path:${pathFilter}`;
    if (filename) searchQuery += ` filename:${filename}`;

    const sortParam = sort === "indexed" ? "&sort=indexed" : "";
    const response = await githubFetch(
      `/search/code?q=${encodeURIComponent(searchQuery)}&per_page=${perPage}&page=${page}${sortParam}`,
      token,
      { accept: "application/vnd.github.text-match+json" }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        content: [{ type: "text", text: `GitHub API error: ${error.message || response.statusText}` }],
        isError: true,
      };
    }

    const data = await response.json();

    // Format results with text matches if available
    const results = data.items?.map((item: any) => {
      const result: Record<string, unknown> = {
        path: item.path,
        repo: item.repository.full_name,
        url: item.html_url,
      };

      // Include text matches (code snippets) if available
      if (item.text_matches?.length > 0) {
        result.matches = item.text_matches.slice(0, 3).map((match: any) => ({
          fragment: match.fragment?.substring(0, 200),
        }));
      }

      return result;
    });

    const totalPages = Math.ceil(data.total_count / perPage);
    const paginationInfo = data.total_count > perPage
      ? `\n\nPage ${page}/${totalPages} (use page parameter for more results)`
      : "";

    return {
      content: [
        {
          type: "text",
          text: `Found ${data.total_count} results for "${query}"${repo ? ` in ${repo}` : ""}:${paginationInfo}\n\n${JSON.stringify(results, null, 2)}`,
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
Supports reading specific line ranges for large files.

Examples:
- Read README: {repo: "owner/repo", path: "README.md"}
- Read source file: {repo: "owner/repo", path: "src/index.ts", ref: "main"}
- Read specific lines: {repo: "owner/repo", path: "src/app.ts", startLine: 50, endLine: 100}
- Get file with blame: {repo: "owner/repo", path: "src/index.ts", includeBlame: true}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    path: z.string().describe("Path to the file in the repository"),
    ref: z.string().optional().describe("Branch, tag, or commit SHA (defaults to default branch)"),
    startLine: z.number().min(1).optional().describe("Starting line number (1-indexed)"),
    endLine: z.number().min(1).optional().describe("Ending line number (1-indexed)"),
    includeBlame: z.boolean().default(false).optional().describe("Include git blame info (who last modified each line)"),
    includeMetadata: z.boolean().default(true).optional().describe("Include file metadata (last commit, contributors)"),
  },
  async (args, extra) => {
    const { repo, path: filePath, ref, startLine, endLine, includeBlame = false, includeMetadata = true } = args;
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

    // Check if file is too large (GitHub returns download_url for large files)
    if (data.content === undefined && data.download_url) {
      return {
        content: [{
          type: "text",
          text: `File is too large to read via API (${formatSize(data.size)}). Consider cloning the repo instead.`
        }],
        isError: true,
      };
    }

    // Decode base64 content
    let content = Buffer.from(data.content, "base64").toString("utf-8");
    const totalLines = content.split("\n").length;

    // Apply line range if specified
    if (startLine || endLine) {
      const lines = content.split("\n");
      const start = (startLine || 1) - 1;
      const end = endLine || lines.length;
      content = lines.slice(start, end).join("\n");
    }

    let result = `📄 **${filePath}**${ref ? ` (${ref})` : ""}\n`;
    result += `Size: ${formatSize(data.size)} | Lines: ${totalLines}`;

    if (startLine || endLine) {
      result += ` | Showing lines ${startLine || 1}-${endLine || totalLines}`;
    }
    result += "\n";

    // Fetch commit metadata if requested
    if (includeMetadata) {
      try {
        const commitsEndpoint = ref
          ? `/repos/${repo}/commits?path=${filePath}&sha=${ref}&per_page=1`
          : `/repos/${repo}/commits?path=${filePath}&per_page=1`;
        const commitsResponse = await githubFetch(commitsEndpoint, token);

        if (commitsResponse.ok) {
          const commits = await commitsResponse.json();
          if (commits.length > 0) {
            const lastCommit = commits[0];
            result += `Last modified: ${formatRelativeTime(lastCommit.commit.author.date)} by @${lastCommit.author?.login || lastCommit.commit.author.name}\n`;
            result += `Commit: ${lastCommit.sha.substring(0, 7)} - ${lastCommit.commit.message.split("\n")[0]}\n`;
          }
        }
      } catch {
        // Metadata fetch failed, continue without it
      }
    }

    result += `\n\`\`\`\n${content}\n\`\`\``;

    // Fetch blame info if requested
    if (includeBlame) {
      try {
        // Note: GitHub doesn't have a direct blame API, so we'd need to use GraphQL
        // For now, add a note about using git blame locally
        result += `\n\n💡 For detailed blame info, clone the repo and run: git blame ${filePath}`;
      } catch {
        // Blame fetch failed
      }
    }

    return { content: [{ type: "text", text: result }] };
  }
);

// Tool: List files in a directory
const listFilesTool = tool(
  "github_list_files",
  `List files and directories in a GitHub repository path.

Use this to explore repository structure before reading specific files.
Supports recursive listing and pattern filtering.

Examples:
- List root: {repo: "owner/repo"}
- List src folder: {repo: "owner/repo", path: "src"}
- List all TypeScript files: {repo: "owner/repo", recursive: true, pattern: ".ts"}
- Get full tree: {repo: "owner/repo", recursive: true, showTree: true}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    path: z.string().default("").describe("Directory path (empty for root)"),
    ref: z.string().optional().describe("Branch, tag, or commit SHA"),
    recursive: z.boolean().default(false).optional().describe("List all files recursively"),
    pattern: z.string().optional().describe("Filter files by pattern (e.g., '.ts', 'test', 'README')"),
    showTree: z.boolean().default(false).optional().describe("Show as tree structure (only with recursive)"),
    includeSize: z.boolean().default(true).optional().describe("Show file sizes"),
  },
  async (args, extra) => {
    const { repo, path: dirPath, ref, recursive = false, pattern, showTree = false, includeSize = true } = args;
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    let items: Array<{ name: string; type: string; size: number; path: string }> = [];

    if (recursive) {
      // Use Git Trees API for recursive listing (more efficient)
      const treeRef = ref || "HEAD";
      const response = await githubFetch(
        `/repos/${repo}/git/trees/${treeRef}?recursive=1`,
        token
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          content: [{ type: "text", text: `Failed to list files: ${error.message || response.statusText}` }],
          isError: true,
        };
      }

      const data = await response.json();

      // Filter by path prefix if specified
      items = data.tree
        .filter((item: any) => {
          if (dirPath && !item.path.startsWith(dirPath)) return false;
          if (pattern && !item.path.includes(pattern)) return false;
          return true;
        })
        .map((item: any) => ({
          name: item.path.split("/").pop(),
          type: item.type === "tree" ? "dir" : "file",
          size: item.size || 0,
          path: item.path,
        }));

      if (data.truncated) {
        items.push({ name: "... (results truncated, repository has too many files)", type: "note", size: 0, path: "" });
      }
    } else {
      // Use Contents API for single directory
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

      items = data
        .filter((item: any) => !pattern || item.name.includes(pattern))
        .map((item: any) => ({
          name: item.name,
          type: item.type,
          size: item.size,
          path: item.path,
        }));
    }

    // Sort: directories first, then files
    items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "dir" ? -1 : 1;
    });

    // Format output
    let result = `📁 **${repo}/${dirPath || "(root)"}**${ref ? ` (${ref})` : ""}\n`;
    result += `${items.filter(i => i.type === "dir").length} folders, ${items.filter(i => i.type === "file").length} files\n\n`;

    if (showTree && recursive) {
      // Build tree structure
      type FileItem = { name: string; type: string; size: number; path: string };
      const buildTree = (fileItems: FileItem[]): Record<string, unknown> => {
        const tree: Record<string, unknown> = {};
        for (const item of fileItems) {
          const parts = item.path.split("/");
          let current = tree as Record<string, unknown>;
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
              current[part] = item.type === "dir" ? {} : item.size;
            } else {
              current[part] = current[part] || {};
              current = current[part] as Record<string, unknown>;
            }
          }
        }
        return tree;
      };

      const renderTree = (tree: Record<string, unknown>, prefix = ""): string => {
        const entries = Object.entries(tree);
        return entries.map(([name, value], i) => {
          const isLast = i === entries.length - 1;
          const connector = isLast ? "└── " : "├── ";
          const extension = isLast ? "    " : "│   ";

          if (typeof value === "number") {
            return `${prefix}${connector}${name}${includeSize ? ` (${formatSize(value)})` : ""}`;
          } else {
            const subtree = renderTree(value as Record<string, unknown>, prefix + extension);
            return `${prefix}${connector}📁 ${name}${subtree ? "\n" + subtree : ""}`;
          }
        }).join("\n");
      };

      result += "```\n" + renderTree(buildTree(items)) + "\n```";
    } else {
      result += items
        .map((i) => {
          const icon = i.type === "dir" ? "📁" : "📄";
          const size = i.type === "file" && includeSize ? ` (${formatSize(i.size)})` : "";
          const pathDisplay = recursive ? i.path : i.name;
          return `${icon} ${pathDisplay}${size}`;
        })
        .join("\n");
    }

    return { content: [{ type: "text", text: result }] };
  }
);

// Tool: List issues
const listIssuesTool = tool(
  "github_list_issues",
  `List issues from a GitHub repository.

Use this to see open bugs, feature requests, or discussions in a repo.
Supports filtering, sorting, and searching.

Examples:
- List open issues: {repo: "owner/repo"}
- List bugs: {repo: "owner/repo", labels: ["bug"]}
- List your issues: {repo: "owner/repo", creator: "username"}
- Recently updated: {repo: "owner/repo", sort: "updated", direction: "desc"}
- Search issues: {repo: "owner/repo", search: "authentication error"}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    state: z.enum(["open", "closed", "all"]).default("open").optional(),
    labels: z.array(z.string()).optional().describe("Filter by labels"),
    assignee: z.string().optional().describe("Filter by assignee username (or 'none' for unassigned)"),
    creator: z.string().optional().describe("Filter by issue creator username"),
    milestone: z.string().optional().describe("Filter by milestone number or 'none'"),
    sort: z.enum(["created", "updated", "comments"]).default("created").optional(),
    direction: z.enum(["asc", "desc"]).default("desc").optional(),
    since: z.string().optional().describe("Only issues updated after this date (ISO 8601 format)"),
    search: z.string().optional().describe("Search in issue title and body"),
    perPage: z.number().min(1).max(100).default(30).optional(),
    page: z.number().min(1).default(1).optional(),
  },
  async (args, extra) => {
    const {
      repo, state = "open", labels, assignee, creator, milestone,
      sort = "created", direction = "desc", since, search,
      perPage = 30, page = 1
    } = args;
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    // Use search API if search term provided
    if (search) {
      let searchQuery = `${search} repo:${repo} is:issue`;
      if (state !== "all") searchQuery += ` is:${state}`;
      if (labels?.length) labels.forEach(l => searchQuery += ` label:"${l}"`);
      if (assignee) searchQuery += ` assignee:${assignee}`;
      if (creator) searchQuery += ` author:${creator}`;

      const response = await githubFetch(
        `/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=${perPage}&page=${page}`,
        token
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          content: [{ type: "text", text: `Search failed: ${error.message || response.statusText}` }],
          isError: true,
        };
      }

      const data = await response.json();
      const issues = data.items.filter((item: any) => !item.pull_request);

      return formatIssuesList(issues, data.total_count, repo, page, perPage, search);
    }

    // Regular listing
    let endpoint = `/repos/${repo}/issues?state=${state}&sort=${sort}&direction=${direction}&per_page=${perPage}&page=${page}`;
    if (labels?.length) endpoint += `&labels=${labels.join(",")}`;
    if (assignee) endpoint += `&assignee=${assignee}`;
    if (creator) endpoint += `&creator=${creator}`;
    if (milestone) endpoint += `&milestone=${milestone}`;
    if (since) endpoint += `&since=${since}`;

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

    return formatIssuesList(issues, issues.length, repo, page, perPage);
  }
);

function formatIssuesList(issues: any[], totalCount: number, repo: string, page: number, perPage: number, search?: string) {
  const formatted = issues.map((issue: any) => {
    const assignees = issue.assignees?.map((a: any) => `@${a.login}`).join(", ") || "unassigned";
    const labels = issue.labels?.map((l: any) => l.name).join(", ") || "";
    const milestone = issue.milestone?.title || "";

    return {
      number: issue.number,
      title: issue.title,
      state: issue.state,
      author: issue.user.login,
      assignees,
      labels,
      milestone,
      comments: issue.comments,
      reactions: issue.reactions?.total_count || 0,
      created: formatRelativeTime(issue.created_at),
      updated: formatRelativeTime(issue.updated_at),
      url: issue.html_url,
    };
  });

  const hasMore = totalCount > page * perPage;
  let result = `📋 **Issues in ${repo}**${search ? ` matching "${search}"` : ""}\n`;
  result += `Found ${totalCount} issues${hasMore ? ` (showing page ${page})` : ""}\n\n`;

  result += formatted
    .map((i: any) => {
      let line = `**#${i.number}** ${i.title}\n`;
      line += `  └ ${i.state === "open" ? "🟢" : "🔴"} ${i.state} | @${i.author} | 💬 ${i.comments}`;
      if (i.reactions > 0) line += ` | 👍 ${i.reactions}`;
      if (i.labels) line += `\n  └ 🏷️ ${i.labels}`;
      if (i.assignees !== "unassigned") line += `\n  └ 👤 ${i.assignees}`;
      line += `\n  └ Created ${i.created}, updated ${i.updated}`;
      return line;
    })
    .join("\n\n");

  if (hasMore) {
    result += `\n\n📄 Use page: ${page + 1} to see more results`;
  }

  return { content: [{ type: "text", text: result }] };
}

// Tool: Get issue details
const getIssueTool = tool(
  "github_get_issue",
  `Get detailed information about a specific GitHub issue.

Use this to read the full issue description, comments, timeline, and metadata.

Examples:
- Get issue: {repo: "owner/repo", number: 123}
- Get with timeline: {repo: "owner/repo", number: 123, includeTimeline: true}
- Get without comments: {repo: "owner/repo", number: 123, includeComments: false}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    number: z.number().describe("Issue number"),
    includeComments: z.boolean().default(true).optional(),
    includeTimeline: z.boolean().default(false).optional().describe("Include timeline events (labels, assignments, etc.)"),
    includeReactions: z.boolean().default(true).optional().describe("Include reaction details"),
    maxComments: z.number().min(1).max(100).default(20).optional(),
  },
  async (args, extra) => {
    const { repo, number, includeComments = true, includeTimeline = false, includeReactions = true, maxComments = 20 } = args;
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
    const assignees = issue.assignees?.map((a: any) => `@${a.login}`).join(", ") || "None";

    let result = `# Issue #${issue.number}: ${issue.title}

**State:** ${issue.state === "open" ? "🟢 Open" : "🔴 Closed"}
**Author:** @${issue.user.login}
**Assignees:** ${assignees}
**Created:** ${formatRelativeTime(issue.created_at)} (${issue.created_at})
**Updated:** ${formatRelativeTime(issue.updated_at)}
**Labels:** ${issue.labels.map((l: any) => `\`${l.name}\``).join(", ") || "None"}
**Milestone:** ${issue.milestone?.title || "None"}
**URL:** ${issue.html_url}`;

    // Add reactions if requested
    if (includeReactions && issue.reactions) {
      const reactions = [];
      if (issue.reactions["+1"]) reactions.push(`👍 ${issue.reactions["+1"]}`);
      if (issue.reactions["-1"]) reactions.push(`👎 ${issue.reactions["-1"]}`);
      if (issue.reactions.laugh) reactions.push(`😄 ${issue.reactions.laugh}`);
      if (issue.reactions.hooray) reactions.push(`🎉 ${issue.reactions.hooray}`);
      if (issue.reactions.confused) reactions.push(`😕 ${issue.reactions.confused}`);
      if (issue.reactions.heart) reactions.push(`❤️ ${issue.reactions.heart}`);
      if (issue.reactions.rocket) reactions.push(`🚀 ${issue.reactions.rocket}`);
      if (issue.reactions.eyes) reactions.push(`👀 ${issue.reactions.eyes}`);
      if (reactions.length > 0) {
        result += `\n**Reactions:** ${reactions.join(" ")}`;
      }
    }

    result += `\n\n## Description\n\n${issue.body || "_No description provided._"}`;

    // Fetch linked PRs (mentioned in timeline or body)
    const prMentions = issue.body?.match(/#\d+/g) || [];
    if (prMentions.length > 0) {
      result += `\n\n**Referenced:** ${prMentions.slice(0, 5).join(", ")}`;
    }

    // Fetch timeline if requested
    if (includeTimeline) {
      const timelineResponse = await githubFetch(`/repos/${repo}/issues/${number}/timeline`, token, {
        accept: "application/vnd.github.mockingbird-preview+json"
      });

      if (timelineResponse.ok) {
        const timeline = await timelineResponse.json();
        const significantEvents = timeline.filter((e: any) =>
          ["labeled", "unlabeled", "assigned", "unassigned", "milestoned", "demilestoned",
           "closed", "reopened", "referenced", "cross-referenced", "renamed"].includes(e.event)
        ).slice(0, 15);

        if (significantEvents.length > 0) {
          result += `\n\n## Timeline\n`;
          for (const event of significantEvents) {
            const time = formatRelativeTime(event.created_at);
            switch (event.event) {
              case "labeled":
                result += `\n- 🏷️ @${event.actor?.login} added \`${event.label?.name}\` ${time}`;
                break;
              case "assigned":
                result += `\n- 👤 @${event.actor?.login} assigned @${event.assignee?.login} ${time}`;
                break;
              case "closed":
                result += `\n- 🔴 @${event.actor?.login} closed this ${time}`;
                break;
              case "reopened":
                result += `\n- 🟢 @${event.actor?.login} reopened this ${time}`;
                break;
              case "referenced":
              case "cross-referenced":
                result += `\n- 🔗 Referenced in ${event.source?.issue?.html_url || "another issue"} ${time}`;
                break;
              case "renamed":
                result += `\n- ✏️ Title changed from "${event.rename?.from}" ${time}`;
                break;
              default:
                result += `\n- ${event.event} ${time}`;
            }
          }
        }
      }
    }

    // Fetch comments
    if (includeComments && issue.comments > 0) {
      const commentsResponse = await githubFetch(`/repos/${repo}/issues/${number}/comments?per_page=${maxComments}`, token);
      if (commentsResponse.ok) {
        const comments = await commentsResponse.json();
        result += `\n\n## Comments (${issue.comments})\n`;
        for (const comment of comments) {
          result += `\n---\n**@${comment.user.login}** · ${formatRelativeTime(comment.created_at)}`;
          if (comment.reactions?.total_count > 0) {
            result += ` · ${comment.reactions.total_count} reactions`;
          }
          result += `\n\n${comment.body}\n`;
        }
        if (issue.comments > maxComments) {
          result += `\n_... and ${issue.comments - maxComments} more comments_`;
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
Shows review status, CI checks, and merge readiness.

Examples:
- List open PRs: {repo: "owner/repo"}
- List merged PRs: {repo: "owner/repo", state: "closed"}
- Your PRs: {repo: "owner/repo", author: "username"}
- PRs to main: {repo: "owner/repo", base: "main"}
- Search PRs: {repo: "owner/repo", search: "fix bug"}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    state: z.enum(["open", "closed", "all"]).default("open").optional(),
    sort: z.enum(["created", "updated", "popularity", "long-running"]).default("created").optional(),
    direction: z.enum(["asc", "desc"]).default("desc").optional(),
    head: z.string().optional().describe("Filter by head branch (format: user:branch or branch)"),
    base: z.string().optional().describe("Filter by base branch"),
    author: z.string().optional().describe("Filter by author username"),
    search: z.string().optional().describe("Search in PR title and body"),
    perPage: z.number().min(1).max(100).default(30).optional(),
    page: z.number().min(1).default(1).optional(),
  },
  async (args, extra) => {
    const { repo, state = "open", sort = "created", direction = "desc", head, base, author, search, perPage = 30, page = 1 } = args;
    const context = extra as { githubToken?: string };
    const token = context?.githubToken;

    if (!token) {
      return {
        content: [{ type: "text", text: "GitHub token not configured. Add it in Settings." }],
        isError: true,
      };
    }

    // Use search API if search term provided
    if (search || author) {
      let searchQuery = `repo:${repo} is:pr`;
      if (search) searchQuery = `${search} ${searchQuery}`;
      if (state !== "all") searchQuery += ` is:${state}`;
      if (author) searchQuery += ` author:${author}`;
      if (base) searchQuery += ` base:${base}`;

      const response = await githubFetch(
        `/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=${perPage}&page=${page}`,
        token
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          content: [{ type: "text", text: `Search failed: ${error.message || response.statusText}` }],
          isError: true,
        };
      }

      const data = await response.json();
      return formatPRsList(data.items, data.total_count, repo, page, perPage, token, search);
    }

    // Regular listing
    let endpoint = `/repos/${repo}/pulls?state=${state}&sort=${sort}&direction=${direction}&per_page=${perPage}&page=${page}`;
    if (head) endpoint += `&head=${head}`;
    if (base) endpoint += `&base=${base}`;

    const response = await githubFetch(endpoint, token);

    if (!response.ok) {
      const error = await response.json();
      return {
        content: [{ type: "text", text: `Failed to list PRs: ${error.message || response.statusText}` }],
        isError: true,
      };
    }

    const prs = await response.json();
    return formatPRsList(prs, prs.length, repo, page, perPage, token);
  }
);

async function formatPRsList(prs: any[], totalCount: number, repo: string, page: number, perPage: number, token: string, search?: string) {
  const formatted = await Promise.all(prs.map(async (pr: any) => {
    let reviewStatus = "⏳ Pending review";
    let checksStatus = "";

    // Fetch review status for open PRs
    if (pr.state === "open") {
      try {
        const reviewsResponse = await githubFetch(`/repos/${repo}/pulls/${pr.number}/reviews`, token);
        if (reviewsResponse.ok) {
          const reviews = await reviewsResponse.json();
          const latestReviews = new Map<string, string>();
          for (const review of reviews) {
            if (review.state !== "COMMENTED") {
              latestReviews.set(review.user.login, review.state);
            }
          }
          const approved = [...latestReviews.values()].filter(s => s === "APPROVED").length;
          const changesRequested = [...latestReviews.values()].filter(s => s === "CHANGES_REQUESTED").length;

          if (changesRequested > 0) reviewStatus = `🔴 Changes requested (${changesRequested})`;
          else if (approved > 0) reviewStatus = `✅ Approved (${approved})`;
        }
      } catch {
        // Review fetch failed
      }

      // Fetch CI status
      try {
        const statusResponse = await githubFetch(`/repos/${repo}/commits/${pr.head.sha}/status`, token);
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          if (status.state === "success") checksStatus = "✅";
          else if (status.state === "failure") checksStatus = "❌";
          else if (status.state === "pending") checksStatus = "🟡";
        }
      } catch {
        // Status fetch failed
      }
    }

    return {
      number: pr.number,
      title: pr.title,
      state: pr.state,
      merged: pr.merged_at !== null,
      draft: pr.draft,
      author: pr.user.login,
      branch: `${pr.head.ref} → ${pr.base.ref}`,
      reviewStatus,
      checksStatus,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      comments: pr.comments + pr.review_comments,
      created: formatRelativeTime(pr.created_at),
      updated: formatRelativeTime(pr.updated_at),
      url: pr.html_url,
    };
  }));

  const hasMore = totalCount > page * perPage;
  let result = `🔀 **Pull Requests in ${repo}**${search ? ` matching "${search}"` : ""}\n`;
  result += `Found ${totalCount} PRs${hasMore ? ` (showing page ${page})` : ""}\n\n`;

  result += formatted
    .map((p: any) => {
      const stateIcon = p.merged ? "🟣" : p.state === "open" ? "🟢" : "🔴";
      const draftBadge = p.draft ? " [DRAFT]" : "";
      let line = `**#${p.number}** ${p.title}${draftBadge}\n`;
      line += `  └ ${stateIcon} ${p.merged ? "merged" : p.state} | @${p.author} | ${p.branch}`;
      if (p.state === "open") {
        line += `\n  └ ${p.reviewStatus}${p.checksStatus ? ` | CI: ${p.checksStatus}` : ""}`;
      }
      line += `\n  └ 📝 +${p.additions}/-${p.deletions} in ${p.changedFiles} files | 💬 ${p.comments}`;
      line += `\n  └ Created ${p.created}, updated ${p.updated}`;
      return line;
    })
    .join("\n\n");

  if (hasMore) {
    result += `\n\n📄 Use page: ${page + 1} to see more results`;
  }

  return { content: [{ type: "text", text: result }] };
}

// Tool: Get PR details with diff
const getPRTool = tool(
  "github_get_pr",
  `Get detailed information about a specific pull request.

Includes description, diff, reviews, comments, CI status, and files changed.

Examples:
- Get PR: {repo: "owner/repo", number: 123}
- Get with reviews: {repo: "owner/repo", number: 123, includeReviews: true}
- Get files list only: {repo: "owner/repo", number: 123, includeDiff: false, includeFiles: true}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    number: z.number().describe("PR number"),
    includeDiff: z.boolean().default(true).optional(),
    includeFiles: z.boolean().default(true).optional().describe("List changed files with stats"),
    includeReviews: z.boolean().default(true).optional().describe("Include review comments"),
    includeChecks: z.boolean().default(true).optional().describe("Include CI check status"),
    includeComments: z.boolean().default(true).optional().describe("Include general comments"),
    maxDiffSize: z.number().default(15000).optional().describe("Max diff size in characters"),
  },
  async (args, extra) => {
    const {
      repo, number, includeDiff = true, includeFiles = true,
      includeReviews = true, includeChecks = true, includeComments = true,
      maxDiffSize = 15000
    } = args;
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
    const stateIcon = pr.merged ? "🟣 Merged" : pr.state === "open" ? "🟢 Open" : "🔴 Closed";

    let result = `# PR #${pr.number}: ${pr.title}

**State:** ${stateIcon}${pr.draft ? " (Draft)" : ""}
**Author:** @${pr.user.login}
**Branch:** \`${pr.head.ref}\` → \`${pr.base.ref}\`
**Created:** ${formatRelativeTime(pr.created_at)} (${pr.created_at})
**Updated:** ${formatRelativeTime(pr.updated_at)}
**Mergeable:** ${pr.mergeable === null ? "Checking..." : pr.mergeable ? "✅ Yes" : "❌ No"}${pr.mergeable_state ? ` (${pr.mergeable_state})` : ""}
**Changes:** +${pr.additions}/-${pr.deletions} across ${pr.changed_files} files
**URL:** ${pr.html_url}`;

    if (pr.labels?.length > 0) {
      result += `\n**Labels:** ${pr.labels.map((l: any) => `\`${l.name}\``).join(", ")}`;
    }

    if (pr.requested_reviewers?.length > 0) {
      result += `\n**Requested Reviewers:** ${pr.requested_reviewers.map((r: any) => `@${r.login}`).join(", ")}`;
    }

    result += `\n\n## Description\n\n${pr.body || "_No description provided._"}`;

    // Fetch CI checks
    if (includeChecks) {
      try {
        const checksResponse = await githubFetch(`/repos/${repo}/commits/${pr.head.sha}/check-runs`, token, {
          accept: "application/vnd.github.v3+json"
        });

        if (checksResponse.ok) {
          const checks = await checksResponse.json();
          if (checks.check_runs?.length > 0) {
            result += `\n\n## CI Checks (${checks.check_runs.length})\n`;
            for (const check of checks.check_runs.slice(0, 10)) {
              const icon = check.conclusion === "success" ? "✅" :
                          check.conclusion === "failure" ? "❌" :
                          check.status === "in_progress" ? "🟡" : "⏳";
              result += `\n${icon} **${check.name}** - ${check.conclusion || check.status}`;
            }
            if (checks.check_runs.length > 10) {
              result += `\n_... and ${checks.check_runs.length - 10} more checks_`;
            }
          }
        }

        // Also check commit status
        const statusResponse = await githubFetch(`/repos/${repo}/commits/${pr.head.sha}/status`, token);
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          if (status.statuses?.length > 0) {
            if (!result.includes("## CI Checks")) {
              result += `\n\n## CI Status\n`;
            }
            for (const s of status.statuses.slice(0, 5)) {
              const icon = s.state === "success" ? "✅" : s.state === "failure" ? "❌" : "🟡";
              result += `\n${icon} **${s.context}** - ${s.description || s.state}`;
            }
          }
        }
      } catch {
        // Checks fetch failed
      }
    }

    // Fetch reviews
    if (includeReviews) {
      try {
        const reviewsResponse = await githubFetch(`/repos/${repo}/pulls/${number}/reviews`, token);
        if (reviewsResponse.ok) {
          const reviews = await reviewsResponse.json();
          const significantReviews = reviews.filter((r: any) => r.state !== "COMMENTED" || r.body);

          if (significantReviews.length > 0) {
            result += `\n\n## Reviews (${significantReviews.length})\n`;
            for (const review of significantReviews.slice(0, 10)) {
              const icon = review.state === "APPROVED" ? "✅" :
                          review.state === "CHANGES_REQUESTED" ? "🔴" :
                          review.state === "COMMENTED" ? "💬" : "⏳";
              result += `\n${icon} **@${review.user.login}** - ${review.state.toLowerCase()}`;
              if (review.body) {
                result += `\n   > ${review.body.substring(0, 200)}${review.body.length > 200 ? "..." : ""}`;
              }
            }
          }
        }
      } catch {
        // Reviews fetch failed
      }
    }

    // Fetch files changed
    if (includeFiles) {
      try {
        const filesResponse = await githubFetch(`/repos/${repo}/pulls/${number}/files?per_page=100`, token);
        if (filesResponse.ok) {
          const files = await filesResponse.json();
          result += `\n\n## Files Changed (${files.length})\n`;
          for (const file of files.slice(0, 30)) {
            const statusIcon = file.status === "added" ? "➕" :
                              file.status === "removed" ? "➖" :
                              file.status === "renamed" ? "📝" : "📄";
            result += `\n${statusIcon} \`${file.filename}\` (+${file.additions}/-${file.deletions})`;
            if (file.previous_filename) {
              result += ` ← ${file.previous_filename}`;
            }
          }
          if (files.length > 30) {
            result += `\n_... and ${files.length - 30} more files_`;
          }
        }
      } catch {
        // Files fetch failed
      }
    }

    // Fetch comments
    if (includeComments && (pr.comments > 0 || pr.review_comments > 0)) {
      try {
        const commentsResponse = await githubFetch(`/repos/${repo}/issues/${number}/comments?per_page=10`, token);
        if (commentsResponse.ok) {
          const comments = await commentsResponse.json();
          if (comments.length > 0) {
            result += `\n\n## Comments (${pr.comments})\n`;
            for (const comment of comments) {
              result += `\n---\n**@${comment.user.login}** · ${formatRelativeTime(comment.created_at)}\n\n${comment.body}\n`;
            }
            if (pr.comments > 10) {
              result += `\n_... and ${pr.comments - 10} more comments_`;
            }
          }
        }
      } catch {
        // Comments fetch failed
      }
    }

    // Fetch diff
    if (includeDiff) {
      try {
        const diffResponse = await githubFetch(
          `/repos/${repo}/pulls/${number}`,
          token,
          { accept: "application/vnd.github.v3.diff" }
        );
        if (diffResponse.ok) {
          const diff = await diffResponse.text();
          const truncatedDiff = diff.length > maxDiffSize
            ? diff.substring(0, maxDiffSize) + `\n\n... (diff truncated at ${maxDiffSize} chars, full diff is ${diff.length} chars)`
            : diff;
          result += `\n\n## Diff\n\n\`\`\`diff\n${truncatedDiff}\n\`\`\``;
        }
      } catch {
        // Diff fetch failed
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
Supports shallow clones, specific branches, and sparse checkouts.

Examples:
- Clone: {repo: "owner/repo"}
- Clone specific branch: {repo: "owner/repo", branch: "develop"}
- Clone to specific dir: {repo: "owner/repo", directory: "my-project"}
- Sparse checkout (specific paths only): {repo: "owner/repo", sparsePaths: ["src/", "package.json"]}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    branch: z.string().optional().describe("Branch to clone (defaults to default branch)"),
    directory: z.string().optional().describe("Target directory name (defaults to repo name)"),
    shallow: z.boolean().default(true).optional().describe("Shallow clone (faster, less disk space)"),
    depth: z.number().min(1).default(1).optional().describe("Depth for shallow clone"),
    sparsePaths: z.array(z.string()).optional().describe("Only checkout these paths (sparse checkout)"),
    includeSubmodules: z.boolean().default(false).optional().describe("Initialize submodules"),
  },
  async (args, extra) => {
    const { repo, branch, directory, shallow = true, depth = 1, sparsePaths, includeSubmodules = false } = args;
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
    if (shallow) cmd += ` --depth ${depth}`;
    if (branch) cmd += ` --branch ${branch}`;
    if (sparsePaths?.length) cmd += ` --sparse`;
    if (includeSubmodules) cmd += ` --recurse-submodules`;
    cmd += ` "${cloneUrl}" "${repoName}"`;

    try {
      await execAsync(cmd, { cwd });

      // Set up sparse checkout if paths specified
      if (sparsePaths?.length) {
        await execAsync(`git sparse-checkout set ${sparsePaths.map(p => `"${p}"`).join(" ")}`, { cwd: targetPath });
      }

      // Get some basic info about the cloned repo
      const { stdout: branchOutput } = await execAsync("git branch --show-current", {
        cwd: targetPath,
      });
      const { stdout: commitOutput } = await execAsync("git log -1 --format='%h %s (%an, %ar)'", {
        cwd: targetPath,
      });

      // Count files
      let fileCount = 0;
      let totalSize = "";
      try {
        const { stdout: countOutput } = await execAsync("find . -type f | wc -l", { cwd: targetPath });
        fileCount = parseInt(countOutput.trim());
        const { stdout: sizeOutput } = await execAsync("du -sh .", { cwd: targetPath });
        totalSize = sizeOutput.split("\t")[0];
      } catch {
        // Count failed
      }

      let result = `✅ Successfully cloned **${repo}**

📁 **Location:** ${targetPath}
🌿 **Branch:** ${branchOutput.trim()}
📝 **Latest commit:** ${commitOutput.trim()}`;

      if (fileCount > 0) {
        result += `\n📊 **Size:** ${totalSize} (${fileCount} files)`;
      }

      if (sparsePaths?.length) {
        result += `\n🎯 **Sparse checkout:** ${sparsePaths.join(", ")}`;
      }

      if (includeSubmodules) {
        const { stdout: submoduleOutput } = await execAsync("git submodule status", { cwd: targetPath });
        if (submoduleOutput.trim()) {
          result += `\n📦 **Submodules:** ${submoduleOutput.trim().split("\n").length} initialized`;
        }
      }

      result += `\n\nYou can now use Read, Edit, Glob, Grep and other tools to work with the repository files.`;

      return { content: [{ type: "text", text: result }] };
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
  `Get comprehensive information about a GitHub repository.

Includes stats, contributors, languages, recent activity, and releases.

Examples:
- Get repo info: {repo: "owner/repo"}
- Get with contributors: {repo: "owner/repo", includeContributors: true}
- Get with releases: {repo: "owner/repo", includeReleases: true}`,
  {
    repo: z.string().describe("Repository in owner/repo format"),
    includeContributors: z.boolean().default(true).optional().describe("Include top contributors"),
    includeLanguages: z.boolean().default(true).optional().describe("Include language breakdown"),
    includeReleases: z.boolean().default(true).optional().describe("Include recent releases"),
    includeBranches: z.boolean().default(true).optional().describe("Include branch list"),
    includeActivity: z.boolean().default(true).optional().describe("Include recent commit activity"),
  },
  async (args, extra) => {
    const {
      repo,
      includeContributors = true,
      includeLanguages = true,
      includeReleases = true,
      includeBranches = true,
      includeActivity = true
    } = args;
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

    let result = `# ${r.full_name}

${r.description || "_No description_"}

## Overview

| Stat | Value |
|------|-------|
| ⭐ Stars | ${r.stargazers_count.toLocaleString()} |
| 🍴 Forks | ${r.forks_count.toLocaleString()} |
| 👀 Watchers | ${r.watchers_count.toLocaleString()} |
| 🐛 Open Issues | ${r.open_issues_count.toLocaleString()} |
| 📦 Size | ${formatSize(r.size * 1024)} |

**Primary Language:** ${r.language || "Not specified"}
**Default Branch:** \`${r.default_branch}\`
**License:** ${r.license?.name || "None"}
**Visibility:** ${r.private ? "🔒 Private" : "🌍 Public"}
**Created:** ${formatRelativeTime(r.created_at)}
**Last Updated:** ${formatRelativeTime(r.updated_at)}
**Last Push:** ${formatRelativeTime(r.pushed_at)}

**URL:** ${r.html_url}`;

    if (r.homepage) {
      result += `\n**Homepage:** ${r.homepage}`;
    }
    if (r.topics?.length) {
      result += `\n**Topics:** ${r.topics.map((t: string) => `\`${t}\``).join(", ")}`;
    }

    // Fetch languages
    if (includeLanguages) {
      try {
        const langResponse = await githubFetch(`/repos/${repo}/languages`, token);
        if (langResponse.ok) {
          const languages = await langResponse.json();
          const total = Object.values(languages).reduce((a: number, b: unknown) => a + (b as number), 0);
          const langBreakdown = Object.entries(languages)
            .map(([lang, bytes]) => {
              const percent = ((bytes as number) / total * 100).toFixed(1);
              return `${lang}: ${percent}%`;
            })
            .slice(0, 8)
            .join(" | ");

          if (langBreakdown) {
            result += `\n\n## Languages\n${langBreakdown}`;
          }
        }
      } catch {
        // Languages fetch failed
      }
    }

    // Fetch contributors
    if (includeContributors) {
      try {
        const contribResponse = await githubFetch(`/repos/${repo}/contributors?per_page=10`, token);
        if (contribResponse.ok) {
          const contributors = await contribResponse.json();
          if (contributors.length > 0) {
            result += `\n\n## Top Contributors\n`;
            result += contributors.slice(0, 10).map((c: any, i: number) =>
              `${i + 1}. @${c.login} (${c.contributions} commits)`
            ).join("\n");
          }
        }
      } catch {
        // Contributors fetch failed
      }
    }

    // Fetch branches
    if (includeBranches) {
      try {
        const branchResponse = await githubFetch(`/repos/${repo}/branches?per_page=20`, token);
        if (branchResponse.ok) {
          const branches = await branchResponse.json();
          if (branches.length > 0) {
            result += `\n\n## Branches (${branches.length})\n`;
            result += branches.slice(0, 10).map((b: any) => {
              const isDefault = b.name === r.default_branch ? " ⭐" : "";
              const isProtected = b.protected ? " 🔒" : "";
              return `- \`${b.name}\`${isDefault}${isProtected}`;
            }).join("\n");
            if (branches.length > 10) {
              result += `\n_... and ${branches.length - 10} more branches_`;
            }
          }
        }
      } catch {
        // Branches fetch failed
      }
    }

    // Fetch releases
    if (includeReleases) {
      try {
        const releaseResponse = await githubFetch(`/repos/${repo}/releases?per_page=5`, token);
        if (releaseResponse.ok) {
          const releases = await releaseResponse.json();
          if (releases.length > 0) {
            result += `\n\n## Recent Releases\n`;
            for (const release of releases.slice(0, 5)) {
              const prerelease = release.prerelease ? " (pre-release)" : "";
              result += `- **${release.tag_name}**${prerelease} - ${formatRelativeTime(release.published_at)}\n`;
              if (release.name && release.name !== release.tag_name) {
                result += `  ${release.name}\n`;
              }
            }
          }
        }
      } catch {
        // Releases fetch failed
      }
    }

    // Fetch recent activity
    if (includeActivity) {
      try {
        const commitsResponse = await githubFetch(`/repos/${repo}/commits?per_page=5`, token);
        if (commitsResponse.ok) {
          const commits = await commitsResponse.json();
          if (commits.length > 0) {
            result += `\n\n## Recent Commits\n`;
            for (const commit of commits) {
              const sha = commit.sha.substring(0, 7);
              const message = commit.commit.message.split("\n")[0].substring(0, 60);
              const author = commit.author?.login || commit.commit.author.name;
              const time = formatRelativeTime(commit.commit.author.date);
              result += `- \`${sha}\` ${message} (@${author}, ${time})\n`;
            }
          }
        }
      } catch {
        // Commits fetch failed
      }
    }

    return { content: [{ type: "text", text: result }] };
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
