"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Github,
  Search,
  GitPullRequest,
  CircleDot,
  ChevronRight,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Folder,
  FileCode,
  File,
  GitBranch,
  Check,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGitHub, type GitHubRepo, type GitHubIssue, type GitHubPR, type GitHubFile, type GitHubBranch } from "@/hooks/useGitHub";

interface GitHubImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (content: string) => void;
}

type View = "repos" | "repo-detail" | "issue-detail" | "pr-detail" | "files" | "file-preview";

// File extension to language mapping for syntax highlighting hints
const extToLang: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  cpp: "cpp",
  c: "c",
  h: "c",
  css: "css",
  scss: "scss",
  html: "html",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  sh: "bash",
  bash: "bash",
};

export function GitHubImportModal({ isOpen, onClose, onImport }: GitHubImportModalProps) {
  const {
    hasToken,
    isLoading,
    error,
    getRepos,
    searchRepos,
    getIssues,
    getIssue,
    getPRs,
    getPR,
    getPRDiff,
    getDirectoryContents,
    getFileContent,
    getBranches,
  } = useGitHub();

  const [view, setView] = useState<View>("repos");
  const [searchQuery, setSearchQuery] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [prs, setPrs] = useState<GitHubPR[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [selectedPR, setSelectedPR] = useState<GitHubPR | null>(null);
  const [prDiff, setPrDiff] = useState<string | null>(null);

  // File browser state
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<GitHubFile | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const loadRepos = useCallback(async () => {
    const data = await getRepos({ type: "all", sort: "updated" });
    setRepos(data);
  }, [getRepos]);

  // Load repos on mount
  useEffect(() => {
    if (isOpen && hasToken && repos.length === 0) {
      loadRepos();
    }
  }, [isOpen, hasToken, repos.length, loadRepos]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadRepos();
      return;
    }
    const data = await searchRepos(searchQuery);
    setRepos(data);
  };

  const handleSelectRepo = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setSelectedBranch(repo.default_branch);
    setView("repo-detail");

    const [owner, name] = repo.full_name.split("/");
    const [issuesData, prsData, branchesData] = await Promise.all([
      getIssues(owner, name),
      getPRs(owner, name),
      getBranches(owner, name),
    ]);
    setIssues(issuesData);
    setPrs(prsData);
    setBranches(branchesData);
  };

  const handleSelectIssue = async (issue: GitHubIssue) => {
    if (!selectedRepo) return;
    const [owner, name] = selectedRepo.full_name.split("/");
    const fullIssue = await getIssue(owner, name, issue.number);
    if (fullIssue) {
      setSelectedIssue(fullIssue);
      setView("issue-detail");
    }
  };

  const handleSelectPR = async (pr: GitHubPR) => {
    if (!selectedRepo) return;
    const [owner, name] = selectedRepo.full_name.split("/");
    const [fullPR, diff] = await Promise.all([
      getPR(owner, name, pr.number),
      getPRDiff(owner, name, pr.number),
    ]);
    if (fullPR) {
      setSelectedPR(fullPR);
      setPrDiff(diff);
      setView("pr-detail");
    }
  };

  const handleBrowseFiles = async () => {
    if (!selectedRepo) return;
    const [owner, name] = selectedRepo.full_name.split("/");
    setCurrentPath([]);
    const contents = await getDirectoryContents(owner, name, "", selectedBranch);
    // Sort: directories first, then files alphabetically
    const sorted = [...contents].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "dir" ? -1 : 1;
    });
    setFiles(sorted);
    setView("files");
  };

  const handleNavigateToDir = async (dir: GitHubFile) => {
    if (!selectedRepo) return;
    const [owner, name] = selectedRepo.full_name.split("/");
    const newPath = [...currentPath, dir.name];
    setCurrentPath(newPath);
    const contents = await getDirectoryContents(owner, name, newPath.join("/"), selectedBranch);
    const sorted = [...contents].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "dir" ? -1 : 1;
    });
    setFiles(sorted);
  };

  const handleNavigateUp = async () => {
    if (!selectedRepo || currentPath.length === 0) return;
    const [owner, name] = selectedRepo.full_name.split("/");
    const newPath = currentPath.slice(0, -1);
    setCurrentPath(newPath);
    const contents = await getDirectoryContents(owner, name, newPath.join("/"), selectedBranch);
    const sorted = [...contents].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "dir" ? -1 : 1;
    });
    setFiles(sorted);
  };

  const handleSelectFile = async (file: GitHubFile) => {
    if (!selectedRepo) return;
    const [owner, name] = selectedRepo.full_name.split("/");
    const fullPath = [...currentPath, file.name].join("/");
    const content = await getFileContent(owner, name, fullPath, selectedBranch);
    if (content) {
      setSelectedFile({ ...file, path: fullPath });
      setFileContent(content.content || null);
      setView("file-preview");
    }
  };

  const toggleFileSelection = (file: GitHubFile) => {
    const fullPath = [...currentPath, file.name].join("/");
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fullPath)) {
      newSelected.delete(fullPath);
    } else {
      newSelected.add(fullPath);
    }
    setSelectedFiles(newSelected);
  };

  const handleImportIssue = () => {
    if (!selectedIssue || !selectedRepo) return;
    const content = `GitHub Issue: ${selectedRepo.full_name}#${selectedIssue.number}

**${selectedIssue.title}**

${selectedIssue.body || "No description provided."}

---
Labels: ${selectedIssue.labels.map((l) => l.name).join(", ") || "None"}
State: ${selectedIssue.state}
URL: ${selectedIssue.html_url}`;

    onImport(content);
    onClose();
  };

  const handleImportPR = () => {
    if (!selectedPR || !selectedRepo) return;
    let content = `GitHub Pull Request: ${selectedRepo.full_name}#${selectedPR.number}

**${selectedPR.title}**

${selectedPR.body || "No description provided."}

Branch: ${selectedPR.head.ref} → ${selectedPR.base.ref}
State: ${selectedPR.state}
URL: ${selectedPR.html_url}`;

    if (prDiff) {
      content += `\n\n---\n**Diff:**\n\`\`\`diff\n${prDiff.substring(0, 10000)}${prDiff.length > 10000 ? "\n... (truncated)" : ""}\n\`\`\``;
    }

    onImport(content);
    onClose();
  };

  const handleImportFile = () => {
    if (!selectedFile || !fileContent || !selectedRepo) return;
    const ext = selectedFile.name.split(".").pop() || "";
    const lang = extToLang[ext] || ext;

    const content = `GitHub File: ${selectedRepo.full_name}/${selectedFile.path} (${selectedBranch})

\`\`\`${lang}
${fileContent.substring(0, 15000)}${fileContent.length > 15000 ? "\n... (truncated)" : ""}
\`\`\``;

    onImport(content);
    onClose();
  };

  const handleImportSelectedFiles = async () => {
    if (!selectedRepo || selectedFiles.size === 0) return;
    const [owner, name] = selectedRepo.full_name.split("/");

    const contents: string[] = [];
    for (const path of selectedFiles) {
      const file = await getFileContent(owner, name, path, selectedBranch);
      if (file?.content) {
        const ext = path.split(".").pop() || "";
        const lang = extToLang[ext] || ext;
        contents.push(`**${path}**\n\`\`\`${lang}\n${file.content.substring(0, 5000)}${file.content.length > 5000 ? "\n... (truncated)" : ""}\n\`\`\``);
      }
    }

    if (contents.length > 0) {
      const content = `GitHub Files from ${selectedRepo.full_name} (${selectedBranch}):\n\n${contents.join("\n\n---\n\n")}`;
      onImport(content);
      onClose();
    }
  };

  const goBack = useCallback(() => {
    switch (view) {
      case "repo-detail":
        setView("repos");
        setSelectedRepo(null);
        setIssues([]);
        setPrs([]);
        setBranches([]);
        setSelectedBranch("");
        break;
      case "issue-detail":
        setView("repo-detail");
        setSelectedIssue(null);
        break;
      case "pr-detail":
        setView("repo-detail");
        setSelectedPR(null);
        setPrDiff(null);
        break;
      case "files":
        setView("repo-detail");
        setFiles([]);
        setCurrentPath([]);
        setSelectedFiles(new Set());
        break;
      case "file-preview":
        setView("files");
        setSelectedFile(null);
        setFileContent(null);
        break;
    }
  }, [view]);

  const resetModal = useCallback(() => {
    setView("repos");
    setSearchQuery("");
    setSelectedRepo(null);
    setSelectedIssue(null);
    setSelectedPR(null);
    setPrDiff(null);
    setIssues([]);
    setPrs([]);
    setFiles([]);
    setCurrentPath([]);
    setSelectedFile(null);
    setFileContent(null);
    setSelectedBranch("");
    setBranches([]);
    setSelectedFiles(new Set());
  }, []);

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const getFileIcon = (file: GitHubFile) => {
    if (file.type === "dir") return <Folder size={16} className="text-terminal-blue" />;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (["ts", "tsx", "js", "jsx", "py", "rb", "go", "rs", "java", "c", "cpp", "h"].includes(ext || "")) {
      return <FileCode size={16} className="text-terminal-green" />;
    }
    return <File size={16} className="text-ink-400" />;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ink-200 px-6 py-4">
            <div className="flex items-center gap-3">
              {view !== "repos" && (
                <button
                  onClick={goBack}
                  className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <Github size={24} className="text-ink-700" />
              <h2 className="text-lg font-semibold text-ink-800">
                {view === "repos" && "Import from GitHub"}
                {view === "repo-detail" && selectedRepo?.name}
                {view === "issue-detail" && `Issue #${selectedIssue?.number}`}
                {view === "pr-detail" && `PR #${selectedPR?.number}`}
                {view === "files" && (
                  <span className="flex items-center gap-2">
                    <FolderOpen size={18} />
                    {currentPath.length > 0 ? currentPath.join("/") : "Files"}
                  </span>
                )}
                {view === "file-preview" && selectedFile?.name}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto p-6">
            {!hasToken ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle size={48} className="mb-4 text-terminal-amber" />
                <h3 className="text-lg font-medium text-ink-700">GitHub Token Required</h3>
                <p className="mt-2 max-w-sm text-sm text-ink-500">
                  Add a GitHub Personal Access Token in Settings to import from GitHub.
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle size={48} className="mb-4 text-red-500" />
                <h3 className="text-lg font-medium text-ink-700">Error</h3>
                <p className="mt-2 max-w-sm text-sm text-ink-500">{error}</p>
              </div>
            ) : (
              <>
                {/* Repos View */}
                {view === "repos" && (
                  <>
                    <div className="mb-4 flex gap-2">
                      <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                          placeholder="Search repositories..."
                          className="w-full rounded-lg border border-ink-200 py-2 pl-10 pr-4 text-sm focus:border-terminal-blue focus:outline-none focus:ring-2 focus:ring-terminal-blue/20"
                        />
                      </div>
                      <button
                        onClick={handleSearch}
                        className="rounded-lg bg-ink-800 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700"
                      >
                        Search
                      </button>
                    </div>

                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-ink-400" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {repos.map((repo) => (
                          <button
                            key={repo.id}
                            onClick={() => handleSelectRepo(repo)}
                            className="flex w-full items-center justify-between rounded-lg border border-ink-200 p-4 text-left transition-colors hover:bg-ink-50"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-ink-800">{repo.full_name}</span>
                                {repo.private && (
                                  <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-500">
                                    Private
                                  </span>
                                )}
                              </div>
                              {repo.description && (
                                <p className="mt-1 truncate text-sm text-ink-500">{repo.description}</p>
                              )}
                            </div>
                            <ChevronRight size={16} className="shrink-0 text-ink-400" />
                          </button>
                        ))}
                        {repos.length === 0 && !isLoading && (
                          <p className="py-8 text-center text-sm text-ink-400">No repositories found</p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Repo Detail View */}
                {view === "repo-detail" && selectedRepo && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <a
                        href={selectedRepo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-terminal-blue hover:underline"
                      >
                        View on GitHub <ExternalLink size={12} />
                      </a>
                      <div className="flex items-center gap-2">
                        <GitBranch size={14} className="text-ink-400" />
                        <select
                          value={selectedBranch}
                          onChange={(e) => setSelectedBranch(e.target.value)}
                          className="rounded bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600 focus:outline-none focus:ring-1 focus:ring-terminal-blue"
                        >
                          {branches.map((branch) => (
                            <option key={branch.name} value={branch.name}>
                              {branch.name}
                              {branch.protected ? " 🔒" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-ink-400" />
                      </div>
                    ) : (
                      <>
                        {/* Browse Files Button */}
                        <button
                          onClick={handleBrowseFiles}
                          className="flex w-full items-center justify-between rounded-lg border-2 border-dashed border-ink-200 p-4 text-left transition-colors hover:border-terminal-blue hover:bg-terminal-blue/5"
                        >
                          <div className="flex items-center gap-3">
                            <FolderOpen size={20} className="text-terminal-blue" />
                            <div>
                              <span className="font-medium text-ink-700">Browse Files</span>
                              <p className="text-sm text-ink-500">Import code files from this repository</p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-ink-400" />
                        </button>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Issues */}
                          <div className="rounded-lg border border-ink-200 p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <CircleDot size={16} className="text-terminal-green" />
                              <span className="font-medium text-ink-700">Open Issues</span>
                              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">
                                {issues.length}
                              </span>
                            </div>
                            <div className="max-h-48 space-y-2 overflow-y-auto">
                              {issues.slice(0, 10).map((issue) => (
                                <button
                                  key={issue.id}
                                  onClick={() => handleSelectIssue(issue)}
                                  className="w-full rounded-md p-2 text-left text-sm hover:bg-ink-50"
                                >
                                  <span className="text-ink-400">#{issue.number}</span>{" "}
                                  <span className="text-ink-700">{issue.title}</span>
                                </button>
                              ))}
                              {issues.length === 0 && (
                                <p className="text-sm text-ink-400">No open issues</p>
                              )}
                            </div>
                          </div>

                          {/* PRs */}
                          <div className="rounded-lg border border-ink-200 p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <GitPullRequest size={16} className="text-terminal-purple" />
                              <span className="font-medium text-ink-700">Open PRs</span>
                              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">
                                {prs.length}
                              </span>
                            </div>
                            <div className="max-h-48 space-y-2 overflow-y-auto">
                              {prs.slice(0, 10).map((pr) => (
                                <button
                                  key={pr.id}
                                  onClick={() => handleSelectPR(pr)}
                                  className="w-full rounded-md p-2 text-left text-sm hover:bg-ink-50"
                                >
                                  <span className="text-ink-400">#{pr.number}</span>{" "}
                                  <span className="text-ink-700">{pr.title}</span>
                                </button>
                              ))}
                              {prs.length === 0 && (
                                <p className="text-sm text-ink-400">No open PRs</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* File Browser View */}
                {view === "files" && selectedRepo && (
                  <div className="space-y-4">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1 text-sm">
                      <button
                        onClick={() => {
                          setCurrentPath([]);
                          handleBrowseFiles();
                        }}
                        className="text-terminal-blue hover:underline"
                      >
                        {selectedRepo.name}
                      </button>
                      {currentPath.map((segment, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="text-ink-400">/</span>
                          <button
                            onClick={async () => {
                              const newPath = currentPath.slice(0, i + 1);
                              const [owner, name] = selectedRepo.full_name.split("/");
                              setCurrentPath(newPath);
                              const contents = await getDirectoryContents(owner, name, newPath.join("/"), selectedBranch);
                              const sorted = [...contents].sort((a, b) => {
                                if (a.type === b.type) return a.name.localeCompare(b.name);
                                return a.type === "dir" ? -1 : 1;
                              });
                              setFiles(sorted);
                            }}
                            className="text-terminal-blue hover:underline"
                          >
                            {segment}
                          </button>
                        </span>
                      ))}
                    </div>

                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-ink-400" />
                      </div>
                    ) : (
                      <>
                        {/* Selected files indicator */}
                        {selectedFiles.size > 0 && (
                          <div className="flex items-center justify-between rounded-lg bg-terminal-blue/10 px-4 py-2">
                            <span className="text-sm font-medium text-terminal-blue">
                              {selectedFiles.size} file{selectedFiles.size > 1 ? "s" : ""} selected
                            </span>
                            <button
                              onClick={handleImportSelectedFiles}
                              className="rounded-md bg-terminal-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-terminal-blue/90"
                            >
                              Import Selected
                            </button>
                          </div>
                        )}

                        {/* File list */}
                        <div className="divide-y divide-ink-100 rounded-lg border border-ink-200">
                          {currentPath.length > 0 && (
                            <button
                              onClick={handleNavigateUp}
                              className="flex w-full items-center gap-3 p-3 text-left hover:bg-ink-50"
                            >
                              <Folder size={16} className="text-ink-400" />
                              <span className="text-sm text-ink-600">..</span>
                            </button>
                          )}
                          {files.map((file) => (
                            <div
                              key={file.name}
                              className="flex items-center gap-3 p-3 hover:bg-ink-50"
                            >
                              {file.type === "file" && (
                                <button
                                  onClick={() => toggleFileSelection(file)}
                                  className={cn(
                                    "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                                    selectedFiles.has([...currentPath, file.name].join("/"))
                                      ? "border-terminal-blue bg-terminal-blue text-white"
                                      : "border-ink-300 hover:border-terminal-blue"
                                  )}
                                >
                                  {selectedFiles.has([...currentPath, file.name].join("/")) && (
                                    <Check size={12} />
                                  )}
                                </button>
                              )}
                              {file.type === "dir" && <div className="size-5" />}
                              <button
                                onClick={() => file.type === "dir" ? handleNavigateToDir(file) : handleSelectFile(file)}
                                className="flex flex-1 items-center gap-2 text-left"
                              >
                                {getFileIcon(file)}
                                <span className="text-sm text-ink-700">{file.name}</span>
                                {file.type === "dir" && (
                                  <ChevronRight size={14} className="ml-auto text-ink-400" />
                                )}
                              </button>
                            </div>
                          ))}
                          {files.length === 0 && (
                            <p className="p-4 text-center text-sm text-ink-400">Empty directory</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* File Preview View */}
                {view === "file-preview" && selectedFile && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCode size={18} className="text-terminal-green" />
                        <span className="font-medium text-ink-700">{selectedFile.path}</span>
                      </div>
                      <span className="rounded bg-ink-100 px-2 py-0.5 text-xs text-ink-500">
                        {selectedBranch}
                      </span>
                    </div>

                    <div className="max-h-80 overflow-auto rounded-lg border border-ink-200 bg-ink-900">
                      <pre className="p-4 font-mono text-xs leading-relaxed text-ink-100">
                        {fileContent?.substring(0, 10000)}
                        {(fileContent?.length || 0) > 10000 && "\n\n... (truncated)"}
                      </pre>
                    </div>

                    <button
                      onClick={handleImportFile}
                      className="w-full rounded-lg bg-terminal-blue px-4 py-2.5 font-medium text-white hover:bg-terminal-blue/90"
                    >
                      Import File
                    </button>
                  </div>
                )}

                {/* Issue Detail View */}
                {view === "issue-detail" && selectedIssue && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium text-ink-800">{selectedIssue.title}</h3>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            selectedIssue.state === "open"
                              ? "bg-terminal-green/10 text-terminal-green"
                              : "bg-terminal-purple/10 text-terminal-purple"
                          )}
                        >
                          {selectedIssue.state}
                        </span>
                        {selectedIssue.labels.map((label) => (
                          <span
                            key={label.name}
                            className="rounded-full px-2 py-0.5 text-xs"
                            style={{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }}
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg bg-ink-50 p-4">
                      <p className="whitespace-pre-wrap text-sm text-ink-700">
                        {selectedIssue.body || "No description provided."}
                      </p>
                    </div>

                    <button
                      onClick={handleImportIssue}
                      className="w-full rounded-lg bg-terminal-blue px-4 py-2.5 font-medium text-white hover:bg-terminal-blue/90"
                    >
                      Import Issue
                    </button>
                  </div>
                )}

                {/* PR Detail View */}
                {view === "pr-detail" && selectedPR && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium text-ink-800">{selectedPR.title}</h3>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            selectedPR.state === "open"
                              ? "bg-terminal-green/10 text-terminal-green"
                              : "bg-terminal-purple/10 text-terminal-purple"
                          )}
                        >
                          {selectedPR.state}
                        </span>
                        <span className="text-xs text-ink-500">
                          {selectedPR.head.ref} → {selectedPR.base.ref}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-ink-50 p-4">
                      <p className="whitespace-pre-wrap text-sm text-ink-700">
                        {selectedPR.body || "No description provided."}
                      </p>
                    </div>

                    {prDiff && (
                      <div className="rounded-lg border border-ink-200 p-4">
                        <h4 className="mb-2 text-sm font-medium text-ink-700">Diff Preview</h4>
                        <pre className="max-h-40 overflow-auto rounded bg-ink-900 p-3 font-mono text-xs text-ink-100">
                          {prDiff.substring(0, 2000)}
                          {prDiff.length > 2000 && "\n... (truncated)"}
                        </pre>
                      </div>
                    )}

                    <button
                      onClick={handleImportPR}
                      className="w-full rounded-lg bg-terminal-blue px-4 py-2.5 font-medium text-white hover:bg-terminal-blue/90"
                    >
                      Import PR
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
