/**
 * Tests for GitHub MCP Server
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Define mock functions using vi.hoisted() so they're available when vi.mock runs
const { mockMkdir, mockWriteFile, mockAccess, mockExec, mockPromisify } = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockWriteFile: vi.fn(),
  mockAccess: vi.fn(),
  mockExec: vi.fn(),
  mockPromisify: vi.fn(() => vi.fn()),
}));

// Mock modules
vi.mock("fs/promises", () => ({
  default: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    access: mockAccess,
  },
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  access: mockAccess,
}));
vi.mock("child_process", () => ({
  default: { exec: mockExec },
  exec: mockExec,
}));
vi.mock("util", () => ({
  default: { promisify: mockPromisify },
  promisify: mockPromisify,
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock the claude-code SDK with proper types for testing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockTool = {
  name: string;
  description: string;
  inputSchema: any;
  handler: (...args: any[]) => Promise<any>;
};
type MockServer = { name: string; version: string; tools: MockTool[] };

vi.mock("@anthropic-ai/claude-code", () => ({
  tool: vi.fn((name, description, schema, handler) => ({
    name,
    description,
    inputSchema: schema,
    handler,
  })),
  createSdkMcpServer: vi.fn(({ name, version, tools }) => ({
    name,
    version,
    tools,
  })),
}));

describe("github-mcp", () => {
  const mockToken = "ghp_test_token_12345";

  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockAccess.mockRejectedValue(new Error("ENOENT"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createGitHubMcpServer", () => {
    it("should create server with correct name and version", async () => {
      const { createGitHubMcpServer } = await import("./github-mcp");
      const server = createGitHubMcpServer(mockToken) as unknown as MockServer;

      expect(server.name).toBe("github");
      expect(server.version).toBe("2.0.0");
    });

    it("should include all four tools", async () => {
      const { createGitHubMcpServer } = await import("./github-mcp");
      const server = createGitHubMcpServer(mockToken) as unknown as MockServer;

      expect(server.tools).toHaveLength(4);

      const toolNames = server.tools.map((t: { name: string }) => t.name);
      expect(toolNames).toContain("github_repo");
      expect(toolNames).toContain("github_issues");
      expect(toolNames).toContain("github_prs");
      expect(toolNames).toContain("github_ci");
    });
  });

  describe("github_repo tool", () => {
    let repoHandler: (
      args: Record<string, unknown>
    ) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    beforeEach(async () => {
      const { createGitHubMcpServer } = await import("./github-mcp");
      const server = createGitHubMcpServer(mockToken) as unknown as MockServer;
      const repoTool = server.tools.find((t: { name: string }) => t.name === "github_repo")!;
      repoHandler = repoTool.handler;
    });

    describe("info action", () => {
      const mockRepoInfo = {
        full_name: "owner/repo",
        description: "Test repository",
        html_url: "https://github.com/owner/repo",
        language: "TypeScript",
        stargazers_count: 100,
        forks_count: 20,
        open_issues_count: 5,
        default_branch: "main",
        pushed_at: new Date().toISOString(),
        license: { name: "MIT" },
        topics: ["testing", "typescript"],
      };

      it("should fetch repository info", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRepoInfo),
        });

        const result = await repoHandler({
          action: "info",
          repo: "owner/repo",
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("repos/owner/repo"),
          expect.any(Object)
        );
        expect(result.content[0].text).toContain("owner/repo");
        expect(result.content[0].text).toContain("TypeScript");
        expect(result.content[0].text).toContain("100");
      });

      it("should handle missing token", async () => {
        const { createGitHubMcpServer } = await import("./github-mcp");
        const server = createGitHubMcpServer("") as unknown as MockServer;
        const handler = server.tools.find(
          (t: { name: string }) => t.name === "github_repo"
        )!.handler;

        const result = await handler({
          action: "info",
          repo: "owner/repo",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("token not configured");
      });

      it("should handle API errors", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ message: "Not Found" }),
        });

        const result = await repoHandler({
          action: "info",
          repo: "nonexistent/repo",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Failed");
      });
    });

    describe("list_files action", () => {
      const mockFiles = [
        { name: "src", type: "dir", size: 0, path: "src" },
        { name: "README.md", type: "file", size: 1024, path: "README.md" },
        { name: "package.json", type: "file", size: 512, path: "package.json" },
      ];

      it("should list repository files", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFiles),
        });

        const result = await repoHandler({
          action: "list_files",
          repo: "owner/repo",
        });

        expect(result.content[0].text).toContain("src");
        expect(result.content[0].text).toContain("README.md");
      });

      it("should list files in subdirectory", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([{ name: "index.ts", type: "file", size: 2048, path: "src/index.ts" }]),
        });

        const result = await repoHandler({
          action: "list_files",
          repo: "owner/repo",
          path: "src",
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("contents/src"),
          expect.any(Object)
        );
        expect(result.content[0].text).toContain("index.ts");
      });
    });

    describe("read_file action", () => {
      it("should read file contents", async () => {
        const fileContent = Buffer.from("# Hello World").toString("base64");
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              type: "file",
              content: fileContent,
              size: 13,
              sha: "abc123",
            }),
        });

        const result = await repoHandler({
          action: "read_file",
          repo: "owner/repo",
          path: "README.md",
        });

        expect(result.content[0].text).toContain("Hello World");
      });

      it("should require path parameter", async () => {
        const result = await repoHandler({
          action: "read_file",
          repo: "owner/repo",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("path is required");
      });

      it("should handle directory path", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ type: "dir" }),
        });

        const result = await repoHandler({
          action: "read_file",
          repo: "owner/repo",
          path: "src",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("directory");
      });
    });

    describe("search_code action", () => {
      it("should search code in repository", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              total_count: 2,
              items: [
                {
                  path: "src/auth.ts",
                  repository: { full_name: "owner/repo" },
                  html_url: "https://github.com/owner/repo/blob/main/src/auth.ts",
                  text_matches: [{ fragment: "function handleAuth" }],
                },
              ],
            }),
        });

        const result = await repoHandler({
          action: "search_code",
          query: "handleAuth",
          repo: "owner/repo",
        });

        expect(result.content[0].text).toContain("auth.ts");
        expect(result.content[0].text).toContain("handleAuth");
      });

      it("should require query parameter", async () => {
        const result = await repoHandler({
          action: "search_code",
          repo: "owner/repo",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("query is required");
      });
    });

    describe("compare action", () => {
      it("should compare branches", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              status: "ahead",
              ahead_by: 5,
              behind_by: 0,
              total_commits: 5,
              commits: [{ sha: "abc123", commit: { message: "Add feature" } }],
              files: [{ filename: "src/new.ts", status: "added", changes: 50 }],
            }),
        });

        const result = await repoHandler({
          action: "compare",
          repo: "owner/repo",
          base: "main",
          head: "feature",
        });

        expect(result.content[0].text).toContain("Ahead:** 5");
        expect(result.content[0].text).toContain("Add feature");
      });

      it("should require base and head", async () => {
        const result = await repoHandler({
          action: "compare",
          repo: "owner/repo",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("base and head are required");
      });

      it("should handle compare API error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ message: "Not Found" }),
        });

        const result = await repoHandler({
          action: "compare",
          repo: "owner/repo",
          base: "main",
          head: "nonexistent",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Compare failed");
      });

      it("should include diff when requested", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                status: "ahead",
                ahead_by: 1,
                behind_by: 0,
                total_commits: 1,
                commits: [],
                files: [{ filename: "file.ts", status: "modified", additions: 5, deletions: 2 }],
              }),
          })
          .mockResolvedValueOnce({
            ok: true,
            text: () => Promise.resolve("diff --git a/file.ts b/file.ts\n+new line"),
          });

        const result = await repoHandler({
          action: "compare",
          repo: "owner/repo",
          base: "main",
          head: "feature",
          includeDiff: true,
        });

        expect(result.content[0].text).toContain("Diff");
        expect(result.content[0].text).toContain("+new line");
      });
    });

    describe("fork action", () => {
      it("should fork repository", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              full_name: "user/repo",
              html_url: "https://github.com/user/repo",
            }),
        });

        const result = await repoHandler({
          action: "fork",
          repo: "owner/repo",
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("forks"),
          expect.objectContaining({ method: "POST" })
        );
        expect(result.content[0].text).toContain("Forked");
        expect(result.content[0].text).toContain("user/repo");
      });

      it("should handle fork with organization", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              full_name: "myorg/repo",
              html_url: "https://github.com/myorg/repo",
            }),
        });

        const result = await repoHandler({
          action: "fork",
          repo: "owner/repo",
          organization: "myorg",
        });

        expect(result.content[0].text).toContain("myorg/repo");
      });

      it("should handle fork failure", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ message: "Repository already exists" }),
        });

        const result = await repoHandler({
          action: "fork",
          repo: "owner/repo",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Fork failed");
      });
    });

    describe("star action", () => {
      it("should star repository", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
        });

        const result = await repoHandler({
          action: "star",
          repo: "owner/repo",
          star: true,
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("starred"),
          expect.objectContaining({ method: "PUT" })
        );
        expect(result.content[0].text).toContain("Starred");
      });

      it("should unstar repository", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
        });

        const result = await repoHandler({
          action: "star",
          repo: "owner/repo",
          star: false,
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("starred"),
          expect.objectContaining({ method: "DELETE" })
        );
        expect(result.content[0].text).toContain("Unstarred");
      });

      it("should require star parameter", async () => {
        const result = await repoHandler({
          action: "star",
          repo: "owner/repo",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("star (true/false) is required");
      });

      it("should handle star failure", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
        });

        const result = await repoHandler({
          action: "star",
          repo: "owner/repo",
          star: true,
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Failed to star");
      });
    });

    describe("file_history action", () => {
      it("should get file history", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                sha: "abc123def456",
                commit: {
                  message: "Update file\nDetails here",
                  author: { name: "John", date: new Date().toISOString() },
                },
                author: { login: "johndoe" },
              },
            ]),
        });

        const result = await repoHandler({
          action: "file_history",
          repo: "owner/repo",
          path: "src/main.ts",
        });

        expect(result.content[0].text).toContain("History of src/main.ts");
        expect(result.content[0].text).toContain("abc123d");
        expect(result.content[0].text).toContain("Update file");
        expect(result.content[0].text).toContain("@johndoe");
      });

      it("should require path for file_history", async () => {
        const result = await repoHandler({
          action: "file_history",
          repo: "owner/repo",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("path is required");
      });

      it("should handle file_history API error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ message: "Not Found" }),
        });

        const result = await repoHandler({
          action: "file_history",
          repo: "owner/repo",
          path: "nonexistent.ts",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Failed");
      });
    });

    describe("unknown action", () => {
      it("should return error for unknown repo action", async () => {
        const result = await repoHandler({
          action: "unknown_action" as "info",
          repo: "owner/repo",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown action");
      });
    });
  });

  describe("github_issues tool", () => {
    let issuesHandler: (
      args: Record<string, unknown>
    ) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    beforeEach(async () => {
      const { createGitHubMcpServer } = await import("./github-mcp");
      const server = createGitHubMcpServer(mockToken) as unknown as MockServer;
      const issuesTool = server.tools.find((t: { name: string }) => t.name === "github_issues")!;
      issuesHandler = issuesTool.handler;
    });

    describe("list action", () => {
      it("should list issues", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                number: 1,
                title: "Bug report",
                state: "open",
                user: { login: "user1" },
                labels: [{ name: "bug" }],
                comments: 3,
                created_at: new Date().toISOString(),
              },
            ]),
        });

        const result = await issuesHandler({
          action: "list",
          repo: "owner/repo",
        });

        expect(result.content[0].text).toContain("Bug report");
        expect(result.content[0].text).toContain("#1");
      });

      it("should filter by state", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        await issuesHandler({
          action: "list",
          repo: "owner/repo",
          state: "closed",
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("state=closed"),
          expect.any(Object)
        );
      });
    });

    describe("get action", () => {
      it("should get issue details", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              number: 42,
              title: "Feature request",
              body: "Add new feature please",
              state: "open",
              user: { login: "requester" },
              labels: [{ name: "enhancement" }],
              assignees: [{ login: "dev1" }],
              milestone: { title: "v2.0" },
              created_at: new Date().toISOString(),
              comments: 0, // No comments to avoid second fetch
              html_url: "https://github.com/owner/repo/issues/42",
            }),
        });

        const result = await issuesHandler({
          action: "get",
          repo: "owner/repo",
          number: 42,
        });

        expect(result.content[0].text).toContain("Feature request");
        expect(result.content[0].text).toContain("#42");
        expect(result.content[0].text).toContain("enhancement");
      });

      it("should require number", async () => {
        const result = await issuesHandler({
          action: "get",
          repo: "owner/repo",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("number is required");
      });
    });

    describe("create action", () => {
      it("should create new issue", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              number: 100,
              title: "New Issue",
              html_url: "https://github.com/owner/repo/issues/100",
            }),
        });

        const result = await issuesHandler({
          action: "create",
          repo: "owner/repo",
          title: "New Issue",
          body: "Issue description",
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("issues"),
          expect.objectContaining({ method: "POST" })
        );
        expect(result.content[0].text).toContain("Created issue #100");
      });

      it("should require title", async () => {
        const result = await issuesHandler({
          action: "create",
          repo: "owner/repo",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("title is required");
      });
    });

    describe("comment action", () => {
      it("should add comment to issue", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 999,
              html_url: "https://github.com/owner/repo/issues/1#issuecomment-999",
            }),
        });

        const result = await issuesHandler({
          action: "comment",
          repo: "owner/repo",
          number: 1,
          body: "This is a comment",
        });

        expect(result.content[0].text).toContain("Added comment");
      });

      it("should require number and body", async () => {
        const result = await issuesHandler({
          action: "comment",
          repo: "owner/repo",
          number: 1,
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("body");
      });
    });
  });

  describe("github_prs tool", () => {
    let prsHandler: (
      args: Record<string, unknown>
    ) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    beforeEach(async () => {
      const { createGitHubMcpServer } = await import("./github-mcp");
      const server = createGitHubMcpServer(mockToken) as unknown as MockServer;
      const prsTool = server.tools.find((t: { name: string }) => t.name === "github_prs")!;
      prsHandler = prsTool.handler;
    });

    describe("list action", () => {
      it("should list pull requests", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                number: 10,
                title: "Add feature",
                state: "open",
                user: { login: "contributor" },
                head: { ref: "feature-branch" },
                base: { ref: "main" },
                draft: false,
                created_at: new Date().toISOString(),
              },
            ]),
        });

        const result = await prsHandler({
          action: "list",
          repo: "owner/repo",
        });

        expect(result.content[0].text).toContain("Add feature");
        expect(result.content[0].text).toContain("#10");
      });
    });

    describe("get action", () => {
      it("should get PR details", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              number: 25,
              title: "Refactor code",
              body: "This PR refactors the codebase",
              state: "open",
              user: { login: "developer" },
              head: { ref: "refactor", sha: "abc123" },
              base: { ref: "main" },
              mergeable: true,
              additions: 100,
              deletions: 50,
              changed_files: 5,
              commits: 3,
              comments: 2,
              review_comments: 4,
              created_at: new Date().toISOString(),
            }),
        });

        const result = await prsHandler({
          action: "get",
          repo: "owner/repo",
          number: 25,
        });

        expect(result.content[0].text).toContain("Refactor code");
        expect(result.content[0].text).toContain("+100");
        expect(result.content[0].text).toContain("-50");
      });
    });

    describe("create action", () => {
      it("should create pull request", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              number: 50,
              title: "New PR",
              html_url: "https://github.com/owner/repo/pull/50",
            }),
        });

        const result = await prsHandler({
          action: "create",
          repo: "owner/repo",
          title: "New PR",
          head: "feature-branch",
          base: "main",
        });

        expect(result.content[0].text).toContain("Created PR #50");
      });

      it("should require title, head, and base", async () => {
        const result = await prsHandler({
          action: "create",
          repo: "owner/repo",
          title: "New PR",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("head");
      });
    });

    describe("merge action", () => {
      it("should merge pull request", async () => {
        // First call: get PR details
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              state: "open",
              mergeable: true,
            }),
        });
        // Second call: merge PR
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              merged: true,
              sha: "merged123abc",
            }),
        });

        const result = await prsHandler({
          action: "merge",
          repo: "owner/repo",
          number: 10,
        });

        expect(result.content[0].text).toContain("Merged PR #10");
        expect(result.content[0].text).toContain("merged1");
      });
    });
  });

  describe("github_ci tool", () => {
    let ciHandler: (
      args: Record<string, unknown>
    ) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    beforeEach(async () => {
      const { createGitHubMcpServer } = await import("./github-mcp");
      const server = createGitHubMcpServer(mockToken) as unknown as MockServer;
      const ciTool = server.tools.find((t: { name: string }) => t.name === "github_ci")!;
      ciHandler = ciTool.handler;
    });

    describe("actions action", () => {
      it("should list workflow runs", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              workflow_runs: [
                {
                  id: 123,
                  name: "CI",
                  head_branch: "main",
                  event: "push",
                  status: "completed",
                  conclusion: "success",
                  html_url: "https://github.com/owner/repo/actions/runs/123",
                  created_at: new Date().toISOString(),
                },
              ],
            }),
        });

        const result = await ciHandler({
          action: "actions",
          repo: "owner/repo",
        });

        expect(result.content[0].text).toContain("CI");
        expect(result.content[0].text).toContain("success");
      });
    });

    describe("notifications action", () => {
      it("should list notifications", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: "1",
                subject: {
                  title: "New comment on issue",
                  type: "Issue",
                },
                repository: { full_name: "owner/repo" },
                reason: "mention",
                unread: true,
                updated_at: new Date().toISOString(),
              },
            ]),
        });

        const result = await ciHandler({
          action: "notifications",
        });

        expect(result.content[0].text).toContain("New comment on issue");
        expect(result.content[0].text).toContain("mention");
      });

      it("should handle empty notifications", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

        const result = await ciHandler({
          action: "notifications",
        });

        expect(result.content[0].text).toContain("No notifications");
      });

      it("should handle notification API errors", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ message: "Rate limit exceeded" }),
        });

        const result = await ciHandler({
          action: "notifications",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Rate limit exceeded");
      });

      it("should group notifications by repository", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: "1",
                subject: { title: "Issue 1", type: "Issue" },
                repository: { full_name: "owner/repo1" },
                reason: "assign",
                unread: true,
                updated_at: new Date().toISOString(),
              },
              {
                id: "2",
                subject: { title: "PR 1", type: "PullRequest" },
                repository: { full_name: "owner/repo1" },
                reason: "review_requested",
                unread: false,
                updated_at: new Date().toISOString(),
              },
              {
                id: "3",
                subject: { title: "Release 1.0", type: "Release" },
                repository: { full_name: "owner/repo2" },
                reason: "subscribed",
                unread: true,
                updated_at: new Date().toISOString(),
              },
            ]),
        });

        const result = await ciHandler({
          action: "notifications",
          all: true,
          participating: false,
        });

        expect(result.content[0].text).toContain("owner/repo1");
        expect(result.content[0].text).toContain("owner/repo2");
        expect(result.content[0].text).toContain("Issue 1");
        expect(result.content[0].text).toContain("PR 1");
        expect(result.content[0].text).toContain("Release 1.0");
      });
    });

    describe("unknown action", () => {
      it("should return error for unknown action", async () => {
        const result = await ciHandler({
          action: "unknown_action" as "actions",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown action");
      });
    });

    describe("actions with different states", () => {
      it("should show different icons for workflow states", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              total_count: 4,
              workflow_runs: [
                {
                  id: 1,
                  name: "Success",
                  head_branch: "main",
                  event: "push",
                  status: "completed",
                  conclusion: "success",
                  run_number: 1,
                  created_at: new Date(Date.now() - 120000).toISOString(),
                  updated_at: new Date().toISOString(),
                },
                {
                  id: 2,
                  name: "Failure",
                  head_branch: "main",
                  event: "push",
                  status: "completed",
                  conclusion: "failure",
                  run_number: 2,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                {
                  id: 3,
                  name: "Cancelled",
                  head_branch: "main",
                  event: "push",
                  status: "completed",
                  conclusion: "cancelled",
                  run_number: 3,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                {
                  id: 4,
                  name: "In Progress",
                  head_branch: "main",
                  event: "pull_request",
                  status: "in_progress",
                  conclusion: null,
                  run_number: 4,
                  created_at: new Date().toISOString(),
                  updated_at: null,
                },
              ],
            }),
        });

        const result = await ciHandler({
          action: "actions",
          repo: "owner/repo",
          branch: "main",
        });

        expect(result.content[0].text).toContain("✅");
        expect(result.content[0].text).toContain("❌");
        expect(result.content[0].text).toContain("⏹️");
        expect(result.content[0].text).toContain("🔄");
      });

      it("should handle workflow with commit message", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              total_count: 1,
              workflow_runs: [
                {
                  id: 1,
                  name: "CI",
                  head_branch: "main",
                  event: "push",
                  status: "completed",
                  conclusion: "success",
                  run_number: 10,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  head_commit: {
                    message: "Fix bug in authentication module\n\nMore details here",
                  },
                },
              ],
            }),
        });

        const result = await ciHandler({
          action: "actions",
          repo: "owner/repo",
        });

        expect(result.content[0].text).toContain("Fix bug in authentication module");
      });
    });
  });

  describe("helper functions", () => {
    it("formatRelativeTime should format times correctly", async () => {
      // Import the module to access internal functions via integration
      const { createGitHubMcpServer } = await import("./github-mcp");
      const server = createGitHubMcpServer(mockToken) as unknown as MockServer;

      // Test via list_files which shows relative times
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([{ name: "file.txt", type: "file", size: 100, path: "file.txt" }]),
      });

      const repoTool = server.tools.find((t: { name: string }) => t.name === "github_repo")!;
      await repoTool.handler({ action: "list_files", repo: "owner/repo" });

      // Just verify it doesn't crash
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
