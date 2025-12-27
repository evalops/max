/**
 * MCP Utilities - Enhanced tool creation with future-proofing for advanced features
 *
 * Provides:
 * - toolWithExamples: Wrapper that stores input_examples for when SDK supports them
 * - generatePythonLibrary: Creates importable Python module from tool definitions
 */

import type { z, ZodRawShape, ZodObject } from "zod";
import { tool } from "@anthropic-ai/claude-code";
import fs from "fs/promises";
import path from "path";

// ============================================================================
// TOOL WITH EXAMPLES WRAPPER
// ============================================================================

/** Tool result type matching MCP SDK CallToolResult */
interface ToolResult {
  content: Array<
    { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
  >;
  isError?: boolean;
}

type ToolHandler<T extends ZodRawShape> = (
  args: z.infer<ZodObject<T>>,
  extra: unknown
) => Promise<ToolResult>;

interface ToolWithExamplesDefinition<T extends ZodRawShape> {
  name: string;
  description: string;
  inputSchema: T;
  handler: ToolHandler<T>;
  /** Stored examples - ready for SDK support */
  _inputExamples: Array<Partial<z.infer<ZodObject<T>>>>;
  /** Whether this tool should be deferred (for future SDK support) */
  _deferLoading?: boolean;
}

/**
 * Create a tool with input examples embedded in description.
 *
 * Examples are:
 * 1. Appended to the description (works now)
 * 2. Stored in _inputExamples (ready for SDK support)
 *
 * @example
 * const searchTool = toolWithExamples(
 *   "search",
 *   "Search for items",
 *   { query: z.string(), limit: z.number().optional() },
 *   [
 *     { query: "machine learning" },
 *     { query: "neural networks", limit: 5 }
 *   ],
 *   async (args) => { ... }
 * );
 */
export function toolWithExamples<T extends ZodRawShape>(
  name: string,
  description: string,
  inputSchema: T,
  examples: Array<Partial<z.infer<ZodObject<T>>>>,
  handler: ToolHandler<T>,
  options?: { deferLoading?: boolean }
): ToolWithExamplesDefinition<T> {
  // Format examples for description
  const examplesText = examples.map((ex) => `  ${JSON.stringify(ex)}`).join("\n");

  const descriptionWithExamples = `${description}

Examples:
${examplesText}`;

  // Create the base tool with examples in description
  const baseTool = tool(name, descriptionWithExamples, inputSchema, handler);

  return {
    ...baseTool,
    _inputExamples: examples,
    _deferLoading: options?.deferLoading,
  };
}

// ============================================================================
// PYTHON LIBRARY GENERATOR
// ============================================================================

interface PythonToolSpec {
  name: string;
  description: string;
  pythonCode: string;
  dependencies?: string[];
}

/**
 * Generate a Python library from tool specifications.
 *
 * This enables programmatic tool calling - Claude can write Python code
 * that imports and uses these functions, processing results before
 * returning to context.
 */
export async function generatePythonLibrary(
  tools: PythonToolSpec[],
  outputPath: string
): Promise<void> {
  const allDependencies = new Set<string>(["requests"]);
  tools.forEach((t) => t.dependencies?.forEach((d) => allDependencies.add(d)));

  const header = `"""
Research Tools Library - Auto-generated
=======================================

This module provides Python functions that mirror the MCP tools.
Use these for programmatic tool calling - write code that processes
results before returning to the context window.

Usage:
    from research_tools import arxiv_search, semantic_scholar_search

    # Search and filter in Python
    papers = arxiv_search("transformers", max_results=20)
    top_cited = [p for p in papers if p.get("citations", 0) > 100]

    # Only return summary (saves context tokens)
    print(f"Found {len(top_cited)} highly-cited papers")

Dependencies: ${[...allDependencies].join(", ")}
"""

import requests
import json
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
import xml.etree.ElementTree as ET

`;

  const toolCode = tools
    .map((t) => {
      return `
# =============================================================================
# ${t.name.toUpperCase()}
# =============================================================================

${t.pythonCode}
`;
    })
    .join("\n");

  const footer = `
# =============================================================================
# CACHING & RETRY UTILITIES
# =============================================================================

import hashlib
import time
from functools import wraps
from pathlib import Path
import pickle

# Simple file-based cache
_CACHE_DIR = Path(".max/cache")
_CACHE_TTL = 3600  # 1 hour default

def _get_cache_path(key: str) -> Path:
    """Get cache file path for a key."""
    hash_key = hashlib.md5(key.encode()).hexdigest()
    return _CACHE_DIR / f"{hash_key}.pkl"

def cache_result(ttl: int = _CACHE_TTL):
    """Decorator to cache function results."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            key = f"{func.__name__}:{str(args)}:{str(sorted(kwargs.items()))}"
            cache_path = _get_cache_path(key)

            # Check cache
            if cache_path.exists():
                try:
                    with open(cache_path, "rb") as f:
                        cached = pickle.load(f)
                    if time.time() - cached["time"] < ttl:
                        return cached["data"]
                except Exception:
                    pass

            # Execute function
            result = func(*args, **kwargs)

            # Save to cache
            try:
                _CACHE_DIR.mkdir(parents=True, exist_ok=True)
                with open(cache_path, "wb") as f:
                    pickle.dump({"time": time.time(), "data": result}, f)
            except Exception:
                pass

            return result
        return wrapper
    return decorator

def retry_with_backoff(max_retries: int = 3, base_delay: float = 1.0):
    """Decorator to retry failed requests with exponential backoff."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except requests.exceptions.RequestException as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)
                        time.sleep(delay)
            raise last_error
        return wrapper
    return decorator

def clear_cache():
    """Clear all cached results."""
    import shutil
    if _CACHE_DIR.exists():
        shutil.rmtree(_CACHE_DIR)
        print(f"Cache cleared: {_CACHE_DIR}")

# =============================================================================
# PAPER UTILITIES
# =============================================================================

def summarize_papers(papers: List[Dict], max_papers: int = 5) -> str:
    """Create a concise summary of papers for context efficiency."""
    if not papers:
        return "No papers found."

    summary = [f"Found {len(papers)} papers:"]
    for i, p in enumerate(papers[:max_papers]):
        authors = p.get("authors", "Unknown")
        if isinstance(authors, list):
            authors = authors[0] + " et al." if len(authors) > 1 else authors[0]
        summary.append(f"{i+1}. {p.get('title', 'Untitled')} ({p.get('year', '?')}) - {authors}")

    if len(papers) > max_papers:
        summary.append(f"... and {len(papers) - max_papers} more")

    return "\\n".join(summary)


def filter_by_year(papers: List[Dict], min_year: int) -> List[Dict]:
    """Filter papers by minimum year."""
    return [p for p in papers if int(p.get("year", 0)) >= min_year]


def filter_by_citations(papers: List[Dict], min_citations: int) -> List[Dict]:
    """Filter papers by minimum citation count."""
    return [p for p in papers if p.get("citations", 0) >= min_citations]


def deduplicate_papers(papers: List[Dict], key: str = "title") -> List[Dict]:
    """Remove duplicate papers based on a key field."""
    seen = set()
    result = []
    for p in papers:
        val = p.get(key, "").lower().strip()
        if val and val not in seen:
            seen.add(val)
            result.append(p)
    return result


def merge_sources(*paper_lists: List[Dict]) -> List[Dict]:
    """Merge papers from multiple sources, deduplicating by title."""
    all_papers = []
    for papers in paper_lists:
        all_papers.extend(papers)
    return deduplicate_papers(all_papers)


def sort_papers(papers: List[Dict], by: str = "year", descending: bool = True) -> List[Dict]:
    """Sort papers by a field (year, citations, title)."""
    def get_key(p):
        val = p.get(by, 0)
        if by == "year":
            try:
                return int(val) if val else 0
            except ValueError:
                return 0
        if by == "citations":
            return val if isinstance(val, int) else 0
        return str(val).lower()
    return sorted(papers, key=get_key, reverse=descending)


if __name__ == "__main__":
    # Test the library
    print("Testing research tools library...")
    papers = arxiv_search("attention mechanism", max_results=3)
    print(summarize_papers(papers))
`;

  const fullCode = header + toolCode + footer;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, fullCode);
}

// Pre-defined tool implementations for the research tools
export const RESEARCH_PYTHON_TOOLS: PythonToolSpec[] = [
  {
    name: "arxiv_search",
    description: "Search arXiv for academic papers",
    pythonCode: `def arxiv_search(query: str, max_results: int = 10, category: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Search arXiv for papers.

    Args:
        query: Search query
        max_results: Maximum number of results (1-50)
        category: arXiv category filter (e.g., "cs.LG", "cs.AI")

    Returns:
        List of paper dictionaries with title, authors, abstract, link, year
    """
    search_query = query
    if category:
        search_query = f"cat:{category} AND {query}"

    url = f"http://export.arxiv.org/api/query?search_query=all:{requests.utils.quote(search_query)}&start=0&max_results={max_results}&sortBy=relevance"

    response = requests.get(url, timeout=30)
    response.raise_for_status()

    papers = []
    root = ET.fromstring(response.text)
    ns = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}

    for entry in root.findall("atom:entry", ns):
        title = entry.find("atom:title", ns)
        summary = entry.find("atom:summary", ns)
        published = entry.find("atom:published", ns)
        link = entry.find("atom:id", ns)

        authors = []
        for author in entry.findall("atom:author", ns):
            name = author.find("atom:name", ns)
            if name is not None:
                authors.append(name.text.strip())

        arxiv_id = None
        if link is not None and link.text:
            import re
            match = re.search(r"abs/(\\d+\\.\\d+)", link.text)
            if match:
                arxiv_id = match.group(1)

        papers.append({
            "title": title.text.strip().replace("\\n", " ") if title is not None else "",
            "authors": authors,
            "abstract": summary.text.strip().replace("\\n", " ") if summary is not None else "",
            "link": link.text.strip() if link is not None else "",
            "year": published.text[:4] if published is not None else "",
            "arxiv_id": arxiv_id,
            "source": "arXiv"
        })

    return papers`,
  },
  {
    name: "semantic_scholar_search",
    description: "Search Semantic Scholar for academic papers",
    pythonCode: `def semantic_scholar_search(query: str, max_results: int = 10, year: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Search Semantic Scholar for papers.

    Args:
        query: Search query
        max_results: Maximum number of results (1-100)
        year: Year filter (e.g., "2024", "2020-2024")

    Returns:
        List of paper dictionaries with title, authors, abstract, citations, year
    """
    url = f"https://api.semanticscholar.org/graph/v1/paper/search"
    params = {
        "query": query,
        "limit": min(max_results, 100),
        "fields": "title,authors,year,abstract,citationCount,url"
    }
    if year:
        params["year"] = year

    response = requests.get(url, params=params, headers={"Accept": "application/json"}, timeout=30)
    response.raise_for_status()

    data = response.json()
    papers = []

    for p in data.get("data", []):
        papers.append({
            "title": p.get("title", "Untitled"),
            "authors": [a.get("name", "") for a in p.get("authors", [])],
            "abstract": p.get("abstract", ""),
            "year": str(p.get("year", "")),
            "citations": p.get("citationCount", 0),
            "link": p.get("url", ""),
            "source": "Semantic Scholar"
        })

    return papers`,
  },
  {
    name: "download_arxiv_pdf",
    description: "Download an arXiv paper PDF",
    pythonCode: `def download_arxiv_pdf(arxiv_id: str, output_path: Optional[str] = None) -> str:
    """
    Download a PDF from arXiv.

    Args:
        arxiv_id: arXiv paper ID (e.g., "2301.07041")
        output_path: Output file path (default: {arxiv_id}.pdf)

    Returns:
        Path to downloaded file
    """
    # Clean up arxiv_id
    arxiv_id = arxiv_id.replace("https://arxiv.org/abs/", "").replace("https://arxiv.org/pdf/", "")
    arxiv_id = arxiv_id.split("v")[0]  # Remove version

    url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
    output_path = output_path or f"{arxiv_id.replace('.', '_')}.pdf"

    response = requests.get(url, timeout=60)
    response.raise_for_status()

    with open(output_path, "wb") as f:
        f.write(response.content)

    return output_path`,
  },
  {
    name: "get_arxiv_paper",
    description: "Get detailed information about a specific arXiv paper",
    pythonCode: `def get_arxiv_paper(arxiv_id: str) -> Dict[str, Any]:
    """
    Get detailed information about an arXiv paper.

    Args:
        arxiv_id: arXiv paper ID (e.g., "2301.07041")

    Returns:
        Paper dictionary with full details
    """
    # Clean up arxiv_id
    arxiv_id = arxiv_id.replace("https://arxiv.org/abs/", "").replace("https://arxiv.org/pdf/", "")
    arxiv_id = arxiv_id.split("v")[0]

    url = f"http://export.arxiv.org/api/query?id_list={arxiv_id}"
    response = requests.get(url, timeout=30)
    response.raise_for_status()

    root = ET.fromstring(response.text)
    ns = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}

    entry = root.find("atom:entry", ns)
    if entry is None:
        return {"error": f"Paper {arxiv_id} not found"}

    title = entry.find("atom:title", ns)
    summary = entry.find("atom:summary", ns)
    published = entry.find("atom:published", ns)
    updated = entry.find("atom:updated", ns)

    authors = []
    for author in entry.findall("atom:author", ns):
        name = author.find("atom:name", ns)
        if name is not None:
            authors.append(name.text.strip())

    categories = []
    for cat in entry.findall("atom:category", ns):
        term = cat.get("term")
        if term:
            categories.append(term)

    return {
        "arxiv_id": arxiv_id,
        "title": title.text.strip().replace("\\n", " ") if title is not None else "",
        "authors": authors,
        "abstract": summary.text.strip().replace("\\n", " ") if summary is not None else "",
        "published": published.text if published is not None else "",
        "updated": updated.text if updated is not None else "",
        "categories": categories,
        "pdf_url": f"https://arxiv.org/pdf/{arxiv_id}.pdf",
        "abs_url": f"https://arxiv.org/abs/{arxiv_id}"
    }`,
  },
];

export const WEB_PYTHON_TOOLS: PythonToolSpec[] = [
  {
    name: "web_fetch",
    description: "Fetch and extract text from a webpage",
    pythonCode: `def web_fetch(url: str, extract_text: bool = True) -> Dict[str, Any]:
    """
    Fetch content from a URL and optionally extract text.

    Args:
        url: URL to fetch
        extract_text: If True, extract readable text; if False, return raw HTML

    Returns:
        Dictionary with url, content, and metadata
    """
    import re
    from html import unescape

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; ResearchBot/1.0)"
    }

    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()

    content = response.text
    title = ""

    # Extract title
    title_match = re.search(r"<title[^>]*>([^<]+)</title>", content, re.IGNORECASE)
    if title_match:
        title = unescape(title_match.group(1).strip())

    if extract_text:
        # Remove script and style elements
        content = re.sub(r"<script[^>]*>.*?</script>", "", content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r"<style[^>]*>.*?</style>", "", content, flags=re.DOTALL | re.IGNORECASE)
        # Remove HTML tags
        content = re.sub(r"<[^>]+>", " ", content)
        # Decode entities and clean whitespace
        content = unescape(content)
        content = re.sub(r"\\s+", " ", content).strip()

    return {
        "url": url,
        "title": title,
        "content": content[:50000],  # Limit content size
        "content_type": response.headers.get("content-type", ""),
        "status": response.status_code
    }`,
    dependencies: ["requests"],
  },
  {
    name: "web_search_scrape",
    description: "Search and scrape multiple URLs",
    pythonCode: `def web_search_scrape(urls: List[str], extract_text: bool = True) -> List[Dict[str, Any]]:
    """
    Fetch content from multiple URLs in sequence.

    Args:
        urls: List of URLs to fetch
        extract_text: If True, extract readable text

    Returns:
        List of results for each URL
    """
    results = []
    for url in urls:
        try:
            result = web_fetch(url, extract_text)
            results.append(result)
        except Exception as e:
            results.append({"url": url, "error": str(e)})
    return results`,
    dependencies: ["requests"],
  },
];

export const GITHUB_PYTHON_TOOLS: PythonToolSpec[] = [
  {
    name: "github_search_code",
    description: "Search code on GitHub",
    pythonCode: `def github_search_code(query: str, repo: Optional[str] = None, language: Optional[str] = None, token: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Search for code on GitHub.

    Args:
        query: Search query
        repo: Repository to search in (owner/repo format)
        language: Filter by programming language
        token: GitHub personal access token (required)

    Returns:
        List of search results with file path, repo, and matches
    """
    if not token:
        return [{"error": "GitHub token required. Set GITHUB_TOKEN environment variable."}]

    search_query = query
    if repo:
        search_query += f" repo:{repo}"
    if language:
        search_query += f" language:{language}"

    url = "https://api.github.com/search/code"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.text-match+json"
    }
    params = {"q": search_query, "per_page": 30}

    response = requests.get(url, headers=headers, params=params, timeout=30)
    response.raise_for_status()

    data = response.json()
    results = []

    for item in data.get("items", []):
        result = {
            "path": item.get("path", ""),
            "repo": item.get("repository", {}).get("full_name", ""),
            "url": item.get("html_url", ""),
        }

        # Include text matches if available
        matches = item.get("text_matches", [])
        if matches:
            result["matches"] = [m.get("fragment", "")[:150] for m in matches[:2]]

        results.append(result)

    return results`,
    dependencies: ["requests"],
  },
  {
    name: "github_get_file",
    description: "Read a file from a GitHub repository",
    pythonCode: `def github_get_file(repo: str, path: str, ref: Optional[str] = None, token: Optional[str] = None) -> Dict[str, Any]:
    """
    Read a file from a GitHub repository.

    Args:
        repo: Repository in owner/repo format
        path: Path to file
        ref: Branch, tag, or commit SHA
        token: GitHub personal access token

    Returns:
        Dictionary with file content and metadata
    """
    import base64

    if not token:
        return {"error": "GitHub token required"}

    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    if ref:
        url += f"?ref={ref}"

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json"
    }

    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()

    data = response.json()

    if data.get("type") != "file":
        return {"error": "Path is not a file"}

    content = base64.b64decode(data.get("content", "")).decode("utf-8")

    return {
        "path": path,
        "content": content,
        "size": data.get("size", 0),
        "sha": data.get("sha", ""),
        "url": data.get("html_url", "")
    }`,
    dependencies: ["requests"],
  },
];

// Data processing Python tools
export const DATA_PYTHON_TOOLS: PythonToolSpec[] = [
  {
    name: "analyze_text",
    description: "Analyze text for word frequency, length stats, and patterns",
    pythonCode: `def analyze_text(text: str, top_n: int = 20) -> Dict[str, Any]:
    """
    Analyze text for common patterns and statistics.

    Args:
        text: Text to analyze
        top_n: Number of top words to return

    Returns:
        Dictionary with word count, frequency, and statistics
    """
    import re
    from collections import Counter

    # Basic cleaning
    words = re.findall(r'\\b\\w+\\b', text.lower())
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]

    word_freq = Counter(words)

    return {
        "total_words": len(words),
        "unique_words": len(word_freq),
        "total_sentences": len(sentences),
        "avg_word_length": sum(len(w) for w in words) / len(words) if words else 0,
        "avg_sentence_length": len(words) / len(sentences) if sentences else 0,
        "top_words": dict(word_freq.most_common(top_n)),
        "char_count": len(text),
        "line_count": text.count("\\n") + 1
    }`,
  },
  {
    name: "parse_csv_data",
    description: "Parse CSV data and compute basic statistics",
    pythonCode: `def parse_csv_data(csv_content: str, has_header: bool = True) -> Dict[str, Any]:
    """
    Parse CSV content and compute statistics.

    Args:
        csv_content: CSV content as string
        has_header: Whether first row is header

    Returns:
        Dictionary with parsed data and statistics
    """
    import csv
    from io import StringIO

    reader = csv.reader(StringIO(csv_content))
    rows = list(reader)

    if not rows:
        return {"error": "Empty CSV"}

    headers = rows[0] if has_header else [f"col_{i}" for i in range(len(rows[0]))]
    data_rows = rows[1:] if has_header else rows

    # Compute column statistics
    column_stats = {}
    for i, header in enumerate(headers):
        values = [row[i] if i < len(row) else "" for row in data_rows]
        numeric_values = []
        for v in values:
            try:
                numeric_values.append(float(v))
            except ValueError:
                pass

        stats = {
            "count": len(values),
            "unique": len(set(values)),
            "empty": sum(1 for v in values if not v)
        }

        if numeric_values:
            stats.update({
                "min": min(numeric_values),
                "max": max(numeric_values),
                "mean": sum(numeric_values) / len(numeric_values),
            })

        column_stats[header] = stats

    return {
        "headers": headers,
        "row_count": len(data_rows),
        "column_count": len(headers),
        "column_stats": column_stats,
        "sample_rows": data_rows[:5]
    }`,
  },
  {
    name: "parse_json_deep",
    description: "Deep parse JSON and extract structure information",
    pythonCode: `def parse_json_deep(json_content: str, max_depth: int = 5) -> Dict[str, Any]:
    """
    Parse JSON and analyze its structure.

    Args:
        json_content: JSON content as string
        max_depth: Maximum depth to analyze

    Returns:
        Dictionary with structure analysis
    """
    import json

    def analyze_structure(obj, depth=0):
        if depth > max_depth:
            return {"type": "...", "truncated": True}

        if isinstance(obj, dict):
            return {
                "type": "object",
                "keys": list(obj.keys())[:20],
                "key_count": len(obj),
                "children": {k: analyze_structure(v, depth+1) for k, v in list(obj.items())[:10]}
            }
        elif isinstance(obj, list):
            sample = obj[:3] if obj else []
            return {
                "type": "array",
                "length": len(obj),
                "sample_types": [type(x).__name__ for x in sample],
                "sample": [analyze_structure(x, depth+1) for x in sample]
            }
        else:
            return {"type": type(obj).__name__, "value_preview": str(obj)[:100]}

    data = json.loads(json_content)
    return {
        "structure": analyze_structure(data),
        "root_type": type(data).__name__,
        "size_chars": len(json_content)
    }`,
  },
  {
    name: "extract_urls",
    description: "Extract and validate URLs from text",
    pythonCode: `def extract_urls(text: str, validate: bool = False) -> List[Dict[str, Any]]:
    """
    Extract URLs from text.

    Args:
        text: Text containing URLs
        validate: Whether to validate URLs by checking if they respond

    Returns:
        List of URL dictionaries with optional validation status
    """
    import re

    url_pattern = r'https?://[^\\s<>"{}|\\\\^\\[\\]\\x60]+'
    urls = re.findall(url_pattern, text)

    # Clean URLs (remove trailing punctuation)
    clean_urls = []
    for url in urls:
        while url and url[-1] in '.,;:!?)':
            url = url[:-1]
        if url:
            clean_urls.append(url)

    # Deduplicate
    unique_urls = list(dict.fromkeys(clean_urls))

    results = []
    for url in unique_urls:
        result = {"url": url}

        if validate:
            try:
                response = requests.head(url, timeout=5, allow_redirects=True)
                result["status"] = response.status_code
                result["valid"] = response.status_code < 400
            except Exception:
                result["status"] = None
                result["valid"] = False

        results.append(result)

    return results`,
    dependencies: ["requests"],
  },
  {
    name: "compute_diff",
    description: "Compute diff between two texts",
    pythonCode: `def compute_diff(text1: str, text2: str, context_lines: int = 3) -> Dict[str, Any]:
    """
    Compute unified diff between two texts.

    Args:
        text1: Original text
        text2: Modified text
        context_lines: Number of context lines

    Returns:
        Dictionary with diff lines and statistics
    """
    import difflib

    lines1 = text1.splitlines(keepends=True)
    lines2 = text2.splitlines(keepends=True)

    diff = list(difflib.unified_diff(lines1, lines2, lineterm="", n=context_lines))

    additions = sum(1 for line in diff if line.startswith("+") and not line.startswith("+++"))
    deletions = sum(1 for line in diff if line.startswith("-") and not line.startswith("---"))

    return {
        "diff": "".join(diff),
        "additions": additions,
        "deletions": deletions,
        "lines_before": len(lines1),
        "lines_after": len(lines2),
        "similarity_ratio": difflib.SequenceMatcher(None, text1, text2).ratio()
    }`,
  },
  {
    name: "extract_code_blocks",
    description: "Extract code blocks from markdown text",
    pythonCode: `def extract_code_blocks(markdown: str) -> List[Dict[str, Any]]:
    """
    Extract fenced code blocks from markdown.

    Args:
        markdown: Markdown text

    Returns:
        List of code blocks with language and content
    """
    import re

    pattern = r'\x60\x60\x60(\\w*)\\n([\\s\\S]*?)\x60\x60\x60'
    matches = re.findall(pattern, markdown)

    blocks = []
    for lang, code in matches:
        blocks.append({
            "language": lang or "text",
            "code": code.strip(),
            "line_count": code.count("\\n") + 1,
            "char_count": len(code)
        })

    return blocks`,
  },
  {
    name: "batch_process",
    description: "Apply a transformation function to items in batch",
    pythonCode: `def batch_process(items: List[Any], batch_size: int = 10, transform_fn: Optional[str] = None) -> Dict[str, Any]:
    """
    Process items in batches with optional transformation.

    Args:
        items: List of items to process
        batch_size: Size of each batch
        transform_fn: Python expression for transformation (uses 'x' as item variable)

    Returns:
        Dictionary with processed batches and statistics
    """
    batches = [items[i:i + batch_size] for i in range(0, len(items), batch_size)]

    results = []
    errors = []

    for batch_idx, batch in enumerate(batches):
        batch_results = []
        for item in batch:
            if transform_fn:
                try:
                    x = item
                    result = eval(transform_fn)
                    batch_results.append(result)
                except Exception as e:
                    errors.append({"batch": batch_idx, "item": str(item)[:50], "error": str(e)})
            else:
                batch_results.append(item)
        results.append(batch_results)

    return {
        "total_items": len(items),
        "batch_count": len(batches),
        "batch_size": batch_size,
        "results": results,
        "errors": errors
    }`,
  },
];
