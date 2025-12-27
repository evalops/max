/**
 * Tests for useExpandable hook
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExpandable } from "./useExpandable";

describe("useExpandable", () => {
  describe("initialization", () => {
    it("should initialize with empty set by default", () => {
      const { result } = renderHook(() => useExpandable());

      expect(result.current.expandedIds.size).toBe(0);
    });

    it("should initialize with provided initial expanded ids", () => {
      const { result } = renderHook(() => useExpandable(["item-1", "item-2"]));

      expect(result.current.expandedIds.size).toBe(2);
      expect(result.current.isExpanded("item-1")).toBe(true);
      expect(result.current.isExpanded("item-2")).toBe(true);
    });
  });

  describe("toggle", () => {
    it("should expand a collapsed item", () => {
      const { result } = renderHook(() => useExpandable());

      act(() => {
        result.current.toggle("item-1");
      });

      expect(result.current.isExpanded("item-1")).toBe(true);
    });

    it("should collapse an expanded item", () => {
      const { result } = renderHook(() => useExpandable(["item-1"]));

      expect(result.current.isExpanded("item-1")).toBe(true);

      act(() => {
        result.current.toggle("item-1");
      });

      expect(result.current.isExpanded("item-1")).toBe(false);
    });

    it("should not affect other items when toggling", () => {
      const { result } = renderHook(() => useExpandable(["item-1"]));

      act(() => {
        result.current.toggle("item-2");
      });

      expect(result.current.isExpanded("item-1")).toBe(true);
      expect(result.current.isExpanded("item-2")).toBe(true);
    });
  });

  describe("expand", () => {
    it("should expand a collapsed item", () => {
      const { result } = renderHook(() => useExpandable());

      act(() => {
        result.current.expand("item-1");
      });

      expect(result.current.isExpanded("item-1")).toBe(true);
    });

    it("should keep an already expanded item expanded", () => {
      const { result } = renderHook(() => useExpandable(["item-1"]));

      act(() => {
        result.current.expand("item-1");
      });

      expect(result.current.isExpanded("item-1")).toBe(true);
    });
  });

  describe("collapse", () => {
    it("should collapse an expanded item", () => {
      const { result } = renderHook(() => useExpandable(["item-1"]));

      act(() => {
        result.current.collapse("item-1");
      });

      expect(result.current.isExpanded("item-1")).toBe(false);
    });

    it("should do nothing for an already collapsed item", () => {
      const { result } = renderHook(() => useExpandable());

      act(() => {
        result.current.collapse("item-1");
      });

      expect(result.current.isExpanded("item-1")).toBe(false);
    });
  });

  describe("isExpanded", () => {
    it("should return true for expanded items", () => {
      const { result } = renderHook(() => useExpandable(["item-1"]));

      expect(result.current.isExpanded("item-1")).toBe(true);
    });

    it("should return false for collapsed items", () => {
      const { result } = renderHook(() => useExpandable());

      expect(result.current.isExpanded("item-1")).toBe(false);
    });
  });

  describe("expandAll", () => {
    it("should expand all provided items", () => {
      const { result } = renderHook(() => useExpandable());

      act(() => {
        result.current.expandAll(["item-1", "item-2", "item-3"]);
      });

      expect(result.current.isExpanded("item-1")).toBe(true);
      expect(result.current.isExpanded("item-2")).toBe(true);
      expect(result.current.isExpanded("item-3")).toBe(true);
    });

    it("should replace existing expanded items", () => {
      const { result } = renderHook(() => useExpandable(["old-item"]));

      act(() => {
        result.current.expandAll(["new-item-1", "new-item-2"]);
      });

      expect(result.current.isExpanded("old-item")).toBe(false);
      expect(result.current.isExpanded("new-item-1")).toBe(true);
      expect(result.current.isExpanded("new-item-2")).toBe(true);
    });

    it("should handle empty array", () => {
      const { result } = renderHook(() => useExpandable(["item-1"]));

      act(() => {
        result.current.expandAll([]);
      });

      expect(result.current.expandedIds.size).toBe(0);
    });
  });

  describe("collapseAll", () => {
    it("should collapse all expanded items", () => {
      const { result } = renderHook(() => useExpandable(["item-1", "item-2", "item-3"]));

      act(() => {
        result.current.collapseAll();
      });

      expect(result.current.expandedIds.size).toBe(0);
      expect(result.current.isExpanded("item-1")).toBe(false);
      expect(result.current.isExpanded("item-2")).toBe(false);
      expect(result.current.isExpanded("item-3")).toBe(false);
    });

    it("should handle already empty set", () => {
      const { result } = renderHook(() => useExpandable());

      act(() => {
        result.current.collapseAll();
      });

      expect(result.current.expandedIds.size).toBe(0);
    });
  });

  describe("expandedIds", () => {
    it("should return a Set of expanded ids", () => {
      const { result } = renderHook(() => useExpandable(["item-1", "item-2"]));

      expect(result.current.expandedIds).toBeInstanceOf(Set);
      expect(result.current.expandedIds.has("item-1")).toBe(true);
      expect(result.current.expandedIds.has("item-2")).toBe(true);
    });

    it("should update when items are toggled", () => {
      const { result } = renderHook(() => useExpandable());

      expect(result.current.expandedIds.size).toBe(0);

      act(() => {
        result.current.toggle("item-1");
      });

      expect(result.current.expandedIds.size).toBe(1);
      expect(result.current.expandedIds.has("item-1")).toBe(true);
    });
  });

  describe("callback stability", () => {
    it("should maintain stable callback references", () => {
      const { result, rerender } = renderHook(() => useExpandable());

      const { toggle, expand, collapse, expandAll, collapseAll } = result.current;

      rerender();

      expect(result.current.toggle).toBe(toggle);
      expect(result.current.expand).toBe(expand);
      expect(result.current.collapse).toBe(collapse);
      expect(result.current.expandAll).toBe(expandAll);
      expect(result.current.collapseAll).toBe(collapseAll);
    });
  });
});
