/**
 * Research MCP Server - Consolidated tools for research tasks
 *
 * IMPORTANT: Tools are consolidated to reduce context window usage.
 * Each tool handles multiple actions via an 'action' parameter.
 *
 * Features:
 * - Consolidated tools (11 → 3) to reduce token overhead
 * - Orchestrated workflows (literature_review) for programmatic tool calling
 * - Python library generation for true programmatic tool calling
 *
 * Tools:
 * - notebook: Create, read, execute, add cells, summarize notebooks
 * - research: Search arXiv, Semantic Scholar, get paper details, download PDFs, literature review
 * - python: Run Python code and create visualizations
 */

import { z } from "zod";
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-code";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import {
  generatePythonLibrary,
  RESEARCH_PYTHON_TOOLS,
  GITHUB_PYTHON_TOOLS,
  WEB_PYTHON_TOOLS,
} from "./mcp-utils";

const execAsync = promisify(exec);

// ============================================================================
// CONSOLIDATED NOTEBOOK TOOL
// ============================================================================

const notebookTool = tool(
  "notebook",
  `Manage Jupyter notebooks - create, read, execute, add cells, or summarize.

Actions:
- create: Create a new notebook with optional cells
- read: Read notebook contents and outputs
- execute: Execute notebook cells
- add_cells: Add cells to an existing notebook
- summarize: Get a high-level overview of a notebook

Examples:
- Create: {action: "create", path: "analysis.ipynb", cells: [{type: "code", source: "import pandas"}]}
- Read: {action: "read", path: "analysis.ipynb"}
- Execute: {action: "execute", path: "analysis.ipynb"}
- Add cells: {action: "add_cells", path: "analysis.ipynb", cells: [{type: "code", source: "df.head()"}]}
- Summarize: {action: "summarize", path: "analysis.ipynb"}`,
  {
    action: z
      .enum(["create", "read", "execute", "add_cells", "summarize"])
      .describe("Action to perform"),
    path: z.string().describe("Path to the notebook file"),
    cells: z
      .array(
        z.object({
          type: z.enum(["code", "markdown"]),
          source: z.string(),
        })
      )
      .optional()
      .describe("Cells to add (for create/add_cells)"),
    kernel: z.string().default("python3").optional().describe("Kernel name (for create)"),
    timeout: z
      .number()
      .default(60)
      .optional()
      .describe("Execution timeout in seconds (for execute)"),
    cellIndices: z
      .array(z.number())
      .optional()
      .describe("Specific cell indices (for read/execute)"),
    includeOutputs: z.boolean().default(true).optional().describe("Include outputs (for read)"),
    position: z
      .enum(["start", "end"])
      .default("end")
      .optional()
      .describe("Where to add cells (for add_cells)"),
  },
  async (args, extra) => {
    const context = extra as { cwd?: string };
    const cwd = context?.cwd || process.cwd();
    const fullPath = path.isAbsolute(args.path) ? args.path : path.join(cwd, args.path);

    try {
      switch (args.action) {
        case "create": {
          const { cells = [], kernel = "python3" } = args;
          const notebook = {
            nbformat: 4,
            nbformat_minor: 5,
            metadata: {
              kernelspec: {
                display_name: kernel === "python3" ? "Python 3" : kernel,
                language: kernel === "python3" ? "python" : kernel,
                name: kernel,
              },
              language_info: { name: kernel === "python3" ? "python" : kernel },
            },
            cells: cells.map((cell, i) => ({
              cell_type: cell.type,
              source: cell.source.split("\n"),
              metadata: {},
              ...(cell.type === "code"
                ? { execution_count: null, outputs: [], id: `cell-${i}` }
                : { id: `cell-${i}` }),
            })),
          };

          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, JSON.stringify(notebook, null, 2));

          return {
            content: [
              {
                type: "text",
                text: `✅ Created notebook: ${args.path}\n${cells.length} cells added. Kernel: ${kernel}`,
              },
            ],
          };
        }

        case "read": {
          const { cellIndices, includeOutputs = true } = args;
          const content = await fs.readFile(fullPath, "utf-8");
          const notebook = JSON.parse(content);

          let result = `# Notebook: ${args.path}\nKernel: ${notebook.metadata?.kernelspec?.display_name || "Unknown"}\nCells: ${notebook.cells.length}\n\n`;

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
                  const text = Array.isArray(output.text) ? output.text.join("") : output.text;
                  result += "```\n" + text + "```\n";
                } else if (output.output_type === "error") {
                  result += `❌ ${output.ename}: ${output.evalue}\n`;
                } else if (output.data?.["text/plain"]) {
                  const text = Array.isArray(output.data["text/plain"])
                    ? output.data["text/plain"].join("")
                    : output.data["text/plain"];
                  result += "```\n" + text + "```\n";
                } else if (output.data?.["image/png"]) {
                  result += "📊 [Image output]\n";
                }
              }
            }
            result += "\n";
          }

          return { content: [{ type: "text", text: result }] };
        }

        case "execute": {
          const { timeout = 60 } = args;

          try {
            await execAsync("jupyter --version");
          } catch {
            return {
              content: [
                { type: "text", text: "Jupyter not installed. Run: pip install jupyter nbconvert" },
              ],
              isError: true,
            };
          }

          const cmd = `jupyter nbconvert --to notebook --execute --ExecutePreprocessor.timeout=${timeout} --output "${path.basename(fullPath)}" "${fullPath}"`;
          const { stderr } = await execAsync(cmd, { cwd: path.dirname(fullPath) });

          const executedContent = await fs.readFile(fullPath, "utf-8");
          const notebook = JSON.parse(executedContent);

          const outputSummary = notebook.cells
            .filter((cell: { cell_type: string }) => cell.cell_type === "code")
            .map(
              (
                cell: {
                  execution_count: number | null;
                  outputs: Array<{ output_type: string; data?: Record<string, unknown> }>;
                },
                i: number
              ) => {
                const outputs = cell.outputs || [];
                const hasError = outputs.some((o) => o.output_type === "error");
                const hasImage = outputs.some(
                  (o) => o.data && ("image/png" in o.data || "image/jpeg" in o.data)
                );
                let summary = `Cell ${i + 1} [${cell.execution_count || "?"}]: `;
                if (hasError) summary += "❌ Error";
                else if (hasImage) summary += "📊 Visualization";
                else if (outputs.length > 0) summary += "✅ Output";
                else summary += "⚪ No output";
                return summary;
              }
            )
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `✅ Executed: ${args.path}\n\n${outputSummary}${stderr ? `\n\nWarnings: ${stderr}` : ""}`,
              },
            ],
          };
        }

        case "add_cells": {
          const { cells = [], position = "end" } = args;
          const content = await fs.readFile(fullPath, "utf-8");
          const notebook = JSON.parse(content);

          const newCells = cells.map((cell, i) => ({
            cell_type: cell.type,
            source: cell.source.split("\n"),
            metadata: {},
            ...(cell.type === "code"
              ? { execution_count: null, outputs: [], id: `cell-new-${Date.now()}-${i}` }
              : { id: `cell-new-${Date.now()}-${i}` }),
          }));

          if (position === "start") {
            notebook.cells = [...newCells, ...notebook.cells];
          } else {
            notebook.cells = [...notebook.cells, ...newCells];
          }

          await fs.writeFile(fullPath, JSON.stringify(notebook, null, 2));

          return {
            content: [
              {
                type: "text",
                text: `✅ Added ${cells.length} cells to ${args.path} (${position})\nTotal cells: ${notebook.cells.length}`,
              },
            ],
          };
        }

        case "summarize": {
          const content = await fs.readFile(fullPath, "utf-8");
          const notebook = JSON.parse(content);

          const codeCells = notebook.cells.filter(
            (c: { cell_type: string }) => c.cell_type === "code"
          );
          const markdownCells = notebook.cells.filter(
            (c: { cell_type: string }) => c.cell_type === "markdown"
          );
          const executedCells = codeCells.filter(
            (c: { execution_count: number | null }) => c.execution_count !== null
          );
          const cellsWithError = codeCells.filter(
            (c: { outputs?: Array<{ output_type: string }> }) =>
              c.outputs?.some((o) => o.output_type === "error")
          );
          const cellsWithImages = codeCells.filter(
            (c: { outputs?: Array<{ data?: Record<string, unknown> }> }) =>
              c.outputs?.some((o) => o.data && ("image/png" in o.data || "image/jpeg" in o.data))
          );

          // Extract imports
          const imports: Set<string> = new Set();
          for (const cell of codeCells) {
            const source = Array.isArray(cell.source) ? cell.source.join("") : cell.source;
            const importMatches = source.matchAll(/^(?:import|from)\s+(\w+)/gm);
            for (const match of importMatches) imports.add(match[1]);
          }

          // Extract headings
          const headings: string[] = [];
          for (const cell of markdownCells) {
            const source = Array.isArray(cell.source) ? cell.source.join("") : cell.source;
            const headerMatches = source.matchAll(/^(#{1,3})\s+(.+)$/gm);
            for (const match of headerMatches) {
              headings.push("  ".repeat(match[1].length - 1) + `- ${match[2].trim()}`);
            }
          }

          let result = `# Summary: ${args.path}\n\n`;
          result += `**Kernel:** ${notebook.metadata?.kernelspec?.display_name || "Unknown"}\n\n`;
          result += `## Stats\n`;
          result += `- Code cells: ${codeCells.length} (${executedCells.length} executed)\n`;
          result += `- Markdown cells: ${markdownCells.length}\n`;
          result += `- Errors: ${cellsWithError.length}\n`;
          result += `- Visualizations: ${cellsWithImages.length}\n\n`;

          if (headings.length > 0) {
            result += `## Contents\n${headings.join("\n")}\n\n`;
          }
          if (imports.size > 0) {
            result += `## Libraries\n${[...imports]
              .sort()
              .map((i) => `- ${i}`)
              .join("\n")}\n`;
          }

          return { content: [{ type: "text", text: result }] };
        }

        default:
          return {
            content: [{ type: "text", text: `Unknown action: ${args.action}` }],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Notebook ${args.action} failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================================
// CONSOLIDATED RESEARCH TOOL
// ============================================================================

const researchTool = tool(
  "research",
  `Search academic papers and get paper details.

Actions:
- arxiv_search: Search arXiv for papers
- arxiv_paper: Get detailed info about a specific arXiv paper
- arxiv_download: Download an arXiv paper PDF
- semantic_scholar: Search Semantic Scholar
- literature_review: **Orchestrated workflow** - searches both sources, compiles top papers, creates notebook (reduces context by returning only summary)

Examples:
- Search arXiv: {action: "arxiv_search", query: "transformer attention", maxResults: 10}
- Paper details: {action: "arxiv_paper", arxivId: "2301.07041"}
- Download PDF: {action: "arxiv_download", arxivId: "2301.07041", outputPath: "paper.pdf"}
- Semantic Scholar: {action: "semantic_scholar", query: "large language models", year: "2024"}
- Literature review: {action: "literature_review", query: "vision transformers", notebookPath: "lit_review.ipynb"}`,
  {
    action: z
      .enum([
        "arxiv_search",
        "arxiv_paper",
        "arxiv_download",
        "semantic_scholar",
        "literature_review",
      ])
      .describe("Action to perform"),
    query: z.string().optional().describe("Search query"),
    arxivId: z.string().optional().describe("arXiv paper ID (for paper/download)"),
    maxResults: z.number().min(1).max(50).default(10).optional().describe("Max results"),
    category: z.string().optional().describe("arXiv category filter (cs.LG, cs.AI, etc.)"),
    year: z.string().optional().describe("Year filter for Semantic Scholar"),
    outputPath: z.string().optional().describe("Output path for PDF download"),
    notebookPath: z.string().optional().describe("Notebook path (for literature_review)"),
    downloadPdfs: z.boolean().optional().describe("Download PDFs (for literature_review)"),
  },
  async (args, extra) => {
    const context = extra as { cwd?: string };
    const cwd = context?.cwd || process.cwd();

    try {
      switch (args.action) {
        case "arxiv_search": {
          const { query, maxResults = 10, category } = args;
          if (!query)
            return {
              content: [{ type: "text", text: "Query required for arxiv_search" }],
              isError: true,
            };

          let searchQuery = query;
          if (category) searchQuery = `cat:${category} AND ${query}`;

          const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(searchQuery)}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;
          const response = await fetch(url);
          const xml = await response.text();

          const entries: Array<{
            title: string;
            authors: string;
            summary: string;
            link: string;
            published: string;
            category: string;
          }> = [];
          const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);

          for (const match of entryMatches) {
            const entry = match[1];
            const title =
              entry
                .match(/<title>([\s\S]*?)<\/title>/)?.[1]
                ?.replace(/\n/g, " ")
                .trim() || "";
            const summary =
              entry
                .match(/<summary>([\s\S]*?)<\/summary>/)?.[1]
                ?.replace(/\n/g, " ")
                .trim() || "";
            const link = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || "";
            const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() || "";
            const cat = entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"/)?.[1] || "";
            const authorMatches = entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g);
            const authors = [...authorMatches].map((m) => m[1].trim()).join(", ");
            entries.push({ title, authors, summary, link, published, category: cat });
          }

          if (entries.length === 0) {
            return { content: [{ type: "text", text: `No papers found for: "${query}"` }] };
          }

          let result = `# arXiv: "${query}"\nFound ${entries.length} papers\n\n`;
          for (const e of entries) {
            result += `## ${e.title}\n**Authors:** ${e.authors}\n**${e.category}** | ${e.published.split("T")[0]}\n${e.link}\n\n${e.summary.substring(0, 250)}...\n\n---\n\n`;
          }

          return { content: [{ type: "text", text: result }] };
        }

        case "arxiv_paper": {
          const { arxivId: rawId } = args;
          if (!rawId)
            return { content: [{ type: "text", text: "arxivId required" }], isError: true };

          const arxivId = rawId.replace(/^https?:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");
          const url = `http://export.arxiv.org/api/query?id_list=${arxivId}`;
          const response = await fetch(url);
          const xml = await response.text();

          const title = xml
            .match(/<title>([\s\S]*?)<\/title>/g)?.[1]
            ?.replace(/<\/?title>/g, "")
            .replace(/\n/g, " ")
            .trim();
          const summary = xml
            .match(/<summary>([\s\S]*?)<\/summary>/)?.[1]
            ?.replace(/\n/g, " ")
            .trim();
          const published = xml.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim();
          const category = xml.match(/<arxiv:primary_category[^>]*term="([^"]+)"/)?.[1];
          const authorMatches = xml.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g);
          const authors = [...authorMatches].map((m) => m[1].trim());

          if (!title)
            return {
              content: [{ type: "text", text: `Paper not found: ${arxivId}` }],
              isError: true,
            };

          let result = `# ${title}\n\n`;
          result += `**arXiv:** ${arxivId}\n**Authors:** ${authors.join(", ")}\n**Category:** ${category}\n**Published:** ${published?.split("T")[0]}\n\n`;
          result += `## Abstract\n${summary}\n\n`;
          result += `## Links\n- [Abstract](https://arxiv.org/abs/${arxivId})\n- [PDF](https://arxiv.org/pdf/${arxivId}.pdf)\n`;

          return { content: [{ type: "text", text: result }] };
        }

        case "arxiv_download": {
          const { arxivId: rawId, outputPath } = args;
          if (!rawId)
            return { content: [{ type: "text", text: "arxivId required" }], isError: true };

          const arxivId = rawId.replace(/^https?:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");
          const outPath = outputPath || `${arxivId.replace("/", "_")}.pdf`;
          const fullPath = path.isAbsolute(outPath) ? outPath : path.join(cwd, outPath);

          const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
          const pdfResponse = await fetch(pdfUrl);

          if (!pdfResponse.ok) {
            return {
              content: [{ type: "text", text: `Failed to download: ${pdfResponse.statusText}` }],
              isError: true,
            };
          }

          const pdfBuffer = await pdfResponse.arrayBuffer();
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, Buffer.from(pdfBuffer));

          return {
            content: [
              {
                type: "text",
                text: `✅ Downloaded: ${outPath}\nSize: ${Math.round(pdfBuffer.byteLength / 1024)} KB`,
              },
            ],
          };
        }

        case "semantic_scholar": {
          const { query, maxResults = 10, year } = args;
          if (!query) return { content: [{ type: "text", text: "Query required" }], isError: true };

          let url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${maxResults}&fields=title,authors,year,abstract,citationCount,url`;
          if (year) url += `&year=${year}`;

          const response = await fetch(url, { headers: { Accept: "application/json" } });
          if (!response.ok) {
            return {
              content: [{ type: "text", text: `API error: ${response.statusText}` }],
              isError: true,
            };
          }

          const data = await response.json();
          const papers = data.data || [];

          if (papers.length === 0) {
            return { content: [{ type: "text", text: `No papers found for: "${query}"` }] };
          }

          let result = `# Semantic Scholar: "${query}"\nFound ${data.total} (showing ${papers.length})\n\n`;
          for (const p of papers) {
            const authors = p.authors?.map((a: { name: string }) => a.name).join(", ") || "Unknown";
            result += `## ${p.title || "Untitled"}\n**Authors:** ${authors}\n**Year:** ${p.year || "?"} | **Citations:** ${p.citationCount || 0}\n`;
            if (p.url) result += `${p.url}\n`;
            if (p.abstract) result += `\n${p.abstract.substring(0, 200)}...\n`;
            result += "\n---\n\n";
          }

          return { content: [{ type: "text", text: result }] };
        }

        case "literature_review": {
          // ORCHESTRATED WORKFLOW: Searches multiple sources, compiles papers, creates notebook
          // Returns only a summary to minimize context usage (programmatic tool calling pattern)
          const { query, maxResults = 5, category, notebookPath, downloadPdfs = false } = args;
          if (!query) return { content: [{ type: "text", text: "Query required" }], isError: true };

          interface Paper {
            title: string;
            authors: string;
            abstract: string;
            link: string;
            source: string;
            year?: string;
            citations?: number;
            arxivId?: string;
          }
          const papers: Paper[] = [];
          const errors: string[] = [];

          // Step 1: Search arXiv
          try {
            let arxivQuery = query;
            if (category) arxivQuery = `cat:${category} AND ${query}`;
            const arxivUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(arxivQuery)}&start=0&max_results=${maxResults}&sortBy=relevance`;
            const arxivResponse = await fetch(arxivUrl);
            const arxivXml = await arxivResponse.text();
            const entryMatches = arxivXml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);

            for (const match of entryMatches) {
              const entry = match[1];
              const title =
                entry
                  .match(/<title>([\s\S]*?)<\/title>/)?.[1]
                  ?.replace(/\n/g, " ")
                  .trim() || "";
              const abstract =
                entry
                  .match(/<summary>([\s\S]*?)<\/summary>/)?.[1]
                  ?.replace(/\n/g, " ")
                  .trim() || "";
              const link = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || "";
              const published =
                entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() || "";
              const authorMatches = entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g);
              const authors = [...authorMatches].map((m) => m[1].trim()).join(", ");
              const arxivId = link.match(/abs\/(\d+\.\d+)/)?.[1];
              papers.push({
                title,
                authors,
                abstract,
                link,
                source: "arXiv",
                year: published.split("-")[0],
                arxivId,
              });
            }
          } catch (e) {
            errors.push(`arXiv: ${e instanceof Error ? e.message : String(e)}`);
          }

          // Step 2: Search Semantic Scholar
          try {
            const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${maxResults}&fields=title,authors,year,abstract,citationCount,url`;
            const ssResponse = await fetch(ssUrl, { headers: { Accept: "application/json" } });
            if (ssResponse.ok) {
              const ssData = await ssResponse.json();
              for (const p of ssData.data || []) {
                papers.push({
                  title: p.title || "Untitled",
                  authors: p.authors?.map((a: { name: string }) => a.name).join(", ") || "Unknown",
                  abstract: p.abstract || "",
                  link: p.url || "",
                  source: "Semantic Scholar",
                  year: p.year?.toString(),
                  citations: p.citationCount,
                });
              }
            }
          } catch (e) {
            errors.push(`Semantic Scholar: ${e instanceof Error ? e.message : String(e)}`);
          }

          if (papers.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No papers found for: "${query}"${errors.length ? `\nErrors: ${errors.join("; ")}` : ""}`,
                },
              ],
            };
          }

          // Step 3: Deduplicate by title similarity
          const seen = new Set<string>();
          const uniquePapers = papers.filter((p) => {
            const key = p.title
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")
              .substring(0, 50);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          // Step 4: Download PDFs if requested
          const downloadedPdfs: string[] = [];
          if (downloadPdfs) {
            for (const p of uniquePapers.slice(0, 3)) {
              if (p.arxivId) {
                try {
                  const pdfUrl = `https://arxiv.org/pdf/${p.arxivId}.pdf`;
                  const pdfResponse = await fetch(pdfUrl);
                  if (pdfResponse.ok) {
                    const pdfBuffer = await pdfResponse.arrayBuffer();
                    const pdfPath = path.join(cwd, `${p.arxivId.replace(/[/.]/g, "_")}.pdf`);
                    await fs.writeFile(pdfPath, Buffer.from(pdfBuffer));
                    downloadedPdfs.push(pdfPath);
                  }
                } catch {
                  /* skip failed downloads */
                }
              }
            }
          }

          // Step 5: Create notebook if path provided
          if (notebookPath) {
            const fullPath = path.isAbsolute(notebookPath)
              ? notebookPath
              : path.join(cwd, notebookPath);
            const cells = [
              {
                cell_type: "markdown",
                source: [`# Literature Review: ${query}\n\n*Generated automatically*`],
                metadata: {},
                id: "intro",
              },
              {
                cell_type: "markdown",
                source: [
                  `## Papers Found (${uniquePapers.length})\n\n${uniquePapers.map((p, i) => `${i + 1}. **${p.title}** (${p.source}, ${p.year || "?"})`).join("\n")}`,
                ],
                metadata: {},
                id: "toc",
              },
            ];

            for (const [i, p] of uniquePapers.slice(0, 10).entries()) {
              cells.push({
                cell_type: "markdown",
                source: [
                  `## ${i + 1}. ${p.title}`,
                  ``,
                  `**Authors:** ${p.authors}`,
                  ``,
                  `**Source:** ${p.source} | **Year:** ${p.year || "?"} | ${p.citations !== undefined ? `**Citations:** ${p.citations}` : ""}`,
                  ``,
                  `**Link:** ${p.link}`,
                  ``,
                  `### Abstract`,
                  ``,
                  p.abstract,
                ],
                metadata: {},
                id: `paper-${i}`,
              });
            }

            const notebook = {
              nbformat: 4,
              nbformat_minor: 5,
              metadata: {
                kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
              },
              cells,
            };

            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, JSON.stringify(notebook, null, 2));
          }

          // Step 6: Return ONLY summary (not full paper details) to minimize context
          const summary = [
            `# Literature Review: "${query}"`,
            ``,
            `**Found:** ${uniquePapers.length} unique papers from ${papers.length} total results`,
            `**Sources:** arXiv (${papers.filter((p) => p.source === "arXiv").length}), Semantic Scholar (${papers.filter((p) => p.source === "Semantic Scholar").length})`,
            notebookPath ? `**Notebook:** ${notebookPath}` : "",
            downloadedPdfs.length ? `**Downloaded:** ${downloadedPdfs.length} PDFs` : "",
            errors.length ? `**Warnings:** ${errors.join("; ")}` : "",
            ``,
            `## Top Papers`,
            ...uniquePapers
              .slice(0, 5)
              .map(
                (p, i) =>
                  `${i + 1}. **${p.title}** (${p.year || "?"}) - ${p.authors.split(",")[0]}${p.authors.includes(",") ? " et al." : ""}`
              ),
          ]
            .filter(Boolean)
            .join("\n");

          return { content: [{ type: "text", text: summary }] };
        }

        default:
          return {
            content: [{ type: "text", text: `Unknown action: ${args.action}` }],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Research ${args.action} failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================================
// CONSOLIDATED PYTHON TOOL
// ============================================================================

const pythonTool = tool(
  "python",
  `Run Python code or create visualizations.

Actions:
- run: Execute Python code
- visualize: Create a chart/plot

PROGRAMMATIC TOOL CALLING: A research_tools library is available at .max/research_tools.py
Import it to call research functions directly and process results before returning:

  import sys; sys.path.insert(0, '.max')
  from research_tools import arxiv_search, semantic_scholar_search, summarize_papers

  papers = arxiv_search("transformers", max_results=20)
  recent = [p for p in papers if int(p.get("year", 0)) >= 2023]
  print(summarize_papers(recent))  # Only summary goes to context

Examples:
- Run code: {action: "run", code: "import pandas as pd; print(pd.__version__)"}
- Create chart: {action: "visualize", chartType: "line", data: {"x": [1,2,3], "y": [4,5,6]}, title: "My Chart"}
- Programmatic search: {action: "run", code: "import sys; sys.path.insert(0, '.max'); from research_tools import arxiv_search; print(arxiv_search('attention'))"}`,
  {
    action: z.enum(["run", "visualize"]).describe("Action to perform"),
    code: z.string().optional().describe("Python code to execute (for run)"),
    chartType: z
      .enum(["line", "bar", "scatter", "histogram", "pie", "heatmap"])
      .optional()
      .describe("Chart type (for visualize)"),
    data: z.record(z.string(), z.unknown()).optional().describe("Chart data (for visualize)"),
    title: z.string().optional().describe("Chart title"),
    xlabel: z.string().optional().describe("X-axis label"),
    ylabel: z.string().optional().describe("Y-axis label"),
    outputPath: z.string().optional().describe("Output file path"),
    timeout: z.number().default(30).optional().describe("Timeout in seconds"),
  },
  async (args, extra) => {
    const context = extra as { cwd?: string };
    const cwd = context?.cwd || process.cwd();

    try {
      switch (args.action) {
        case "run": {
          const { code, timeout = 30 } = args;
          if (!code) return { content: [{ type: "text", text: "Code required" }], isError: true };

          // Handle matplotlib plots
          let wrappedCode = code;
          if (code.includes("plt.")) {
            const plotPath = path.join(cwd, `plot_${Date.now()}.png`);
            wrappedCode = `
import matplotlib
matplotlib.use('Agg')
${code}
import matplotlib.pyplot as plt
if plt.get_fignums():
    plt.savefig('${plotPath}')
    print(f"\\n📊 Plot saved: ${plotPath}")
`;
          }

          const { stdout, stderr } = await execAsync(`python3 -c ${JSON.stringify(wrappedCode)}`, {
            cwd,
            timeout: timeout * 1000,
          });

          let result = "";
          if (stdout) result += `**Output:**\n\`\`\`\n${stdout}\`\`\`\n`;
          if (stderr) result += `**Stderr:**\n\`\`\`\n${stderr}\`\`\`\n`;
          if (!stdout && !stderr) result = "✅ Executed (no output)";

          return { content: [{ type: "text", text: result }] };
        }

        case "visualize": {
          const { chartType, data, title, xlabel, ylabel, outputPath } = args;
          if (!chartType || !data) {
            return {
              content: [{ type: "text", text: "chartType and data required" }],
              isError: true,
            };
          }

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

chart_type = "${chartType}"
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
print("done")
`;

          await execAsync(`python3 -c ${JSON.stringify(pythonCode)}`, { cwd, timeout: 30000 });

          return {
            content: [
              {
                type: "text",
                text: `📊 Created ${chartType} chart: ${outPath}${title ? `\nTitle: ${title}` : ""}`,
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
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Python ${args.action} failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================================
// CREATE SERVER
// ============================================================================

/**
 * Create the Research MCP server with consolidated tools
 *
 * OPTIMIZATION: Reduced from 11 tools to 3 tools to minimize context usage.
 * Each tool uses an 'action' parameter to handle multiple operations.
 *
 * PROGRAMMATIC TOOL CALLING: Generates a Python library that can be imported
 * by the python tool. This allows Claude to write Python code that calls
 * research functions directly, processing results before returning to context.
 */
export async function createResearchMcpServer(cwd?: string) {
  const toolContext = { cwd };
  const workingDir = cwd || process.cwd();

  // Generate Python library for programmatic tool calling
  try {
    const libPath = path.join(workingDir, ".max", "research_tools.py");
    await generatePythonLibrary(
      [...RESEARCH_PYTHON_TOOLS, ...WEB_PYTHON_TOOLS, ...GITHUB_PYTHON_TOOLS],
      libPath
    );
    console.log(`[Research MCP] Generated Python library: ${libPath}`);
  } catch (error) {
    console.error("[Research MCP] Failed to generate Python library:", error);
    // Continue without the library - it's optional
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapTool = (toolDef: any) => ({
    ...toolDef,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (args: any) => toolDef.handler(args, toolContext),
  });

  return createSdkMcpServer({
    name: "research",
    version: "2.1.0",
    tools: [wrapTool(notebookTool), wrapTool(researchTool), wrapTool(pythonTool)],
  });
}
