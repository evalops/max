/**
 * Tests for LoadingSpinner component
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingSpinner, LoadingDots, ThinkingIndicator } from "./LoadingSpinner";

describe("LoadingSpinner", () => {
  it("should render with default size", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("should render with sm size", () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    expect(container.querySelector(".size-4")).toBeInTheDocument();
  });

  it("should render with md size", () => {
    const { container } = render(<LoadingSpinner size="md" />);
    expect(container.querySelector(".size-6")).toBeInTheDocument();
  });

  it("should render with lg size", () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    expect(container.querySelector(".size-8")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(<LoadingSpinner className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("should have animation class", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toHaveClass("animate-spin");
  });
});

describe("LoadingDots", () => {
  it("should render three animated dots", () => {
    const { container } = render(<LoadingDots />);
    const dots = container.querySelectorAll(".animate-pulse");
    expect(dots.length).toBeGreaterThan(0);
  });

  it("should apply custom className", () => {
    const { container } = render(<LoadingDots className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });
});

describe("ThinkingIndicator", () => {
  it("should render with default text", () => {
    render(<ThinkingIndicator />);
    expect(screen.getByText("Thinking")).toBeInTheDocument();
  });

  it("should render with custom text", () => {
    render(<ThinkingIndicator text="Processing" />);
    expect(screen.getByText("Processing")).toBeInTheDocument();
  });

  it("should include a spinner", () => {
    const { container } = render(<ThinkingIndicator />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
