# stock-agent

A LangGraph + LangChain stock analysis system with a chat assistant and multi-agent conference workflow.

# Important Information
This Orchestraion can't run on free tier llm it spawn to about 35-50 agents in total and each agent call about 3-5 times the llm, tools, so you will need a llm provider that can handle this amount of calls, also you will need to set up a proxy to avoid CORS issues with the llm provider, in the .env file you can set up the WEB_PROXY variable with your proxy url.

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

Available graphs:
- `chatGraph`: Chat-first assistant graph with middleware (PII detection, todo-list, context editing, model/tool retries and model fallback) plus conference tools.
- `conferenceGraph`: Core stock conference execution graph.

### LangGraph Studio (separate UI)
```bash
bun run langgraph:studio
```

## Graph Structure

The `stock-conference` graph implements a multi-round equity research panel:

```
START → gather → memorandum → round (loop) → report → END
```

The `chatGraph` runs `conferenceGraph` as a tool and returns the **final report** as the main user-facing output.
Reasoning traces and panel-message summaries are still available through follow-up queries/tooling when needed.
