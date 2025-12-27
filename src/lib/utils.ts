import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes with intelligent conflict resolution.
 * Combines the power of clsx for conditional classes and tailwind-merge
 * for handling Tailwind-specific class conflicts.
 *
 * @param inputs - Class values to merge (strings, arrays, objects, or conditionals)
 * @returns Merged class string with conflicts resolved
 *
 * @example
 * ```tsx
 * // Basic usage
 * cn("px-4 py-2", "bg-blue-500") // "px-4 py-2 bg-blue-500"
 *
 * // Conflict resolution
 * cn("p-4", "p-8") // "p-8"
 *
 * // Conditional classes
 * cn("base", isActive && "active", { error: hasError })
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date to a human-readable relative time string.
 * Returns "just now" for times under a minute, then progressively
 * shows minutes, hours, and finally a formatted date.
 *
 * @param date - The date to format
 * @returns Relative time string (e.g., "just now", "5m ago", "2h ago", "Jun 10")
 *
 * @example
 * ```tsx
 * formatRelativeTime(new Date()) // "just now"
 * formatRelativeTime(new Date(Date.now() - 300000)) // "5m ago"
 * ```
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) {
    return "just now";
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

/**
 * Formats a date to a 24-hour time string (HH:MM).
 *
 * @param date - The date to format
 * @returns Time string in HH:MM format
 *
 * @example
 * ```tsx
 * formatTimestamp(new Date("2024-01-15T14:30:00")) // "14:30"
 * ```
 */
export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Truncates a string to a maximum length, adding ellipsis if needed.
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated string with ellipsis if exceeded length
 *
 * @example
 * ```tsx
 * truncate("Hello world", 8) // "hello..."
 * truncate("Hi", 10) // "Hi"
 * ```
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Generates a unique alphanumeric ID.
 * Uses Math.random() for simplicity - not suitable for cryptographic purposes.
 *
 * @returns 7-character alphanumeric string
 *
 * @example
 * ```tsx
 * generateId() // "x7k2m9p"
 * ```
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Creates a promise that resolves after a specified delay.
 * Useful for animations, throttling, or testing.
 *
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after the delay
 *
 * @example
 * ```tsx
 * await delay(1000); // Wait 1 second
 * ```
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Result of parsing a markdown line
 */
export interface ParsedLine {
  /** Type of the line */
  type: "heading" | "bold" | "bullet" | "normal";
  /** Heading level (1-6) for heading type */
  level?: number;
  /** The content of the line */
  content: string;
}

/**
 * Parses a single line of markdown to identify its type.
 * Detects headings, bullet points, bold text, and normal text.
 *
 * @param line - A single line of markdown text
 * @returns Parsed line object with type, level (for headings), and content
 *
 * @example
 * ```tsx
 * parseMarkdownLine("# Heading") // { type: "heading", level: 1, content: "Heading" }
 * parseMarkdownLine("- Item") // { type: "bullet", content: "Item" }
 * parseMarkdownLine("**Bold**") // { type: "bold", content: "**Bold**" }
 * ```
 */
export function parseMarkdownLine(line: string): ParsedLine {
  // Check for headings
  const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
  if (headingMatch) {
    return {
      type: "heading",
      level: headingMatch[1].length,
      content: headingMatch[2],
    };
  }

  // Check for bullet points
  if (line.match(/^[-*]\s+/)) {
    return {
      type: "bullet",
      content: line.replace(/^[-*]\s+/, ""),
    };
  }

  // Check for bold text markers
  if (line.includes("**")) {
    return {
      type: "bold",
      content: line,
    };
  }

  return {
    type: "normal",
    content: line,
  };
}

/**
 * Calculates staggered animation delay for list items.
 * Useful for creating cascading animation effects.
 *
 * @param index - Item index in the list (0-based)
 * @param baseDelay - Base delay between items in milliseconds
 * @returns Delay in milliseconds for this item
 *
 * @example
 * ```tsx
 * items.map((item, index) => (
 *   <motion.div
 *     initial={{ opacity: 0 }}
 *     animate={{ opacity: 1 }}
 *     transition={{ delay: getStaggerDelay(index) / 1000 }}
 *   />
 * ))
 * ```
 */
export function getStaggerDelay(index: number, baseDelay: number = 50): number {
  return index * baseDelay;
}

/**
 * Formats a file size in bytes to a human-readable string.
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 KB", "2.3 MB")
 *
 * @example
 * ```tsx
 * formatFileSize(1024) // "1.0 KB"
 * formatFileSize(1536) // "1.5 KB"
 * formatFileSize(1048576) // "1.0 MB"
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Debounces a function call.
 *
 * @param fn - Function to debounce
 * @param ms - Delay in milliseconds
 * @returns Debounced function
 *
 * @example
 * ```tsx
 * const debouncedSearch = debounce((query) => search(query), 300);
 * ```
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Throttles a function call.
 *
 * @param fn - Function to throttle
 * @param ms - Minimum time between calls in milliseconds
 * @returns Throttled function
 *
 * @example
 * ```tsx
 * const throttledScroll = throttle(() => handleScroll(), 100);
 * ```
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastTime >= ms) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

/**
 * Clamps a number between a minimum and maximum value.
 *
 * @param value - The value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value
 *
 * @example
 * ```tsx
 * clamp(5, 0, 10) // 5
 * clamp(-5, 0, 10) // 0
 * clamp(15, 0, 10) // 10
 * ```
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Creates a range of numbers.
 *
 * @param start - Start of range (inclusive)
 * @param end - End of range (exclusive)
 * @param step - Step between numbers
 * @returns Array of numbers
 *
 * @example
 * ```tsx
 * range(0, 5) // [0, 1, 2, 3, 4]
 * range(0, 10, 2) // [0, 2, 4, 6, 8]
 * ```
 */
export function range(start: number, end: number, step: number = 1): number[] {
  const result: number[] = [];
  for (let i = start; i < end; i += step) {
    result.push(i);
  }
  return result;
}

/**
 * Safely parses JSON with a fallback value.
 *
 * @param json - JSON string to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed value or fallback
 *
 * @example
 * ```tsx
 * safeJsonParse('{"key": "value"}', {}) // { key: "value" }
 * safeJsonParse('invalid', {}) // {}
 * ```
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
