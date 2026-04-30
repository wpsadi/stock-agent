import { llm } from "@llm/index";
import { SystemMessage, HumanMessage, ChatMessage, AIMessage } from "@langchain/core/messages";
import type { ConferenceState } from "../types";

export const compileMemorandum = async (input: { state: ConferenceState }) => {
  const { state } = input;
  const { companyName, ticker, rawData, messages } = state;

  if (!rawData) throw new Error("No raw data to compile");

  console.log(`\n[COMPILE_MEMO] Creating briefing for ${companyName}...`);

  const systemPrompt = `You are compiling a pre-conference memorandum (~2000 words).

Sections:
1. EXECUTIVE SNAPSHOT (industry, market cap, P/E, 52-week range)
2. FINANCIAL PERFORMANCE (revenue growth, margins, debt, cash flow)
3. RECENT NEWS & EVENTS (last 3-6 months)
4. NEWS SENTIMENT (tone, key headlines)
5. RISK ASSESSMENT (top 5 risks by severity/likelihood)
6. COMPETITIVE LANDSCAPE (competitors, market share, moat)
7. BUSINESS MODEL ANALYSIS (revenue streams, unit economics, scalability)
8. FORECAST SCENARIOS (base/bull/bear price targets)
9. CATALYSTS & EVENTS (upcoming catalysts)
10. PATTERN & ANOMALY SIGNALS (technical observations)
11. REGULATORY & POLICY FACTORS
12. MACRO / SECTOR CONTEXT
13. OPEN QUESTIONS

Format as clean markdown with headings. Use specific numbers.`;

  const humanPrompt = `Company: ${companyName} (${ticker})

Raw Data:
${JSON.stringify(rawData, null, 2)}
`;

  const result = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(humanPrompt),
  ]);
  const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
  console.log("[COMPILE_MEMO] Done\n");

  // Append LLM interaction to messages
  const newMessages = [
    new SystemMessage({ content: systemPrompt, additional_kwargs: { stage: "compileMemorandum", type: "system" } }),
    new HumanMessage({ content: humanPrompt, additional_kwargs: { stage: "compileMemorandum", type: "human" } }),
    new AIMessage({ content, additional_kwargs: { stage: "compileMemorandum", type: "ai" } }),
  ];

  return { state: { ...state, memorandum: content, messages: [...messages, ...newMessages] } };
};
