/**
 * Research MCP Server - Tools for research tasks
 *
 * Provides tools for:
 * - Creating and executing Jupyter notebooks
 * - Searching academic papers
 * - Data analysis and visualization
 */

import { z } from "zod";
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-code";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

// ============================================================================
// NOTEBOOK TOOLS
// ============================================================================

// Tool: Create a new Jupyter notebook
const createNotebookTool = tool(
  "notebook_create",
  `Create a new Jupyter notebook with optional initial cells.

Use this to start a new data analysis or research notebook.

Examples:
- Empty notebook: {path: "analysis.ipynb"}
- With code cells: {path: "analysis.ipynb", cells: [{type: "code", source: "import pandas as pd"}]}
- With markdown: {path: "research.ipynb", cells: [{type: "markdown", source: "# Research Notes"}]}`,
  {
    path: z.string().describe("Path for the new notebook file"),
    cells: z.array(z.object({
      type: z.enum(["code", "markdown"]),
      source: z.string(),
    })).optional().describe("Initial cells to add"),
    kernel: z.string().default("python3").optional().describe("Kernel name (python3, ir, julia, etc.)"),
  },
  async (args, extra) => {
    const { path: notebookPath, cells = [], kernel = "python3" } = args;
    const context = extra as { cwd?: string };
    const cwd = context?.cwd || process.cwd();
    const fullPath = path.isAbsolute(notebookPath) ? notebookPath : path.join(cwd, notebookPath);

    // Create notebook structure
    const notebook = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: {
          display_name: kernel === "python3" ? "Python 3" : kernel,
          language: kernel === "python3" ? "python" : kernel,
          name: kernel,
        },
        language_info: {
          name: kernel === "python3" ? "python" : kernel,
        },
      },
      cells: cells.map((cell, i) => ({
        cell_type: cell.type,
        source: cell.source.split("\n"),
        metadata: {},
        ...(cell.type === "code" ? {
          execution_count: null,
          outputs: [],
          id: `cell-${i}`,
        } : {
          id: `cell-${i}`,
        }),
      })),
    };

    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, JSON.stringify(notebook, null, 2));

      return {
        content: [{
          type: "text",
          text: `✅ Created notebook: ${notebookPath}\n\n${cells.length} cells added.\n\nKernel: ${kernel}`
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to create notebook: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Tool: Add cells to an existing notebook
const addCellsTool = tool(
  "notebook_add_cells",
  `Add cells to an existing Jupyter notebook.

Examples:
- Add code cell: {path: "analysis.ipynb", cells: [{type: "code", source: "df.describe()"}]}
- Add at position: {path: "analysis.ipynb", position: 2, cells: [{type: "markdown", source: "## Results"}]}`,
  {
    path: z.string().describe("Path to the notebook"),
    cells: z.array(z.object({
      type: z.enum(["code", "markdown"]),
      source: z.string(),
    })).describe("Cells to add"),
    position: z.number().optional().describe("Position to insert cells (default: end)"),
  },
  async (args, extra) => {
    const { path: notebookPath, cells, position } = args;
    const context = extra as { cwd?: string };
    const cwd = context?.cwd || process.cwd();
    const fullPath = path.isAbsolute(notebookPath) ? notebookPath : path.join(cwd, notebookPath);

    try {
      const content = await fs.readFile(fullPath, "utf-8");
      const notebook = JSON.parse(content);

      const newCells = cells.map((cell, i) => ({
        cell_type: cell.type,
        source: cell.source.split("\n"),
        metadata: {},
        ...(cell.type === "code" ? {
          execution_count: null,
          outputs: [],
          id: `cell-${Date.now()}-${i}`,
        } : {
          id: `cell-${Date.now()}-${i}`,
        }),
      }));

      if (position !== undefined) {
        notebook.cells.splice(position, 0, ...newCells);
      } else {
        notebook.cells.push(...newCells);
      }

      await fs.writeFile(fullPath, JSON.stringify(notebook, null, 2));

      return {
        content: [{
          type: "text",
          text: `✅ Added ${cells.length} cell(s) to ${notebookPath}${position !== undefined ? ` at position ${position}` : ""}`
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to add cells: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Tool: Execute notebook cells
const executeNotebookTool = tool(
  "notebook_execute",
  `Execute cells in a Jupyter notebook and capture outputs.

Requires jupyter/nbconvert to be installed. Executes cells in order and captures outputs.

Examples:
- Execute all: {path: "analysis.ipynb"}
- Execute specific cells: {path: "analysis.ipynb", cellIndices: [0, 2, 3]}
- With timeout: {path: "analysis.ipynb", timeout: 120}`,
  {
    path: z.string().describe("Path to the notebook"),
    cellIndices: z.array(z.number()).optional().describe("Specific cell indices to execute (default: all)"),
    timeout: z.number().default(60).optional().describe("Execution timeout in seconds"),
    inPlace: z.boolean().default(true).optional().describe("Modify notebook in place with outputs"),
  },
  async (args, extra) => {
    const { path: notebookPath, timeout = 60, inPlace = true } = args;
    const context = extra as { cwd?: string };
    const cwd = context?.cwd || process.cwd();
    const fullPath = path.isAbsolute(notebookPath) ? notebookPath : path.join(cwd, notebookPath);

    try {
      // Check if jupyter is available
      try {
        await execAsync("jupyter --version");
      } catch {
        return {
          content: [{ type: "text", text: "Jupyter is not installed. Install with: pip install jupyter nbconvert" }],
          isError: true,
        };
      }

      // Execute the notebook
      const outputPath = inPlace ? fullPath : fullPath.replace(".ipynb", "_executed.ipynb");
      const cmd = `jupyter nbconvert --to notebook --execute --ExecutePreprocessor.timeout=${timeout} --output "${path.basename(outputPath)}" "${fullPath}"`;

      const { stderr } = await execAsync(cmd, { cwd: path.dirname(fullPath) });

      // Read the executed notebook to get outputs
      const executedContent = await fs.readFile(outputPath, "utf-8");
      const notebook = JSON.parse(executedContent);

      // Summarize outputs
      const outputSummary = notebook.cells
        .filter((cell: { cell_type: string }) => cell.cell_type === "code")
        .map((cell: { execution_count: number | null; outputs: Array<{ output_type: string; text?: string[]; data?: Record<string, unknown> }> }, i: number) => {
          const outputs = cell.outputs || [];
          const hasOutput = outputs.length > 0;
          const hasError = outputs.some((o: { output_type: string }) => o.output_type === "error");
          const hasImage = outputs.some((o: { data?: Record<string, unknown> }) => o.data && ("image/png" in o.data || "image/jpeg" in o.data));

          let summary = `Cell ${i + 1} [${cell.execution_count || "?"}]: `;
          if (hasError) summary += "❌ Error";
          else if (hasImage) summary += "📊 Output with visualization";
          else if (hasOutput) summary += "✅ Output";
          else summary += "⚪ No output";

          return summary;
        })
        .join("\n");

      return {
        content: [{
          type: "text",
          text: `✅ Executed notebook: ${notebookPath}\n\n## Cell Outputs\n${outputSummary}\n\n${stderr ? `\nWarnings:\n${stderr}` : ""}`
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to execute notebook: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Tool: Read notebook outputs
const readNotebookTool = tool(
  "notebook_read",
  `Read a Jupyter notebook and display its contents and outputs.

Examples:
- Read full notebook: {path: "analysis.ipynb"}
- Read specific cells: {path: "analysis.ipynb", cellIndices: [0, 5]}`,
  {
    path: z.string().describe("Path to the notebook"),
    cellIndices: z.array(z.number()).optional().describe("Specific cell indices to read"),
    includeOutputs: z.boolean().default(true).optional().describe("Include cell outputs"),
  },
  async (args, extra) => {
    const { path: notebookPath, cellIndices, includeOutputs = true } = args;
    const context = extra as { cwd?: string };
    const cwd = context?.cwd || process.cwd();
    const fullPath = path.isAbsolute(notebookPath) ? notebookPath : path.join(cwd, notebookPath);

    try {
      const content = await fs.readFile(fullPath, "utf-8");
      const notebook = JSON.parse(content);

      let result = `# Notebook: ${notebookPath}\n`;
      result += `Kernel: ${notebook.metadata?.kernelspec?.display_name || "Unknown"}\n`;
      result += `Cells: ${notebook.cells.length}\n\n`;

      const cellsToShow = cellIndices
        ? notebook.cells.filter((_: unknown, i: number) => cellIndices.includes(i))
        : notebook.cells;

      for (let i = 0; i < cellsToShow.length; i++) {
        const cell = cellsToShow[i];
        const cellIndex = cellIndices ? cellIndices[i] : i;
        const source = Array.isArray(cell.source) ? cell.source.join("") : cell.source;

        result += `## Cell ${cellIndex + 1} (${cell.cell_type})`;
        if (cell.execution_count) result += ` [${cell.execution_count}]`;
        result += "\n\n";

        if (cell.cell_type === "code") {
          result += "```python\n" + source + "\n```\n";
        } else {
          result += source + "\n";
        }

        if (includeOutputs && cell.outputs?.length > 0) {
          result += "\n**Output:**\n";
          for (const output of cell.outputs) {
            if (output.output_type === "stream") {
              result += "```\n" + (output.text?.join("") || "") + "```\n";
            } else if (output.output_type === "execute_result" || output.output_type === "display_data") {
              if (output.data?.["text/plain"]) {
                const text = Array.isArray(output.data["text/plain"])
                  ? output.data["text/plain"].join("")
                  : output.data["text/plain"];
                result += "```\n" + text + "\n```\n";
              }
              if (output.data?.["image/png"]) {
                result += "\n[Image output - base64 encoded]\n";
              }
            } else if (output.output_type === "error") {
              result += "```\n❌ " + output.ename + ": " + output.evalue + "\n```\n";
            }
          }
        }
        result += "\n---\n\n";
      }

      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to read notebook: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// ============================================================================
// RESEARCH TOOLS
// ============================================================================

// Tool: Search arXiv papers
const searchArxivTool = tool(
  "research_arxiv",
  `Search for academic papers on arXiv.

Examples:
- Search: {query: "transformer attention mechanism"}
- Search with filters: {query: "neural networks", maxResults: 20, category: "cs.LG"}`,
  {
    query: z.string().describe("Search query"),
    maxResults: z.number().min(1).max(100).default(10).optional(),
    category: z.string().optional().describe("arXiv category (cs.LG, cs.AI, math.ST, etc.)"),
    sortBy: z.enum(["relevance", "lastUpdatedDate", "submittedDate"]).default("relevance").optional(),
  },
  async (args) => {
    const { query, maxResults = 10, category, sortBy = "relevance" } = args;

    try {
      let searchQuery = query;
      if (category) {
        searchQuery = `cat:${category} AND ${query}`;
      }

      const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(searchQuery)}&start=0&max_results=${maxResults}&sortBy=${sortBy}&sortOrder=descending`;

      const response = await fetch(url);
      if (!response.ok) {
        return {
          content: [{ type: "text", text: `arXiv API error: ${response.statusText}` }],
          isError: true,
        };
      }

      const xml = await response.text();

      // Simple XML parsing for arXiv results
      const entries: Array<{ title: string; authors: string; summary: string; link: string; published: string; category: string }> = [];
      const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);

      for (const match of entryMatches) {
        const entry = match[1];
        const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\n/g, " ").trim() || "";
        const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\n/g, " ").trim() || "";
        const link = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || "";
        const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() || "";
        const categoryMatch = entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"/);
        const cat = categoryMatch?.[1] || "";

        const authorMatches = entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g);
        const authors = [...authorMatches].map(m => m[1].trim()).join(", ");

        entries.push({ title, authors, summary, link, published, category: cat });
      }

      if (entries.length === 0) {
        return {
          content: [{ type: "text", text: `No papers found for query: "${query}"` }],
        };
      }

      let result = `# arXiv Search: "${query}"\n`;
      result += `Found ${entries.length} papers\n\n`;

      for (const entry of entries) {
        result += `## ${entry.title}\n`;
        result += `**Authors:** ${entry.authors}\n`;
        result += `**Category:** ${entry.category} | **Published:** ${entry.published.split("T")[0]}\n`;
        result += `**Link:** ${entry.link}\n\n`;
        result += `${entry.summary.substring(0, 300)}${entry.summary.length > 300 ? "..." : ""}\n\n`;
        result += "---\n\n";
      }

      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `arXiv search failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Tool: Search Semantic Scholar
const searchSemanticScholarTool = tool(
  "research_semantic_scholar",
  `Search for academic papers on Semantic Scholar.

Examples:
- Search: {query: "large language models"}
- With filters: {query: "deep learning", year: "2023-", limit: 20}`,
  {
    query: z.string().describe("Search query"),
    limit: z.number().min(1).max(100).default(10).optional(),
    year: z.string().optional().describe("Year filter (e.g., '2023', '2020-2023', '2023-')"),
    fieldsOfStudy: z.array(z.string()).optional().describe("Filter by field (Computer Science, Mathematics, etc.)"),
  },
  async (args) => {
    const { query, limit = 10, year, fieldsOfStudy } = args;

    try {
      let url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,abstract,citationCount,url,fieldsOfStudy`;

      if (year) url += `&year=${year}`;
      if (fieldsOfStudy?.length) url += `&fieldsOfStudy=${fieldsOfStudy.join(",")}`;

      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        return {
          content: [{ type: "text", text: `Semantic Scholar API error: ${response.statusText}` }],
          isError: true,
        };
      }

      const data = await response.json();
      const papers = data.data || [];

      if (papers.length === 0) {
        return {
          content: [{ type: "text", text: `No papers found for query: "${query}"` }],
        };
      }

      let result = `# Semantic Scholar: "${query}"\n`;
      result += `Found ${data.total} papers (showing ${papers.length})\n\n`;

      for (const paper of papers) {
        const authors = paper.authors?.map((a: { name: string }) => a.name).join(", ") || "Unknown";
        const fields = paper.fieldsOfStudy?.join(", ") || "";

        result += `## ${paper.title || "Untitled"}\n`;
        result += `**Authors:** ${authors}\n`;
        result += `**Year:** ${paper.year || "?"} | **Citations:** ${paper.citationCount || 0}`;
        if (fields) result += ` | **Fields:** ${fields}`;
        result += "\n";
        if (paper.url) result += `**URL:** ${paper.url}\n`;
        result += "\n";
        if (paper.abstract) {
          result += `${paper.abstract.substring(0, 300)}${paper.abstract.length > 300 ? "..." : ""}\n`;
        }
        result += "\n---\n\n";
      }

      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Semantic Scholar search failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Tool: Run Python code for data analysis
const runPythonTool = tool(
  "python_run",
  `Execute Python code for quick data analysis.

The code runs in a subprocess. Supports pandas, numpy, matplotlib if installed.

Examples:
- Quick calculation: {code: "import math; print(math.sqrt(144))"}
- Data analysis: {code: "import pandas as pd; df = pd.read_csv('data.csv'); print(df.describe())"}`,
  {
    code: z.string().describe("Python code to execute"),
    timeout: z.number().default(30).optional().describe("Timeout in seconds"),
    savePlots: z.boolean().default(true).optional().describe("Save matplotlib plots to files"),
  },
  async (args, extra) => {
    const { code, timeout = 30, savePlots = true } = args;
    const context = extra as { cwd?: string };
    const cwd = context?.cwd || process.cwd();

    try {
      // Wrap code to handle plots
      let wrappedCode = code;
      if (savePlots && code.includes("plt.")) {
        const plotPath = path.join(cwd, `plot_${Date.now()}.png`);
        wrappedCode = `
import matplotlib
matplotlib.use('Agg')
${code}
import matplotlib.pyplot as plt
if plt.get_fignums():
    plt.savefig('${plotPath}')
    print(f"\\n📊 Plot saved to: ${plotPath}")
`;
      }

      const { stdout, stderr } = await execAsync(`python3 -c ${JSON.stringify(wrappedCode)}`, {
        cwd,
        timeout: timeout * 1000,
      });

      let result = "";
      if (stdout) result += `**Output:**\n\`\`\`\n${stdout}\`\`\`\n`;
      if (stderr) result += `**Stderr:**\n\`\`\`\n${stderr}\`\`\`\n`;
      if (!stdout && !stderr) result = "Code executed successfully (no output)";

      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Python execution failed:\n\`\`\`\n${errorMessage}\`\`\`` }],
        isError: true,
      };
    }
  }
);

// Tool: Create a data visualization
const createVisualizationTool = tool(
  "visualize_data",
  `Create a data visualization using Python matplotlib/seaborn.

Generates a chart and saves it to a file.

Examples:
- Line chart: {type: "line", data: {"x": [1,2,3], "y": [4,5,6]}, title: "My Chart"}
- Bar chart: {type: "bar", data: {"labels": ["A","B","C"], "values": [10,20,15]}}`,
  {
    type: z.enum(["line", "bar", "scatter", "histogram", "pie", "heatmap"]).describe("Chart type"),
    data: z.record(z.string(), z.unknown()).describe("Data for the chart (varies by type)"),
    title: z.string().optional().describe("Chart title"),
    xlabel: z.string().optional().describe("X-axis label"),
    ylabel: z.string().optional().describe("Y-axis label"),
    outputPath: z.string().optional().describe("Output file path (default: chart_<timestamp>.png)"),
  },
  async (args, extra) => {
    const { type, data, title, xlabel, ylabel, outputPath } = args;
    const context = extra as { cwd?: string };
    const cwd = context?.cwd || process.cwd();
    const outPath = outputPath || `chart_${Date.now()}.png`;
    const fullPath = path.isAbsolute(outPath) ? outPath : path.join(cwd, outPath);

    const dataJson = JSON.stringify(data);

    const pythonCode = `
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import json

data = json.loads('${dataJson.replace(/'/g, "\\'")}')
plt.figure(figsize=(10, 6))

chart_type = "${type}"
if chart_type == "line":
    plt.plot(data.get("x", range(len(data.get("y", [])))), data.get("y", []))
elif chart_type == "bar":
    plt.bar(data.get("labels", data.get("x", [])), data.get("values", data.get("y", [])))
elif chart_type == "scatter":
    plt.scatter(data.get("x", []), data.get("y", []))
elif chart_type == "histogram":
    plt.hist(data.get("values", data.get("x", [])), bins=data.get("bins", 10))
elif chart_type == "pie":
    plt.pie(data.get("values", []), labels=data.get("labels", None), autopct='%1.1f%%')
elif chart_type == "heatmap":
    sns.heatmap(data.get("values", []), annot=True)

${title ? `plt.title("${title}")` : ""}
${xlabel ? `plt.xlabel("${xlabel}")` : ""}
${ylabel ? `plt.ylabel("${ylabel}")` : ""}
plt.tight_layout()
plt.savefig("${fullPath}", dpi=150)
print("Chart saved successfully")
`;

    try {
      const { stdout, stderr } = await execAsync(`python3 -c ${JSON.stringify(pythonCode)}`, {
        cwd,
        timeout: 30000,
      });

      if (stderr && !stdout.includes("Chart saved")) {
        return {
          content: [{ type: "text", text: `Warning: ${stderr}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: "text",
          text: `📊 Created ${type} chart: ${outPath}\n\nTitle: ${title || "(none)"}`
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to create visualization: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Tool: Download arXiv paper PDF
const downloadArxivPaperTool = tool(
  "research_arxiv_download",
  `Download an arXiv paper PDF.

Examples:
- Download by ID: {arxivId: "2301.07041"}
- Download with custom name: {arxivId: "2301.07041", outputPath: "transformer_paper.pdf"}`,
  {
    arxivId: z.string().describe("arXiv paper ID (e.g., '2301.07041' or full URL)"),
    outputPath: z.string().optional().describe("Output file path (default: <arxivId>.pdf)"),
  },
  async (args, extra) => {
    const { arxivId: rawId, outputPath } = args;
    const context = extra as { cwd?: string };
    const cwd = context?.cwd || process.cwd();

    // Extract ID from URL if needed
    const arxivId = rawId.replace(/^https?:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");
    const outPath = outputPath || `${arxivId.replace("/", "_")}.pdf`;
    const fullPath = path.isAbsolute(outPath) ? outPath : path.join(cwd, outPath);

    try {
      // Get paper metadata first
      const metaUrl = `http://export.arxiv.org/api/query?id_list=${arxivId}`;
      const metaResponse = await fetch(metaUrl);
      const metaXml = await metaResponse.text();

      const title = metaXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\n/g, " ").trim();
      if (!title || title === "Error") {
        return {
          content: [{ type: "text", text: `Paper not found: ${arxivId}` }],
          isError: true,
        };
      }

      // Download PDF
      const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
      const pdfResponse = await fetch(pdfUrl);

      if (!pdfResponse.ok) {
        return {
          content: [{ type: "text", text: `Failed to download PDF: ${pdfResponse.statusText}` }],
          isError: true,
        };
      }

      const pdfBuffer = await pdfResponse.arrayBuffer();
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, Buffer.from(pdfBuffer));

      const sizeKb = Math.round(pdfBuffer.byteLength / 1024);

      return {
        content: [{
          type: "text",
          text: `✅ Downloaded paper: ${title}\n\n📄 Saved to: ${outPath}\n📦 Size: ${sizeKb} KB\n🔗 arXiv: https://arxiv.org/abs/${arxivId}`
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Download failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get paper details from arXiv
const getArxivPaperTool = tool(
  "research_arxiv_paper",
  `Get detailed information about a specific arXiv paper.

Examples:
- Get paper: {arxivId: "2301.07041"}`,
  {
    arxivId: z.string().describe("arXiv paper ID (e.g., '2301.07041')"),
  },
  async (args) => {
    const { arxivId: rawId } = args;
    const arxivId = rawId.replace(/^https?:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");

    try {
      const url = `http://export.arxiv.org/api/query?id_list=${arxivId}`;
      const response = await fetch(url);
      const xml = await response.text();

      const title = xml.match(/<title>([\s\S]*?)<\/title>/g)?.[1]?.replace(/<\/?title>/g, "").replace(/\n/g, " ").trim();
      const summary = xml.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\n/g, " ").trim();
      const published = xml.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim();
      const updated = xml.match(/<updated>([\s\S]*?)<\/updated>/)?.[1]?.trim();
      const category = xml.match(/<arxiv:primary_category[^>]*term="([^"]+)"/)?.[1];
      const doi = xml.match(/<arxiv:doi>([\s\S]*?)<\/arxiv:doi>/)?.[1];
      const journalRef = xml.match(/<arxiv:journal_ref>([\s\S]*?)<\/arxiv:journal_ref>/)?.[1];
      const comment = xml.match(/<arxiv:comment>([\s\S]*?)<\/arxiv:comment>/)?.[1];

      const authorMatches = xml.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g);
      const authors = [...authorMatches].map(m => m[1].trim());

      const allCategories = [...xml.matchAll(/<category[^>]*term="([^"]+)"/g)].map(m => m[1]);

      if (!title) {
        return {
          content: [{ type: "text", text: `Paper not found: ${arxivId}` }],
          isError: true,
        };
      }

      let result = `# ${title}\n\n`;
      result += `**arXiv ID:** ${arxivId}\n`;
      result += `**Authors:** ${authors.join(", ")}\n`;
      result += `**Primary Category:** ${category}\n`;
      if (allCategories.length > 1) {
        result += `**All Categories:** ${allCategories.join(", ")}\n`;
      }
      result += `**Published:** ${published?.split("T")[0]}\n`;
      if (updated !== published) {
        result += `**Last Updated:** ${updated?.split("T")[0]}\n`;
      }
      if (doi) result += `**DOI:** ${doi}\n`;
      if (journalRef) result += `**Journal:** ${journalRef}\n`;
      if (comment) result += `**Comment:** ${comment}\n`;
      result += "\n## Abstract\n\n";
      result += summary + "\n\n";
      result += `## Links\n\n`;
      result += `- [Abstract](https://arxiv.org/abs/${arxivId})\n`;
      result += `- [PDF](https://arxiv.org/pdf/${arxivId}.pdf)\n`;
      result += `- [HTML (ar5iv)](https://ar5iv.labs.arxiv.org/html/${arxivId})\n`;

      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to get paper: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Tool: Summarize notebook
const summarizeNotebookTool = tool(
  "notebook_summarize",
  `Summarize the contents and outputs of a Jupyter notebook.

Provides a high-level overview without showing all code.

Examples:
- Summarize: {path: "analysis.ipynb"}`,
  {
    path: z.string().describe("Path to the notebook"),
  },
  async (args, extra) => {
    const { path: notebookPath } = args;
    const context = extra as { cwd?: string };
    const cwd = context?.cwd || process.cwd();
    const fullPath = path.isAbsolute(notebookPath) ? notebookPath : path.join(cwd, notebookPath);

    try {
      const content = await fs.readFile(fullPath, "utf-8");
      const notebook = JSON.parse(content);

      let result = `# Notebook Summary: ${notebookPath}\n\n`;
      result += `**Kernel:** ${notebook.metadata?.kernelspec?.display_name || "Unknown"}\n`;
      result += `**Cells:** ${notebook.cells.length}\n\n`;

      // Stats
      const codeCells = notebook.cells.filter((c: { cell_type: string }) => c.cell_type === "code");
      const markdownCells = notebook.cells.filter((c: { cell_type: string }) => c.cell_type === "markdown");
      const executedCells = codeCells.filter((c: { execution_count: number | null }) => c.execution_count !== null);
      const cellsWithOutput = codeCells.filter((c: { outputs?: unknown[] }) => c.outputs && c.outputs.length > 0);
      const cellsWithError = codeCells.filter((c: { outputs?: Array<{ output_type: string }> }) =>
        c.outputs?.some((o: { output_type: string }) => o.output_type === "error")
      );
      const cellsWithImages = codeCells.filter((c: { outputs?: Array<{ data?: Record<string, unknown> }> }) =>
        c.outputs?.some((o: { data?: Record<string, unknown> }) => o.data && ("image/png" in o.data || "image/jpeg" in o.data || "image/svg+xml" in o.data))
      );

      result += `## Statistics\n\n`;
      result += `- **Code cells:** ${codeCells.length} (${executedCells.length} executed)\n`;
      result += `- **Markdown cells:** ${markdownCells.length}\n`;
      result += `- **Cells with output:** ${cellsWithOutput.length}\n`;
      result += `- **Cells with errors:** ${cellsWithError.length}\n`;
      result += `- **Cells with visualizations:** ${cellsWithImages.length}\n\n`;

      // Get markdown headings for TOC
      const headings: string[] = [];
      for (const cell of markdownCells) {
        const source = Array.isArray(cell.source) ? cell.source.join("") : cell.source;
        const headerMatches = source.matchAll(/^(#{1,3})\s+(.+)$/gm);
        for (const match of headerMatches) {
          const level = match[1].length;
          const text = match[2].trim();
          headings.push("  ".repeat(level - 1) + `- ${text}`);
        }
      }

      if (headings.length > 0) {
        result += `## Table of Contents\n\n`;
        result += headings.join("\n") + "\n\n";
      }

      // Imports used
      const imports: Set<string> = new Set();
      for (const cell of codeCells) {
        const source = Array.isArray(cell.source) ? cell.source.join("") : cell.source;
        const importMatches = source.matchAll(/^(?:import|from)\s+(\w+)/gm);
        for (const match of importMatches) {
          imports.add(match[1]);
        }
      }

      if (imports.size > 0) {
        result += `## Libraries Used\n\n`;
        result += [...imports].sort().map(i => `- ${i}`).join("\n") + "\n\n";
      }

      // Errors if any
      if (cellsWithError.length > 0) {
        result += `## Errors\n\n`;
        for (let i = 0; i < cellsWithError.length; i++) {
          const cell = cellsWithError[i];
          const error = cell.outputs?.find((o: { output_type: string }) => o.output_type === "error") as { ename?: string; evalue?: string } | undefined;
          if (error) {
            result += `- Cell ${notebook.cells.indexOf(cell) + 1}: ${error.ename}: ${error.evalue}\n`;
          }
        }
        result += "\n";
      }

      return { content: [{ type: "text", text: result }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to summarize notebook: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

/**
 * Create the Research MCP server with all tools
 */
export function createResearchMcpServer(cwd?: string) {
  const toolContext = { cwd };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapTool = (toolDef: any) => ({
    ...toolDef,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: any) => toolDef.handler(args, toolContext),
  });

  return createSdkMcpServer({
    name: "research",
    version: "1.0.0",
    tools: [
      // Notebook tools
      wrapTool(createNotebookTool),
      wrapTool(addCellsTool),
      wrapTool(executeNotebookTool),
      wrapTool(readNotebookTool),
      wrapTool(summarizeNotebookTool),
      // Research tools
      wrapTool(searchArxivTool),
      wrapTool(getArxivPaperTool),
      wrapTool(downloadArxivPaperTool),
      wrapTool(searchSemanticScholarTool),
      // Analysis tools
      wrapTool(runPythonTool),
      wrapTool(createVisualizationTool),
    ],
  });
}
