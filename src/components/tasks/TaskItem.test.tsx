/**
 * Tests for TaskItem component
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskItem } from "./TaskItem";
import type { Task } from "@/types";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
}));

describe("TaskItem", () => {
  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: "task-1",
    title: "Test Task",
    status: "pending",
    ...overrides,
  });

  describe("rendering", () => {
    it("should render task title", () => {
      const task = createTask({ title: "Complete feature" });

      render(<TaskItem task={task} index={0} />);

      expect(screen.getByText("Complete feature")).toBeInTheDocument();
    });
  });

  describe("status indicators", () => {
    it("should render check icon for completed tasks", () => {
      const task = createTask({ status: "completed" });

      const { container } = render(<TaskItem task={task} index={0} />);

      // Check for success background color class
      const checkContainer = container.querySelector(".bg-status-success");
      expect(checkContainer).toBeInTheDocument();
    });

    it("should render pulsing indicator for in_progress tasks", () => {
      const task = createTask({ status: "in_progress" });

      const { container } = render(<TaskItem task={task} index={0} />);

      // Check for pending animation class
      const pulsingElement = container.querySelector(".animate-ping");
      expect(pulsingElement).toBeInTheDocument();
    });

    it("should render clock icon for pending tasks", () => {
      const task = createTask({ status: "pending" });

      const { container } = render(<TaskItem task={task} index={0} />);

      // Check for waiting status color
      const clockContainer = container.querySelector(".text-status-waiting");
      expect(clockContainer).toBeInTheDocument();
    });
  });

  describe("text styling", () => {
    it("should apply muted style for completed tasks", () => {
      const task = createTask({ status: "completed", title: "Done task" });

      render(<TaskItem task={task} index={0} />);

      const taskText = screen.getByText("Done task");
      expect(taskText).toHaveClass("text-ink-500");
    });

    it("should apply bold style for in_progress tasks", () => {
      const task = createTask({ status: "in_progress", title: "Active task" });

      render(<TaskItem task={task} index={0} />);

      const taskText = screen.getByText("Active task");
      expect(taskText).toHaveClass("font-medium", "text-ink-800");
    });

    it("should apply muted style for pending tasks", () => {
      const task = createTask({ status: "pending", title: "Waiting task" });

      render(<TaskItem task={task} index={0} />);

      const taskText = screen.getByText("Waiting task");
      expect(taskText).toHaveClass("text-ink-500");
    });
  });

  describe("duration and status text", () => {
    it("should display duration for in_progress tasks", () => {
      const task = createTask({
        status: "in_progress",
        duration: "2m 30s",
      });

      render(<TaskItem task={task} index={0} />);

      expect(screen.getByText("2m 30s")).toBeInTheDocument();
    });

    it("should display status text for in_progress tasks", () => {
      const task = createTask({
        status: "in_progress",
        duration: "1m",
        statusText: "Processing data...",
      });

      render(<TaskItem task={task} index={0} />);

      expect(screen.getByText("Processing data...")).toBeInTheDocument();
    });

    it("should not display duration for completed tasks", () => {
      const task = createTask({
        status: "completed",
        duration: "5m 00s",
      });

      render(<TaskItem task={task} index={0} />);

      expect(screen.queryByText("5m 00s")).not.toBeInTheDocument();
    });

    it("should not display duration for pending tasks", () => {
      const task = createTask({
        status: "pending",
        duration: "0m",
      });

      render(<TaskItem task={task} index={0} />);

      expect(screen.queryByText("0m")).not.toBeInTheDocument();
    });

    it("should display separator between duration and status text", () => {
      const task = createTask({
        status: "in_progress",
        duration: "1m",
        statusText: "Running...",
      });

      render(<TaskItem task={task} index={0} />);

      expect(screen.getByText("·")).toBeInTheDocument();
    });
  });

  describe("index-based animation delay", () => {
    it("should render with animation styles", () => {
      const task = createTask();

      // Just verify the component renders - animation testing is handled by framer-motion
      const { container } = render(<TaskItem task={task} index={2} />);

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("should handle empty title", () => {
      const task = createTask({ title: "" });

      const { container } = render(<TaskItem task={task} index={0} />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("should handle very long title", () => {
      const longTitle = "A".repeat(200);
      const task = createTask({ title: longTitle });

      render(<TaskItem task={task} index={0} />);

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it("should handle special characters in title", () => {
      const task = createTask({ title: 'Task with <special> & "characters"' });

      render(<TaskItem task={task} index={0} />);

      expect(screen.getByText('Task with <special> & "characters"')).toBeInTheDocument();
    });
  });
});
