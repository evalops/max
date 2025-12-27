/**
 * Tests for EmptyState component
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "./EmptyState";
import { FileText } from "lucide-react";

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

describe("EmptyState", () => {
  it("should render title and description", () => {
    render(
      <EmptyState
        icon={FileText}
        title="No items found"
        description="There are no items to display"
      />
    );

    expect(screen.getByText("No items found")).toBeInTheDocument();
    expect(screen.getByText("There are no items to display")).toBeInTheDocument();
  });

  it("should render the icon", () => {
    const { container } = render(
      <EmptyState icon={FileText} title="No items" description="Nothing here" />
    );

    const iconContainer = container.querySelector("svg");
    expect(iconContainer).toBeInTheDocument();
  });

  it("should render action button when provided", () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={FileText}
        title="No items"
        description="Nothing here"
        action={{
          label: "Create Item",
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByRole("button", { name: "Create Item" });
    expect(button).toBeInTheDocument();
  });

  it("should call action onClick when button is clicked", () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={FileText}
        title="No items"
        description="Nothing here"
        action={{
          label: "Create Item",
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByRole("button", { name: "Create Item" });
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should not render action button when not provided", () => {
    render(<EmptyState icon={FileText} title="No items" description="Nothing here" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <EmptyState
        icon={FileText}
        title="No items"
        description="Nothing here"
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
