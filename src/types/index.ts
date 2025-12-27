// Re-export artifact types
export * from "./artifacts";

// Activity Types
export type ActivityType =
  | "command"
  | "github"
  | "file_read"
  | "file_write"
  | "file_create"
  | "thinking"
  | "knowledge"
  | "error"
  | "success";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: Date;
  isExpanded?: boolean;
  children?: ActivityChild[];
  status?: "running" | "completed" | "error";
  duration?: string;
}

export interface ActivityChild {
  id: string;
  type: "knowledge" | "file" | "command" | "info";
  title: string;
  description?: string;
  link?: string;
  isExpanded?: boolean;
}

// Task Types
export type TaskStatus = "completed" | "in_progress" | "pending";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  duration?: string;
  statusText?: string;
}

// Document Types
export interface Document {
  id: string;
  filename: string;
  content: string;
  language: "markdown" | "typescript" | "javascript" | "json" | "python" | "text";
}

// Agent State
export interface AgentState {
  name: string;
  currentActivity: string;
  currentFile?: string;
  isThinking: boolean;
}

// Panel Types
export interface ComputerPanelProps {
  agent: AgentState;
  document: Document | null;
  tasks: Task[];
}

export interface ActivityPanelProps {
  activities: ActivityItem[];
  agentName: string;
}

// Component Props
export interface ActivityItemProps {
  activity: ActivityItem;
  index: number;
  onToggle: (id: string) => void;
}

export interface TaskItemProps {
  task: Task;
  index: number;
}

export interface DocumentViewerProps {
  document: Document;
}

export interface MessageInputProps {
  agentName: string;
  onSend: (message: string) => void;
  disabled?: boolean;
}
