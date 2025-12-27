/**
 * Tests for Research MCP Server
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create mock functions
const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn().mockResolvedValue("");
const mockReaddir = vi.fn().mockResolvedValue([]);
const mockStat = vi.fn().mockResolvedValue({ isFile: () => true });

// Mock modules before importing
vi.mock("fs/promises", () => ({
  default: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    readdir: mockReaddir,
    stat: mockStat,
  },
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  readdir: mockReaddir,
  stat: mockStat,
}));
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));
vi.mock("util", () => ({
  promisify: vi.fn(() => vi.fn()),
}));

// Import fs after mocking
import fs from "fs/promises";

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

// Mock mcp-utils
vi.mock("./mcp-utils", () => ({
  generatePythonLibrary: vi.fn().mockResolvedValue(undefined),
  RESEARCH_PYTHON_TOOLS: [],
  GITHUB_PYTHON_TOOLS: [],
  WEB_PYTHON_TOOLS: [],
}));

describe("research-mcp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue("");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createResearchMcpServer", () => {
    it("should create server with correct name and version", async () => {
      const { createResearchMcpServer } = await import("./research-mcp");
      const server = (await createResearchMcpServer("/test/cwd")) as unknown as MockServer;

      expect(server.name).toBe("research");
      expect(server.version).toBe("2.1.0");
    });

    it("should include all three tools", async () => {
      const { createResearchMcpServer } = await import("./research-mcp");
      const server = (await createResearchMcpServer()) as unknown as MockServer;

      expect(server.tools).toHaveLength(3);

      const toolNames = server.tools.map((t: { name: string }) => t.name);
      expect(toolNames).toContain("notebook");
      expect(toolNames).toContain("research");
      expect(toolNames).toContain("python");
    });

    it("should generate Python library on creation", async () => {
      const { generatePythonLibrary } = await import("./mcp-utils");
      const { createResearchMcpServer } = await import("./research-mcp");

      await createResearchMcpServer("/test/cwd");

      expect(generatePythonLibrary).toHaveBeenCalledWith(
        expect.any(Array),
        "/test/cwd/.max/research_tools.py"
      );
    });
  });

  describe("notebook tool", () => {
    let notebookHandler: (
      args: Record<string, unknown>,
      extra?: unknown
    ) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    beforeEach(async () => {
      const { createResearchMcpServer } = await import("./research-mcp");
      const server = (await createResearchMcpServer("/test")) as unknown as MockServer;
      const notebookTool = server.tools.find((t: { name: string }) => t.name === "notebook")!;
      notebookHandler = notebookTool.handler;
    });

    describe("create action", () => {
      it("should create a new notebook with cells", async () => {
        const result = await notebookHandler({
          action: "create",
          path: "test.ipynb",
          cells: [
            { type: "code", source: "import pandas as pd" },
            { type: "markdown", source: "# Header" },
          ],
        });

        expect(fs.mkdir).toHaveBeenCalled();
        expect(fs.writeFile).toHaveBeenCalled();
        expect(result.content[0].text).toContain("Created notebook");
        expect(result.content[0].text).toContain("2 cells added");
      });

      it("should create empty notebook without cells", async () => {
        const result = await notebookHandler({
          action: "create",
          path: "empty.ipynb",
        });

        expect(result.content[0].text).toContain("Created notebook");
        expect(result.content[0].text).toContain("0 cells added");
      });

      it("should use custom kernel", async () => {
        const result = await notebookHandler({
          action: "create",
          path: "test.ipynb",
          kernel: "julia",
        });

        expect(result.content[0].text).toContain("Kernel: julia");
      });
    });

    describe("read action", () => {
      const sampleNotebook = {
        metadata: { kernelspec: { display_name: "Python 3" } },
        cells: [
          {
            cell_type: "code",
            source: ["import pandas as pd"],
            execution_count: 1,
            outputs: [{ output_type: "stream", text: ["success"] }],
          },
          {
            cell_type: "markdown",
            source: ["# Header"],
          },
        ],
      };

      beforeEach(() => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleNotebook));
      });

      it("should read notebook contents", async () => {
        const result = await notebookHandler({
          action: "read",
          path: "test.ipynb",
        });

        expect(result.content[0].text).toContain("Notebook: test.ipynb");
        expect(result.content[0].text).toContain("Cells: 2");
        expect(result.content[0].text).toContain("import pandas");
      });

      it("should filter by cell indices", async () => {
        const result = await notebookHandler({
          action: "read",
          path: "test.ipynb",
          cellIndices: [0],
        });

        expect(result.content[0].text).toContain("import pandas");
        expect(result.content[0].text).not.toContain("Header");
      });

      it("should include outputs when requested", async () => {
        const result = await notebookHandler({
          action: "read",
          path: "test.ipynb",
          includeOutputs: true,
        });

        expect(result.content[0].text).toContain("Output");
        expect(result.content[0].text).toContain("success");
      });
    });

    describe("summarize action", () => {
      const sampleNotebook = {
        metadata: { kernelspec: { display_name: "Python 3" } },
        cells: [
          {
            cell_type: "code",
            source: ["import pandas as pd\nimport numpy as np"],
            execution_count: 1,
            outputs: [],
          },
          {
            cell_type: "markdown",
            source: ["# Introduction\n## Setup"],
          },
          {
            cell_type: "code",
            source: ["df.plot()"],
            execution_count: 2,
            outputs: [{ data: { "image/png": "base64..." } }],
          },
        ],
      };

      beforeEach(() => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(sampleNotebook));
      });

      it("should provide notebook summary", async () => {
        const result = await notebookHandler({
          action: "summarize",
          path: "test.ipynb",
        });

        expect(result.content[0].text).toContain("Summary: test.ipynb");
        expect(result.content[0].text).toContain("Code cells: 2");
        expect(result.content[0].text).toContain("Markdown cells: 1");
        expect(result.content[0].text).toContain("Visualizations: 1");
      });

      it("should extract imports", async () => {
        const result = await notebookHandler({
          action: "summarize",
          path: "test.ipynb",
        });

        expect(result.content[0].text).toContain("Libraries");
        expect(result.content[0].text).toContain("pandas");
        expect(result.content[0].text).toContain("numpy");
      });

      it("should extract headings", async () => {
        const result = await notebookHandler({
          action: "summarize",
          path: "test.ipynb",
        });

        expect(result.content[0].text).toContain("Contents");
        expect(result.content[0].text).toContain("Introduction");
        expect(result.content[0].text).toContain("Setup");
      });
    });

    describe("add_cells action", () => {
      const existingNotebook = {
        cells: [{ cell_type: "code", source: ["existing"] }],
      };

      beforeEach(() => {
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingNotebook));
      });

      it("should add cells at end by default", async () => {
        let writtenContent = "";
        vi.mocked(fs.writeFile).mockImplementation(async (_path, content) => {
          writtenContent = content as string;
        });

        await notebookHandler({
          action: "add_cells",
          path: "test.ipynb",
          cells: [{ type: "code", source: "new cell" }],
        });

        const notebook = JSON.parse(writtenContent);
        expect(notebook.cells).toHaveLength(2);
        expect(notebook.cells[1].source).toContain("new cell");
      });

      it("should add cells at start when specified", async () => {
        let writtenContent = "";
        vi.mocked(fs.writeFile).mockImplementation(async (_path, content) => {
          writtenContent = content as string;
        });

        await notebookHandler({
          action: "add_cells",
          path: "test.ipynb",
          cells: [{ type: "markdown", source: "# New Header" }],
          position: "start",
        });

        const notebook = JSON.parse(writtenContent);
        const source = Array.isArray(notebook.cells[0].source)
          ? notebook.cells[0].source.join("")
          : notebook.cells[0].source;
        expect(source).toContain("New Header");
      });
    });

    describe("error handling", () => {
      it("should handle file not found", async () => {
        vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT: file not found"));

        const result = await notebookHandler({
          action: "read",
          path: "nonexistent.ipynb",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("failed");
      });

      it("should handle invalid JSON", async () => {
        vi.mocked(fs.readFile).mockResolvedValue("not valid json");

        const result = await notebookHandler({
          action: "read",
          path: "invalid.ipynb",
        });

        expect(result.isError).toBe(true);
      });
    });
  });

  describe("research tool", () => {
    let researchHandler: (
      args: Record<string, unknown>
    ) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    beforeEach(async () => {
      const { createResearchMcpServer } = await import("./research-mcp");
      const server = (await createResearchMcpServer("/test")) as unknown as MockServer;
      const researchTool = server.tools.find((t: { name: string }) => t.name === "research")!;
      researchHandler = researchTool.handler;
    });

    describe("arxiv_search action", () => {
      const mockArxivXml = `<?xml version="1.0"?>
        <feed>
          <entry>
            <title>Test Paper Title</title>
            <summary>This is a test abstract.</summary>
            <id>http://arxiv.org/abs/2301.00001</id>
            <published>2023-01-01T00:00:00Z</published>
            <author><name>Test Author</name></author>
            <arxiv:primary_category xmlns:arxiv="http://arxiv.org/schemas/atom" term="cs.AI"/>
          </entry>
        </feed>`;

      it("should search arXiv and return results", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockArxivXml),
        });

        const result = await researchHandler({
          action: "arxiv_search",
          query: "test query",
          maxResults: 10,
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("export.arxiv.org/api/query")
        );
        expect(result.content[0].text).toContain("arXiv");
        expect(result.content[0].text).toContain("Test Paper Title");
        expect(result.content[0].text).toContain("Test Author");
      });

      it("should require query parameter", async () => {
        const result = await researchHandler({
          action: "arxiv_search",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Query required");
      });

      it("should handle category filter", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockArxivXml),
        });

        await researchHandler({
          action: "arxiv_search",
          query: "transformers",
          category: "cs.LG",
        });

        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("cat%3Acs.LG"));
      });

      it("should handle empty results", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve("<feed></feed>"),
        });

        const result = await researchHandler({
          action: "arxiv_search",
          query: "nonexistent topic xyz123",
        });

        expect(result.content[0].text).toContain("No papers found");
      });
    });

    describe("arxiv_paper action", () => {
      const mockPaperXml = `<?xml version="1.0"?>
        <feed>
          <title>ArXiv API</title>
          <entry>
            <title>Detailed Paper</title>
            <summary>Full abstract here.</summary>
            <published>2023-06-15T00:00:00Z</published>
            <author><name>Author One</name></author>
            <author><name>Author Two</name></author>
            <arxiv:primary_category xmlns:arxiv="http://arxiv.org/schemas/atom" term="cs.CL"/>
          </entry>
        </feed>`;

      it("should fetch paper details", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockPaperXml),
        });

        const result = await researchHandler({
          action: "arxiv_paper",
          arxivId: "2301.07041",
        });

        expect(result.content[0].text).toContain("Detailed Paper");
        expect(result.content[0].text).toContain("Author One");
        expect(result.content[0].text).toContain("Abstract");
      });

      it("should handle full URL as arxivId", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockPaperXml),
        });

        await researchHandler({
          action: "arxiv_paper",
          arxivId: "https://arxiv.org/abs/2301.07041",
        });

        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("id_list=2301.07041"));
      });

      it("should require arxivId", async () => {
        const result = await researchHandler({
          action: "arxiv_paper",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("arxivId required");
      });
    });

    describe("arxiv_download action", () => {
      it("should download PDF", async () => {
        const pdfBuffer = new ArrayBuffer(1024);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(pdfBuffer),
        });

        const result = await researchHandler({
          action: "arxiv_download",
          arxivId: "2301.07041",
          outputPath: "paper.pdf",
        });

        expect(fs.writeFile).toHaveBeenCalled();
        expect(result.content[0].text).toContain("Downloaded");
        expect(result.content[0].text).toContain("paper.pdf");
      });

      it("should handle download failure", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: "Not Found",
        });

        const result = await researchHandler({
          action: "arxiv_download",
          arxivId: "invalid-id",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Failed to download");
      });
    });

    describe("semantic_scholar action", () => {
      const mockSSResponse = {
        total: 100,
        data: [
          {
            title: "SS Paper Title",
            authors: [{ name: "SS Author" }],
            year: 2024,
            abstract: "SS abstract text",
            citationCount: 42,
            url: "https://example.com/paper",
          },
        ],
      };

      it("should search Semantic Scholar", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSSResponse),
        });

        const result = await researchHandler({
          action: "semantic_scholar",
          query: "deep learning",
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("api.semanticscholar.org"),
          expect.any(Object)
        );
        expect(result.content[0].text).toContain("Semantic Scholar");
        expect(result.content[0].text).toContain("SS Paper Title");
        expect(result.content[0].text).toContain("42"); // Citation count
      });

      it("should handle year filter", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSSResponse),
        });

        await researchHandler({
          action: "semantic_scholar",
          query: "transformers",
          year: "2024",
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("year=2024"),
          expect.any(Object)
        );
      });

      it("should handle API errors", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: "Rate Limited",
        });

        const result = await researchHandler({
          action: "semantic_scholar",
          query: "test",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("API error");
      });
    });

    describe("literature_review action", () => {
      beforeEach(() => {
        // Mock arXiv response
        const arxivXml = `<feed>
          <entry>
            <title>ArXiv Paper</title>
            <summary>ArXiv abstract</summary>
            <id>http://arxiv.org/abs/2301.00001</id>
            <published>2024-01-01T00:00:00Z</published>
            <author><name>ArXiv Author</name></author>
          </entry>
        </feed>`;

        // Mock Semantic Scholar response
        const ssData = {
          data: [
            {
              title: "SS Paper",
              authors: [{ name: "SS Author" }],
              year: 2024,
              abstract: "SS abstract",
              citationCount: 10,
            },
          ],
        };

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            text: () => Promise.resolve(arxivXml),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(ssData),
          });
      });

      it("should search multiple sources", async () => {
        const result = await researchHandler({
          action: "literature_review",
          query: "attention mechanisms",
        });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(result.content[0].text).toContain("Literature Review");
        expect(result.content[0].text).toContain("unique papers");
      });

      it("should create notebook when path provided", async () => {
        await researchHandler({
          action: "literature_review",
          query: "transformers",
          notebookPath: "review.ipynb",
        });

        expect(fs.writeFile).toHaveBeenCalled();
        const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
        expect(writeCall[0]).toContain("review.ipynb");
      });

      it("should deduplicate papers", async () => {
        // Both sources return same title
        const arxivXml = `<feed>
          <entry>
            <title>Same Paper Title</title>
            <summary>Abstract 1</summary>
            <id>http://arxiv.org/abs/2301.00001</id>
            <published>2024-01-01T00:00:00Z</published>
            <author><name>Author</name></author>
          </entry>
        </feed>`;

        const ssData = {
          data: [
            {
              title: "Same Paper Title",
              authors: [{ name: "Author" }],
              year: 2024,
              abstract: "Abstract 2",
            },
          ],
        };

        mockFetch.mockReset();
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            text: () => Promise.resolve(arxivXml),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(ssData),
          });

        const result = await researchHandler({
          action: "literature_review",
          query: "test",
        });

        // Should show 1 unique paper from 2 total results
        expect(result.content[0].text).toContain("1 unique papers from 2 total");
      });
    });
  });

  describe("python tool", () => {
    let pythonHandler: (
      args: Record<string, unknown>
    ) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
    let mockExecAsync: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      // Setup exec mock
      const { exec } = await import("child_process");
      mockExecAsync = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
      vi.mocked(exec).mockImplementation((_cmd, _opts, callback) => {
        if (callback) {
          callback(null, "", "");
        }
        return {} as ReturnType<typeof exec>;
      });

      // Re-mock promisify to return our mock
      const { promisify } = await import("util");
      vi.mocked(promisify).mockReturnValue(mockExecAsync);

      // Need to re-import to get fresh module with new mocks
      vi.resetModules();

      // Re-setup the mocks after reset
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

      vi.mock("./mcp-utils", () => ({
        generatePythonLibrary: vi.fn().mockResolvedValue(undefined),
        RESEARCH_PYTHON_TOOLS: [],
        GITHUB_PYTHON_TOOLS: [],
        WEB_PYTHON_TOOLS: [],
      }));

      const { createResearchMcpServer } = await import("./research-mcp");
      const server = (await createResearchMcpServer("/test")) as unknown as MockServer;
      const pythonTool = server.tools.find((t: { name: string }) => t.name === "python")!;
      pythonHandler = pythonTool.handler;
    });

    describe("run action", () => {
      it("should execute Python code", async () => {
        mockExecAsync.mockResolvedValueOnce({
          stdout: "Hello, World!\n",
          stderr: "",
        });

        const result = await pythonHandler({
          action: "run",
          code: "print('Hello, World!')",
        });

        expect(result.content[0].text).toContain("Output");
        expect(result.content[0].text).toContain("Hello, World!");
      });

      it("should require code parameter", async () => {
        const result = await pythonHandler({
          action: "run",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Code required");
      });

      it("should handle stderr", async () => {
        mockExecAsync.mockResolvedValueOnce({
          stdout: "",
          stderr: "Warning: deprecated\n",
        });

        const result = await pythonHandler({
          action: "run",
          code: "import warnings",
        });

        expect(result.content[0].text).toContain("Stderr");
        expect(result.content[0].text).toContain("deprecated");
      });

      it("should wrap matplotlib code", async () => {
        mockExecAsync.mockResolvedValueOnce({
          stdout: "Plot saved\n",
          stderr: "",
        });

        await pythonHandler({
          action: "run",
          code: "import matplotlib.pyplot as plt\nplt.plot([1,2,3])",
        });

        expect(mockExecAsync).toHaveBeenCalledWith(
          expect.stringContaining("matplotlib.use('Agg')"),
          expect.any(Object)
        );
      });
    });

    describe("visualize action", () => {
      it("should create visualization", async () => {
        mockExecAsync.mockResolvedValueOnce({
          stdout: "done\n",
          stderr: "",
        });

        const result = await pythonHandler({
          action: "visualize",
          chartType: "line",
          data: { x: [1, 2, 3], y: [4, 5, 6] },
          title: "Test Chart",
        });

        expect(result.content[0].text).toContain("Created line chart");
        expect(result.content[0].text).toContain("Test Chart");
      });

      it("should require chartType and data", async () => {
        const result = await pythonHandler({
          action: "visualize",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("chartType and data required");
      });

      it("should support different chart types", async () => {
        const chartTypes = ["line", "bar", "scatter", "histogram", "pie", "heatmap"];

        for (const chartType of chartTypes) {
          mockExecAsync.mockResolvedValueOnce({ stdout: "done", stderr: "" });

          const result = await pythonHandler({
            action: "visualize",
            chartType,
            data: { values: [1, 2, 3] },
          });

          expect(result.content[0].text).toContain(`Created ${chartType} chart`);
        }
      });
    });
  });
});
