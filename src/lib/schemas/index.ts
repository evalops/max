/**
 * Zod validation schemas for the application
 */
import { z } from "zod";

// =============================================================================
// Base Schemas
// =============================================================================

/**
 * Schema for a valid ID string
 */
export const IdSchema = z.string().min(1).max(100);

/**
 * Schema for ISO date strings
 */
export const ISODateSchema = z.string().datetime({ offset: true }).or(z.string().datetime());

/**
 * Schema for file paths
 */
export const FilePathSchema = z.string().min(1).max(500);

// =============================================================================
// Artifact Schemas
// =============================================================================

/**
 * Valid artifact kinds
 */
export const ArtifactKindSchema = z.enum([
  "code",
  "markdown",
  "image",
  "data",
  "notebook",
  "chart",
  "table",
  "diagram",
]);

/**
 * Schema for artifact tags
 */
export const TagSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-zA-Z0-9-_]+$/);

/**
 * Schema for creating/updating artifacts
 */
export const ArtifactInputSchema = z.object({
  id: IdSchema.optional(),
  sessionId: IdSchema,
  filename: z.string().min(1).max(255).trim(),
  title: z.string().min(1).max(200).trim(),
  content: z.string().max(5 * 1024 * 1024), // 5MB max
  kind: ArtifactKindSchema,
  mimeType: z.string().min(1).max(100),
  language: z.string().max(50).optional(),
  tags: z.array(TagSchema).max(20).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Full artifact schema including timestamps
 */
export const ArtifactSchema = ArtifactInputSchema.extend({
  id: IdSchema,
  createdAt: ISODateSchema,
  updatedAt: ISODateSchema,
});

// =============================================================================
// Activity Schemas
// =============================================================================

/**
 * Activity types
 */
export const ActivityTypeSchema = z.enum([
  "tool_call",
  "tool_result",
  "message",
  "error",
  "status",
  "knowledge",
  "file_operation",
]);

/**
 * Activity item schema (base without children for type inference)
 */
const ActivityItemBaseSchema = z.object({
  id: IdSchema,
  type: ActivityTypeSchema,
  timestamp: ISODateSchema,
  title: z.string().max(200),
  description: z.string().max(2000).optional(),
  icon: z.string().max(50).optional(),
  status: z.enum(["pending", "running", "success", "error"]).optional(),
  expandable: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Activity item schema with recursive children
 */
export const ActivityItemSchema: z.ZodType<{
  id: string;
  type: string;
  timestamp: string;
  title: string;
  description?: string;
  icon?: string;
  status?: "pending" | "running" | "success" | "error";
  expandable?: boolean;
  children?: Array<z.infer<typeof ActivityItemBaseSchema>>;
  metadata?: Record<string, unknown>;
}> = ActivityItemBaseSchema.extend({
  children: z.array(z.lazy(() => ActivityItemBaseSchema)).optional(),
});

// =============================================================================
// Tool Run Schemas
// =============================================================================

/**
 * Tool status
 */
export const ToolStatusSchema = z.enum(["pending", "running", "success", "error"]);

/**
 * Tool run schema
 */
export const ToolRunSchema = z.object({
  id: IdSchema,
  toolName: z.string().min(1).max(100),
  status: ToolStatusSchema,
  startTime: ISODateSchema,
  endTime: ISODateSchema.optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  duration: z.number().min(0).optional(),
});

// =============================================================================
// Message Schemas
// =============================================================================

/**
 * Message role
 */
export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);

/**
 * Chat message schema
 */
export const MessageSchema = z.object({
  id: IdSchema,
  role: MessageRoleSchema,
  content: z.string().min(1).max(100000),
  timestamp: ISODateSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// Task Schemas
// =============================================================================

/**
 * Task status
 */
export const TaskStatusSchema = z.enum(["pending", "in_progress", "completed", "failed"]);

/**
 * Task schema
 */
export const TaskSchema = z.object({
  id: IdSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatusSchema,
  progress: z.number().min(0).max(100).optional(),
  createdAt: ISODateSchema,
  updatedAt: ISODateSchema.optional(),
  completedAt: ISODateSchema.optional(),
});

// =============================================================================
// GitHub Schemas
// =============================================================================

/**
 * GitHub repository schema
 */
export const GitHubRepoSchema = z.object({
  owner: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  fullName: z.string(),
  description: z.string().max(1000).optional(),
  url: z.string().url(),
  defaultBranch: z.string().default("main"),
  private: z.boolean().default(false),
  stars: z.number().min(0).optional(),
  forks: z.number().min(0).optional(),
});

/**
 * GitHub file schema
 */
export const GitHubFileSchema = z.object({
  path: FilePathSchema,
  name: z.string(),
  sha: z.string(),
  size: z.number().min(0),
  type: z.enum(["file", "dir", "symlink", "submodule"]),
  content: z.string().optional(),
  encoding: z.string().optional(),
});

// =============================================================================
// Research Schemas
// =============================================================================

/**
 * ArXiv paper schema
 */
export const ArxivPaperSchema = z.object({
  id: z.string(),
  title: z.string(),
  abstract: z.string(),
  authors: z.array(z.string()),
  categories: z.array(z.string()),
  published: ISODateSchema,
  updated: ISODateSchema.optional(),
  pdfUrl: z.string().url().optional(),
  doi: z.string().optional(),
});

/**
 * Semantic Scholar paper schema
 */
export const SemanticScholarPaperSchema = z.object({
  paperId: z.string(),
  title: z.string(),
  abstract: z.string().optional(),
  authors: z.array(
    z.object({
      authorId: z.string().optional(),
      name: z.string(),
    })
  ),
  year: z.number().optional(),
  citationCount: z.number().optional(),
  venue: z.string().optional(),
  url: z.string().url().optional(),
});

// =============================================================================
// API Schemas
// =============================================================================

/**
 * API error response schema
 */
export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  code: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Paginated response schema
 */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().min(0),
    page: z.number().min(1),
    pageSize: z.number().min(1).max(100),
    hasMore: z.boolean(),
  });

// =============================================================================
// Type Exports
// =============================================================================

export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;
export type ArtifactInput = z.infer<typeof ArtifactInputSchema>;
export type Artifact = z.infer<typeof ArtifactSchema>;
export type ActivityType = z.infer<typeof ActivityTypeSchema>;
export type ActivityItem = z.infer<typeof ActivityItemSchema>;
export type ToolStatus = z.infer<typeof ToolStatusSchema>;
export type ToolRun = z.infer<typeof ToolRunSchema>;
export type MessageRole = z.infer<typeof MessageRoleSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;
export type GitHubFile = z.infer<typeof GitHubFileSchema>;
export type ArxivPaper = z.infer<typeof ArxivPaperSchema>;
export type SemanticScholarPaper = z.infer<typeof SemanticScholarPaperSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validates data against a schema and returns typed result
 */
export function validate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validates and throws on error
 */
export function validateOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}

/**
 * Validates with default value on error
 */
export function validateWithDefault<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  defaultValue: z.infer<T>
): z.infer<T> {
  const result = schema.safeParse(data);
  return result.success ? result.data : defaultValue;
}
