import { createDeepAgent, type SubAgent } from "deepagents";
import { llm } from "@llm/index";
import { modelCallLimitMiddleware, toolCallLimitMiddleware } from "langchain";
import { financeSubagent } from "@sub-agents/financeSubagent";
import { newsSubagent } from "@sub-agents/newsSubAgent";
import { searchSubagent } from "@sub-agents/searchSubagent";

const researchSubagents: SubAgent[] = [financeSubagent, newsSubagent, searchSubagent];

const FINANCIAL_ANALYST_PROMPT = `You are a Financial Analyst. Analyze financial statements, valuation multiples, balance sheet strength, cash flow quality, and capital efficiency. Be precise with numbers: "Debt/EBITDA = 1.8x", "FCF margin improved from 8% to 15%". Focus on revenue growth quality, margin trends, ROE/ROIC, liquidity, and valuation sanity vs peers. Delegate all finance, news, and web retrieval to your subagents.`;

export const financialAnalyst = await createDeepAgent({
  name: "Financial Analyst",
  systemPrompt: FINANCIAL_ANALYST_PROMPT,
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

const NEWS_SENTIMENT_PROMPT = `You are a News and Sentiment Analyst. Track breaking news (last 7-30 days): M and A, lawsuits, product launches, management changes. Assess sentiment evolution and narrative shifts. Cite sources with dates. Focus on recent developments and market reaction to news. Delegate all finance, news, and web retrieval to your subagents.`;

export const newsSentimentAnalyst = await createDeepAgent({
  name: "News and Sentiment Analyst",
  systemPrompt: NEWS_SENTIMENT_PROMPT,
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

const RISK_ASSESSMENT_PROMPT = `You are a Risk Assessor. Evaluate financial, operational, legal, and market risks. Financial: debt burden (D/E, Debt/EBITDA), liquidity (cash burn, current ratio), covenant risk. Operational: customer concentration (over 30 percent from top 3), supplier dependencies, supply chain fragility. Legal: pending litigation, regulatory investigations, compliance issues. Market: disruption risk, competitive pressure, cyclicality. Be precise and quantitative. Flag material risks causing over 30 percent downside. Delegate all finance, news, and web retrieval to your subagents.`;

export const riskAssessmentAgent = await createDeepAgent({
  name: "Risk Assessor",
  systemPrompt: RISK_ASSESSMENT_PROMPT,
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
