/**
 * Tests for utils.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cn,
  formatRelativeTime,
  formatTimestamp,
  truncate,
  generateId,
  delay,
  parseMarkdownLine,
  getStaggerDelay,
} from "./utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge simple class names", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("should handle conditional classes", () => {
      expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
      expect(cn("foo", true && "bar", "baz")).toBe("foo bar baz");
    });

    it("should merge conflicting Tailwind classes", () => {
      // eslint-disable-next-line tailwindcss/no-contradicting-classname
      expect(cn("p-4", "p-8")).toBe("p-8");
      // eslint-disable-next-line tailwindcss/no-contradicting-classname
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("should handle arrays", () => {
      expect(cn(["foo", "bar"])).toBe("foo bar");
    });

    it("should handle objects", () => {
      expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
    });

    it("should handle mixed inputs", () => {
      expect(cn("foo", ["bar", "baz"], { qux: true })).toBe("foo bar baz qux");
    });

    it("should handle empty inputs", () => {
      expect(cn()).toBe("");
      expect(cn("", null, undefined)).toBe("");
    });
  });

  describe("formatRelativeTime", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "just now" for recent dates', () => {
      const now = new Date();
      vi.setSystemTime(now);
      expect(formatRelativeTime(new Date(now.getTime() - 30 * 1000))).toBe("just now");
    });

    it("should return minutes ago", () => {
      const now = new Date();
      vi.setSystemTime(now);
      expect(formatRelativeTime(new Date(now.getTime() - 5 * 60 * 1000))).toBe("5m ago");
      expect(formatRelativeTime(new Date(now.getTime() - 30 * 60 * 1000))).toBe("30m ago");
    });

    it("should return hours ago", () => {
      const now = new Date();
      vi.setSystemTime(now);
      expect(formatRelativeTime(new Date(now.getTime() - 2 * 60 * 60 * 1000))).toBe("2h ago");
      expect(formatRelativeTime(new Date(now.getTime() - 12 * 60 * 60 * 1000))).toBe("12h ago");
    });

    it("should return formatted date for older dates", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      vi.setSystemTime(now);
      const oldDate = new Date("2024-06-10T12:00:00Z");
      const result = formatRelativeTime(oldDate);
      expect(result).toContain("Jun");
      expect(result).toContain("10");
    });
  });

  describe("formatTimestamp", () => {
    it("should format time in HH:MM format", () => {
      const date = new Date("2024-06-15T14:30:00Z");
      const result = formatTimestamp(date);
      // Result depends on timezone, but should contain numbers
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it("should use 24-hour format", () => {
      const date = new Date("2024-06-15T23:45:00Z");
      const result = formatTimestamp(date);
      // Should not contain AM/PM
      expect(result).not.toMatch(/[AP]M/i);
    });
  });

  describe("truncate", () => {
    it("should not truncate short strings", () => {
      expect(truncate("hello", 10)).toBe("hello");
      expect(truncate("hello", 5)).toBe("hello");
    });

    it("should truncate long strings with ellipsis", () => {
      expect(truncate("hello world", 8)).toBe("hello...");
      expect(truncate("this is a long string", 10)).toBe("this is...");
    });

    it("should handle empty strings", () => {
      expect(truncate("", 10)).toBe("");
    });

    it("should handle edge cases", () => {
      expect(truncate("abc", 3)).toBe("abc");
      expect(truncate("abcd", 3)).toBe("...");
    });
  });

  describe("generateId", () => {
    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it("should generate alphanumeric IDs", () => {
      const id = generateId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it("should generate IDs of expected length", () => {
      const id = generateId();
      expect(id.length).toBe(7);
    });
  });

  describe("delay", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should resolve after specified time", async () => {
      const promise = delay(1000);
      vi.advanceTimersByTime(999);

      let resolved = false;
      promise.then(() => {
        resolved = true;
      });

      await Promise.resolve(); // Allow microtasks
      expect(resolved).toBe(false);

      vi.advanceTimersByTime(1);
      await Promise.resolve();
      expect(resolved).toBe(true);
    });

    it("should resolve with undefined", async () => {
      const promise = delay(100);
      vi.advanceTimersByTime(100);
      const result = await promise;
      expect(result).toBeUndefined();
    });
  });

  describe("parseMarkdownLine", () => {
    describe("headings", () => {
      it("should parse h1", () => {
        const result = parseMarkdownLine("# Heading 1");
        expect(result.type).toBe("heading");
        expect(result.level).toBe(1);
        expect(result.content).toBe("Heading 1");
      });

      it("should parse h2", () => {
        const result = parseMarkdownLine("## Heading 2");
        expect(result.type).toBe("heading");
        expect(result.level).toBe(2);
        expect(result.content).toBe("Heading 2");
      });

      it("should parse h6", () => {
        const result = parseMarkdownLine("###### Heading 6");
        expect(result.type).toBe("heading");
        expect(result.level).toBe(6);
        expect(result.content).toBe("Heading 6");
      });

      it("should not parse # without space", () => {
        const result = parseMarkdownLine("#NoSpace");
        expect(result.type).toBe("normal");
      });
    });

    describe("bullet points", () => {
      it("should parse dash bullets", () => {
        const result = parseMarkdownLine("- Item one");
        expect(result.type).toBe("bullet");
        expect(result.content).toBe("Item one");
      });

      it("should parse asterisk bullets", () => {
        const result = parseMarkdownLine("* Item two");
        expect(result.type).toBe("bullet");
        expect(result.content).toBe("Item two");
      });

      it("should require space after bullet", () => {
        const result = parseMarkdownLine("-NoSpace");
        expect(result.type).toBe("normal");
      });
    });

    describe("bold text", () => {
      it("should detect bold markers", () => {
        const result = parseMarkdownLine("This is **bold** text");
        expect(result.type).toBe("bold");
        expect(result.content).toBe("This is **bold** text");
      });

      it("should detect multiple bold sections", () => {
        const result = parseMarkdownLine("**One** and **two**");
        expect(result.type).toBe("bold");
      });
    });

    describe("normal text", () => {
      it("should parse normal lines", () => {
        const result = parseMarkdownLine("Just normal text");
        expect(result.type).toBe("normal");
        expect(result.content).toBe("Just normal text");
      });

      it("should handle empty lines", () => {
        const result = parseMarkdownLine("");
        expect(result.type).toBe("normal");
        expect(result.content).toBe("");
      });
    });
  });

  describe("getStaggerDelay", () => {
    it("should return 0 for index 0", () => {
      expect(getStaggerDelay(0)).toBe(0);
      expect(getStaggerDelay(0, 100)).toBe(0);
    });

    it("should multiply index by base delay", () => {
      expect(getStaggerDelay(1)).toBe(50);
      expect(getStaggerDelay(2)).toBe(100);
      expect(getStaggerDelay(5)).toBe(250);
    });

    it("should use custom base delay", () => {
      expect(getStaggerDelay(1, 100)).toBe(100);
      expect(getStaggerDelay(3, 25)).toBe(75);
    });
  });
});
