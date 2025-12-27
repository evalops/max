"use client";

import { useCallback, useRef } from "react";
import { useAppStore } from "@/store";
import type { AgentEvent, AgentRequest } from "@/app/api/agent/route";
import type { ActivityType, ArtifactKind } from "@/types";

// Map tool names to activity types
const toolToActivityType: Record<string, ActivityType> = {
  Read: "file_read",
  Write: "file_write",
  Edit: "file_write",
  Bash: "command",
  Glob: "file_read",
  Grep: "file_read",
  Task: "thinking",
  WebSearch: "github",
  WebFetch: "github",
  // GitHub MCP tools (consolidated: 20 → 4)
  github_repo: "github",
  github_issues: "github",
  github_prs: "github",
  github_ci: "github",
  // Research MCP tools (consolidated)
  notebook: "file_write",
  research: "thinking",
  python: "command",
};

// Infer artifact kind from file extension
function getArtifactKind(filename: string): ArtifactKind {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const kindMap: Record<string, ArtifactKind> = {
    md: "markdown",
    markdown: "markdown",
    html: "html",
    htm: "html",
    json: "json",
    ts: "code",
    tsx: "code",
    js: "code",
    jsx: "code",
    py: "code",
    rb: "code",
    go: "code",
    rs: "code",
    java: "code",
    c: "code",
    cpp: "code",
    h: "code",
    css: "code",
    scss: "code",
    yaml: "code",
    yml: "code",
    toml: "code",
    sh: "code",
    bash: "code",
    png: "image",
    jpg: "image",
    jpeg: "image",
    gif: "image",
    svg: "image",
    webp: "image",
  };
  return kindMap[ext] || "text";
}

// Get MIME type from file extension
function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string, string> = {
    md: "text/markdown",
    markdown: "text/markdown",
    html: "text/html",
    htm: "text/html",
    json: "application/json",
    ts: "text/typescript",
    tsx: "text/typescript",
    js: "text/javascript",
    jsx: "text/javascript",
    py: "text/x-python",
    css: "text/css",
    txt: "text/plain",
  };
  return mimeMap[ext] || "text/plain";
}

// Get language from file extension
function getLanguage(filename: string): string | undefined {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
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
  return langMap[ext];
}

// Extract filename from path
function getFilename(filepath: string): string {
  return filepath.split("/").pop() || filepath;
}

// Extract folder path from full path
function getFolderPath(filepath: string): string {
  const parts = filepath.split("/");
  parts.pop();
  return parts.join("/") || "/";
}

export function useAgent() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    settings,
    session,
    setSession,
    resetSession,
    addActivity,
    updateActivity,
    addStatusText,
    addTask,
    updateTask,
    setAgent,
    // New: Tool Runs
    addToolRun,
    updateToolRun,
    // New: Artifacts
    addArtifact,
    // New: Documents
    setDocument,
    // New: Cost
    addCostEntry,
  } = useAppStore();

  const runAgent = useCallback(
    async (prompt: string) => {
      // Check budget before starting
      if (session.totalCost >= settings.maxBudgetUsd) {
        addActivity({
          type: "error",
          title: "Budget exceeded",
          description: `Session cost ($${session.totalCost.toFixed(4)}) has exceeded your max budget ($${settings.maxBudgetUsd.toFixed(2)}). Increase your budget in settings to continue.`,
          timestamp: new Date(),
          status: "error",
        });
        return;
      }

      // Abort any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Update session state
      setSession({
        isRunning: true,
        isThinking: true,
        currentTask: prompt,
        startTime: Date.now(),
      });

      // Update agent state
      setAgent({
        currentActivity: "Thinking",
        isThinking: true,
      });

      // Add a task for this prompt
      const taskId = Math.random().toString(36).substring(2, 9);
      addTask({
        title: prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt,
        status: "in_progress",
        statusText: "Running",
      });

      // Track current activity for updates
      const currentActivityIds = new Map<string, string>();
      // Track tool runs by toolId
      const toolRunIds = new Map<string, string>();
      // Track tool inputs for artifact creation
      const toolInputs = new Map<string, Record<string, unknown>>();
      // Track tool names for cost tracking
      const toolNamesUsed: string[] = [];

      try {
        const request: AgentRequest = {
          prompt,
          apiKey: settings.apiKey,
          githubToken: settings.githubToken || undefined,
          model: settings.model,
          maxTurns: settings.maxTurns,
          workingDirectory: settings.workingDirectory,
          sessionId: session.sessionId || undefined,
        };

        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: AgentEvent = JSON.parse(line.slice(6));
                processEvent(event);
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }

        // Process any remaining data
        if (buffer.startsWith("data: ")) {
          try {
            const event: AgentEvent = JSON.parse(buffer.slice(6));
            processEvent(event);
          } catch {
            // Skip invalid JSON
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          // Request was aborted, update task status
          updateTask(taskId, { status: "pending", statusText: "Cancelled" });
          // Cancel any pending tool runs
          for (const [, runId] of toolRunIds) {
            updateToolRun(runId, { status: "cancelled", completedAt: Date.now() });
          }
        } else {
          // Real error
          addActivity({
            type: "error",
            title: "Error",
            description: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date(),
            status: "error",
          });
          updateTask(taskId, { status: "pending", statusText: "Error" });
        }
      } finally {
        setSession({
          isRunning: false,
          isThinking: false,
        });
        setAgent({
          isThinking: false,
        });
      }

      function processEvent(event: AgentEvent) {
        switch (event.type) {
          case "init":
            if (event.data.sessionId) {
              setSession({ sessionId: event.data.sessionId as string });
            }
            setAgent({
              currentActivity: "Initializing",
            });
            break;

          case "tool_start": {
            const toolName = event.data.toolName as string;
            const toolId = event.data.toolId as string;
            const input = event.data.input as Record<string, unknown>;

            // Store input for later use (artifact creation)
            toolInputs.set(toolId, input);
            toolNamesUsed.push(toolName);

            // Create activity title based on tool
            let title = `Using ${toolName}`;
            let description = "";

            if (toolName === "Read" && input.file_path) {
              title = "Reading file";
              description = input.file_path as string;
            } else if (toolName === "Write" && input.file_path) {
              title = "Creating file";
              description = input.file_path as string;
            } else if (toolName === "Edit" && input.file_path) {
              title = "Editing file";
              description = input.file_path as string;
            } else if (toolName === "Bash" && input.command) {
              title = "Executing command";
              description = (input.command as string).substring(0, 100);
            } else if (toolName === "Glob" && input.pattern) {
              title = "Searching files";
              description = input.pattern as string;
            } else if (toolName === "Grep" && input.pattern) {
              title = "Searching code";
              description = input.pattern as string;
            } else if (toolName === "WebSearch" && input.query) {
              title = "Searching web";
              description = input.query as string;
            } else if (toolName === "WebFetch" && input.url) {
              title = "Fetching URL";
              description = input.url as string;
            } else if (toolName === "Task" && input.description) {
              title = "Running task";
              description = input.description as string;
            }

            const activityId = Math.random().toString(36).substring(2, 9);
            currentActivityIds.set(toolId, activityId);

            addActivity({
              type: toolToActivityType[toolName] || "thinking",
              title,
              description,
              timestamp: new Date(event.timestamp),
              status: "running",
            });

            // Add tool run
            const runId = addToolRun({
              toolCallId: toolId,
              name: toolName,
              label: `${title}${description ? `: ${description}` : ""}`,
              status: "running",
              startedAt: Date.now(),
              completedAt: null,
              progress: 0,
              args: input,
              output: null,
              error: null,
            });
            toolRunIds.set(toolId, runId);

            setAgent({
              currentActivity: title,
              currentFile: (input.file_path as string) || undefined,
              isThinking: false,
            });
            break;
          }

          case "tool_end": {
            const toolId = event.data.toolId as string;
            const result = event.data.result as string;
            const isError = event.data.isError as boolean;
            const input = toolInputs.get(toolId);
            // toolName lookup removed - not currently used

            // Update activity
            const activityId = currentActivityIds.get(toolId);
            if (activityId) {
              updateActivity(activityId, {
                status: isError ? "error" : "completed",
              });
              currentActivityIds.delete(toolId);
            }

            // Update tool run
            const runId = toolRunIds.get(toolId);
            if (runId) {
              updateToolRun(runId, {
                status: isError ? "failed" : "succeeded",
                completedAt: Date.now(),
                progress: 100,
                output: result?.substring(0, 10000) || null, // Limit output size
                error: isError ? result : null,
              });
            }

            // Handle specific tools for extra features
            if (input) {
              const filePath = input.file_path as string | undefined;

              // Create artifact for Write tool
              if (filePath && !isError && input.content) {
                const filename = getFilename(filePath);
                addArtifact({
                  sessionId: session.sessionId || "default",
                  filename,
                  title: filename,
                  content: input.content as string,
                  kind: getArtifactKind(filename),
                  mimeType: getMimeType(filename),
                  language: getLanguage(filename),
                  folderPath: getFolderPath(filePath),
                  tags: ["auto-created"],
                  agentContext: {
                    intent: "write",
                    confidence: 1.0,
                  },
                });
              }

              // Create/update artifact for Edit tool
              if (filePath && !isError && input.new_string) {
                const filename = getFilename(filePath);
                // For edits, we track the change
                addArtifact({
                  sessionId: session.sessionId || "default",
                  filename,
                  title: `Edit: ${filename}`,
                  content: `Old:\n${input.old_string}\n\nNew:\n${input.new_string}`,
                  kind: "code",
                  mimeType: "text/plain",
                  language: getLanguage(filename),
                  folderPath: getFolderPath(filePath),
                  tags: ["edit", "auto-created"],
                  agentContext: {
                    intent: "edit",
                    confidence: 1.0,
                  },
                });
              }

              // Set document for Read results
              if (filePath && !isError && result && !input.content && !input.new_string) {
                // This was likely a Read operation
                const filename = getFilename(filePath);
                const ext = filename.split(".").pop()?.toLowerCase() || "text";
                const langMap: Record<
                  string,
                  "markdown" | "typescript" | "javascript" | "json" | "python" | "text"
                > = {
                  md: "markdown",
                  ts: "typescript",
                  tsx: "typescript",
                  js: "javascript",
                  jsx: "javascript",
                  json: "json",
                  py: "python",
                };
                setDocument({
                  id: toolId,
                  filename,
                  content: result.substring(0, 50000), // Limit content size
                  language: langMap[ext] || "text",
                });
              }
            }

            toolInputs.delete(toolId);
            break;
          }

          case "thinking":
            setSession({ isThinking: true });
            setAgent({
              currentActivity: "Thinking",
              isThinking: true,
            });
            break;

          case "message":
            // Handle text messages - could add to a message stream
            break;

          case "result": {
            const success = event.data.success as boolean;
            const duration = event.data.duration as number;
            const cost = (event.data.cost as number) || 0;
            const turns = (event.data.turns as number) || 0;

            // Update task to completed
            updateTask(taskId, {
              status: success ? "completed" : "pending",
              statusText: success ? undefined : "Failed",
              duration: `${(duration / 1000).toFixed(1)}s`,
            });

            // Update session totals
            setSession({
              totalCost: session.totalCost + cost,
              turnCount: session.turnCount + turns,
            });

            // Add cost entry with breakdown
            // Estimate token breakdown based on cost (approximate rates)
            // Claude Sonnet: $3/MTok input, $15/MTok output
            // Rough estimate: 70% of cost is output, 30% is input
            const outputCost = cost * 0.7;
            const inputCost = cost * 0.3;
            const estimatedInputTokens = Math.round(inputCost / 0.000003);
            const estimatedOutputTokens = Math.round(outputCost / 0.000015);

            addCostEntry({
              turnId: taskId,
              model: settings.model || "claude-sonnet-4-20250514",
              toolNames: [...new Set(toolNamesUsed)],
              inputTokens: estimatedInputTokens,
              outputTokens: estimatedOutputTokens,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              cost: {
                input: inputCost,
                output: outputCost,
                cacheRead: 0,
                cacheWrite: 0,
                total: cost,
              },
            });

            addActivity({
              type: success ? "success" : "error",
              title: success ? "Task completed" : "Task failed",
              description: event.data.result as string,
              timestamp: new Date(event.timestamp),
              status: "completed",
            });
            break;
          }

          case "error":
            addActivity({
              type: "error",
              title: "Error",
              description: event.data.message as string,
              timestamp: new Date(event.timestamp),
              status: "error",
            });
            break;

          case "status": {
            // Add status text after the most recent activity
            const text = event.data.text as string;
            if (text) {
              // Get the most recent activity ID
              const recentActivityId = [...currentActivityIds.values()].pop();
              if (recentActivityId) {
                addStatusText(recentActivityId, text.substring(0, 200));
              }
            }
            break;
          }
        }
      }
    },
    [
      settings,
      session,
      setSession,
      addActivity,
      updateActivity,
      addStatusText,
      addTask,
      updateTask,
      setAgent,
      addToolRun,
      updateToolRun,
      addArtifact,
      setDocument,
      addCostEntry,
    ]
  );

  const stopAgent = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSession({ isRunning: false, isThinking: false });
    setAgent({ isThinking: false });
  }, [setSession, setAgent]);

  const clearSession = useCallback(() => {
    stopAgent();
    resetSession();
  }, [stopAgent, resetSession]);

  return {
    runAgent,
    stopAgent,
    clearSession,
    isRunning: session.isRunning,
    isThinking: session.isThinking,
  };
}
