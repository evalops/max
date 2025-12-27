/**
 * Tests for Zod validation schemas
 */
import { describe, it, expect } from "vitest";
import {
  IdSchema,
  ISODateSchema,
  ArtifactKindSchema,
  ArtifactInputSchema,
  TaskStatusSchema,
  TaskSchema,
  MessageSchema,
  ApiErrorSchema,
  validate,
  validateOrThrow,
  validateWithDefault,
} from "./index";

describe("IdSchema", () => {
  it("should accept valid IDs", () => {
    expect(IdSchema.safeParse("abc123").success).toBe(true);
    expect(IdSchema.safeParse("a").success).toBe(true);
    expect(IdSchema.safeParse("x".repeat(100)).success).toBe(true);
  });

  it("should reject empty strings", () => {
    expect(IdSchema.safeParse("").success).toBe(false);
  });

  it("should reject strings over 100 chars", () => {
    expect(IdSchema.safeParse("x".repeat(101)).success).toBe(false);
  });
});

describe("ISODateSchema", () => {
  it("should accept valid ISO date strings", () => {
    expect(ISODateSchema.safeParse("2024-01-15T12:00:00Z").success).toBe(true);
    expect(ISODateSchema.safeParse("2024-01-15T12:00:00.000Z").success).toBe(true);
    expect(ISODateSchema.safeParse("2024-01-15T12:00:00+05:30").success).toBe(true);
  });

  it("should reject invalid date strings", () => {
    expect(ISODateSchema.safeParse("not-a-date").success).toBe(false);
    expect(ISODateSchema.safeParse("2024-13-45").success).toBe(false);
  });
});

describe("ArtifactKindSchema", () => {
  it("should accept valid kinds", () => {
    const validKinds = [
      "code",
      "markdown",
      "image",
      "data",
      "notebook",
      "chart",
      "table",
      "diagram",
    ];
    for (const kind of validKinds) {
      expect(ArtifactKindSchema.safeParse(kind).success).toBe(true);
    }
  });

  it("should reject invalid kinds", () => {
    expect(ArtifactKindSchema.safeParse("invalid").success).toBe(false);
    expect(ArtifactKindSchema.safeParse("").success).toBe(false);
  });
});

describe("ArtifactInputSchema", () => {
  const validArtifact = {
    sessionId: "session-1",
    filename: "test.ts",
    title: "Test File",
    content: "console.log('test')",
    kind: "code",
    mimeType: "text/typescript",
  };

  it("should accept valid artifact input", () => {
    expect(ArtifactInputSchema.safeParse(validArtifact).success).toBe(true);
  });

  it("should accept optional fields", () => {
    const withOptional = {
      ...validArtifact,
      id: "artifact-1",
      language: "typescript",
      tags: ["test", "demo"],
    };
    expect(ArtifactInputSchema.safeParse(withOptional).success).toBe(true);
  });

  it("should trim filename and title", () => {
    const result = ArtifactInputSchema.safeParse({
      ...validArtifact,
      filename: "  test.ts  ",
      title: "  Test  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.filename).toBe("test.ts");
      expect(result.data.title).toBe("Test");
    }
  });

  it("should reject empty filename", () => {
    expect(
      ArtifactInputSchema.safeParse({
        ...validArtifact,
        filename: "",
      }).success
    ).toBe(false);
  });

  it("should reject content over 5MB", () => {
    expect(
      ArtifactInputSchema.safeParse({
        ...validArtifact,
        content: "x".repeat(6 * 1024 * 1024),
      }).success
    ).toBe(false);
  });

  it("should reject invalid tags", () => {
    expect(
      ArtifactInputSchema.safeParse({
        ...validArtifact,
        tags: ["valid", "invalid tag with spaces"],
      }).success
    ).toBe(false);
  });
});

describe("TaskStatusSchema", () => {
  it("should accept valid statuses", () => {
    const validStatuses = ["pending", "in_progress", "completed", "failed"];
    for (const status of validStatuses) {
      expect(TaskStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("should reject invalid statuses", () => {
    expect(TaskStatusSchema.safeParse("unknown").success).toBe(false);
  });
});

describe("TaskSchema", () => {
  const validTask = {
    id: "task-1",
    title: "Complete feature",
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  it("should accept valid task", () => {
    expect(TaskSchema.safeParse(validTask).success).toBe(true);
  });

  it("should accept task with optional fields", () => {
    const fullTask = {
      ...validTask,
      description: "Complete the feature implementation",
      progress: 50,
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    expect(TaskSchema.safeParse(fullTask).success).toBe(true);
  });

  it("should reject progress outside 0-100", () => {
    expect(
      TaskSchema.safeParse({
        ...validTask,
        progress: 150,
      }).success
    ).toBe(false);
    expect(
      TaskSchema.safeParse({
        ...validTask,
        progress: -10,
      }).success
    ).toBe(false);
  });
});

describe("MessageSchema", () => {
  const validMessage = {
    id: "msg-1",
    role: "user",
    content: "Hello",
    timestamp: new Date().toISOString(),
  };

  it("should accept valid message", () => {
    expect(MessageSchema.safeParse(validMessage).success).toBe(true);
  });

  it("should accept all valid roles", () => {
    for (const role of ["user", "assistant", "system"]) {
      expect(
        MessageSchema.safeParse({
          ...validMessage,
          role,
        }).success
      ).toBe(true);
    }
  });

  it("should reject empty content", () => {
    expect(
      MessageSchema.safeParse({
        ...validMessage,
        content: "",
      }).success
    ).toBe(false);
  });
});

describe("ApiErrorSchema", () => {
  it("should accept valid error", () => {
    const error = {
      error: "ValidationError",
      message: "Invalid input",
    };
    expect(ApiErrorSchema.safeParse(error).success).toBe(true);
  });

  it("should accept error with optional fields", () => {
    const error = {
      error: "ValidationError",
      message: "Invalid input",
      code: "ERR_001",
      details: { field: "email", reason: "Invalid format" },
    };
    expect(ApiErrorSchema.safeParse(error).success).toBe(true);
  });
});

describe("validate helper", () => {
  it("should return success with data for valid input", () => {
    const result = validate(IdSchema, "valid-id");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("valid-id");
    }
  });

  it("should return failure with errors for invalid input", () => {
    const result = validate(IdSchema, "");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toBeDefined();
    }
  });
});

describe("validateOrThrow helper", () => {
  it("should return data for valid input", () => {
    const result = validateOrThrow(IdSchema, "valid-id");
    expect(result).toBe("valid-id");
  });

  it("should throw for invalid input", () => {
    expect(() => validateOrThrow(IdSchema, "")).toThrow();
  });
});

describe("validateWithDefault helper", () => {
  it("should return data for valid input", () => {
    const result = validateWithDefault(IdSchema, "valid-id", "default");
    expect(result).toBe("valid-id");
  });

  it("should return default for invalid input", () => {
    const result = validateWithDefault(IdSchema, "", "default");
    expect(result).toBe("default");
  });
});
