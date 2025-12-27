/**
 * Integration tests for MCP Utilities
 * Tests that the generated Python library is syntactically valid
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import {
  generatePythonLibrary,
  RESEARCH_PYTHON_TOOLS,
  GITHUB_PYTHON_TOOLS,
  WEB_PYTHON_TOOLS,
} from "./mcp-utils";

const execAsync = promisify(exec);

const TEST_DIR = path.join(process.cwd(), ".test-output");
const TEST_LIB_PATH = path.join(TEST_DIR, "research_tools.py");

describe("mcp-utils integration", () => {
  beforeAll(async () => {
    // Generate the Python library for testing
    await generatePythonLibrary(
      [...RESEARCH_PYTHON_TOOLS, ...WEB_PYTHON_TOOLS, ...GITHUB_PYTHON_TOOLS],
      TEST_LIB_PATH
    );
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should generate a valid Python file", async () => {
    const content = await fs.readFile(TEST_LIB_PATH, "utf-8");
    expect(content.length).toBeGreaterThan(1000);
    expect(content).toContain("def arxiv_search");
  });

  it("should have valid Python syntax", async () => {
    // Check if Python is available
    try {
      await execAsync("python3 --version");
    } catch {
      console.log("Python3 not available, skipping syntax check");
      return;
    }

    // Use Python to check syntax
    const { stderr } = await execAsync(`python3 -m py_compile "${TEST_LIB_PATH}"`);
    expect(stderr).toBe("");
  });

  it("should be importable in Python", async () => {
    // Check if Python is available
    try {
      await execAsync("python3 --version");
    } catch {
      console.log("Python3 not available, skipping import check");
      return;
    }

    // Create a test script file to avoid shell escaping issues
    const testScript = path.join(TEST_DIR, "test_import.py");
    await fs.writeFile(
      testScript,
      `
import sys
sys.path.insert(0, "${TEST_DIR}")

# Mock requests module since it may not be installed
import types
requests = types.ModuleType("requests")
requests.get = lambda *a, **k: None
requests.utils = types.ModuleType("utils")
requests.utils.quote = lambda x: x
requests.exceptions = types.ModuleType("exceptions")
requests.exceptions.RequestException = Exception
sys.modules["requests"] = requests
sys.modules["requests.utils"] = requests.utils
sys.modules["requests.exceptions"] = requests.exceptions

try:
    import research_tools
    print("OK")
except ImportError as e:
    print("IMPORT_ERROR: " + str(e))
except SyntaxError as e:
    print("SYNTAX_ERROR: " + str(e))
`
    );

    const { stdout } = await execAsync(`python3 "${testScript}"`);
    expect(stdout.trim()).toBe("OK");
  });

  it("should have all expected functions available", async () => {
    // Check if Python is available
    try {
      await execAsync("python3 --version");
    } catch {
      console.log("Python3 not available, skipping function check");
      return;
    }

    const expectedFunctions = [
      "arxiv_search",
      "semantic_scholar_search",
      "download_arxiv_pdf",
      "get_arxiv_paper",
      "web_fetch",
      "web_search_scrape",
      "github_search_code",
      "github_get_file",
      "summarize_papers",
      "filter_by_year",
      "filter_by_citations",
      "deduplicate_papers",
      "merge_sources",
      "sort_papers",
      "cache_result",
      "retry_with_backoff",
      "clear_cache",
    ];

    const testScript = path.join(TEST_DIR, "test_functions.py");
    await fs.writeFile(
      testScript,
      `
import sys
sys.path.insert(0, "${TEST_DIR}")

# Mock requests module
import types
requests = types.ModuleType("requests")
requests.get = lambda *a, **k: None
requests.utils = types.ModuleType("utils")
requests.utils.quote = lambda x: x
requests.exceptions = types.ModuleType("exceptions")
requests.exceptions.RequestException = Exception
sys.modules["requests"] = requests
sys.modules["requests.utils"] = requests.utils
sys.modules["requests.exceptions"] = requests.exceptions

import research_tools
functions = [name for name in dir(research_tools) if callable(getattr(research_tools, name)) and not name.startswith("_")]
print(",".join(sorted(functions)))
`
    );

    const { stdout } = await execAsync(`python3 "${testScript}"`);
    const availableFunctions = stdout.trim().split(",");

    for (const fn of expectedFunctions) {
      expect(availableFunctions).toContain(fn);
    }
  });

  it("should have working utility functions", async () => {
    // Check if Python is available
    try {
      await execAsync("python3 --version");
    } catch {
      console.log("Python3 not available, skipping utility test");
      return;
    }

    const testScript = path.join(TEST_DIR, "test_utilities.py");
    await fs.writeFile(
      testScript,
      `
import sys
sys.path.insert(0, "${TEST_DIR}")

# Mock requests module
import types
requests = types.ModuleType("requests")
requests.get = lambda *a, **k: None
requests.utils = types.ModuleType("utils")
requests.utils.quote = lambda x: x
requests.exceptions = types.ModuleType("exceptions")
requests.exceptions.RequestException = Exception
sys.modules["requests"] = requests
sys.modules["requests.utils"] = requests.utils
sys.modules["requests.exceptions"] = requests.exceptions

from research_tools import summarize_papers, filter_by_year, sort_papers, deduplicate_papers

# Test data
papers = [
    {"title": "Paper A", "year": "2024", "authors": ["Alice"], "citations": 100},
    {"title": "Paper B", "year": "2023", "authors": ["Bob", "Charlie"], "citations": 50},
    {"title": "Paper A", "year": "2024", "authors": ["Alice"], "citations": 100},
    {"title": "Paper C", "year": "2022", "authors": ["Dave"], "citations": 200},
]

# Test summarize_papers
summary = summarize_papers(papers, max_papers=2)
assert "Found 4 papers" in summary, "Expected Found 4 papers in summary"
assert "Paper A" in summary, "Expected Paper A in summary"

# Test filter_by_year
filtered = filter_by_year(papers, 2023)
assert len(filtered) == 3, "Expected 3 papers from 2023+"

# Test deduplicate_papers
deduped = deduplicate_papers(papers)
assert len(deduped) == 3, "Expected 3 unique papers"

# Test sort_papers
sorted_by_citations = sort_papers(papers, by="citations", descending=True)
assert sorted_by_citations[0]["citations"] == 200, "Expected highest citations first"

print("ALL_TESTS_PASSED")
`
    );

    const { stdout } = await execAsync(`python3 "${testScript}"`);
    expect(stdout.trim()).toBe("ALL_TESTS_PASSED");
  });

  it("should have proper type hints that work with Python type checkers", async () => {
    const content = await fs.readFile(TEST_LIB_PATH, "utf-8");

    // Check for proper type imports
    expect(content).toContain("from typing import");
    expect(content).toContain("Optional");
    expect(content).toContain("List");
    expect(content).toContain("Dict");
    expect(content).toContain("Any");

    // Check for return type hints on main functions
    expect(content).toMatch(/def arxiv_search.*->.*List\[Dict/);
    expect(content).toMatch(/def summarize_papers.*->.*str/);
  });

  it("should include caching configuration", async () => {
    const content = await fs.readFile(TEST_LIB_PATH, "utf-8");

    expect(content).toContain("_CACHE_DIR");
    expect(content).toContain("_CACHE_TTL");
    expect(content).toContain("import pickle");
    expect(content).toContain("from pathlib import Path");
  });
});
