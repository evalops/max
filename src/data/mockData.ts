import type { ActivityItem, Task, Document, AgentState } from "@/types";

export const mockAgent: AgentState = {
  name: "Max",
  currentActivity: "Editor",
  currentFile: "research_findings/SYNTHESIS.md",
  isThinking: false,
};

export const mockDocument: Document = {
  id: "doc-1",
  filename: "SYNTHESIS.md",
  language: "markdown",
  content: `### Theme 5: Just-In-Time Context Loading

**Convergent Finding**: All sources recommend loading context on-demand rather than pre-stuffing.

**Anthropic's Approach**:
− "Write to files" pattern for persistent state
− "Read from files" for just-in-time loading
− Lightweight identifiers instead of full content

**Google ADK's Approach**:
− Artifacts: Handle pattern (references, not content)
− Memory: Reactive recall (agent requests) vs Proactive recall (pre-loaded)
− LoadArtifactsTool for on-demand access

**LangChain's Approach**:
− Dynamic context assembly based on task requirements
− Retrieval-augmented approaches for knowledge

**Skill Implication**: Enhance "context-optimization" with JIT loading patterns.`,
};

export const mockTasks: Task[] = [
  {
    id: "task-1",
    title: "Research Tier 1 sources for Context Engineering content",
    status: "completed",
  },
  {
    id: "task-2",
    title: "Search academic papers and arXiv for Context Engineering research",
    status: "completed",
  },
  {
    id: "task-3",
    title: "Clone repository and analyze existing Skills structure",
    status: "completed",
  },
  {
    id: "task-4",
    title: "Synthesize findings and extract key insights",
    status: "completed",
  },
  {
    id: "task-5",
    title: "Create Skill recommendations document",
    status: "in_progress",
    duration: "3:15",
    statusText: "Thinking",
  },
  {
    id: "task-6",
    title: "Deliver research findings and Skill recommendations",
    status: "pending",
  },
];

export const mockActivities: ActivityItem[] = [
  {
    id: "act-1",
    type: "command",
    title: "Executing command",
    description: "cd /home/ubuntu && gh repo clone muratcankoylan/Agent-Skills-for-Context-Engineering...",
    timestamp: new Date(Date.now() - 1000 * 60 * 8),
    duration: "19:29",
    status: "completed",
  },
  {
    id: "act-2",
    type: "github",
    title: "Accessing GitHub",
    description: "cd /home/ubuntu && gh repo clone muratcankoylan/Agent-Skills-for-Context-Engineering...",
    timestamp: new Date(Date.now() - 1000 * 60 * 7),
    status: "completed",
  },
  {
    id: "act-3",
    type: "command",
    title: "Executing command",
    description: "cd /home/ubuntu/Agent-Skills-for-Context-Engineering...",
    timestamp: new Date(Date.now() - 1000 * 60 * 6),
    status: "completed",
  },
  {
    id: "act-4",
    type: "file_read",
    title: "Reading file",
    description: "Agent-Skills-for-Context-Engineering/SKILL.md",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    status: "completed",
  },
  {
    id: "act-5",
    type: "command",
    title: "Executing command",
    description: "cd /home/ubuntu/Agent-Skills-for-Context-Engineering...",
    timestamp: new Date(Date.now() - 1000 * 60 * 4),
    status: "completed",
  },
  {
    id: "act-6",
    type: "file_read",
    title: "Reading file",
    description: "Agent-Skills-for-Context-Engineering/skills/context_fundame...",
    timestamp: new Date(Date.now() - 1000 * 60 * 3.5),
    status: "completed",
    children: [
      {
        id: "child-6-1",
        type: "info",
        title: "Handling file reading issue",
      },
    ],
  },
  {
    id: "act-7",
    type: "file_read",
    title: "Reading file",
    description: "Agent-Skills-for-Context-Engineering/template/SKILL.md",
    timestamp: new Date(Date.now() - 1000 * 60 * 3),
    status: "completed",
  },
  {
    id: "act-8",
    type: "thinking",
    title: "Synthesize findings and extract key insights",
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    status: "completed",
    isExpanded: true,
    children: [
      {
        id: "child-8-1",
        type: "knowledge",
        title: "Knowledge recalled(1)",
        description: "Technical Research Source Prioritization",
        isExpanded: true,
      },
    ],
  },
  {
    id: "act-9",
    type: "file_create",
    title: "Creating file",
    description: "research_findings/SYNTHESIS.md",
    timestamp: new Date(Date.now() - 1000 * 60 * 1.5),
    status: "completed",
  },
  {
    id: "act-10",
    type: "thinking",
    title: "Create Skill recommendations document",
    timestamp: new Date(Date.now() - 1000 * 60 * 1),
    status: "running",
    isExpanded: true,
    children: [
      {
        id: "child-10-1",
        type: "knowledge",
        title: "Knowledge recalled(1)",
        isExpanded: true,
      },
    ],
  },
  {
    id: "act-11",
    type: "command",
    title: "Executing command",
    description: "mkdir -p /home/ubuntu/Agent-Skills-for-Context-Engineering...",
    timestamp: new Date(Date.now() - 1000 * 30),
    status: "running",
  },
];

export const mockStatusTexts = [
  {
    afterId: "act-5",
    text: "Explored the repository structure; key skills include context fundamentals, multi-agent patterns, memory, tools, and evaluation. Next, will analyze these core skills for insights.",
  },
  {
    afterId: "act-7",
    text: "Analyzing the core skills, especially context fundamentals, reveals key components like system prompts, tools, and retrieval strategies. Next, I will synthesize this info into structured skill recommendations.",
  },
  {
    afterId: "act-8",
    text: "Focusing on Tier 1 sources about Context Engineering, I will identify authoritative materials to understand essential skills like system prompts, tools, and retrieval strategies for effective synthesis.",
  },
  {
    afterId: "act-9",
    text: "Reviewed Tier 1 sources on Context Engineering; compiled key insights into a synthesis document to guide understanding of system prompts, tools, and retrieval strategies. Next, analyze academic research.",
  },
];
