"use client";

import { useEffect, useCallback, useRef } from "react";

/**
 * Key combination representation
 */
interface KeyCombo {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * Options for keyboard shortcuts
 */
interface UseKeyboardOptions {
  /** Whether the shortcut is enabled */
  enabled?: boolean;
  /** Element to attach listener to (default: window) */
  target?: HTMLElement | Window | null;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
  /** Stop event propagation */
  stopPropagation?: boolean;
  /** Only trigger when target element has focus */
  requireFocus?: boolean;
}

/**
 * Parse a key string like "ctrl+k" or "meta+shift+p" into KeyCombo
 */
function parseKeyCombo(keyString: string): KeyCombo {
  const parts = keyString.toLowerCase().split("+");
  const key = parts.pop() || "";

  return {
    key,
    ctrl: parts.includes("ctrl"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
    meta: parts.includes("meta") || parts.includes("cmd"),
  };
}

/**
 * Check if a keyboard event matches a key combo
 */
function matchesKeyCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  const keyMatch = event.key.toLowerCase() === combo.key.toLowerCase();
  const ctrlMatch = !!combo.ctrl === event.ctrlKey;
  const altMatch = !!combo.alt === event.altKey;
  const shiftMatch = !!combo.shift === event.shiftKey;
  const metaMatch = !!combo.meta === event.metaKey;

  return keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch;
}

/**
 * Hook for handling keyboard shortcuts
 *
 * @param keyCombo - Key combination string (e.g., "ctrl+k", "meta+shift+p", "escape")
 * @param callback - Function to call when shortcut is triggered
 * @param options - Additional options
 *
 * @example
 * ```tsx
 * // Simple shortcut
 * useKeyboard("escape", () => closeModal());
 *
 * // With modifiers
 * useKeyboard("ctrl+k", () => openSearch(), { preventDefault: true });
 *
 * // Disabled shortcut
 * useKeyboard("enter", () => submit(), { enabled: isFormValid });
 * ```
 */
export function useKeyboard(
  keyCombo: string,
  callback: (event: KeyboardEvent) => void,
  options: UseKeyboardOptions = {}
): void {
  const {
    enabled = true,
    target = typeof window !== "undefined" ? window : null,
    preventDefault = false,
    stopPropagation = false,
    requireFocus = false,
  } = options;

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const combo = parseKeyCombo(keyCombo);

  useEffect(() => {
    if (!enabled || !target) return;

    const handleKeyDown = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;

      // Check if we require focus and the target is focused
      if (requireFocus && target instanceof HTMLElement) {
        if (document.activeElement !== target) return;
      }

      // Skip if user is typing in an input
      const tagName = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (["input", "textarea", "select"].includes(tagName)) {
        // Allow escape to work in inputs
        if (combo.key !== "escape") return;
      }

      if (matchesKeyCombo(keyboardEvent, combo)) {
        if (preventDefault) {
          event.preventDefault();
        }
        if (stopPropagation) {
          event.stopPropagation();
        }
        callbackRef.current(keyboardEvent);
      }
    };

    target.addEventListener("keydown", handleKeyDown);
    return () => target.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    target,
    combo.key,
    combo.ctrl,
    combo.alt,
    combo.shift,
    combo.meta,
    preventDefault,
    stopPropagation,
    requireFocus,
  ]);
}

/**
 * Hook for handling multiple keyboard shortcuts
 *
 * @param shortcuts - Map of key combos to callbacks
 * @param options - Additional options
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   "ctrl+k": () => openSearch(),
 *   "ctrl+/": () => toggleHelp(),
 *   "escape": () => closeModal(),
 * });
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: Record<string, (event: KeyboardEvent) => void>,
  options: Omit<UseKeyboardOptions, "requireFocus"> = {}
): void {
  const {
    enabled = true,
    target = typeof window !== "undefined" ? window : null,
    preventDefault = true,
  } = options;

  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled || !target) return;

    const combos = Object.keys(shortcutsRef.current).map((key) => ({
      key,
      combo: parseKeyCombo(key),
    }));

    const handleKeyDown = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;

      // Skip if user is typing in an input (except escape)
      const tagName = (event.target as HTMLElement)?.tagName?.toLowerCase();
      const isTyping = ["input", "textarea", "select"].includes(tagName);

      for (const { key, combo } of combos) {
        if (matchesKeyCombo(keyboardEvent, combo)) {
          if (isTyping && combo.key !== "escape") continue;

          if (preventDefault) {
            event.preventDefault();
          }
          shortcutsRef.current[key](keyboardEvent);
          return;
        }
      }
    };

    target.addEventListener("keydown", handleKeyDown);
    return () => target.removeEventListener("keydown", handleKeyDown);
  }, [enabled, target, preventDefault]);
}

/**
 * Hook for focus trap within a container
 *
 * @param containerRef - Ref to the container element
 * @param enabled - Whether the focus trap is active
 *
 * @example
 * ```tsx
 * function Modal({ isOpen }) {
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref, isOpen);
 *
 *   return <div ref={ref}>...</div>;
 * }
 * ```
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus first element when trap is enabled
    firstFocusable.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, enabled]);
}

/**
 * Hook for roving tabindex navigation in a list
 *
 * @param containerRef - Ref to the container element
 * @param itemSelector - CSS selector for focusable items
 * @param options - Navigation options
 *
 * @example
 * ```tsx
 * function Menu() {
 *   const ref = useRef<HTMLUListElement>(null);
 *   useRovingTabIndex(ref, '[role="menuitem"]');
 *
 *   return (
 *     <ul ref={ref} role="menu">
 *       <li role="menuitem" tabIndex={0}>Item 1</li>
 *       <li role="menuitem" tabIndex={-1}>Item 2</li>
 *     </ul>
 *   );
 * }
 * ```
 */
export function useRovingTabIndex(
  containerRef: React.RefObject<HTMLElement | null>,
  itemSelector: string,
  options: { wrap?: boolean; horizontal?: boolean } = {}
): void {
  const { wrap = true, horizontal = false } = options;

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      const items = Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
      const currentIndex = items.findIndex((item) => item === document.activeElement);

      if (currentIndex === -1) return;

      const prevKey = horizontal ? "ArrowLeft" : "ArrowUp";
      const nextKey = horizontal ? "ArrowRight" : "ArrowDown";

      let newIndex = currentIndex;

      if (event.key === prevKey) {
        event.preventDefault();
        newIndex = currentIndex - 1;
        if (newIndex < 0) {
          newIndex = wrap ? items.length - 1 : 0;
        }
      } else if (event.key === nextKey) {
        event.preventDefault();
        newIndex = currentIndex + 1;
        if (newIndex >= items.length) {
          newIndex = wrap ? 0 : items.length - 1;
        }
      } else if (event.key === "Home") {
        event.preventDefault();
        newIndex = 0;
      } else if (event.key === "End") {
        event.preventDefault();
        newIndex = items.length - 1;
      }

      if (newIndex !== currentIndex) {
        items[currentIndex].setAttribute("tabindex", "-1");
        items[newIndex].setAttribute("tabindex", "0");
        items[newIndex].focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, itemSelector, wrap, horizontal]);
}
