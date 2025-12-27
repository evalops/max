"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGitDetect } from "@/hooks/useGitDetect";
import { useAppStore } from "@/store";

interface RepoSwitcherProps {
  className?: string;
}

export function RepoSwitcher({ className = "" }: RepoSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { settings } = useAppStore();
  const {
    currentRepo,
    currentBranch,
    recentRepos,
    isAutoDetected,
    autoDetect,
    setRepo,
    clearRepo,
  } = useGitDetect();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.includes("/")) {
      setRepo(inputValue.trim());
      setInputValue("");
      setIsOpen(false);
    }
  };

  const handleSelectRepo = (repo: string) => {
    setRepo(repo);
    setIsOpen(false);
  };

  const hasGitHubToken = !!settings.githubToken;

  if (!hasGitHubToken) {
    return (
      <div className={`flex items-center gap-2 text-xs text-zinc-500 ${className}`}>
        <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        <span>Add GitHub token in settings</span>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      >
        <svg
          className="size-4 text-zinc-600 dark:text-zinc-400"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        {currentRepo ? (
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            {currentRepo}
            {currentBranch && (
              <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
                : {currentBranch}
              </span>
            )}
            {isAutoDetected && (
              <span className="ml-1 text-xs text-blue-500" title="Auto-detected from git remote">
                ⚡
              </span>
            )}
          </span>
        ) : (
          <span className="text-zinc-500">Select repo</span>
        )}
        <svg
          className={`size-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          >
            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="border-b border-zinc-200 p-2 dark:border-zinc-700"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="owner/repo"
                className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </form>

            {/* Actions */}
            <div className="flex gap-2 border-b border-zinc-200 p-2 dark:border-zinc-700">
              <button
                onClick={() => {
                  autoDetect();
                  setIsOpen(false);
                }}
                className="flex-1 rounded-md bg-blue-50 px-3 py-1.5 text-xs text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
              >
                ⚡ Auto-detect
              </button>
              {currentRepo && (
                <button
                  onClick={() => {
                    clearRepo();
                    setIsOpen(false);
                  }}
                  className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Recent repos */}
            {recentRepos.length > 0 && (
              <div className="max-h-48 overflow-y-auto">
                <div className="px-3 py-1.5 text-xs uppercase tracking-wide text-zinc-500">
                  Recent
                </div>
                {recentRepos.map((repo) => (
                  <button
                    key={repo}
                    onClick={() => handleSelectRepo(repo)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                      repo === currentRepo
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <svg className="size-4 text-zinc-400" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
                    </svg>
                    <span className="truncate">{repo}</span>
                    {repo === currentRepo && <span className="ml-auto text-xs">✓</span>}
                  </button>
                ))}
              </div>
            )}

            {recentRepos.length === 0 && (
              <div className="p-4 text-center text-sm text-zinc-500">
                No recent repos. Enter a repo above or auto-detect.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
