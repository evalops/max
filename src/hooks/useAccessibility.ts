"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Hook to detect if user prefers reduced motion
 *
 * @returns Boolean indicating if reduced motion is preferred
 *
 * @example
 * ```tsx
 * function AnimatedComponent() {
 *   const prefersReducedMotion = usePrefersReducedMotion();
 *
 *   return (
 *     <motion.div
 *       animate={prefersReducedMotion ? {} : { x: 100 }}
 *     />
 *   );
 * }
 * ```
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook to detect user's preferred color scheme
 *
 * @returns 'light' | 'dark' | null
 */
export function usePrefersColorScheme(): "light" | "dark" | null {
  const [colorScheme, setColorScheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setColorScheme(darkQuery.matches ? "dark" : "light");

    const handleChange = (event: MediaQueryListEvent) => {
      setColorScheme(event.matches ? "dark" : "light");
    };

    darkQuery.addEventListener("change", handleChange);
    return () => darkQuery.removeEventListener("change", handleChange);
  }, []);

  return colorScheme;
}

/**
 * Hook to announce messages to screen readers via live region
 *
 * @returns Function to announce messages
 *
 * @example
 * ```tsx
 * function SearchResults() {
 *   const announce = useAnnounce();
 *
 *   useEffect(() => {
 *     announce(`Found ${results.length} results`);
 *   }, [results, announce]);
 * }
 * ```
 */
export function useAnnounce(): (message: string, priority?: "polite" | "assertive") => void {
  const politeRef = useRef<HTMLDivElement | null>(null);
  const assertiveRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create live regions if they don't exist
    if (!document.getElementById("aria-live-polite")) {
      const polite = document.createElement("div");
      polite.id = "aria-live-polite";
      polite.setAttribute("role", "status");
      polite.setAttribute("aria-live", "polite");
      polite.setAttribute("aria-atomic", "true");
      polite.className = "sr-only";
      document.body.appendChild(polite);
      politeRef.current = polite;
    } else {
      politeRef.current = document.getElementById("aria-live-polite") as HTMLDivElement;
    }

    if (!document.getElementById("aria-live-assertive")) {
      const assertive = document.createElement("div");
      assertive.id = "aria-live-assertive";
      assertive.setAttribute("role", "alert");
      assertive.setAttribute("aria-live", "assertive");
      assertive.setAttribute("aria-atomic", "true");
      assertive.className = "sr-only";
      document.body.appendChild(assertive);
      assertiveRef.current = assertive;
    } else {
      assertiveRef.current = document.getElementById("aria-live-assertive") as HTMLDivElement;
    }

    return () => {
      // Clean up only if we created them
      const polite = document.getElementById("aria-live-polite");
      const assertive = document.getElementById("aria-live-assertive");
      if (polite && polite.textContent === "") polite.remove();
      if (assertive && assertive.textContent === "") assertive.remove();
    };
  }, []);

  const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    const region = priority === "assertive" ? assertiveRef.current : politeRef.current;
    if (region) {
      // Clear and set to trigger announcement
      region.textContent = "";
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    }
  }, []);

  return announce;
}

/**
 * Hook for skip link functionality
 *
 * @param targetId - ID of the element to skip to
 * @returns Props to spread on the skip link
 */
export function useSkipLink(targetId: string) {
  const handleClick = useCallback(
    (event: React.MouseEvent | React.KeyboardEvent) => {
      event.preventDefault();
      const target = document.getElementById(targetId);
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.focus();
        target.removeAttribute("tabindex");
      }
    },
    [targetId]
  );

  return {
    href: `#${targetId}`,
    onClick: handleClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        handleClick(e);
      }
    },
  };
}

/**
 * Hook to manage focus when content loads dynamically
 *
 * @param shouldFocus - Whether to focus the element
 * @returns Ref to attach to the focusable element
 */
export function useFocusOnMount<T extends HTMLElement>(shouldFocus: boolean = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (shouldFocus && ref.current) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        ref.current?.focus();
      });
    }
  }, [shouldFocus]);

  return ref;
}

/**
 * Hook to restore focus when a component unmounts
 *
 * @example
 * ```tsx
 * function Modal({ onClose }) {
 *   useFocusRestore();
 *
 *   return <div>Modal content</div>;
 * }
 * ```
 */
export function useFocusRestore(): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;

    return () => {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, []);
}

/**
 * Hook to detect if high contrast mode is enabled
 */
export function usePrefersHighContrast(): boolean {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-contrast: more)");
    setPrefersHighContrast(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersHighContrast(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersHighContrast;
}

/**
 * Generate unique IDs for ARIA attributes
 */
let idCounter = 0;

export function useId(prefix: string = "id"): string {
  const idRef = useRef<string | null>(null);

  if (idRef.current === null) {
    idRef.current = `${prefix}-${++idCounter}`;
  }

  return idRef.current;
}

/**
 * Hook to create accessible description/label associations
 *
 * @example
 * ```tsx
 * function FormField() {
 *   const { labelId, descriptionId, errorId } = useAriaDescribedBy();
 *
 *   return (
 *     <>
 *       <label id={labelId}>Name</label>
 *       <input aria-labelledby={labelId} aria-describedby={`${descriptionId} ${errorId}`} />
 *       <span id={descriptionId}>Enter your full name</span>
 *       <span id={errorId}>Name is required</span>
 *     </>
 *   );
 * }
 * ```
 */
export function useAriaDescribedBy(prefix: string = "field") {
  const labelId = useId(`${prefix}-label`);
  const descriptionId = useId(`${prefix}-desc`);
  const errorId = useId(`${prefix}-error`);

  return { labelId, descriptionId, errorId };
}
