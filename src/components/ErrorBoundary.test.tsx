/**
 * Tests for ErrorBoundary component
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ErrorBoundary,
  withErrorBoundary,
  ActivityErrorBoundary,
  ArtifactsErrorBoundary,
} from "./ErrorBoundary";

// Store original console.error
const originalConsoleError = console.error;

// Component that throws an error
function ThrowError({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>No error</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Suppress React error boundary console output
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("should render children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("should render default fallback on error", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();
  });

  it("should render custom fallback element on error", () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
  });

  it("should render custom fallback function on error", () => {
    const fallback = vi.fn((error: Error, reset: () => void) => (
      <div>
        <span>Error: {error.message}</span>
        <button onClick={reset}>Reset</button>
      </div>
    ));

    render(
      <ErrorBoundary fallback={fallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(fallback).toHaveBeenCalled();
    expect(screen.getByText("Error: Test error")).toBeInTheDocument();
  });

  it("should call onError callback when error occurs", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it("should include name in error message when provided", () => {
    render(
      <ErrorBoundary name="TestSection">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/in TestSection/)).toBeInTheDocument();
  });

  it("should reset error state when try again is clicked", () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Error should be shown
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Rerender with non-throwing component before clicking reset
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    // Click try again
    const tryAgainButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(tryAgainButton);

    // After reset, children should render
    expect(screen.getByText("No error")).toBeInTheDocument();
  });
});

describe("withErrorBoundary", () => {
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("should wrap component with error boundary", () => {
    const WrappedComponent = withErrorBoundary(function TestComponent() {
      return <div>Test content</div>;
    });

    render(<WrappedComponent />);
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("should catch errors in wrapped component", () => {
    const WrappedComponent = withErrorBoundary(ThrowError);

    render(<WrappedComponent />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("should set display name", () => {
    function MyComponent() {
      return <div>Test</div>;
    }

    const WrappedComponent = withErrorBoundary(MyComponent);
    expect(WrappedComponent.displayName).toBe("withErrorBoundary(MyComponent)");
  });
});

describe("Specialized Error Boundaries", () => {
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("ActivityErrorBoundary should have correct name", () => {
    render(
      <ActivityErrorBoundary>
        <ThrowError />
      </ActivityErrorBoundary>
    );

    expect(screen.getByText(/Activity Panel/)).toBeInTheDocument();
  });

  it("ArtifactsErrorBoundary should have correct name", () => {
    render(
      <ArtifactsErrorBoundary>
        <ThrowError />
      </ArtifactsErrorBoundary>
    );

    expect(screen.getByText(/Artifacts Panel/)).toBeInTheDocument();
  });
});
