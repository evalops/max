/**
 * Tests for ActivityIcons components
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ActivityIcon, StatusDot } from "./ActivityIcons";
import type { ActivityType } from "@/types";

describe("ActivityIcon", () => {
  const activityTypes: ActivityType[] = [
    "command",
    "github",
    "file_read",
    "file_write",
    "file_create",
    "thinking",
    "knowledge",
    "error",
    "success",
  ];

  describe("rendering", () => {
    it.each(activityTypes)("should render icon for type: %s", (type) => {
      const { container } = render(<ActivityIcon type={type} />);

      // Should have the icon container
      const iconContainer = container.querySelector(".size-7");
      expect(iconContainer).toBeInTheDocument();

      // Should have an SVG icon
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should render with default size of 16", () => {
      const { container } = render(<ActivityIcon type="command" />);

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "16");
      expect(svg).toHaveAttribute("height", "16");
    });

    it("should render with custom size", () => {
      const { container } = render(<ActivityIcon type="command" size={24} />);

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "24");
      expect(svg).toHaveAttribute("height", "24");
    });
  });

  describe("styling", () => {
    it("should apply base container classes", () => {
      const { container } = render(<ActivityIcon type="command" />);

      const iconContainer = container.firstChild;
      expect(iconContainer).toHaveClass(
        "flex",
        "size-7",
        "shrink-0",
        "items-center",
        "justify-center",
        "rounded-lg"
      );
    });

    it("should apply custom className", () => {
      const { container } = render(<ActivityIcon type="command" className="custom-class" />);

      const iconContainer = container.firstChild;
      expect(iconContainer).toHaveClass("custom-class");
    });

    it("should apply correct background color for command type", () => {
      const { container } = render(<ActivityIcon type="command" />);

      const iconContainer = container.firstChild;
      expect(iconContainer).toHaveClass("bg-terminal-green/10");
    });

    it("should apply correct background color for github type", () => {
      const { container } = render(<ActivityIcon type="github" />);

      const iconContainer = container.firstChild;
      expect(iconContainer).toHaveClass("bg-ink-100");
    });

    it("should apply correct background color for file_read type", () => {
      const { container } = render(<ActivityIcon type="file_read" />);

      const iconContainer = container.firstChild;
      expect(iconContainer).toHaveClass("bg-terminal-blue/10");
    });

    it("should apply correct background color for file_write type", () => {
      const { container } = render(<ActivityIcon type="file_write" />);

      const iconContainer = container.firstChild;
      expect(iconContainer).toHaveClass("bg-terminal-purple/10");
    });

    it("should apply correct background color for error type", () => {
      const { container } = render(<ActivityIcon type="error" />);

      const iconContainer = container.firstChild;
      expect(iconContainer).toHaveClass("bg-red-50");
    });

    it("should apply correct text color for command type", () => {
      const { container } = render(<ActivityIcon type="command" />);

      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("text-terminal-green");
    });

    it("should apply correct text color for error type", () => {
      const { container } = render(<ActivityIcon type="error" />);

      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("text-red-500");
    });
  });
});

describe("StatusDot", () => {
  describe("rendering", () => {
    it("should render a span element", () => {
      const { container } = render(<StatusDot status="running" />);

      const dot = container.querySelector("span");
      expect(dot).toBeInTheDocument();
    });

    it("should have base dot classes", () => {
      const { container } = render(<StatusDot status="running" />);

      const dot = container.firstChild;
      expect(dot).toHaveClass("inline-block", "size-2", "rounded-full");
    });
  });

  describe("status styling", () => {
    it("should apply running status classes", () => {
      const { container } = render(<StatusDot status="running" />);

      const dot = container.firstChild;
      expect(dot).toHaveClass("animate-pulse-subtle", "bg-terminal-blue");
    });

    it("should apply completed status classes", () => {
      const { container } = render(<StatusDot status="completed" />);

      const dot = container.firstChild;
      expect(dot).toHaveClass("bg-status-success");
    });

    it("should apply error status classes", () => {
      const { container } = render(<StatusDot status="error" />);

      const dot = container.firstChild;
      expect(dot).toHaveClass("bg-red-500");
    });
  });
});
