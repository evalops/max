"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ActivityPanel } from "@/components/activity";
import { ComputerPanel } from "@/components/panels";
import { MessageInput } from "@/components/input";
import { SettingsPanel } from "@/components/settings";
import { SidePanel } from "./SidePanel";
import { useAppStore } from "@/store";
import { useAgent } from "@/hooks";
import type { ActivityType, ToolRunStatus } from "@/types";

// Simulated mock responses for demo mode
interface MockToolRun {
  name: string;
  label: string;
  args?: Record<string, unknown>;
  output?: string;
  status: ToolRunStatus;
}

interface MockResponse {
  activities: { type: ActivityType; title: string; description?: string }[];
  toolRuns: MockToolRun[];
  statusText: string;
  duration: number;
  tokens: { input: number; output: number };
}

const mockResponses: MockResponse[] = [
  {
    activities: [
      { type: "file_read", title: "Reading file", description: "src/components/App.tsx" },
      { type: "thinking", title: "Analyzing code structure" },
      { type: "file_write", title: "Editing file", description: "src/components/App.tsx" },
    ],
    toolRuns: [
      { name: "Read", label: "Read src/components/App.tsx", args: { file: "src/components/App.tsx" }, output: "export function App() { ... }", status: "succeeded" },
      { name: "Edit", label: "Edit src/components/App.tsx", args: { file: "src/components/App.tsx", changes: "Improved structure" }, output: "File updated successfully", status: "succeeded" },
    ],
    statusText: "I've analyzed the code and made some improvements to the component structure.",
    duration: 3000,
    tokens: { input: 2450, output: 890 },
  },
  {
    activities: [
      { type: "command", title: "Executing command", description: "npm run test" },
      { type: "file_read", title: "Reading file", description: "src/__tests__/utils.test.ts" },
      { type: "success", title: "Tests passed", description: "All 12 tests passed" },
    ],
    toolRuns: [
      { name: "Bash", label: "Run npm run test", args: { command: "npm run test" }, output: "All 12 tests passed", status: "succeeded" },
      { name: "Read", label: "Read test file", args: { file: "src/__tests__/utils.test.ts" }, output: "describe('utils', () => { ... })", status: "succeeded" },
    ],
    statusText: "I ran the test suite and all tests are passing.",
    duration: 4000,
    tokens: { input: 3200, output: 450 },
  },
  {
    activities: [
      { type: "github", title: "Searching GitHub", description: "Looking for similar implementations" },
      { type: "thinking", title: "Comparing approaches" },
      { type: "file_create", title: "Creating file", description: "src/utils/helpers.ts" },
    ],
    toolRuns: [
      { name: "WebSearch", label: "Search GitHub for implementations", args: { query: "react helper functions best practices" }, output: "Found 15 relevant results", status: "succeeded" },
      { name: "Write", label: "Create src/utils/helpers.ts", args: { file: "src/utils/helpers.ts", content: "export function..." }, output: "File created", status: "succeeded" },
    ],
    statusText: "I've created a new utility file with optimized helper functions.",
    duration: 3500,
    tokens: { input: 4100, output: 1200 },
  },
];

export function AgentDashboard() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const mockResponseIndex = useRef(0);

  const {
    settings,
    agent,
    activities,
    statusTexts,
    tasks,
    document,
    loadMockData,
    addActivity,
    addStatusText,
    addTask,
    updateTask,
    setAgent,
    clearActivities,
    clearStatusTexts,
    clearTasks,
    addToolRun,
    updateToolRun,
    addCostEntry,
  } = useAppStore();

  const { runAgent, stopAgent, isRunning } = useAgent();

  // Load mock data on first render if in mock mode
  useEffect(() => {
    if (settings.dataMode === "mock" && activities.length === 0) {
      loadMockData();
    }
  }, [settings.dataMode, activities.length, loadMockData]);

  // Simulate mock mode response
  const simulateMockResponse = useCallback(
    async (message: string) => {
      // Clear previous data for fresh start
      clearActivities();
      clearStatusTexts();
      clearTasks();

      // Add a task for this request
      const taskId = Math.random().toString(36).substring(2, 9);
      addTask({
        title: message.length > 50 ? message.substring(0, 50) + "..." : message,
        status: "in_progress",
        statusText: "Processing",
      });

      // Set thinking state
      setAgent({
        currentActivity: "Thinking",
        isThinking: true,
      });

      // Get mock response (cycle through)
      const response = mockResponses[mockResponseIndex.current % mockResponses.length];
      mockResponseIndex.current++;

      // Track tool run IDs for updates
      const toolRunIds: string[] = [];

      // Add tool runs first (pending state)
      for (const toolRun of response.toolRuns) {
        const id = addToolRun({
          toolCallId: null,
          name: toolRun.name,
          label: toolRun.label,
          status: "pending",
          startedAt: null,
          completedAt: null,
          progress: null,
          args: toolRun.args || null,
          output: null,
          error: null,
        });
        toolRunIds.push(id);
      }

      // Simulate activities with delays
      for (let i = 0; i < response.activities.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 800));

        const activity = response.activities[i];
        const activityId = Math.random().toString(36).substring(2, 9);

        addActivity({
          type: activity.type,
          title: activity.title,
          description: activity.description,
          timestamp: new Date(),
          status: i === response.activities.length - 1 ? "completed" : "running",
        });

        setAgent({
          currentActivity: activity.title,
          currentFile: activity.description,
          isThinking: activity.type === "thinking",
        });

        // Update corresponding tool run if exists
        if (toolRunIds[i]) {
          updateToolRun(toolRunIds[i], {
            status: "running",
            startedAt: Date.now(),
            progress: 50,
          });
          await new Promise((resolve) => setTimeout(resolve, 400));
          updateToolRun(toolRunIds[i], {
            status: response.toolRuns[i].status,
            completedAt: Date.now(),
            progress: 100,
            output: response.toolRuns[i].output || null,
          });
        }

        // Add status text after some activities
        if (i === response.activities.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          addStatusText(activityId, response.statusText);
        }
      }

      // Add cost entry for this turn
      addCostEntry({
        model: settings.model || "claude-sonnet-4-20250514",
        toolNames: response.toolRuns.map((t) => t.name),
        inputTokens: response.tokens.input,
        outputTokens: response.tokens.output,
        cacheReadTokens: Math.floor(response.tokens.input * 0.3),
        cacheWriteTokens: Math.floor(response.tokens.input * 0.1),
        cost: {
          input: response.tokens.input * 0.000003,
          output: response.tokens.output * 0.000015,
          cacheRead: response.tokens.input * 0.3 * 0.0000003,
          cacheWrite: response.tokens.input * 0.1 * 0.00000375,
          total:
            response.tokens.input * 0.000003 +
            response.tokens.output * 0.000015 +
            response.tokens.input * 0.3 * 0.0000003 +
            response.tokens.input * 0.1 * 0.00000375,
        },
      });

      // Complete task
      updateTask(taskId, {
        status: "completed",
        statusText: undefined,
        duration: `${(response.duration / 1000).toFixed(1)}s`,
      });

      setAgent({
        currentActivity: "Idle",
        isThinking: false,
      });
    },
    [
      addActivity,
      addStatusText,
      addTask,
      updateTask,
      setAgent,
      clearActivities,
      clearStatusTexts,
      clearTasks,
      addToolRun,
      updateToolRun,
      addCostEntry,
      settings.model,
    ]
  );

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (settings.dataMode === "live") {
        if (!settings.apiKey) {
          setIsSettingsOpen(true);
          return;
        }
        await runAgent(message);
      } else {
        // Mock mode - simulate response
        await simulateMockResponse(message);
      }
    },
    [settings.dataMode, settings.apiKey, runAgent, simulateMockResponse]
  );

  const handleStop = useCallback(() => {
    stopAgent();
    setAgent({ isThinking: false });
  }, [stopAgent, setAgent]);

  return (
    <div className="flex h-screen w-full bg-paper-200">
      {/* Left Panel - Activity Feed */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex min-w-[400px] flex-1 flex-col border-r border-paper-400/50"
      >
        <ActivityPanel
          activities={activities}
          statusTexts={statusTexts}
          agentName={agent.name}
          className="flex-1 overflow-hidden"
          onSettingsClick={() => setIsSettingsOpen(true)}
        />
        <MessageInput
          agentName={agent.name}
          onSend={handleSendMessage}
          onStop={handleStop}
          isProcessing={isRunning || agent.isThinking}
          isLiveMode={settings.dataMode === "live"}
          hasApiKey={!!settings.apiKey}
        />
      </motion.div>

      {/* Center Panel - Computer View */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className={cn(
          "flex w-[400px] shrink-0 flex-col",
          "shadow-[-4px_0_24px_-4px_rgba(0,0,0,0.1)]"
        )}
      >
        <ComputerPanel agent={agent} document={document} tasks={tasks} />
      </motion.div>

      {/* Right Panel - Artifacts/ToolRuns/Cost */}
      <AnimatePresence mode="wait">
        <SidePanel
          isOpen={isSidePanelOpen}
          onToggle={() => setIsSidePanelOpen(!isSidePanelOpen)}
        />
      </AnimatePresence>

      {/* Settings Panel */}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
