/**
 * Tests for ArtifactCard component
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArtifactCard } from "./ArtifactCard";
import type { Artifact, ArtifactKind } from "@/types/artifacts";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, onClick, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} onClick={onClick} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock storage functions
vi.mock("@/lib/storage", () => ({
  getArtifactRevisions: vi.fn(() => []),
}));

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};
Object.assign(navigator, { clipboard: mockClipboard });

// Mock URL APIs
const mockCreateObjectURL = vi.fn(() => "blob:test-url");
const mockRevokeObjectURL = vi.fn();
Object.assign(URL, {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

describe("ArtifactCard", () => {
  const createArtifact = (overrides: Partial<Artifact> = {}): Artifact => ({
    id: "artifact-1",
    sessionId: "session-1",
    title: "Test Artifact",
    filename: "test.txt",
    content: "Test content",
    kind: "text",
    mimeType: "text/plain",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render artifact title", () => {
      const artifact = createArtifact({ title: "My Document" });

      render(<ArtifactCard artifact={artifact} />);

      expect(screen.getByText("My Document")).toBeInTheDocument();
    });

    it("should render artifact filename", () => {
      const artifact = createArtifact({ filename: "document.md" });

      render(<ArtifactCard artifact={artifact} />);

      expect(screen.getByText("document.md")).toBeInTheDocument();
    });

    it("should render language badge when specified", () => {
      const artifact = createArtifact({ language: "typescript" });

      render(<ArtifactCard artifact={artifact} />);

      expect(screen.getByText("typescript")).toBeInTheDocument();
    });

    it("should not render language badge when not specified", () => {
      const artifact = createArtifact({ language: undefined });

      render(<ArtifactCard artifact={artifact} />);

      expect(screen.queryByText("typescript")).not.toBeInTheDocument();
    });
  });

  describe("artifact kinds", () => {
    const kinds: ArtifactKind[] = ["text", "markdown", "html", "code", "json", "image"];

    it.each(kinds)("should render icon for kind: %s", (kind) => {
      const artifact = createArtifact({ kind });

      const { container } = render(<ArtifactCard artifact={artifact} />);

      // Should have an SVG icon
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should apply correct color for code kind", () => {
      const artifact = createArtifact({ kind: "code" });

      const { container } = render(<ArtifactCard artifact={artifact} />);

      const iconWrapper = container.querySelector(".text-terminal-green");
      expect(iconWrapper).toBeInTheDocument();
    });

    it("should apply correct color for json kind", () => {
      const artifact = createArtifact({ kind: "json" });

      const { container } = render(<ArtifactCard artifact={artifact} />);

      const iconWrapper = container.querySelector(".text-terminal-amber");
      expect(iconWrapper).toBeInTheDocument();
    });
  });

  describe("selection", () => {
    it("should call onSelect when clicked", () => {
      const onSelect = vi.fn();
      const artifact = createArtifact();

      render(<ArtifactCard artifact={artifact} onSelect={onSelect} />);

      const header = screen.getByText("Test Artifact").closest("div");
      fireEvent.click(header!.parentElement!);

      expect(onSelect).toHaveBeenCalledWith(artifact);
    });

    it("should apply selected styling when isSelected is true", () => {
      const artifact = createArtifact();

      const { container } = render(<ArtifactCard artifact={artifact} isSelected />);

      const card = container.firstChild;
      expect(card).toHaveClass("border-terminal-blue");
    });

    it("should apply default styling when not selected", () => {
      const artifact = createArtifact();

      const { container } = render(<ArtifactCard artifact={artifact} isSelected={false} />);

      const card = container.firstChild;
      expect(card).toHaveClass("border-ink-200");
    });
  });

  describe("copy functionality", () => {
    it("should copy content to clipboard", async () => {
      const artifact = createArtifact({ content: "Copy this content" });
      mockClipboard.writeText.mockResolvedValueOnce(undefined);

      render(<ArtifactCard artifact={artifact} />);

      const copyButton = screen.getByTitle("Copy content");
      fireEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalledWith("Copy this content");
    });

    it("should stop event propagation on copy button click", async () => {
      const onSelect = vi.fn();
      const artifact = createArtifact();
      mockClipboard.writeText.mockResolvedValueOnce(undefined);

      render(<ArtifactCard artifact={artifact} onSelect={onSelect} />);

      const copyButton = screen.getByTitle("Copy content");
      fireEvent.click(copyButton);

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("should handle clipboard errors gracefully", async () => {
      const artifact = createArtifact();
      mockClipboard.writeText.mockRejectedValueOnce(new Error("Access denied"));

      render(<ArtifactCard artifact={artifact} />);

      const copyButton = screen.getByTitle("Copy content");

      expect(() => fireEvent.click(copyButton)).not.toThrow();
    });
  });

  describe("download functionality", () => {
    it("should have download button", () => {
      const artifact = createArtifact();

      render(<ArtifactCard artifact={artifact} />);

      expect(screen.getByTitle("Download")).toBeInTheDocument();
    });

    it("should stop event propagation on download button click", () => {
      const onSelect = vi.fn();
      const artifact = createArtifact();

      render(<ArtifactCard artifact={artifact} onSelect={onSelect} />);

      const downloadButton = screen.getByTitle("Download");
      fireEvent.click(downloadButton);

      // onSelect should not be called because of stopPropagation
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("should call URL.createObjectURL when download is clicked", () => {
      const artifact = createArtifact({
        filename: "test.txt",
        content: "Test content",
        mimeType: "text/plain",
      });

      render(<ArtifactCard artifact={artifact} />);

      const downloadButton = screen.getByTitle("Download");
      fireEvent.click(downloadButton);

      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  describe("delete functionality", () => {
    it("should render delete button when onDelete is provided", () => {
      const artifact = createArtifact();
      const onDelete = vi.fn();

      render(<ArtifactCard artifact={artifact} onDelete={onDelete} />);

      expect(screen.getByTitle("Delete")).toBeInTheDocument();
    });

    it("should not render delete button when onDelete is not provided", () => {
      const artifact = createArtifact();

      render(<ArtifactCard artifact={artifact} />);

      expect(screen.queryByTitle("Delete")).not.toBeInTheDocument();
    });

    it("should call onDelete with artifact id when clicked", () => {
      const artifact = createArtifact({ id: "delete-me" });
      const onDelete = vi.fn();

      render(<ArtifactCard artifact={artifact} onDelete={onDelete} />);

      const deleteButton = screen.getByTitle("Delete");
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledWith("delete-me");
    });

    it("should stop event propagation on delete button click", () => {
      const onSelect = vi.fn();
      const onDelete = vi.fn();
      const artifact = createArtifact();

      render(<ArtifactCard artifact={artifact} onDelete={onDelete} onSelect={onSelect} />);

      const deleteButton = screen.getByTitle("Delete");
      fireEvent.click(deleteButton);

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("expand/collapse", () => {
    it("should not show preview when collapsed", () => {
      const artifact = createArtifact({ content: "Preview content here" });

      render(<ArtifactCard artifact={artifact} />);

      // The pre element should not be visible initially
      expect(screen.queryByText("Preview content here")).not.toBeInTheDocument();
    });

    it("should show preview when expanded", () => {
      const artifact = createArtifact({ content: "Preview content here" });

      const { container } = render(<ArtifactCard artifact={artifact} />);

      // Find and click the chevron/expand button
      const chevronButton = container.querySelector('[class*="ml-1"]') as HTMLButtonElement;
      fireEvent.click(chevronButton);

      expect(screen.getByText(/Preview content here/)).toBeInTheDocument();
    });

    it("should truncate long content with indicator", () => {
      const longContent = "Line\n".repeat(20) + "Last line";
      const artifact = createArtifact({ content: longContent });

      const { container } = render(<ArtifactCard artifact={artifact} />);

      // Expand
      const chevronButton = container.querySelector('[class*="ml-1"]') as HTMLButtonElement;
      fireEvent.click(chevronButton);

      // Should show truncation indicator
      expect(screen.getByText(/chars total/)).toBeInTheDocument();
    });
  });

  describe("metadata display", () => {
    it("should display relative time", () => {
      const artifact = createArtifact({ updatedAt: new Date(Date.now() - 60000).toISOString() }); // 1 minute ago

      render(<ArtifactCard artifact={artifact} />);

      // Should show some time indicator (exact text depends on formatRelativeTime)
      const timeText = screen.getByText(/ago|min|sec|now/i);
      expect(timeText).toBeInTheDocument();
    });

    it("should display tags when present", () => {
      const artifact = createArtifact({ tags: ["react", "typescript", "ui"] });

      render(<ArtifactCard artifact={artifact} />);

      expect(screen.getByText(/react, typescript, ui/)).toBeInTheDocument();
    });

    it("should truncate many tags", () => {
      const artifact = createArtifact({
        tags: ["tag1", "tag2", "tag3", "tag4", "tag5"],
      });

      render(<ArtifactCard artifact={artifact} />);

      expect(screen.getByText(/\+2/)).toBeInTheDocument();
    });

    it("should display agent intent badge when present", () => {
      const artifact = createArtifact({
        agentContext: { intent: "documentation" },
      });

      render(<ArtifactCard artifact={artifact} />);

      expect(screen.getByText("documentation")).toBeInTheDocument();
    });
  });

  describe("agent context display", () => {
    it("should display agent context when expanded", () => {
      const artifact = createArtifact({
        agentContext: {
          persona: "Technical Writer",
          intent: "documentation",
          confidence: 0.95,
          reasoning: "Based on content structure",
        },
      });

      const { container } = render(<ArtifactCard artifact={artifact} />);

      // Expand
      const chevronButton = container.querySelector('[class*="ml-1"]') as HTMLButtonElement;
      fireEvent.click(chevronButton);

      expect(screen.getByText("Agent Context")).toBeInTheDocument();
      expect(screen.getByText("Technical Writer")).toBeInTheDocument();
      expect(screen.getByText("95%")).toBeInTheDocument();
      expect(screen.getByText("Based on content structure")).toBeInTheDocument();
    });
  });

  describe("history", () => {
    it("should render history button", () => {
      const artifact = createArtifact();

      render(<ArtifactCard artifact={artifact} />);

      expect(screen.getByTitle("History")).toBeInTheDocument();
    });

    it("should toggle history view when button clicked", async () => {
      const { getArtifactRevisions } = await import("@/lib/storage");
      (getArtifactRevisions as ReturnType<typeof vi.fn>).mockReturnValue([
        {
          id: "rev-1",
          artifactId: "artifact-1",
          content: "Old content",
          source: "user",
          createdAt: Date.now() - 3600000,
        },
      ]);

      const artifact = createArtifact();

      render(<ArtifactCard artifact={artifact} onRestore={vi.fn()} />);

      const historyButton = screen.getByTitle("History");
      fireEvent.click(historyButton);

      expect(screen.getByText(/Revision History/)).toBeInTheDocument();
      expect(screen.getByText("user")).toBeInTheDocument();
    });

    it("should call onRestore when restore button clicked", async () => {
      const { getArtifactRevisions } = await import("@/lib/storage");
      (getArtifactRevisions as ReturnType<typeof vi.fn>).mockReturnValue([
        {
          id: "rev-1",
          artifactId: "artifact-1",
          content: "Old content",
          source: "backup",
          createdAt: Date.now() - 3600000,
        },
      ]);

      const onRestore = vi.fn();
      const artifact = createArtifact();

      render(<ArtifactCard artifact={artifact} onRestore={onRestore} />);

      // Open history
      const historyButton = screen.getByTitle("History");
      fireEvent.click(historyButton);

      // Click restore
      const restoreButton = screen.getByText("Restore");
      fireEvent.click(restoreButton);

      expect(onRestore).toHaveBeenCalledWith("rev-1");
    });
  });

  describe("edge cases", () => {
    it("should handle empty content", () => {
      const artifact = createArtifact({ content: "" });

      const { container } = render(<ArtifactCard artifact={artifact} />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("should handle very long title", () => {
      const longTitle = "A".repeat(100);
      const artifact = createArtifact({ title: longTitle });

      render(<ArtifactCard artifact={artifact} />);

      const title = screen.getByText(longTitle);
      expect(title).toHaveClass("truncate");
    });

    it("should handle missing optional fields", () => {
      const artifact = createArtifact({
        language: undefined,
        tags: undefined,
        agentContext: undefined,
      });

      const { container } = render(<ArtifactCard artifact={artifact} />);

      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
