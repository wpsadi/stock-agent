# Stock Agent System Overview

Comprehensive documentation of all tools, agents, and sub-agents in the stock-agent system.

---

## Tools

### `@llm/index`
Main language model interface used by all agents for natural language processing and structured output generation.

### `@tools/internet-search`
Web search tool for retrieving current information from the internet. Used for gathering real-time data, news, and research across all analysis agents.

### `@mcps/yahoo-finance`
MCP integration for Yahoo Finance data. Provides stock quotes, historical prices, financial statements, company info, and analyst recommendations via `get_stock_quote`, `get_historical_prices`, `get_financial_statements`, `get_company_info`, and `compare_stocks`.

### `@mcps/news-mcp`
MCP integration for news aggregation. Searches financial news feeds and recent articles using `news_search` for sentiment analysis and event detection.

### `@mcps/web-crawler`
MCP integration for web crawling. Fetches and parses specific web pages including SEC filings, government records, and company investor relations sites via `web_crawl`.

### `@utils/readFile`
File reading utility for accessing local files (configuration, skills, data files). Used to load agent skills and read local markdown resources.

---

## Core Agents (src/sub-agents/)

Core agents providing foundational capabilities for market data, news, and search.

### `financeSubagent.ts` - Finance Agent
Retrieves stock prices, historical data, company information, financial statements, and analyst insights using Yahoo Finance tools. Routes requests to appropriate Yahoo Finance functions (quote, history, financials, comparison). Uses `yahooFinance` tools only.

### `newsSubAgent.ts` - News Agent
Aggregates and summarizes recent financial news from multiple sources. Prioritizes recent, credible sources and synthesizes key developments without hallucinating facts. Uses `news` MCP tools.

### `searchSubagent.ts` - Search Agent
Performs real-time web searches using Tavily to retrieve and synthesize up-to-date information on companies, industries, and market trends. Uses `internetSearch` tool.

### `promoterAgent.ts` - Promoter Agent
(Empty file - not yet implemented)

---

## Finance Sub-Agents (src/sub-agents/finance/)

Specialized analysis agents covering different dimensions of equity research and due diligence.

### Financial Analysis

**`financialAnalysisSubAgent`** (financesExplorerSubagent.ts)
Performs deep financial breakdowns: revenue, profit, margins, YoY/QoQ growth, key ratios (P/E, ROE, debt/equity), cash flow analysis, and anomaly detection. Foundational agent for financial health assessment.
- **Skill loaded:** `financial-statements`

**`businessExplorerSubAgent`** (businessModelExplorerSubagent.ts)
Extracts structured company intelligence: business model, revenue streams, products/services, leadership, sector and industry classification. Focuses on how the company operates and creates value.

### Market Data & Sentiment

**`marketDataSubAgent`** (marketDataSubAgent.ts)
Analyzes stock trading behavior: price, volume, volatility, beta, trends (short/long-term), support/resistance levels, and trading patterns. Calculates technical indicators from historical price data.

**`newsSentimentSubAgent`** (newsSentimentSubAgent.ts)
Aggregates latest financial news, scores sentiment (bullish/bearish/neutral with confidence), detects key events (M&A, lawsuits, product launches, management changes), and tracks narrative shifts over time.

### Competitive & Sector Analysis

**`competitorAnalysisSubAgent`** (competitorAnalysisSubAgent.ts)
Identifies competitors, compares financial metrics across peers, estimates market share, and maps strengths/weaknesses. Calculates percentile rankings for revenue, growth, margins, and valuation metrics.
- **Skill loaded:** `financial-statements`

**`macroSectorSubAgent`** (macroSectorSubAgent.ts)
Evaluates external environment: industry trends, regulatory landscape, interest rate and inflation sensitivity, sector growth forecasts, and tailwind/headwind analysis. Provides macroeconomic and regulatory impact assessment.

**`synthesisDecisionSubAgent`** (synthesisDecisionSubAgent.ts)
Final decision-making agent that integrates all other agent outputs, resolves conflicts, weighs evidence by confidence and materiality, and produces investment conclusion (Buy/Hold/Sell) with confidence scoring and structured reasoning.
- **Skill loaded:** `find-skills`

### Risk & Forecasting

**`riskAssessmentSubAgent`** (riskAssessmentSubAgent.ts)
Identifies and prioritizes financial, operational, legal, and market risks with severity/likelihood scores (1-5). Assesses debt levels, liquidity, customer concentration, litigation exposure, regulatory investigations, competitive threats, and cyclicality. Computes financial health metrics (debt/EBITDA, cash runway, interest coverage, current/quick ratios).
- **Skill loaded:** `financial-statements`

**`forecastingPredictionSubAgent`** (forecastingPredictionSubAgent.ts)
Generates revenue and growth forecasts (3-5 year horizon), predicts stock prices using multiple methodologies, and produces scenario models (bull/base/bear). Includes sensitivity analysis and confidence intervals.
- **Skill loaded:** `earnings-analysis`

### Validation & Political Analysis

**`dataValidationSubAgent`** (dataValidationSubAgent.ts)
Trust layer that cross-checks data against independent sources, detects stale/low-quality inputs, normalizes units/currencies, flags uncertainties, and resolves conflicts. Ensures data integrity across all analyses.

**`politicalConnectionsSubAgent`** (politicalConnectionsSubAgent.ts)
Maps political connections between companies, executives, and politicians. Tracks campaign contributions (by party, top recipients), lobbying expenditures, PAC activities, regulatory favors, government contracts, and conflicts of interest (revolving door, family ties). Produces political dependence score (0-1) and party alignment.

**`patternDetectionManipulationSubAgent`** (patternDetectionManipulationSubAgent.ts)
Analyzes sequences of political favors for suspicious patterns. Identifies temporal correlations, quid pro quo relationships, and coordinated influence campaigns. Assigns manipulation likelihood score (0-1), flags red flags by priority, and recommends investigation steps.

---

## Skills (src/.agents/skills/)

Skills are modular packages that extend agent capabilities with specialized knowledge, workflows, and reference materials. Loaded via `@utils/readFile`.

### `earnings-analysis`
Creates professional equity research earnings update reports (8-12 pages, 3,000-5,000 words) analyzing quarterly results with beat/miss analysis, updated estimates, and revised thesis following institutional sell-side standards. Includes templated report structure, chart specifications, and quality checklists.

### `financial-statements`
Generates financial statements (income statement, balance sheet, cash flow) with period-over-period comparison and variance analysis. Provides GAAP presentation guidelines (ASC 220/210/230), common period-end adjustments, and material variance flagging thresholds.

### `find-skills`
Helps discover and install new agent skills from the open skills ecosystem at skills.sh. Searches by keyword, verifies quality (install count, source reputation), and provides installation commands for the Skills CLI.

---

## Skills Integration Matrix

| Agent | Loaded Skill |
|-------|-------------|
| `financialAnalysisSubAgent` | `financial-statements` |
| `forecastingPredictionSubAgent` | `earnings-analysis` |
| `riskAssessmentSubAgent` | `financial-statements` |
| `competitorAnalysisSubAgent` | `financial-statements` |
| `synthesisDecisionSubAgent` | `find-skills` |

---

## Agent Interface

All agents implement the `SubAgent` interface from the `deepagents` framework:

```ts
interface SubAgent {
  name: string;                    // Human-readable identifier
  description: string;             // Brief purpose summary
  systemPrompt: string;            // Instructions and workflow definition
  model?: LLMModel;                // LLM provider (defaults to main agent)
  tools: Tool[];                   // Available tool functions
  skills?: Skill[];                // Optional loaded skill objects
  responseFormat: ZodSchema;       // Structured output schema
}
```

**Exports:** All finance sub-agents are exported from `src/sub-agents/finance/index.ts` for centralized importing.

---

## Architecture

The system follows a modular architecture:
- **Tools** provide data access (Yahoo Finance, news, web search, crawling)
- **Core Agents** handle basic retrieval (finance, news, search)
- **Finance Sub-Agents** perform specialized analysis in focused domains
- **Skills** are optional modules that provide deep procedural guidance

The `synthesisDecisionSubAgent` serves as the final integrator, combining outputs from multiple analysis agents to produce consolidated investment recommendations with confidence scores.

---

## Quick Reference

**Start here:** `financeSubagent` for basic stock data queries

**Financial analysis:** `financialAnalysisSubAgent` + `businessExplorerSubAgent`

**Market context:** `marketDataSubAgent` + `newsSentimentSubAgent`

**Competitive positioning:** `competitorAnalysisSubAgent` + `macroSectorSubAgent`

**Risk & upside:** `riskAssessmentSubAgent` + `forecastingPredictionSubAgent`

**Final verdict:** `synthesisDecisionSubAgent`

**Political influence:** `politicalConnectionsSubAgent` → `patternDetectionManipulationSubAgent`

**Data quality:** `dataValidationSubAgent`
