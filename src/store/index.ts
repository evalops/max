import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ActivityItem,
  Task,
  Document,
  AgentState,
  Artifact,
  ToolRun,
  ToolRunFilterState,
  ToolRunLogEntry,
  SessionCostEntry,
} from "@/types";
import {
  saveArtifact,
  getArtifactsBySession,
  deleteArtifact,
  searchArtifacts,
  generateId,
} from "@/lib/storage";

export type ThemeMode = "light" | "dark" | "system";

interface Settings {
  theme: ThemeMode;
  apiKey: string;
  model: string;
  maxTurns: number;
  maxBudgetUsd: number;
  workingDirectory: string;
  autoScroll: boolean;
  showTimestamps: boolean;
  compactMode: boolean;
}

interface AgentSession {
  sessionId: string | null;
  isRunning: boolean;
  isThinking: boolean;
  currentTask: string | null;
  startTime: number | null;
  totalCost: number;
  turnCount: number;
}

interface AppState {
  // Settings
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;

  // Agent State
  agent: AgentState;
  setAgent: (agent: Partial<AgentState>) => void;

  // Session
  session: AgentSession;
  setSession: (session: Partial<AgentSession>) => void;
  resetSession: () => void;

  // Activities
  activities: ActivityItem[];
  addActivity: (activity: Omit<ActivityItem, "id">) => void;
  updateActivity: (id: string, updates: Partial<ActivityItem>) => void;
  clearActivities: () => void;

  // Status texts
  statusTexts: { afterId: string; text: string }[];
  addStatusText: (afterId: string, text: string) => void;
  clearStatusTexts: () => void;

  // Tasks
  tasks: Task[];
  addTask: (task: Omit<Task, "id">) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  clearTasks: () => void;

  // Document
  document: Document | null;
  setDocument: (doc: Document | null) => void;

  // Artifacts (Conductor-style)
  artifacts: Artifact[];
  loadArtifacts: () => void;
  addArtifact: (artifact: Omit<Artifact, "id" | "createdAt" | "updatedAt">) => Artifact;
  updateArtifact: (id: string, updates: Partial<Artifact>) => void;
  removeArtifact: (id: string) => void;
  searchArtifacts: (query: string) => Artifact[];

  // Tool Runs (Conductor-style)
  toolRuns: ToolRun[];
  toolRunFilter: ToolRunFilterState;
  addToolRun: (run: Omit<ToolRun, "id" | "createdAt" | "logs">) => string;
  updateToolRun: (id: string, updates: Partial<ToolRun>) => void;
  logToolRun: (id: string, entry: Omit<ToolRunLogEntry, "id" | "timestamp">) => void;
  setToolRunFilter: (filter: Partial<ToolRunFilterState>) => void;
  getFilteredToolRuns: () => ToolRun[];
  clearToolRuns: () => void;

  // Cost tracking
  costTimeline: SessionCostEntry[];
  addCostEntry: (entry: Omit<SessionCostEntry, "id" | "createdAt">) => void;
  getTotalCost: () => number;
  clearCostTimeline: () => void;

  // Data helpers
  clearAllData: () => void;
}

const defaultAgent: AgentState = {
  name: "Max",
  currentActivity: "Idle",
  isThinking: false,
};

const defaultSettings: Settings = {
  theme: "light",
  apiKey: "",
  model: "claude-sonnet-4-20250514",
  maxTurns: 50,
  maxBudgetUsd: 10,
  workingDirectory: typeof window !== "undefined" ? "/" : process.cwd?.() || "/",
  autoScroll: true,
  showTimestamps: true,
  compactMode: false,
};

const defaultSession: AgentSession = {
  sessionId: null,
  isRunning: false,
  isThinking: false,
  currentTask: null,
  startTime: null,
  totalCost: 0,
  turnCount: 0,
};

const defaultToolRunFilter: ToolRunFilterState = {
  query: "",
  status: "all",
};

const MAX_TOOL_RUNS = 100;
const MAX_COST_ENTRIES = 200;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Settings
      settings: defaultSettings,
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Agent State
      agent: defaultAgent,
      setAgent: (agentUpdates) =>
        set((state) => ({
          agent: { ...state.agent, ...agentUpdates },
        })),

      // Session
      session: defaultSession,
      setSession: (sessionUpdates) =>
        set((state) => ({
          session: { ...state.session, ...sessionUpdates },
        })),
      resetSession: () => set({ session: defaultSession }),

      // Activities
      activities: [],
      addActivity: (activity) =>
        set((state) => ({
          activities: [{ ...activity, id: generateId() }, ...state.activities],
        })),
      updateActivity: (id, updates) =>
        set((state) => ({
          activities: state.activities.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        })),
      clearActivities: () => set({ activities: [] }),

      // Status texts
      statusTexts: [],
      addStatusText: (afterId, text) =>
        set((state) => ({
          statusTexts: [...state.statusTexts, { afterId, text }],
        })),
      clearStatusTexts: () => set({ statusTexts: [] }),

      // Tasks
      tasks: [],
      addTask: (task) =>
        set((state) => ({
          tasks: [...state.tasks, { ...task, id: generateId() }],
        })),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),
      clearTasks: () => set({ tasks: [] }),

      // Document
      document: null,
      setDocument: (doc) => set({ document: doc }),

      // Artifacts
      artifacts: [],
      loadArtifacts: () => {
        const { session } = get();
        if (session.sessionId) {
          const artifacts = getArtifactsBySession(session.sessionId);
          set({ artifacts });
        }
      },
      addArtifact: (artifactData) => {
        const { session } = get();
        const artifact: Artifact = {
          ...artifactData,
          id: generateId(),
          sessionId: session.sessionId || generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const saved = saveArtifact(artifact);
        set((state) => ({
          artifacts: [...state.artifacts, saved],
        }));
        return saved;
      },
      updateArtifact: (id, updates) => {
        const { artifacts } = get();
        const existing = artifacts.find((a) => a.id === id);
        if (existing) {
          const updated = saveArtifact({ ...existing, ...updates });
          set((state) => ({
            artifacts: state.artifacts.map((a) => (a.id === id ? updated : a)),
          }));
        }
      },
      removeArtifact: (id) => {
        deleteArtifact(id);
        set((state) => ({
          artifacts: state.artifacts.filter((a) => a.id !== id),
        }));
      },
      searchArtifacts: (query) => {
        const { session } = get();
        return searchArtifacts(query, session.sessionId || undefined);
      },

      // Tool Runs
      toolRuns: [],
      toolRunFilter: defaultToolRunFilter,
      addToolRun: (run) => {
        const id = generateId();
        const newRun: ToolRun = {
          ...run,
          id,
          createdAt: Date.now(),
          logs: [],
        };
        set((state) => {
          const runs = [newRun, ...state.toolRuns].slice(0, MAX_TOOL_RUNS);
          return { toolRuns: runs };
        });
        return id;
      },
      updateToolRun: (id, updates) =>
        set((state) => ({
          toolRuns: state.toolRuns.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
      logToolRun: (id, entry) =>
        set((state) => ({
          toolRuns: state.toolRuns.map((r) =>
            r.id === id
              ? {
                  ...r,
                  logs: [
                    ...r.logs,
                    { ...entry, id: generateId(), timestamp: Date.now() },
                  ],
                }
              : r
          ),
        })),
      setToolRunFilter: (filter) =>
        set((state) => ({
          toolRunFilter: { ...state.toolRunFilter, ...filter },
        })),
      getFilteredToolRuns: () => {
        const { toolRuns, toolRunFilter } = get();
        let filtered = toolRuns;

        // Filter by status
        if (toolRunFilter.status !== "all") {
          switch (toolRunFilter.status) {
            case "active":
              filtered = filtered.filter((r) => r.status === "running");
              break;
            case "pending":
              filtered = filtered.filter((r) => r.status === "pending");
              break;
            case "completed":
              filtered = filtered.filter((r) => r.status === "succeeded");
              break;
            case "errors":
              filtered = filtered.filter(
                (r) => r.status === "failed" || r.status === "cancelled"
              );
              break;
          }
        }

        // Filter by query
        if (toolRunFilter.query.trim()) {
          const q = toolRunFilter.query.toLowerCase();
          filtered = filtered.filter(
            (r) =>
              r.name.toLowerCase().includes(q) ||
              r.label.toLowerCase().includes(q) ||
              r.output?.toLowerCase().includes(q) ||
              r.error?.toLowerCase().includes(q)
          );
        }

        return filtered;
      },
      clearToolRuns: () => set({ toolRuns: [] }),

      // Cost tracking
      costTimeline: [],
      addCostEntry: (entry) =>
        set((state) => {
          const newEntry: SessionCostEntry = {
            ...entry,
            id: generateId(),
            createdAt: new Date().toISOString(),
          };
          const timeline = [...state.costTimeline, newEntry].slice(-MAX_COST_ENTRIES);
          return { costTimeline: timeline };
        }),
      getTotalCost: () => {
        const { costTimeline } = get();
        return costTimeline.reduce((sum, e) => sum + e.cost.total, 0);
      },
      clearCostTimeline: () => set({ costTimeline: [] }),

      // Data helpers
      clearAllData: () =>
        set({
          activities: [],
          statusTexts: [],
          tasks: [],
          document: null,
          session: defaultSession,
          toolRuns: [],
          costTimeline: [],
          artifacts: [],
        }),
    }),
    {
      name: "max-agent-storage",
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);
