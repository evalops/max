/**
 * Tests for Zustand store
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "./index";
import type { ToolRun } from "@/types";

// Mock the storage module
vi.mock("@/lib/storage", () => ({
  saveArtifact: vi.fn((artifact) => artifact),
  getArtifactsBySession: vi.fn(() => []),
  deleteArtifact: vi.fn(() => true),
  searchArtifacts: vi.fn(() => []),
  generateId: vi.fn(() => `id-${Date.now()}-${Math.random()}`),
}));

describe("useAppStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAppStore.setState({
      settings: {
        theme: "light",
        apiKey: "",
        githubToken: "",
        model: "claude-sonnet-4-20250514",
        maxTurns: 50,
        maxBudgetUsd: 10,
        workingDirectory: "/",
        autoScroll: true,
        showTimestamps: true,
        compactMode: false,
        voiceLanguage: "en-US",
      },
      agent: {
        name: "Max",
        currentActivity: "Idle",
        isThinking: false,
      },
      session: {
        sessionId: null,
        isRunning: false,
        isThinking: false,
        currentTask: null,
        startTime: null,
        totalCost: 0,
        turnCount: 0,
      },
      activities: [],
      statusTexts: [],
      tasks: [],
      document: null,
      artifacts: [],
      toolRuns: [],
      toolRunFilter: { query: "", status: "all" },
      costTimeline: [],
      githubContext: {
        currentRepo: null,
        currentBranch: null,
        recentRepos: [],
        autoDetected: false,
      },
    });
  });

  describe("settings", () => {
    it("should have default settings", () => {
      const { settings } = useAppStore.getState();

      expect(settings.theme).toBe("light");
      expect(settings.model).toBe("claude-sonnet-4-20250514");
      expect(settings.maxTurns).toBe(50);
    });

    it("should update settings partially", () => {
      useAppStore.getState().updateSettings({ theme: "dark" });

      const { settings } = useAppStore.getState();
      expect(settings.theme).toBe("dark");
      expect(settings.model).toBe("claude-sonnet-4-20250514"); // Unchanged
    });

    it("should update multiple settings at once", () => {
      useAppStore.getState().updateSettings({
        theme: "dark",
        apiKey: "test-key",
        compactMode: true,
      });

      const { settings } = useAppStore.getState();
      expect(settings.theme).toBe("dark");
      expect(settings.apiKey).toBe("test-key");
      expect(settings.compactMode).toBe(true);
    });
  });

  describe("agent state", () => {
    it("should have default agent state", () => {
      const { agent } = useAppStore.getState();

      expect(agent.name).toBe("Max");
      expect(agent.currentActivity).toBe("Idle");
      expect(agent.isThinking).toBe(false);
    });

    it("should update agent state", () => {
      useAppStore.getState().setAgent({
        currentActivity: "Processing",
        isThinking: true,
      });

      const { agent } = useAppStore.getState();
      expect(agent.currentActivity).toBe("Processing");
      expect(agent.isThinking).toBe(true);
      expect(agent.name).toBe("Max"); // Unchanged
    });
  });

  describe("session", () => {
    it("should have default session state", () => {
      const { session } = useAppStore.getState();

      expect(session.sessionId).toBe(null);
      expect(session.isRunning).toBe(false);
      expect(session.totalCost).toBe(0);
    });

    it("should update session", () => {
      useAppStore.getState().setSession({
        sessionId: "session-123",
        isRunning: true,
        startTime: Date.now(),
      });

      const { session } = useAppStore.getState();
      expect(session.sessionId).toBe("session-123");
      expect(session.isRunning).toBe(true);
      expect(session.startTime).not.toBe(null);
    });

    it("should reset session to defaults", () => {
      useAppStore.getState().setSession({
        sessionId: "session-123",
        isRunning: true,
        totalCost: 5.5,
      });

      useAppStore.getState().resetSession();

      const { session } = useAppStore.getState();
      expect(session.sessionId).toBe(null);
      expect(session.isRunning).toBe(false);
      expect(session.totalCost).toBe(0);
    });
  });

  describe("activities", () => {
    it("should start with empty activities", () => {
      const { activities } = useAppStore.getState();
      expect(activities).toHaveLength(0);
    });

    it("should add activity with generated id", () => {
      useAppStore.getState().addActivity({
        type: "command",
        title: "Running npm install",
        timestamp: new Date(),
        status: "running",
      });

      const { activities } = useAppStore.getState();
      expect(activities).toHaveLength(1);
      expect(activities[0].title).toBe("Running npm install");
      expect(activities[0].id).toBeDefined();
    });

    it("should add activities at the beginning (newest first)", () => {
      useAppStore.getState().addActivity({
        type: "command",
        title: "First",
        timestamp: new Date(),
        status: "completed",
      });

      useAppStore.getState().addActivity({
        type: "github",
        title: "Second",
        timestamp: new Date(),
        status: "running",
      });

      const { activities } = useAppStore.getState();
      expect(activities[0].title).toBe("Second");
      expect(activities[1].title).toBe("First");
    });

    it("should update activity by id", () => {
      useAppStore.getState().addActivity({
        type: "command",
        title: "Task",
        timestamp: new Date(),
        status: "running",
      });

      const { activities } = useAppStore.getState();
      const activityId = activities[0].id;

      useAppStore.getState().updateActivity(activityId, { status: "completed" });

      const updated = useAppStore.getState().activities[0];
      expect(updated.status).toBe("completed");
      expect(updated.title).toBe("Task"); // Unchanged
    });

    it("should clear all activities", () => {
      useAppStore.getState().addActivity({
        type: "command",
        title: "Task 1",
        timestamp: new Date(),
        status: "completed",
      });

      useAppStore.getState().addActivity({
        type: "command",
        title: "Task 2",
        timestamp: new Date(),
        status: "completed",
      });

      useAppStore.getState().clearActivities();

      const { activities } = useAppStore.getState();
      expect(activities).toHaveLength(0);
    });
  });

  describe("status texts", () => {
    it("should start with empty status texts", () => {
      const { statusTexts } = useAppStore.getState();
      expect(statusTexts).toHaveLength(0);
    });

    it("should add status text", () => {
      useAppStore.getState().addStatusText("activity-1", "Processing request...");

      const { statusTexts } = useAppStore.getState();
      expect(statusTexts).toHaveLength(1);
      expect(statusTexts[0].afterId).toBe("activity-1");
      expect(statusTexts[0].text).toBe("Processing request...");
    });

    it("should clear status texts", () => {
      useAppStore.getState().addStatusText("a1", "Text 1");
      useAppStore.getState().addStatusText("a2", "Text 2");

      useAppStore.getState().clearStatusTexts();

      const { statusTexts } = useAppStore.getState();
      expect(statusTexts).toHaveLength(0);
    });
  });

  describe("tasks", () => {
    it("should start with empty tasks", () => {
      const { tasks } = useAppStore.getState();
      expect(tasks).toHaveLength(0);
    });

    it("should add task with generated id", () => {
      useAppStore.getState().addTask({
        title: "Review code",
        status: "pending",
      });

      const { tasks } = useAppStore.getState();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("Review code");
      expect(tasks[0].id).toBeDefined();
    });

    it("should update task by id", () => {
      useAppStore.getState().addTask({
        title: "Review code",
        status: "pending",
      });

      const { tasks } = useAppStore.getState();
      const taskId = tasks[0].id;

      useAppStore.getState().updateTask(taskId, {
        status: "in_progress",
        duration: "2m 30s",
      });

      const updated = useAppStore.getState().tasks[0];
      expect(updated.status).toBe("in_progress");
      expect(updated.duration).toBe("2m 30s");
    });

    it("should clear all tasks", () => {
      useAppStore.getState().addTask({ title: "Task 1", status: "pending" });
      useAppStore.getState().addTask({ title: "Task 2", status: "completed" });

      useAppStore.getState().clearTasks();

      const { tasks } = useAppStore.getState();
      expect(tasks).toHaveLength(0);
    });
  });

  describe("document", () => {
    it("should start with null document", () => {
      const { document } = useAppStore.getState();
      expect(document).toBe(null);
    });

    it("should set document", () => {
      useAppStore.getState().setDocument({
        id: "doc-1",
        filename: "README.md",
        language: "markdown",
        content: "# Hello World",
      });

      const { document } = useAppStore.getState();
      expect(document).not.toBe(null);
      expect(document?.filename).toBe("README.md");
      expect(document?.language).toBe("markdown");
    });

    it("should clear document", () => {
      useAppStore.getState().setDocument({
        id: "doc-1",
        filename: "test.txt",
        language: "text",
        content: "Test",
      });

      useAppStore.getState().setDocument(null);

      const { document } = useAppStore.getState();
      expect(document).toBe(null);
    });
  });

  describe("tool runs", () => {
    it("should start with empty tool runs", () => {
      const { toolRuns } = useAppStore.getState();
      expect(toolRuns).toHaveLength(0);
    });

    it("should add tool run with generated id", () => {
      const id = useAppStore.getState().addToolRun({
        toolCallId: null,
        name: "read_file",
        label: "Reading file.txt",
        status: "running",
        startedAt: Date.now(),
        completedAt: null,
        progress: null,
        args: { path: "file.txt" },
        output: null,
        error: null,
      });

      const { toolRuns } = useAppStore.getState();
      expect(toolRuns).toHaveLength(1);
      expect(toolRuns[0].name).toBe("read_file");
      expect(toolRuns[0].id).toBe(id);
      expect(toolRuns[0].logs).toEqual([]);
    });

    it("should update tool run", () => {
      const id = useAppStore.getState().addToolRun({
        toolCallId: null,
        name: "read_file",
        label: "Reading file.txt",
        status: "running",
        startedAt: Date.now(),
        completedAt: null,
        progress: null,
        args: { path: "file.txt" },
        output: null,
        error: null,
      });

      useAppStore.getState().updateToolRun(id, {
        status: "succeeded",
        output: "File contents here",
      });

      const { toolRuns } = useAppStore.getState();
      expect(toolRuns[0].status).toBe("succeeded");
      expect(toolRuns[0].output).toBe("File contents here");
    });

    it("should log to tool run", () => {
      const id = useAppStore.getState().addToolRun({
        toolCallId: null,
        name: "bash",
        label: "Running command",
        status: "running",
        startedAt: Date.now(),
        completedAt: null,
        progress: null,
        args: { command: "npm test" },
        output: null,
        error: null,
      });

      useAppStore.getState().logToolRun(id, {
        level: "info",
        message: "Tests passed",
      });

      const { toolRuns } = useAppStore.getState();
      expect(toolRuns[0].logs).toHaveLength(1);
      expect(toolRuns[0].logs[0].message).toBe("Tests passed");
      expect(toolRuns[0].logs[0].timestamp).toBeDefined();
    });

    it("should filter tool runs by status", () => {
      useAppStore.getState().addToolRun({
        toolCallId: null,
        name: "tool1",
        label: "Tool 1",
        status: "running",
        startedAt: null,
        completedAt: null,
        progress: null,
        args: {},
        output: null,
        error: null,
      });

      useAppStore.getState().addToolRun({
        toolCallId: null,
        name: "tool2",
        label: "Tool 2",
        status: "succeeded",
        startedAt: null,
        completedAt: null,
        progress: null,
        args: {},
        output: null,
        error: null,
      });

      useAppStore.getState().addToolRun({
        toolCallId: null,
        name: "tool3",
        label: "Tool 3",
        status: "failed",
        startedAt: null,
        completedAt: null,
        progress: null,
        args: {},
        output: null,
        error: null,
      });

      // Filter by active (running)
      useAppStore.getState().setToolRunFilter({ status: "active" });
      let filtered = useAppStore.getState().getFilteredToolRuns();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("tool1");

      // Filter by completed (succeeded)
      useAppStore.getState().setToolRunFilter({ status: "completed" });
      filtered = useAppStore.getState().getFilteredToolRuns();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("tool2");

      // Filter by errors (failed/cancelled)
      useAppStore.getState().setToolRunFilter({ status: "errors" });
      filtered = useAppStore.getState().getFilteredToolRuns();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("tool3");
    });

    it("should filter tool runs by query", () => {
      useAppStore.getState().addToolRun({
        toolCallId: null,
        name: "read_file",
        label: "Reading package.json",
        status: "succeeded",
        startedAt: null,
        completedAt: null,
        progress: null,
        args: {},
        output: null,
        error: null,
      });

      useAppStore.getState().addToolRun({
        toolCallId: null,
        name: "write_file",
        label: "Writing config",
        status: "succeeded",
        startedAt: null,
        completedAt: null,
        progress: null,
        args: {},
        output: null,
        error: null,
      });

      useAppStore.getState().setToolRunFilter({ status: "all", query: "package" });
      const filtered = useAppStore.getState().getFilteredToolRuns();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].label).toBe("Reading package.json");
    });

    it("should limit tool runs to MAX_TOOL_RUNS", () => {
      // Add more than MAX_TOOL_RUNS (100) tool runs
      for (let i = 0; i < 110; i++) {
        useAppStore.getState().addToolRun({
          toolCallId: null,
          name: `tool-${i}`,
          label: `Tool ${i}`,
          status: "succeeded",
          startedAt: null,
          completedAt: null,
          progress: null,
          args: {},
          output: null,
          error: null,
        });
      }

      const { toolRuns } = useAppStore.getState();
      expect(toolRuns.length).toBeLessThanOrEqual(100);
    });

    it("should clear tool runs", () => {
      useAppStore.getState().addToolRun({
        toolCallId: null,
        name: "tool",
        label: "Tool",
        status: "succeeded",
        startedAt: null,
        completedAt: null,
        progress: null,
        args: {},
        output: null,
        error: null,
      });

      useAppStore.getState().clearToolRuns();

      const { toolRuns } = useAppStore.getState();
      expect(toolRuns).toHaveLength(0);
    });
  });

  describe("cost tracking", () => {
    it("should start with empty cost timeline", () => {
      const { costTimeline } = useAppStore.getState();
      expect(costTimeline).toHaveLength(0);
    });

    it("should add cost entry", () => {
      useAppStore.getState().addCostEntry({
        model: "claude-sonnet",
        toolNames: [],
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        cost: {
          input: 0.003,
          output: 0.0075,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0.0105,
        },
      });

      const { costTimeline } = useAppStore.getState();
      expect(costTimeline).toHaveLength(1);
      expect(costTimeline[0].model).toBe("claude-sonnet");
      expect(costTimeline[0].id).toBeDefined();
    });

    it("should calculate total cost", () => {
      useAppStore.getState().addCostEntry({
        model: "claude-sonnet",
        toolNames: [],
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        cost: {
          input: 0.003,
          output: 0.0075,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0.01,
        },
      });

      useAppStore.getState().addCostEntry({
        model: "claude-sonnet",
        toolNames: [],
        inputTokens: 2000,
        outputTokens: 1000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        cost: {
          input: 0.006,
          output: 0.015,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0.02,
        },
      });

      const totalCost = useAppStore.getState().getTotalCost();
      expect(totalCost).toBe(0.03);
    });

    it("should clear cost timeline", () => {
      useAppStore.getState().addCostEntry({
        model: "claude-sonnet",
        toolNames: [],
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        cost: {
          input: 0.003,
          output: 0.0075,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0.01,
        },
      });

      useAppStore.getState().clearCostTimeline();

      const { costTimeline } = useAppStore.getState();
      expect(costTimeline).toHaveLength(0);
    });
  });

  describe("github context", () => {
    it("should have default github context", () => {
      const { githubContext } = useAppStore.getState();

      expect(githubContext.currentRepo).toBe(null);
      expect(githubContext.currentBranch).toBe(null);
      expect(githubContext.recentRepos).toEqual([]);
      expect(githubContext.autoDetected).toBe(false);
    });

    it("should set github context", () => {
      useAppStore.getState().setGitHubContext({
        currentRepo: "owner/repo",
        currentBranch: "main",
      });

      const { githubContext } = useAppStore.getState();
      expect(githubContext.currentRepo).toBe("owner/repo");
      expect(githubContext.currentBranch).toBe("main");
    });

    it("should set current repo and add to recent repos", () => {
      useAppStore.getState().setCurrentRepo("owner/repo1");

      const { githubContext } = useAppStore.getState();
      expect(githubContext.currentRepo).toBe("owner/repo1");
      expect(githubContext.recentRepos).toContain("owner/repo1");
    });

    it("should set autoDetected flag when setting repo", () => {
      useAppStore.getState().setCurrentRepo("owner/repo", true);

      const { githubContext } = useAppStore.getState();
      expect(githubContext.autoDetected).toBe(true);
    });

    it("should add recent repo without duplicates", () => {
      useAppStore.getState().addRecentRepo("owner/repo1");
      useAppStore.getState().addRecentRepo("owner/repo2");
      useAppStore.getState().addRecentRepo("owner/repo1"); // Duplicate

      const { githubContext } = useAppStore.getState();
      expect(githubContext.recentRepos).toHaveLength(2);
      expect(githubContext.recentRepos[0]).toBe("owner/repo1"); // Most recent
    });

    it("should limit recent repos to MAX_RECENT_REPOS", () => {
      for (let i = 0; i < 15; i++) {
        useAppStore.getState().addRecentRepo(`owner/repo${i}`);
      }

      const { githubContext } = useAppStore.getState();
      expect(githubContext.recentRepos.length).toBeLessThanOrEqual(10);
    });

    it("should clear github context", () => {
      useAppStore.getState().setGitHubContext({
        currentRepo: "owner/repo",
        currentBranch: "main",
        autoDetected: true,
      });

      useAppStore.getState().clearGitHubContext();

      const { githubContext } = useAppStore.getState();
      expect(githubContext.currentRepo).toBe(null);
      expect(githubContext.currentBranch).toBe(null);
      expect(githubContext.autoDetected).toBe(false);
    });
  });

  describe("clearAllData", () => {
    it("should clear all data except settings", () => {
      // Set up some data
      useAppStore.getState().addActivity({
        type: "command",
        title: "Test",
        timestamp: new Date(),
        status: "completed",
      });
      useAppStore.getState().addTask({ title: "Task", status: "pending" });
      useAppStore.getState().setSession({ sessionId: "test", isRunning: true });
      useAppStore.getState().updateSettings({ theme: "dark" });

      // Clear all data
      useAppStore.getState().clearAllData();

      const state = useAppStore.getState();
      expect(state.activities).toHaveLength(0);
      expect(state.tasks).toHaveLength(0);
      expect(state.session.sessionId).toBe(null);
      expect(state.settings.theme).toBe("dark"); // Settings preserved
    });
  });
});
