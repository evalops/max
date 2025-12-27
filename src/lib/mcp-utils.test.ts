/**
 * Tests for MCP Utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generatePythonLibrary,
  RESEARCH_PYTHON_TOOLS,
  GITHUB_PYTHON_TOOLS,
  WEB_PYTHON_TOOLS,
  DATA_PYTHON_TOOLS,
} from "./mcp-utils";

// Define mock functions using vi.hoisted() so they're available when vi.mock runs
const { mockMkdir, mockWriteFile } = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockWriteFile: vi.fn(),
}));

// Mock fs module for testing
vi.mock("fs/promises", () => ({
  default: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
  },
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

describe("mcp-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("RESEARCH_PYTHON_TOOLS", () => {
    it("should have correct number of research tools", () => {
      expect(RESEARCH_PYTHON_TOOLS).toHaveLength(4);
    });

    it("should have arxiv_search tool", () => {
      const arxivTool = RESEARCH_PYTHON_TOOLS.find((t) => t.name === "arxiv_search");
      expect(arxivTool).toBeDefined();
      expect(arxivTool?.description).toContain("arXiv");
      expect(arxivTool?.pythonCode).toContain("def arxiv_search");
    });

    it("should have semantic_scholar_search tool", () => {
      const ssTool = RESEARCH_PYTHON_TOOLS.find((t) => t.name === "semantic_scholar_search");
      expect(ssTool).toBeDefined();
      expect(ssTool?.pythonCode).toContain("api.semanticscholar.org");
    });

    it("should have download_arxiv_pdf tool", () => {
      const downloadTool = RESEARCH_PYTHON_TOOLS.find((t) => t.name === "download_arxiv_pdf");
      expect(downloadTool).toBeDefined();
      expect(downloadTool?.pythonCode).toContain("arxiv.org/pdf");
    });

    it("should have get_arxiv_paper tool", () => {
      const getPaperTool = RESEARCH_PYTHON_TOOLS.find((t) => t.name === "get_arxiv_paper");
      expect(getPaperTool).toBeDefined();
      expect(getPaperTool?.pythonCode).toContain("export.arxiv.org/api");
    });

    it("all tools should have valid Python function signatures", () => {
      for (const tool of RESEARCH_PYTHON_TOOLS) {
        expect(tool.pythonCode).toMatch(/^def \w+\(/);
        expect(tool.pythonCode).toContain('"""');
      }
    });
  });

  describe("WEB_PYTHON_TOOLS", () => {
    it("should have web_fetch tool", () => {
      const webFetchTool = WEB_PYTHON_TOOLS.find((t) => t.name === "web_fetch");
      expect(webFetchTool).toBeDefined();
      expect(webFetchTool?.pythonCode).toContain("requests.get");
    });

    it("should have web_search_scrape tool", () => {
      const scrapeTool = WEB_PYTHON_TOOLS.find((t) => t.name === "web_search_scrape");
      expect(scrapeTool).toBeDefined();
      expect(scrapeTool?.pythonCode).toContain("web_fetch");
    });
  });

  describe("GITHUB_PYTHON_TOOLS", () => {
    it("should have github_search_code tool", () => {
      const searchTool = GITHUB_PYTHON_TOOLS.find((t) => t.name === "github_search_code");
      expect(searchTool).toBeDefined();
      expect(searchTool?.pythonCode).toContain("api.github.com/search/code");
    });

    it("should have github_get_file tool", () => {
      const getFileTool = GITHUB_PYTHON_TOOLS.find((t) => t.name === "github_get_file");
      expect(getFileTool).toBeDefined();
      expect(getFileTool?.pythonCode).toContain("api.github.com/repos");
    });

    it("all GitHub tools should require token", () => {
      for (const tool of GITHUB_PYTHON_TOOLS) {
        expect(tool.pythonCode).toContain("token");
      }
    });
  });

  describe("DATA_PYTHON_TOOLS", () => {
    it("should have correct number of data tools", () => {
      expect(DATA_PYTHON_TOOLS).toHaveLength(7);
    });

    it("should have analyze_text tool", () => {
      const tool = DATA_PYTHON_TOOLS.find((t) => t.name === "analyze_text");
      expect(tool).toBeDefined();
      expect(tool?.pythonCode).toContain("word_freq");
      expect(tool?.pythonCode).toContain("Counter");
    });

    it("should have parse_csv_data tool", () => {
      const tool = DATA_PYTHON_TOOLS.find((t) => t.name === "parse_csv_data");
      expect(tool).toBeDefined();
      expect(tool?.pythonCode).toContain("csv.reader");
      expect(tool?.pythonCode).toContain("column_stats");
    });

    it("should have parse_json_deep tool", () => {
      const tool = DATA_PYTHON_TOOLS.find((t) => t.name === "parse_json_deep");
      expect(tool).toBeDefined();
      expect(tool?.pythonCode).toContain("analyze_structure");
      expect(tool?.pythonCode).toContain("json.loads");
    });

    it("should have extract_urls tool", () => {
      const tool = DATA_PYTHON_TOOLS.find((t) => t.name === "extract_urls");
      expect(tool).toBeDefined();
      expect(tool?.pythonCode).toContain("url_pattern");
      expect(tool?.dependencies).toContain("requests");
    });

    it("should have compute_diff tool", () => {
      const tool = DATA_PYTHON_TOOLS.find((t) => t.name === "compute_diff");
      expect(tool).toBeDefined();
      expect(tool?.pythonCode).toContain("unified_diff");
      expect(tool?.pythonCode).toContain("similarity_ratio");
    });

    it("should have extract_code_blocks tool", () => {
      const tool = DATA_PYTHON_TOOLS.find((t) => t.name === "extract_code_blocks");
      expect(tool).toBeDefined();
      expect(tool?.pythonCode).toContain("pattern");
    });

    it("should have batch_process tool", () => {
      const tool = DATA_PYTHON_TOOLS.find((t) => t.name === "batch_process");
      expect(tool).toBeDefined();
      expect(tool?.pythonCode).toContain("batches");
      expect(tool?.pythonCode).toContain("transform_fn");
    });

    it("all data tools should have docstrings", () => {
      for (const tool of DATA_PYTHON_TOOLS) {
        expect(tool.pythonCode).toContain('"""');
        expect(tool.pythonCode).toContain("Args:");
        expect(tool.pythonCode).toContain("Returns:");
      }
    });

    it("all data tools should have type hints", () => {
      for (const tool of DATA_PYTHON_TOOLS) {
        expect(tool.pythonCode).toMatch(/def \w+\([^)]*:.*\)/);
        expect(tool.pythonCode).toContain("->");
      }
    });
  });

  describe("generatePythonLibrary", () => {
    it("should create directory and write file", async () => {
      await generatePythonLibrary(RESEARCH_PYTHON_TOOLS, "/tmp/test/lib.py");

      expect(mockMkdir).toHaveBeenCalledWith("/tmp/test", { recursive: true });
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it("should include header with dependencies", async () => {
      let writtenContent = "";
      mockWriteFile.mockImplementation(async (_path: string, content: string) => {
        writtenContent = content;
      });

      await generatePythonLibrary(RESEARCH_PYTHON_TOOLS, "/tmp/test/lib.py");

      expect(writtenContent).toContain("Research Tools Library");
      expect(writtenContent).toContain("import requests");
      expect(writtenContent).toContain("from typing import");
    });

    it("should include all tool functions", async () => {
      let writtenContent = "";
      mockWriteFile.mockImplementation(async (_path: string, content: string) => {
        writtenContent = content;
      });

      await generatePythonLibrary(RESEARCH_PYTHON_TOOLS, "/tmp/test/lib.py");

      for (const tool of RESEARCH_PYTHON_TOOLS) {
        expect(writtenContent).toContain(`def ${tool.name}`);
      }
    });

    it("should include utility functions", async () => {
      let writtenContent = "";
      mockWriteFile.mockImplementation(async (_path: string, content: string) => {
        writtenContent = content;
      });

      await generatePythonLibrary(RESEARCH_PYTHON_TOOLS, "/tmp/test/lib.py");

      // Check for utility functions
      expect(writtenContent).toContain("def summarize_papers");
      expect(writtenContent).toContain("def filter_by_year");
      expect(writtenContent).toContain("def filter_by_citations");
      expect(writtenContent).toContain("def deduplicate_papers");
      expect(writtenContent).toContain("def merge_sources");
      expect(writtenContent).toContain("def sort_papers");
    });

    it("should include caching utilities", async () => {
      let writtenContent = "";
      mockWriteFile.mockImplementation(async (_path: string, content: string) => {
        writtenContent = content;
      });

      await generatePythonLibrary(RESEARCH_PYTHON_TOOLS, "/tmp/test/lib.py");

      expect(writtenContent).toContain("def cache_result");
      expect(writtenContent).toContain("def retry_with_backoff");
      expect(writtenContent).toContain("def clear_cache");
    });

    it("should handle empty tools array", async () => {
      let writtenContent = "";
      mockWriteFile.mockImplementation(async (_path: string, content: string) => {
        writtenContent = content;
      });

      await generatePythonLibrary([], "/tmp/test/lib.py");

      // Should still have header and utilities
      expect(writtenContent).toContain("Research Tools Library");
      expect(writtenContent).toContain("def summarize_papers");
    });

    it("should collect all dependencies", async () => {
      let writtenContent = "";
      mockWriteFile.mockImplementation(async (_path: string, content: string) => {
        writtenContent = content;
      });

      const toolsWithDeps = [
        ...GITHUB_PYTHON_TOOLS, // has requests dependency
      ];
      await generatePythonLibrary(toolsWithDeps, "/tmp/test/lib.py");

      expect(writtenContent).toContain("Dependencies: requests");
    });

    it("should generate valid Python syntax", async () => {
      let writtenContent = "";
      mockWriteFile.mockImplementation(async (_path: string, content: string) => {
        writtenContent = content;
      });

      await generatePythonLibrary(
        [...RESEARCH_PYTHON_TOOLS, ...WEB_PYTHON_TOOLS, ...GITHUB_PYTHON_TOOLS],
        "/tmp/test/lib.py"
      );

      // Check for proper Python structure
      expect(writtenContent).toContain('"""');
      expect(writtenContent).toContain("import ");
      expect(writtenContent).toContain("def ");
      expect(writtenContent).toContain("return ");

      // Should not have any obvious syntax errors
      expect(writtenContent).not.toContain("undefined");
      expect(writtenContent).not.toContain("null");
    });
  });

  describe("Python code quality", () => {
    it("all tools should have type hints", () => {
      const allTools = [...RESEARCH_PYTHON_TOOLS, ...WEB_PYTHON_TOOLS, ...GITHUB_PYTHON_TOOLS];

      for (const tool of allTools) {
        // Check for return type hints
        expect(tool.pythonCode).toMatch(/->\s*(List|Dict|str|Optional)/);
        // Check for parameter type hints
        expect(tool.pythonCode).toMatch(/:\s*(str|int|bool|Optional|List)/);
      }
    });

    it("all tools should have docstrings", () => {
      const allTools = [...RESEARCH_PYTHON_TOOLS, ...WEB_PYTHON_TOOLS, ...GITHUB_PYTHON_TOOLS];

      for (const tool of allTools) {
        // Check for docstrings
        const docstringCount = (tool.pythonCode.match(/"""/g) || []).length;
        expect(docstringCount).toBeGreaterThanOrEqual(2); // Opening and closing
      }
    });

    it("all tools should handle errors gracefully", () => {
      const allTools = [...RESEARCH_PYTHON_TOOLS, ...WEB_PYTHON_TOOLS, ...GITHUB_PYTHON_TOOLS];

      for (const tool of allTools) {
        // Most tools should use raise_for_status or have error handling
        const hasErrorHandling =
          tool.pythonCode.includes("raise_for_status") ||
          tool.pythonCode.includes("try:") ||
          tool.pythonCode.includes("error");
        expect(hasErrorHandling).toBe(true);
      }
    });
  });
});
