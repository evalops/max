/**
 * Tests for ActivityItem component
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityItem } from "./ActivityItem";
import type { ActivityItem as ActivityItemType } from "@/types";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};
Object.assign(navigator, { clipboard: mockClipboard });

describe("ActivityItem", () => {
  const createActivity = (overrides: Partial<ActivityItemType> = {}): ActivityItemType => ({
    id: "activity-1",
    type: "command",
    title: "Test Activity",
    timestamp: new Date(),
    status: "completed",
    ...overrides,
  });

  const defaultProps = {
    index: 0,
    isExpanded: false,
    onToggle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render activity title", () => {
      const activity = createActivity({ title: "Running npm install" });

      render(<ActivityItem {...defaultProps} activity={activity} />);

      expect(screen.getByText("Running npm install")).toBeInTheDocument();
    });

    it("should render activity icon", () => {
      const activity = createActivity({ type: "command" });

      const { container } = render(<ActivityItem {...defaultProps} activity={activity} />);

      // Should have the icon container
      const iconContainer = container.querySelector(".size-7");
      expect(iconContainer).toBeInTheDocument();
    });

    it("should render timestamp when showTimestamp is true", () => {
      const activity = createActivity({ duration: "1m 30s" });

      render(<ActivityItem {...defaultProps} activity={activity} showTimestamp />);

      expect(screen.getByText("1m 30s")).toBeInTheDocument();
    });

    it("should not render timestamp when showTimestamp is false", () => {
      const activity = createActivity({ duration: "1m 30s" });

      render(<ActivityItem {...defaultProps} activity={activity} showTimestamp={false} />);

      expect(screen.queryByText("1m 30s")).not.toBeInTheDocument();
    });
  });

  describe("expandable behavior", () => {
    it("should call onToggle when clicked", () => {
      const onToggle = vi.fn();
      const activity = createActivity({ description: "Some description" });

      render(<ActivityItem {...defaultProps} activity={activity} onToggle={onToggle} />);

      const button = screen.getByRole("button", { name: /test activity/i });
      fireEvent.click(button);

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("should show description preview when collapsed", () => {
      const activity = createActivity({ description: "This is a description" });

      render(<ActivityItem {...defaultProps} activity={activity} isExpanded={false} />);

      expect(screen.getByText("This is a description")).toBeInTheDocument();
    });

    it("should show full description when expanded", () => {
      const activity = createActivity({
        description: "This is a full description with more details",
      });

      render(<ActivityItem {...defaultProps} activity={activity} isExpanded />);

      expect(screen.getByText("This is a full description with more details")).toBeInTheDocument();
    });

    it("should render chevron icon for expandable items", () => {
      const activity = createActivity({ description: "Some description" });

      const { container } = render(<ActivityItem {...defaultProps} activity={activity} />);

      // ChevronDown is an SVG inside the button
      const chevrons = container.querySelectorAll("svg");
      expect(chevrons.length).toBeGreaterThan(0);
    });

    it("should not be expandable without description or children", () => {
      const activity = createActivity({
        description: undefined,
        children: undefined,
      });

      render(<ActivityItem {...defaultProps} activity={activity} />);

      // Get the toggle button (first button, not the copy button)
      const buttons = screen.getAllByRole("button");
      const toggleButton = buttons[0];
      expect(toggleButton).toBeDisabled();
    });
  });

  describe("children rendering", () => {
    it("should render knowledge type children", () => {
      const activity = createActivity({
        children: [{ id: "child-1", type: "knowledge", title: "Important knowledge" }],
      });

      render(<ActivityItem {...defaultProps} activity={activity} isExpanded />);

      expect(screen.getByText("Important knowledge")).toBeInTheDocument();
    });

    it("should render file type children", () => {
      const activity = createActivity({
        children: [{ id: "child-1", type: "file", title: "src/components/App.tsx" }],
      });

      render(<ActivityItem {...defaultProps} activity={activity} isExpanded />);

      expect(screen.getByText("src/components/App.tsx")).toBeInTheDocument();
    });

    it("should render info type children", () => {
      const activity = createActivity({
        children: [{ id: "child-1", type: "info", title: "Additional information" }],
      });

      render(<ActivityItem {...defaultProps} activity={activity} isExpanded />);

      expect(screen.getByText("Additional information")).toBeInTheDocument();
    });

    it("should render external link for children with links", () => {
      const activity = createActivity({
        children: [
          {
            id: "child-1",
            type: "file",
            title: "GitHub Issue",
            link: "https://github.com/test/repo/issues/1",
          },
        ],
      });

      render(<ActivityItem {...defaultProps} activity={activity} isExpanded />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "https://github.com/test/repo/issues/1");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("should not render children when collapsed", () => {
      const activity = createActivity({
        children: [{ id: "child-1", type: "knowledge", title: "Hidden knowledge" }],
      });

      render(<ActivityItem {...defaultProps} activity={activity} isExpanded={false} />);

      expect(screen.queryByText("Hidden knowledge")).not.toBeInTheDocument();
    });
  });

  describe("status indicator", () => {
    it("should show status dot for running activities", () => {
      const activity = createActivity({ status: "running" });

      const { container } = render(<ActivityItem {...defaultProps} activity={activity} />);

      const statusDot = container.querySelector(".animate-pulse-subtle");
      expect(statusDot).toBeInTheDocument();
    });

    it("should apply font-medium class for running activities", () => {
      const activity = createActivity({ status: "running", title: "Running" });

      render(<ActivityItem {...defaultProps} activity={activity} />);

      const title = screen.getByText("Running");
      expect(title).toHaveClass("font-medium");
    });

    it("should not show status dot for completed activities", () => {
      const activity = createActivity({ status: "completed" });

      const { container } = render(<ActivityItem {...defaultProps} activity={activity} />);

      const statusDot = container.querySelector(".animate-pulse-subtle");
      expect(statusDot).not.toBeInTheDocument();
    });
  });

  describe("copy functionality", () => {
    it("should copy activity title to clipboard", async () => {
      const activity = createActivity({ title: "Copy this" });
      mockClipboard.writeText.mockResolvedValueOnce(undefined);

      render(<ActivityItem {...defaultProps} activity={activity} />);

      // Find copy button by its title
      const copyButton = screen.getByTitle("Copy");
      fireEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalledWith("Copy this");
    });

    it("should copy title and description to clipboard", async () => {
      const activity = createActivity({
        title: "Activity",
        description: "Description",
      });
      mockClipboard.writeText.mockResolvedValueOnce(undefined);

      render(<ActivityItem {...defaultProps} activity={activity} />);

      const copyButton = screen.getByTitle("Copy");
      fireEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalledWith("Activity: Description");
    });

    it("should handle clipboard errors gracefully", async () => {
      const activity = createActivity({ title: "Test" });
      mockClipboard.writeText.mockRejectedValueOnce(new Error("Access denied"));

      render(<ActivityItem {...defaultProps} activity={activity} />);

      const copyButton = screen.getByTitle("Copy");

      // Should not throw
      expect(() => fireEvent.click(copyButton)).not.toThrow();
    });

    it("should stop event propagation on copy button click", async () => {
      const onToggle = vi.fn();
      const activity = createActivity({ description: "Test" });
      mockClipboard.writeText.mockResolvedValueOnce(undefined);

      render(<ActivityItem {...defaultProps} activity={activity} onToggle={onToggle} />);

      const copyButton = screen.getByTitle("Copy");
      fireEvent.click(copyButton);

      // onToggle should not be called because stopPropagation was called
      expect(onToggle).not.toHaveBeenCalled();
    });
  });

  describe("compact mode", () => {
    it("should apply compact padding when compact is true", () => {
      const activity = createActivity();

      const { container } = render(<ActivityItem {...defaultProps} activity={activity} compact />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("pb-2");
    });

    it("should apply normal padding when compact is false", () => {
      const activity = createActivity();

      const { container } = render(
        <ActivityItem {...defaultProps} activity={activity} compact={false} />
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("pb-4");
    });
  });

  describe("timeline connector", () => {
    it("should render timeline connector line", () => {
      const activity = createActivity();

      const { container } = render(<ActivityItem {...defaultProps} activity={activity} />);

      const connector = container.querySelector(".bg-gradient-to-b");
      expect(connector).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("should handle empty title", () => {
      const activity = createActivity({ title: "" });

      const { container } = render(<ActivityItem {...defaultProps} activity={activity} />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("should handle very long title", () => {
      const longTitle = "A".repeat(200);
      const activity = createActivity({ title: longTitle });

      render(<ActivityItem {...defaultProps} activity={activity} />);

      const title = screen.getByText(longTitle);
      expect(title).toHaveClass("truncate");
    });

    it("should handle multiple children", () => {
      const activity = createActivity({
        children: [
          { id: "1", type: "knowledge", title: "Knowledge 1" },
          { id: "2", type: "file", title: "file.ts" },
          { id: "3", type: "info", title: "Info item" },
        ],
      });

      render(<ActivityItem {...defaultProps} activity={activity} isExpanded />);

      expect(screen.getByText("Knowledge 1")).toBeInTheDocument();
      expect(screen.getByText("file.ts")).toBeInTheDocument();
      expect(screen.getByText("Info item")).toBeInTheDocument();
    });
  });
});
