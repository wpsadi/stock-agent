# stock-agent

A LangGraph-based stock analysis conference system with multiple AI panelists.

## Setup

1. Install dependencies:
```bash
bun install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys:
# - LANGSMITH_API_KEY (required for langgraph dev)
# - OPENAI_API_KEY (required for LLM calls)
```

## Running

### Standard execution
```bash
bun start
```

### LangGraph Dev Server (with UI)
```bash
bun run langgraph:dev
```
This starts the LangGraph Studio at http://localhost:2024 where you can:
- Visualize the graph flow
- Debug with checkpoints
- Stream node outputs in real-time
- Replay executions

### LangGraph Studio (separate UI)
```bash
bun run langgraph:studio
```

## Graph Structure

The `stock-conference` graph implements a multi-round equity research panel:

```
START → gather → memorandum → round (loop) → report → END
```
