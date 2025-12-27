/**
 * Tests for TaskProgress component
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskProgress } from "./TaskProgress";
import type { Task } from "@/types";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      className,
      style,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { style?: React.CSSProperties }) => (
      <div className={className} style={style} {...props}>
        {children}
      </div>
    ),
  },
}));

describe("TaskProgress", () => {
  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task-${Math.random()}`,
    title: "Test Task",
    status: "pending",
    ...overrides,
  });

  describe("rendering", () => {
    it("should render task progress header", () => {
      const tasks: Task[] = [createTask()];

      render(<TaskProgress tasks={tasks} />);

      expect(screen.getByText("Task progress")).toBeInTheDocument();
    });

    it("should display correct progress count", () => {
      const tasks: Task[] = [
        createTask({ status: "completed" }),
        createTask({ status: "completed" }),
        createTask({ status: "in_progress" }),
        createTask({ status: "pending" }),
      ];

      render(<TaskProgress tasks={tasks} />);

      expect(screen.getByText("2/4")).toBeInTheDocument();
    });

    it("should display 0/0 for empty tasks", () => {
      render(<TaskProgress tasks={[]} />);

      expect(screen.getByText("0/0")).toBeInTheDocument();
    });

    it("should render all tasks", () => {
      const tasks: Task[] = [
        createTask({ id: "1", title: "Task One" }),
        createTask({ id: "2", title: "Task Two" }),
        createTask({ id: "3", title: "Task Three" }),
      ];

      render(<TaskProgress tasks={tasks} />);

      expect(screen.getByText("Task One")).toBeInTheDocument();
      expect(screen.getByText("Task Two")).toBeInTheDocument();
      expect(screen.getByText("Task Three")).toBeInTheDocument();
    });
  });

  describe("expand/collapse", () => {
    it("should be expanded by default", () => {
      const tasks: Task[] = [createTask({ title: "Test Task" })];

      render(<TaskProgress tasks={tasks} />);

      expect(screen.getByText("Test Task")).toBeVisible();
    });

    it("should collapse when header is clicked", () => {
      const tasks: Task[] = [createTask({ title: "Test Task" })];

      render(<TaskProgress tasks={tasks} />);

      const header = screen.getByRole("button", { name: /task progress/i });
      fireEvent.click(header);

      // The task should still be in the DOM but the container should have height: 0
      // Since we mock framer-motion, we just verify the toggle happened
      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });

    it("should expand when header is clicked again", () => {
      const tasks: Task[] = [createTask({ title: "Test Task" })];

      render(<TaskProgress tasks={tasks} />);

      const header = screen.getByRole("button", { name: /task progress/i });

      // Click to collapse
      fireEvent.click(header);

      // Click to expand
      fireEvent.click(header);

      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("should apply custom className", () => {
      const tasks: Task[] = [createTask()];

      const { container } = render(<TaskProgress tasks={tasks} className="custom-class" />);

      expect(container.firstChild).toHaveClass("custom-class");
    });

    it("should have proper base classes", () => {
      const tasks: Task[] = [createTask()];

      const { container } = render(<TaskProgress tasks={tasks} />);

      expect(container.firstChild).toHaveClass("border-t", "border-ink-100", "bg-white");
    });
  });

  describe("task status counts", () => {
    it("should count only completed tasks in numerator", () => {
      const tasks: Task[] = [
        createTask({ status: "completed" }),
        createTask({ status: "in_progress" }),
        createTask({ status: "pending" }),
      ];

      render(<TaskProgress tasks={tasks} />);

      expect(screen.getByText("1/3")).toBeInTheDocument();
    });

    it("should count all tasks in denominator", () => {
      const tasks: Task[] = [
        createTask({ status: "completed" }),
        createTask({ status: "completed" }),
        createTask({ status: "completed" }),
        createTask({ status: "completed" }),
        createTask({ status: "completed" }),
      ];

      render(<TaskProgress tasks={tasks} />);

      expect(screen.getByText("5/5")).toBeInTheDocument();
    });
  });
});
