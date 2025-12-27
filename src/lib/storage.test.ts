/**
 * Tests for storage.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

import {
  generateId,
  saveArtifact,
  getArtifacts,
  getArtifact,
  getArtifactsBySession,
  deleteArtifact,
  getRevisions,
  getArtifactRevisions,
  restoreRevision,
  searchArtifacts,
  computeLineDiff,
} from "./storage";
import type { Artifact } from "@/types/artifacts";

describe("storage", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("generateId", () => {
    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it("should generate IDs with expected format", () => {
      const id = generateId();
      expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe("saveArtifact", () => {
    const createTestArtifact = (overrides: Partial<Artifact> = {}): Artifact => ({
      id: "test-1",
      sessionId: "session-1",
      filename: "test.ts",
      title: "Test File",
      content: "console.log('test')",
      kind: "code",
      mimeType: "text/typescript",
      language: "typescript",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    });

    it("should save a new artifact", () => {
      const artifact = createTestArtifact();
      const saved = saveArtifact(artifact);

      expect(saved.id).toBe("test-1");
      expect(saved.filename).toBe("test.ts");
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it("should normalize artifact data", () => {
      const artifact = createTestArtifact({
        filename: "  test.ts  ",
        title: "  Test  ",
        tags: ["  tag1  ", "tag2", "tag1"],
      });

      const saved = saveArtifact(artifact);

      expect(saved.filename).toBe("test.ts");
      expect(saved.title).toBe("Test");
      expect(saved.tags).toEqual(["tag1", "tag2"]);
    });

    it("should throw error for oversized artifacts", () => {
      const artifact = createTestArtifact({
        content: "x".repeat(6 * 1024 * 1024), // 6MB
      });

      expect(() => saveArtifact(artifact)).toThrow("exceeds maximum size");
    });

    it("should update existing artifact", () => {
      const artifact = createTestArtifact();
      saveArtifact(artifact);

      const updated = saveArtifact({
        ...artifact,
        content: "updated content",
      });

      expect(updated.content).toBe("updated content");
      expect(getArtifacts()).toHaveLength(1);
    });

    it("should create revision when updating", () => {
      const artifact = createTestArtifact();
      saveArtifact(artifact);
      saveArtifact({ ...artifact, content: "updated" });

      const revisions = getArtifactRevisions(artifact.id);
      expect(revisions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getArtifacts", () => {
    it("should return empty array when no artifacts", () => {
      expect(getArtifacts()).toEqual([]);
    });

    it("should return all artifacts", () => {
      saveArtifact({
        id: "1",
        sessionId: "s1",
        filename: "a.ts",
        title: "A",
        content: "a",
        kind: "code",
        mimeType: "text/typescript",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      saveArtifact({
        id: "2",
        sessionId: "s1",
        filename: "b.ts",
        title: "B",
        content: "b",
        kind: "code",
        mimeType: "text/typescript",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(getArtifacts()).toHaveLength(2);
    });

    it("should handle corrupted localStorage", () => {
      localStorage.setItem("max_artifacts", "invalid json{");
      expect(getArtifacts()).toEqual([]);
    });
  });

  describe("getArtifact", () => {
    it("should return artifact by ID", () => {
      saveArtifact({
        id: "find-me",
        sessionId: "s1",
        filename: "test.ts",
        title: "Test",
        content: "content",
        kind: "code",
        mimeType: "text/typescript",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const found = getArtifact("find-me");
      expect(found?.id).toBe("find-me");
    });

    it("should return null for non-existent ID", () => {
      expect(getArtifact("non-existent")).toBeNull();
    });
  });

  describe("getArtifactsBySession", () => {
    it("should filter artifacts by session", () => {
      saveArtifact({
        id: "1",
        sessionId: "session-a",
        filename: "a.ts",
        title: "A",
        content: "a",
        kind: "code",
        mimeType: "text/typescript",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      saveArtifact({
        id: "2",
        sessionId: "session-b",
        filename: "b.ts",
        title: "B",
        content: "b",
        kind: "code",
        mimeType: "text/typescript",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      saveArtifact({
        id: "3",
        sessionId: "session-a",
        filename: "c.ts",
        title: "C",
        content: "c",
        kind: "code",
        mimeType: "text/typescript",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const sessionA = getArtifactsBySession("session-a");
      expect(sessionA).toHaveLength(2);
      expect(sessionA.every((a) => a.sessionId === "session-a")).toBe(true);
    });
  });

  describe("deleteArtifact", () => {
    it("should delete artifact by ID", () => {
      saveArtifact({
        id: "to-delete",
        sessionId: "s1",
        filename: "test.ts",
        title: "Test",
        content: "content",
        kind: "code",
        mimeType: "text/typescript",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(deleteArtifact("to-delete")).toBe(true);
      expect(getArtifact("to-delete")).toBeNull();
    });

    it("should return false for non-existent ID", () => {
      expect(deleteArtifact("non-existent")).toBe(false);
    });

    it("should also delete revisions", () => {
      const artifact = {
        id: "with-revisions",
        sessionId: "s1",
        filename: "test.ts",
        title: "Test",
        content: "v1",
        kind: "code" as const,
        mimeType: "text/typescript",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveArtifact(artifact);
      saveArtifact({ ...artifact, content: "v2" });

      deleteArtifact("with-revisions");

      const revisions = getArtifactRevisions("with-revisions");
      expect(revisions).toHaveLength(0);
    });
  });

  describe("revisions", () => {
    it("should track revisions", () => {
      const artifact = {
        id: "rev-test",
        sessionId: "s1",
        filename: "test.ts",
        title: "Test",
        content: "version 1",
        kind: "code" as const,
        mimeType: "text/typescript",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      saveArtifact(artifact);
      saveArtifact({ ...artifact, content: "version 2" });
      saveArtifact({ ...artifact, content: "version 3" });

      const revisions = getArtifactRevisions("rev-test");
      expect(revisions.length).toBeGreaterThanOrEqual(2);
    });

    it("should restore revision", () => {
      const artifact = {
        id: "restore-test",
        sessionId: "s1",
        filename: "test.ts",
        title: "Test",
        content: "original",
        kind: "code" as const,
        mimeType: "text/typescript",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      saveArtifact(artifact);
      saveArtifact({ ...artifact, content: "modified" });

      const revisions = getArtifactRevisions("restore-test");
      const originalRevision = revisions.find((r) => r.content === "original");

      if (originalRevision) {
        const restored = restoreRevision(originalRevision.id);
        expect(restored?.content).toBe("original");
      }
    });

    it("should return null for non-existent revision", () => {
      expect(restoreRevision("non-existent")).toBeNull();
    });

    it("should handle corrupted revisions localStorage", () => {
      localStorage.setItem("max_revisions", "invalid json{");
      expect(getRevisions()).toEqual([]);
    });
  });

  describe("searchArtifacts", () => {
    beforeEach(() => {
      saveArtifact({
        id: "1",
        sessionId: "s1",
        filename: "component.tsx",
        title: "React Component",
        content: "function Button() { return <button>Click</button> }",
        kind: "code",
        mimeType: "text/tsx",
        tags: ["react", "ui"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      saveArtifact({
        id: "2",
        sessionId: "s1",
        filename: "utils.ts",
        title: "Utility Functions",
        content: "export function formatDate(date: Date) {}",
        kind: "code",
        mimeType: "text/typescript",
        tags: ["utils"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      saveArtifact({
        id: "3",
        sessionId: "s2",
        filename: "readme.md",
        title: "Documentation",
        content: "# Project README",
        kind: "markdown",
        mimeType: "text/markdown",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it("should return all artifacts for empty query", () => {
      expect(searchArtifacts("")).toHaveLength(3);
      expect(searchArtifacts("   ")).toHaveLength(3);
    });

    it("should search by filename", () => {
      const results = searchArtifacts("component");
      expect(results).toHaveLength(1);
      expect(results[0].filename).toBe("component.tsx");
    });

    it("should search by title", () => {
      const results = searchArtifacts("utility");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Utility Functions");
    });

    it("should search by content", () => {
      const results = searchArtifacts("Button");
      expect(results).toHaveLength(1);
    });

    it("should search by kind", () => {
      const results = searchArtifacts("markdown");
      expect(results).toHaveLength(1);
      expect(results[0].kind).toBe("markdown");
    });

    it("should search by tags", () => {
      const results = searchArtifacts("react");
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain("react");
    });

    it("should be case-insensitive", () => {
      expect(searchArtifacts("COMPONENT")).toHaveLength(1);
      expect(searchArtifacts("React")).toHaveLength(1);
    });

    it("should filter by session", () => {
      const results = searchArtifacts("", "s1");
      expect(results).toHaveLength(2);
      expect(results.every((a) => a.sessionId === "s1")).toBe(true);
    });
  });

  describe("computeLineDiff", () => {
    it("should detect added lines", () => {
      const diff = computeLineDiff("line1\nline2", "line1\nline2\nline3");

      expect(diff.filter((d) => d.type === "add")).toHaveLength(1);
      expect(diff.find((d) => d.type === "add")?.line).toBe("line3");
    });

    it("should detect removed lines", () => {
      const diff = computeLineDiff("line1\nline2\nline3", "line1\nline3");

      expect(diff.filter((d) => d.type === "remove")).toHaveLength(1);
      expect(diff.find((d) => d.type === "remove")?.line).toBe("line2");
    });

    it("should detect same lines", () => {
      const diff = computeLineDiff("same\nline", "same\nline");

      expect(diff.every((d) => d.type === "same")).toBe(true);
      expect(diff).toHaveLength(2);
    });

    it("should handle empty strings", () => {
      const diff = computeLineDiff("", "new line");
      expect(diff.filter((d) => d.type === "add")).toHaveLength(1);

      const diff2 = computeLineDiff("old line", "");
      expect(diff2.filter((d) => d.type === "remove")).toHaveLength(1);
    });

    it("should handle complete replacement", () => {
      const diff = computeLineDiff("old\ncontent", "new\nstuff");

      const removes = diff.filter((d) => d.type === "remove");
      const adds = diff.filter((d) => d.type === "add");

      expect(removes.length).toBe(2);
      expect(adds.length).toBe(2);
    });

    it("should handle complex diff", () => {
      const old = `function hello() {
  console.log("hello");
  return true;
}`;

      const newContent = `function hello() {
  console.log("hello world");
  console.log("extra line");
  return true;
}`;

      const diff = computeLineDiff(old, newContent);

      expect(diff.some((d) => d.type === "add")).toBe(true);
      expect(diff.some((d) => d.type === "same")).toBe(true);
    });
  });
});
