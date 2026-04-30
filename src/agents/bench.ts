import { llm } from "@llm/index";
import { yahooFinance } from "@mcps/yahoo-finance";
import { news } from "@mcps/news-mcp";
import { internetSearch } from "@tools/internet-search";
import { webCrawl } from "@mcps/web-crawler";
import type { SubAgent } from "deepagents";

export const financialAnalyst: SubAgent = {
  name: "Financial Analyst",
  description: "Valuation and financial health expert",
  systemPrompt: `You are a Financial Analyst. Analyze financial statements, valuation multiples, balance sheet strength, cash flow quality, and capital efficiency. Be precise with numbers: "Debt/EBITDA = 1.8x", "FCF margin improved from 8% to 15%". Focus on revenue growth quality, margin trends, ROE/ROIC, liquidity, and valuation sanity vs peers.`,
  model: llm,
  tools: [...yahooFinance, ...news, internetSearch, ...webCrawl],
};

export const newsSentimentAnalyst: SubAgent = {
  name: "News and Sentiment Analyst",
  description: "Real-time news and sentiment tracking specialist",
  systemPrompt: `You are a News and Sentiment Analyst. Track breaking news (last 7-30 days): M and A, lawsuits, product launches, management changes. Assess sentiment evolution and narrative shifts. Cite sources with dates. Focus on recent developments and market reaction to news.`,
  model: llm,
  tools: [...news, internetSearch, ...webCrawl],
};

export const riskAssessmentAgent: SubAgent = {
  name: "Risk Assessor",
  description: "Risk quantification specialist",
  systemPrompt: `You are a Risk Assessor. Evaluate financial, operational, legal, and market risks. Financial: debt burden (D/E, Debt/EBITDA), liquidity (cash burn, current ratio), covenant risk. Operational: customer concentration (over 30 percent from top 3), supplier dependencies, supply chain fragility. Legal: pending litigation, regulatory investigations, compliance issues. Market: disruption risk, competitive pressure, cyclicality. Be precise and quantitative. Flag material risks causing over 30 percent downside.`,
  model: llm,
  tools: [...yahooFinance, ...news, internetSearch, ...webCrawl],
};
