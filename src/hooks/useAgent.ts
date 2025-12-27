"use client";

import { useCallback, useRef } from "react";
import { useAppStore } from "@/store";
import type { AgentEvent, AgentRequest } from "@/app/api/agent/route";
import type { ActivityType } from "@/types";

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
};

export function useAgent() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    settings,
    session,
    setSession,
    resetSession,
    addActivity,
    updateActivity,
    addTask,
    updateTask,
    setAgent,
  } = useAppStore();

  const runAgent = useCallback(
    async (prompt: string) => {
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

      try {
        const request: AgentRequest = {
          prompt,
          apiKey: settings.apiKey,
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

            setAgent({
              currentActivity: title,
              currentFile: (input.file_path as string) || undefined,
              isThinking: false,
            });
            break;
          }

          case "tool_end": {
            const toolId = event.data.toolId as string;
            const activityId = currentActivityIds.get(toolId);
            if (activityId) {
              updateActivity(activityId, {
                status: event.data.isError ? "error" : "completed",
              });
              currentActivityIds.delete(toolId);
            }
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
            // Handle text messages - could add to status texts
            break;

          case "result":
            // Update task to completed
            updateTask(taskId, {
              status: event.data.success ? "completed" : "pending",
              statusText: event.data.success ? undefined : "Failed",
              duration: `${((event.data.duration as number) / 1000).toFixed(1)}s`,
            });

            setSession({
              totalCost: session.totalCost + (event.data.cost as number || 0),
              turnCount: session.turnCount + (event.data.turns as number || 0),
            });

            addActivity({
              type: event.data.success ? "success" : "error",
              title: event.data.success ? "Task completed" : "Task failed",
              description: event.data.result as string,
              timestamp: new Date(event.timestamp),
              status: "completed",
            });
            break;

          case "error":
            addActivity({
              type: "error",
              title: "Error",
              description: event.data.message as string,
              timestamp: new Date(event.timestamp),
              status: "error",
            });
            break;

          case "status":
            // Handle status updates
            break;
        }
      }
    },
    [
      settings,
      session,
      setSession,
      addActivity,
      updateActivity,
      addTask,
      updateTask,
      setAgent,
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
