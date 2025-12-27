import { type NextRequest } from "next/server";

// Types for the agent API
export interface AgentRequest {
  prompt: string;
  apiKey: string;
  model?: string;
  maxTurns?: number;
  workingDirectory?: string;
  sessionId?: string;
}

export interface AgentEvent {
  type:
    | "init"
    | "tool_start"
    | "tool_end"
    | "thinking"
    | "message"
    | "result"
    | "error"
    | "status";
  data: Record<string, unknown>;
  timestamp: string;
}

// POST handler for starting/continuing an agent session
export async function POST(request: NextRequest) {
  const body = (await request.json()) as AgentRequest;
  const { prompt, apiKey, model, maxTurns, workingDirectory, sessionId } = body;

  if (!apiKey) {
    return Response.json({ error: "API key is required" }, { status: 400 });
  }

  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  // Set the API key in environment for the SDK
  process.env.ANTHROPIC_API_KEY = apiKey;

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: AgentEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        // Dynamic import to avoid bundling issues
        const { query } = await import("@anthropic-ai/claude-code");
        type Options = Parameters<typeof query>[0]["options"];

        // Send init event
        sendEvent({
          type: "init",
          data: { status: "starting", model: model || "claude-sonnet-4-20250514" },
          timestamp: new Date().toISOString(),
        });

        // Run the agent
        const agentOptions: Options = {
          allowedTools: [
            "Read",
            "Write",
            "Edit",
            "Bash",
            "Glob",
            "Grep",
            "WebSearch",
            "WebFetch",
            "Task",
          ],
          maxTurns: maxTurns || 50,
          cwd: workingDirectory || process.cwd(),
          model: model || "claude-sonnet-4-20250514",
          permissionMode: "acceptEdits",
        };

        // Resume session if provided
        if (sessionId) {
          agentOptions.resume = sessionId;
        }

        for await (const message of query({
          prompt,
          options: agentOptions,
        })) {
          // Handle different message types
          if (message.type === "system" && message.subtype === "init") {
            sendEvent({
              type: "init",
              data: {
                sessionId: message.session_id,
                tools: message.tools,
                model: message.model,
                cwd: message.cwd,
              },
              timestamp: new Date().toISOString(),
            });
          }

          if (message.type === "assistant") {
            // Parse the message content to extract tool uses
            const content = message.message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "tool_use") {
                  sendEvent({
                    type: "tool_start",
                    data: {
                      toolId: block.id,
                      toolName: block.name,
                      input: block.input,
                    },
                    timestamp: new Date().toISOString(),
                  });
                } else if (block.type === "text") {
                  sendEvent({
                    type: "message",
                    data: { text: block.text },
                    timestamp: new Date().toISOString(),
                  });
                }
              }
            }
          }

          if (message.type === "user" && "message" in message) {
            // Tool results
            const content = message.message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "tool_result") {
                  sendEvent({
                    type: "tool_end",
                    data: {
                      toolId: block.tool_use_id,
                      result:
                        typeof block.content === "string"
                          ? block.content
                          : JSON.stringify(block.content),
                      isError: block.is_error,
                    },
                    timestamp: new Date().toISOString(),
                  });
                }
              }
            }
          }

          if (message.type === "result") {
            const resultData: Record<string, unknown> = {
              success: message.subtype === "success",
              duration: message.duration_ms,
              cost: message.total_cost_usd,
              turns: message.num_turns,
              sessionId: message.session_id,
            };

            // Only include result text for success subtype
            if (message.subtype === "success" && "result" in message) {
              resultData.result = message.result;
            }

            sendEvent({
              type: "result",
              data: resultData,
              timestamp: new Date().toISOString(),
            });
          }
        }

        controller.close();
      } catch (error) {
        sendEvent({
          type: "error",
          data: {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
          },
          timestamp: new Date().toISOString(),
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
