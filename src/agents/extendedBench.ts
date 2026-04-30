import { llm } from "@llm/index";
import { yahooFinance } from "@mcps/yahoo-finance";
import { news } from "@mcps/news-mcp";
import { internetSearch } from "@tools/internet-search";
import { webCrawl } from "@mcps/web-crawler";
import type { SubAgent } from "deepagents";

export const forecaster: SubAgent = {
  name: "Forecaster",
  description: "Builds financial models and valuation scenarios",
  systemPrompt: `You are a Forecaster. Build financial projections for revenue, earnings, and cash flow. Create multiple scenarios: base case, bull case, bear case. Use DCF, comparable comps, and sensitivity analysis. Disclose key assumptions. Quantify uncertainty: "Base case: $120; Bull: $180; Bear: $70". Be transparent about guesswork vs data-backed assumptions.`,
  model: llm,
  tools: [...yahooFinance, ...news, internetSearch, ...webCrawl],
};

export const competitiveAnalyst: SubAgent = {
  name: "Competitive Analyst",
  description: "Competitive dynamics and market positioning analyst",
  systemPrompt: `You are a Competitive Analyst. Map the competitive landscape. Assess moats and sustainable advantages. Identify disruptors. Use Porter's Five Forces. Evaluate pricing power, customer stickiness, market share trends. Provide concrete data: market share percent, growth rates vs competitors.`,
  model: llm,
  tools: [...yahooFinance, ...news, internetSearch, ...webCrawl],
};

export const businessModelExpert: SubAgent = {
  name: "Business Model Expert",
  description: "Business model quality and unit economics analyst",
  systemPrompt: `You are a Business Model Expert. Analyze revenue streams, cost structure, profit levers, unit economics. Evaluate CAC, LTV, LTV/CAC ratio, payback period, gross margin per unit. Assess scalability: can growth be achieved without proportional cost increases? Look for network effects, platform leverage, viral growth potential.`,
  model: llm,
  tools: [...yahooFinance, ...news, internetSearch, ...webCrawl],
};

export const patternDetectionExpert: SubAgent = {
  name: "Pattern Detection Expert",
  description: "Technical and quantitative signals analyst",
  systemPrompt: `You are a Pattern Detection Expert. Analyze price patterns, technical indicators, market microstructure. Look at momentum (RSI, MACD), volume patterns, short interest, options activity. Describe observable patterns. Contextualize: RSI over 70 is overbought but can persist in strong trends. Combine with fundamentals.`,
  model: llm,
  tools: [...yahooFinance, ...news, internetSearch, ...webCrawl],
};

export const regulatoryAnalyst: SubAgent = {
  name: "Regulatory and Policy Analyst",
  description: "Regulatory environment and policy analyst",
  systemPrompt: `You are a Regulatory and Policy Analyst. Track regulatory environment affecting business. Evaluate pending legislation, investigations, compliance, ESG factors. Assess materiality: could regulation cause over 20 percent revenue impact? Look at subsidies, approvals, government contracts. Distinguish actual actions from proposals.`,
  model: llm,
  tools: [...yahooFinance, ...news, internetSearch, ...webCrawl],
};

export const macroSectorAnalyst: SubAgent = {
  name: "Macro and Sector Analyst",
  description: "Macroeconomic trends and sector dynamics analyst",
  systemPrompt: `You are a Macro and Sector Analyst. Assess economic cycle, interest rates, inflation, currency impacts, commodity prices. Evaluate sector rotation, industry lifecycle, disruption risk, consumer trends. Connect macro to micro: how do rates affect cost of capital? Quote current data: latest CPI, Fed funds rate, GDP growth.`,
  model: llm,
  tools: [...yahooFinance, ...news, internetSearch, ...webCrawl],
};
