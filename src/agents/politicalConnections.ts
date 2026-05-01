import { createDeepAgent, type SubAgent } from "deepagents";
import { llm } from "@llm/index";
import { modelCallLimitMiddleware, toolCallLimitMiddleware } from "langchain";
import { politicalConnectionsSubAgent } from "@sub-agents/finance";

const politicalConnectionsSubagents: SubAgent[] = [politicalConnectionsSubAgent];

const POLITICAL_CONNECTIONS_PROMPT = `You are a Political Connections Analyst. Identify political connections, lobbying activity, and regulatory favors related to the target company. Delegate all political connections data retrieval to your subagents. Do not call external data sources directly. Return a concise, structured summary with clear sources and noted uncertainties.`;

export const politicalConnectionsAgent = await createDeepAgent({
  name: "Political Connections Analyst",
  systemPrompt: POLITICAL_CONNECTIONS_PROMPT,
  model: llm,
  subagents: politicalConnectionsSubagents,
  middleware: [
    modelCallLimitMiddleware({
      runLimit: 10,
      exitBehavior: "end",
    }),
    toolCallLimitMiddleware({
      runLimit: 10,
      exitBehavior: "continue",
    }),
  ],
});
