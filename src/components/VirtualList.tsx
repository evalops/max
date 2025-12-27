"use client";

import { useRef, useCallback, type ReactNode } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

interface VirtualListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Estimated height of each item in pixels */
  estimateSize: number;
  /** Render function for each item */
  renderItem: (item: T, index: number, virtualItem: VirtualItem) => ReactNode;
  /** Optional class name for the container */
  className?: string;
  /** Optional class name for the scrollable area */
  scrollClassName?: string;
  /** Number of items to render above/below visible area */
  overscan?: number;
  /** Key extractor function */
  getItemKey?: (item: T, index: number) => string | number;
  /** Gap between items in pixels */
  gap?: number;
  /** Horizontal mode */
  horizontal?: boolean;
}

/**
 * A virtualized list component that efficiently renders large lists
 * by only rendering items currently visible in the viewport.
 */
export function VirtualList<T>({
  items,
  estimateSize,
  renderItem,
  className,
  scrollClassName,
  overscan = 5,
  getItemKey,
  gap = 0,
  horizontal = false,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey ? (index) => getItemKey(items[index], index) : undefined,
    gap,
    horizontal,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (items.length === 0) {
    return null;
  }

  return (
    <div ref={parentRef} className={cn("overflow-auto", scrollClassName)}>
      <div
        className={cn("relative", className)}
        style={{
          [horizontal ? "width" : "height"]: `${virtualizer.getTotalSize()}px`,
          [horizontal ? "height" : "width"]: "100%",
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0"
            style={{
              [horizontal ? "left" : "top"]: `${virtualItem.start}px`,
              [horizontal ? "height" : "width"]: "100%",
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index, virtualItem)}
          </div>
        ))}
      </div>
    </div>
  );
}

interface VirtualGridProps<T> {
  /** Array of items to render */
  items: T[];
  /** Number of columns in the grid */
  columns: number;
  /** Height of each row in pixels */
  rowHeight: number;
  /** Render function for each item */
  renderItem: (item: T, index: number) => ReactNode;
  /** Optional class name for the container */
  className?: string;
  /** Number of rows to render above/below visible area */
  overscan?: number;
  /** Gap between items in pixels */
  gap?: number;
}

/**
 * A virtualized grid component for rendering large grids efficiently.
 */
export function VirtualGrid<T>({
  items,
  columns,
  rowHeight,
  renderItem,
  className,
  overscan = 3,
  gap = 0,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight + gap,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();

  if (items.length === 0) {
    return null;
  }

  return (
    <div ref={parentRef} className="overflow-auto">
      <div
        className={cn("relative", className)}
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowItems = items.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 top-0 flex w-full"
              style={{
                top: `${virtualRow.start}px`,
                height: `${rowHeight}px`,
                gap: `${gap}px`,
              }}
            >
              {rowItems.map((item, colIndex) => (
                <div key={startIndex + colIndex} className="flex-1" style={{ minWidth: 0 }}>
                  {renderItem(item, startIndex + colIndex)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface UseVirtualScrollOptions {
  /** Total number of items */
  itemCount: number;
  /** Estimated height of each item */
  estimateSize: number;
  /** Number of items to render outside visible area */
  overscan?: number;
  /** Gap between items */
  gap?: number;
}

/**
 * Hook for implementing virtual scroll in custom components.
 */
export function useVirtualScroll({
  itemCount,
  estimateSize,
  overscan = 5,
  gap = 0,
}: UseVirtualScrollOptions) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    gap,
  });

  const scrollToIndex = useCallback(
    (index: number, options?: { align?: "start" | "center" | "end" }) => {
      virtualizer.scrollToIndex(index, options);
    },
    [virtualizer]
  );

  const scrollToOffset = useCallback(
    (offset: number, options?: { align?: "start" | "center" | "end" }) => {
      virtualizer.scrollToOffset(offset, options);
    },
    [virtualizer]
  );

  return {
    parentRef,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    scrollToIndex,
    scrollToOffset,
    measureElement: virtualizer.measureElement,
  };
}
