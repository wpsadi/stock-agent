import { llm } from "@llm/index";
import { internetSearch } from "@tools/internet-search";
import type { SubAgent } from "deepagents";


const SYSTEM_PROMPT=`
  You are a web search agent that retrieves accurate, up-to-date information using Tavily search.

  For every query:
  1. Understand the user’s intent and construct an optimal search query.
  2. Call tavily_search first to fetch relevant results.
  3. Analyze and synthesize the results into a concise, accurate answer.
  4. Prefer recent, high-quality sources.

  Rules:
  - Always use tavily_search when the query involves current events, external data, or unknown facts.
  - Do not hallucinate; base answers strictly on retrieved results.
  - If results are insufficient, refine the search query and retry once.
  - Keep responses concise and factual.
  - Include key findings, not raw dumps.
  - Mention uncertainty if sources conflict.
`

const searchSubagent: SubAgent = {
  name: "Web Search Agent",
  description: "A real-time web search agent that uses Tavily to retrieve and summarize up-to-date information from the internet.",
  systemPrompt: SYSTEM_PROMPT,
  tools: [internetSearch],
  
  model: llm,  // Optional override, defaults to main agent model
};

export { searchSubagent };