"use client";

import { useState, useCallback } from "react";

interface UseExpandableReturn {
  expandedIds: Set<string>;
  toggle: (id: string) => void;
  expand: (id: string) => void;
  collapse: (id: string) => void;
  isExpanded: (id: string) => boolean;
  expandAll: (ids: string[]) => void;
  collapseAll: () => void;
}

export function useExpandable(initialExpanded: string[] = []): UseExpandableReturn {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(initialExpanded));

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expand = useCallback((id: string) => {
    setExpandedIds((prev) => new Set(prev).add(id));
  }, []);

  const collapse = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isExpanded = useCallback(
    (id: string) => {
      return expandedIds.has(id);
    },
    [expandedIds]
  );

  const expandAll = useCallback((ids: string[]) => {
    setExpandedIds(new Set(ids));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  return {
    expandedIds,
    toggle,
    expand,
    collapse,
    isExpanded,
    expandAll,
    collapseAll,
  };
}
