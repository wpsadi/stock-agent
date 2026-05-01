import { createDeepAgent, type SubAgent } from "deepagents";
import { llm } from "@llm/index";
import { modelCallLimitMiddleware, toolCallLimitMiddleware } from "langchain";
import { financeSubagent } from "@sub-agents/financeSubagent";
import { newsSubagent } from "@sub-agents/newsSubAgent";
import { searchSubagent } from "@sub-agents/searchSubagent";

const researchSubagents: SubAgent[] = [financeSubagent, newsSubagent, searchSubagent];

const FORECASTER_PROMPT = `You are a Forecaster. Build financial projections for revenue, earnings, and cash flow. Create multiple scenarios: base case, bull case, bear case. Use DCF, comparable comps, and sensitivity analysis. Disclose key assumptions. Quantify uncertainty: "Base case: $120; Bull: $180; Bear: $70". Be transparent about guesswork vs data-backed assumptions. Delegate all finance, news, and web retrieval to your subagents.`;

export const forecaster = await createDeepAgent({
  name: "Forecaster",
  systemPrompt: FORECASTER_PROMPT,
  model: llm,
  subagents: researchSubagents,
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

const COMPETITIVE_ANALYST_PROMPT = `You are a Competitive Analyst. Map the competitive landscape. Assess moats and sustainable advantages. Identify disruptors. Use Porter's Five Forces. Evaluate pricing power, customer stickiness, market share trends. Provide concrete data: market share percent, growth rates vs competitors. Delegate all finance, news, and web retrieval to your subagents.`;

export const competitiveAnalyst = await createDeepAgent({
  name: "Competitive Analyst",
  systemPrompt: COMPETITIVE_ANALYST_PROMPT,
  model: llm,
  subagents: researchSubagents,
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

const BUSINESS_MODEL_PROMPT = `You are a Business Model Expert. Analyze revenue streams, cost structure, profit levers, unit economics. Evaluate CAC, LTV, LTV/CAC ratio, payback period, gross margin per unit. Assess scalability: can growth be achieved without proportional cost increases? Look for network effects, platform leverage, viral growth potential. Delegate all finance, news, and web retrieval to your subagents.`;

export const businessModelExpert = await createDeepAgent({
  name: "Business Model Expert",
  systemPrompt: BUSINESS_MODEL_PROMPT,
  model: llm,
  subagents: researchSubagents,
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

const PATTERN_DETECTION_PROMPT = `You are a Pattern Detection Expert. Analyze price patterns, technical indicators, market microstructure. Look at momentum (RSI, MACD), volume patterns, short interest, options activity. Describe observable patterns. Contextualize: RSI over 70 is overbought but can persist in strong trends. Combine with fundamentals. Delegate all finance, news, and web retrieval to your subagents.`;

export const patternDetectionExpert = await createDeepAgent({
  name: "Pattern Detection Expert",
  systemPrompt: PATTERN_DETECTION_PROMPT,
  model: llm,
  subagents: researchSubagents,
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

const REGULATORY_ANALYST_PROMPT = `You are a Regulatory and Policy Analyst. Track regulatory environment affecting business. Evaluate pending legislation, investigations, compliance, ESG factors. Assess materiality: could regulation cause over 20 percent revenue impact? Look at subsidies, approvals, government contracts. Distinguish actual actions from proposals. Delegate all finance, news, and web retrieval to your subagents.`;

export const regulatoryAnalyst = await createDeepAgent({
  name: "Regulatory and Policy Analyst",
  systemPrompt: REGULATORY_ANALYST_PROMPT,
  model: llm,
  subagents: researchSubagents,
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

const MACRO_SECTOR_PROMPT = `You are a Macro and Sector Analyst. Assess economic cycle, interest rates, inflation, currency impacts, commodity prices. Evaluate sector rotation, industry lifecycle, disruption risk, consumer trends. Connect macro to micro: how do rates affect cost of capital? Quote current data: latest CPI, Fed funds rate, GDP growth. Delegate all finance, news, and web retrieval to your subagents.`;

export const macroSectorAnalyst = await createDeepAgent({
  name: "Macro and Sector Analyst",
  systemPrompt: MACRO_SECTOR_PROMPT,
  model: llm,
  subagents: researchSubagents,
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
