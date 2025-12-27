/**
 * Tests for StatusText component
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusText } from "./StatusText";

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

describe("StatusText", () => {
  describe("rendering", () => {
    it("should render the text content", () => {
      render(<StatusText text="Processing data..." index={0} />);

      expect(screen.getByText("Processing data...")).toBeInTheDocument();
    });

    it("should render with correct base classes", () => {
      render(<StatusText text="Status update" index={0} />);

      const paragraph = screen.getByText("Status update");
      expect(paragraph).toHaveClass("text-sm", "leading-relaxed", "text-ink-600");
    });

    it("should render the container with base styling", () => {
      const { container } = render(<StatusText text="Test" index={0} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("py-3", "pl-10");
    });
  });

  describe("className prop", () => {
    it("should apply custom className to container", () => {
      const { container } = render(<StatusText text="Test" index={0} className="custom-class" />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("custom-class");
    });

    it("should merge custom className with base classes", () => {
      const { container } = render(<StatusText text="Test" index={0} className="mt-4" />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass("py-3", "pl-10", "mt-4");
    });
  });

  describe("edge cases", () => {
    it("should handle empty text", () => {
      const { container } = render(<StatusText text="" index={0} />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("should handle very long text", () => {
      const longText = "A".repeat(500);
      render(<StatusText text={longText} index={0} />);

      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it("should handle special characters", () => {
      const specialText = 'Status: <pending> & "waiting" for @user';
      render(<StatusText text={specialText} index={0} />);

      expect(screen.getByText(specialText)).toBeInTheDocument();
    });

    it("should handle multiline text", () => {
      const multilineText = "Line 1\nLine 2\nLine 3";
      render(<StatusText text={multilineText} index={0} />);

      // Use a custom text matcher for multiline text
      expect(screen.getByText((content) => content.includes("Line 1"))).toBeInTheDocument();
    });

    it("should handle high index values", () => {
      const { container } = render(<StatusText text="Test" index={100} />);

      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
