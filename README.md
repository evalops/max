# Max

An AI agent dashboard built with Next.js, TypeScript, and Tailwind CSS. Provides a visual interface for interacting with Claude agents via the Claude SDK.

## Features

- **Activity Feed**: Real-time timeline of agent activities (file reads, writes, commands, etc.)
- **Computer Panel**: Shows agent's current work, document preview, and task progress
- **Artifacts Panel**: Conductor-style artifact management with revisions and search
- **Tool Runs Panel**: Track and inspect tool executions with logs and output
- **Cost Tracking**: Monitor token usage and session costs
- **Settings**: Configure API key, model selection, working directory, and preferences

## Getting Started

### Prerequisites

- Node.js 18+
- An Anthropic API key

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configuration

1. Click the settings icon in the activity panel header
2. Enter your Anthropic API key
3. Select your preferred model (Claude Sonnet 4, Opus 4.5, or Haiku 4.5)
4. Set your working directory

## Architecture

```
src/
├── app/                 # Next.js App Router
│   ├── api/agent/       # SSE streaming endpoint for Claude SDK
│   └── page.tsx         # Main entry point
├── components/
│   ├── activity/        # Activity feed components
│   ├── artifacts/       # Artifact management
│   ├── cost/            # Cost tracking panel
│   ├── dashboard/       # Main dashboard layout
│   ├── input/           # Message input
│   ├── panels/          # Computer panel
│   ├── settings/        # Settings panel
│   ├── tasks/           # Task progress
│   └── toolruns/        # Tool run tracking
├── hooks/               # Custom React hooks
├── lib/                 # Utilities and storage
├── store/               # Zustand state management
└── types/               # TypeScript types
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand with persistence
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Fonts**: Geist Sans & Geist Mono
- **Agent SDK**: @anthropic-ai/claude-code

## License

MIT
