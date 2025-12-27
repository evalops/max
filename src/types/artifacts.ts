// Artifact types following Conductor patterns

export type ArtifactKind = "text" | "markdown" | "html" | "code" | "json" | "image";

export interface ArtifactAgentContext {
  persona?: string;
  intent?: string;
  confidence?: number;
  reasoning?: string;
}

export interface ArtifactValueAssessment {
  impact?: "low" | "medium" | "high";
  novelty?: "derivative" | "incremental" | "novel";
  effort?: "trivial" | "moderate" | "significant";
  risk?: "safe" | "caution" | "risky";
}

export interface ArtifactRelationship {
  artifactId: string;
  type: "depends_on" | "extends" | "replaces" | "related";
  description?: string;
}

export interface Artifact {
  id: string;
  sessionId: string;
  filename: string;
  title: string;
  content: string;
  kind: ArtifactKind;
  mimeType: string;
  language?: string; // For code artifacts
  createdAt: string;
  updatedAt: string;
  folderPath?: string;
  tags?: string[];
  agentContext?: ArtifactAgentContext;
  valueAssessment?: ArtifactValueAssessment;
  relatedArtifacts?: ArtifactRelationship[];
}

export interface ArtifactRevision {
  id: string;
  artifactId: string;
  sessionId: string;
  filename: string;
  content: string;
  createdAt: string;
  source: "create" | "update" | "restore";
}

// Tool run types following Conductor patterns
export type ToolRunStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export interface ToolRunLogEntry {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error";
  message: string;
}

export interface ToolRun {
  id: string;
  toolCallId: string | null;
  name: string;
  label: string;
  status: ToolRunStatus;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  progress: number | null; // 0-100
  args: Record<string, unknown> | null;
  output: string | null;
  error: string | null;
  logs: ToolRunLogEntry[];
}

// Filter state
export interface ToolRunFilterState {
  query: string;
  status: "all" | "active" | "pending" | "completed" | "errors";
}

// Session cost tracking
export interface SessionCostEntry {
  id: string;
  createdAt: string;
  turnId?: string;
  model: string;
  toolNames: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}
