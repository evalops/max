"use client";

import { useState, useCallback } from "react";
import type { AgentState, ActivityItem, Task, Document } from "@/types";

interface UseAgentStateReturn {
  agent: AgentState;
  activities: ActivityItem[];
  tasks: Task[];
  document: Document | null;
  addActivity: (activity: Omit<ActivityItem, "id">) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  setDocument: (doc: Document | null) => void;
  setAgentActivity: (activity: string, file?: string) => void;
}

export function useAgentState(
  initialAgent: AgentState,
  initialActivities: ActivityItem[] = [],
  initialTasks: Task[] = [],
  initialDocument: Document | null = null
): UseAgentStateReturn {
  const [agent, setAgent] = useState<AgentState>(initialAgent);
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [document, setDocument] = useState<Document | null>(initialDocument);

  const addActivity = useCallback((activity: Omit<ActivityItem, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setActivities((prev) => [{ ...activity, id }, ...prev]);
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)));
  }, []);

  const setAgentActivity = useCallback((activity: string, file?: string) => {
    setAgent((prev) => ({
      ...prev,
      currentActivity: activity,
      currentFile: file,
      isThinking: activity.toLowerCase().includes("thinking"),
    }));
  }, []);

  return {
    agent,
    activities,
    tasks,
    document,
    addActivity,
    updateTask,
    setDocument,
    setAgentActivity,
  };
}
