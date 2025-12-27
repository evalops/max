/**
 * Tests for the Agent API route
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock all dependencies before importing the route
vi.mock("@anthropic-ai/claude-code", () => ({
  query: vi.fn(async function* () {
    yield {
      type: "result",
      subtype: "success",
      duration_ms: 1000,
      total_cost_usd: 0.01,
      num_turns: 1,
      session_id: "test-session",
      result: "Done",
    };
  }),
}));

vi.mock("@/lib/github-mcp", () => ({
  createGitHubMcpServer: vi.fn(() => ({})),
}));

vi.mock("@/lib/research-mcp", () => ({
  createResearchMcpServer: vi.fn(async () => ({})),
}));

import { POST, type AgentRequest, type AgentEvent } from "./route";

function createRequest(body: Partial<AgentRequest>): NextRequest {
  return new NextRequest("http://localhost:3000/api/agent", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function readSSEStream(response: Response): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) return events;

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event = JSON.parse(line.slice(6)) as AgentEvent;
          events.push(event);
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  return events;
}

describe("Agent API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/agent - validation", () => {
    it("should return 400 if API key is missing", async () => {
      const request = createRequest({
        prompt: "Hello",
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("API key is required");
    });

    it("should return 400 if prompt is missing", async () => {
      const request = createRequest({
        apiKey: "test-key",
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Prompt is required");
    });

    it("should return 400 if both apiKey and prompt are missing", async () => {
      const request = createRequest({});

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("API key is required");
    });

    it("should return 400 if apiKey is empty string", async () => {
      const request = createRequest({
        apiKey: "",
        prompt: "Hello",
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("API key is required");
    });

    it("should return 400 if prompt is empty string", async () => {
      const request = createRequest({
        apiKey: "test-key",
        prompt: "",
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Prompt is required");
    });
  });

  describe("POST /api/agent - SSE stream", () => {
    it("should return SSE stream with correct headers", async () => {
      const request = createRequest({
        apiKey: "test-key",
        prompt: "Hello",
      });

      const response = await POST(request);

      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
      expect(response.headers.get("Cache-Control")).toBe("no-cache");
      expect(response.headers.get("Connection")).toBe("keep-alive");
    });

    it("should return a readable stream body", async () => {
      const request = createRequest({
        apiKey: "test-key",
        prompt: "Hello",
      });

      const response = await POST(request);

      expect(response.body).toBeDefined();
      expect(response.body).not.toBeNull();
    });

    it("should send events as SSE format", async () => {
      const request = createRequest({
        apiKey: "test-key",
        prompt: "Hello",
      });

      const response = await POST(request);
      const events = await readSSEStream(response);

      // Should have at least the init event
      expect(events.length).toBeGreaterThan(0);
    });

    it("should include timestamps in events", async () => {
      const request = createRequest({
        apiKey: "test-key",
        prompt: "Hello",
      });

      const response = await POST(request);
      const events = await readSSEStream(response);

      // All events should have timestamps
      for (const event of events) {
        expect(event.timestamp).toBeDefined();
        expect(new Date(event.timestamp).getTime()).not.toBeNaN();
      }
    });
  });
});
