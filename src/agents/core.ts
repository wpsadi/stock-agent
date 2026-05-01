import { createDeepAgent, type SubAgent } from "deepagents";
import { llm } from "@llm/index";
import { modelCallLimitMiddleware, toolCallLimitMiddleware } from "langchain";
import { financeSubagent } from "@sub-agents/financeSubagent";
import { newsSubagent } from "@sub-agents/newsSubAgent";

const coreFinanceSubagents: SubAgent[] = [financeSubagent];
const coreNewsSubagents: SubAgent[] = [newsSubagent];

const CORE_FINANCE_PROMPT = `You are the Core Finance Agent. Retrieve and summarize current market and financial data for the target company. Delegate all finance data retrieval to your subagents. Do not call external data sources directly. Return a concise, structured summary with key metrics and any data gaps.`;

const CORE_NEWS_PROMPT = `You are the Core News Agent. Retrieve and summarize recent news and sentiment for the target company. Delegate all news retrieval to your subagents. Do not call external data sources directly. Return a concise, structured summary with key headlines and dates.`;

export const coreFinanceAgent = await createDeepAgent({
  name: "Core Finance Agent",
  systemPrompt: CORE_FINANCE_PROMPT,
  model: llm,
  subagents: coreFinanceSubagents,
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

export const coreNewsAgent = await createDeepAgent({
  name: "Core News Agent",
  systemPrompt: CORE_NEWS_PROMPT,
  model: llm,
  subagents: coreNewsSubagents,
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
