"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that catches JavaScript errors in child components.
 * Provides a fallback UI and optional error reporting.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`,
      error,
      errorInfo
    );
    this.props.onError?.(error, errorInfo);
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error, this.resetError);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <DefaultErrorFallback
          error={this.state.error}
          reset={this.resetError}
          name={this.props.name}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error;
  reset: () => void;
  name?: string;
}

/**
 * Default fallback UI for error boundaries
 */
function DefaultErrorFallback({ error, reset, name }: DefaultErrorFallbackProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950"
    >
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <svg
          className="size-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h2 className="text-lg font-semibold">Something went wrong{name ? ` in ${name}` : ""}</h2>
      </div>
      <p className="max-w-md text-center text-sm text-red-600/80 dark:text-red-400/80">
        {error.message || "An unexpected error occurred"}
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-700 dark:hover:bg-red-600"
      >
        Try again
      </button>
      {process.env.NODE_ENV === "development" && (
        <details className="mt-4 w-full max-w-md">
          <summary className="cursor-pointer text-xs text-red-500">Error details</summary>
          <pre className="mt-2 overflow-auto rounded bg-red-100 p-2 text-xs text-red-800 dark:bg-red-900 dark:text-red-200">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}

/**
 * Higher-order component to wrap a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, "children">
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component";

  const WithErrorBoundary = (props: P) => (
    <ErrorBoundary {...options} name={options?.name || displayName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return WithErrorBoundary;
}

/**
 * Specialized error boundaries for different sections
 */
export function ActivityErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary name="Activity Panel">{children}</ErrorBoundary>;
}

export function ArtifactsErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary name="Artifacts Panel">{children}</ErrorBoundary>;
}

export function ComputerErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary name="Computer Panel">{children}</ErrorBoundary>;
}

export function ToolRunsErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary name="Tool Runs">{children}</ErrorBoundary>;
}

export function ChartErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary name="Chart Viewer">{children}</ErrorBoundary>;
}
