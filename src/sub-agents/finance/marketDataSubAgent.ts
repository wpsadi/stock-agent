import { llm } from "@llm/index";
import { internetSearch } from "@tools/internet-search";
import type { SubAgent } from "deepagents";
import { yahooFinance } from "@mcps/yahoo-finance";
import z from "zod";
import { webCrawl } from "@mcps/web-crawler";

const SYSTEM_PROMPT = `
You are a market data agent that analyzes stock trading behavior and technical indicators.

For every request:
1. Identify the target stock ticker and relevant timeframe.
2. Retrieve current market data using available tools.
3. Calculate technical indicators and detect trends.
4. Estimate support and resistance levels.
5. Return structured market analysis.

Core tasks:
- Current price and volume analysis
- Volatility and beta calculation
- Trend detection (short-term and long-term)
- Support/resistance estimation
- Trading pattern identification

Workflow:
1. Use get_stock_quote → for current price, volume, beta
2. Use get_historical_prices → for volatility calculations and trend analysis
3. Calculate technical indicators (moving averages, RSI, MACD if needed)
4. Detect support/resistance through price clustering and historical levels
5. Cross-check with recent news if unusual volatility detected

Rules:
- Never hallucinate market data.
- Use only retrieved price/volume data for calculations.
- Clearly mark estimated vs. calculated values.
- Flag unusual volume or volatility spikes.
- Keep calculations transparent and reproducible.

Output format:
Return a structured object with:
- ticker
- current_price
- volume
- volatility (30-day annualized)
- beta
- short_term_trend
- long_term_trend
- support_levels (array of nearest support prices)
- resistance_levels (array of nearest resistance prices)
- anomalies (unusual patterns)
- notes
`;

const responseFormat = z.object({
  ticker: z
    .string()
    .describe("Stock ticker symbol"),

  current_price: z
    .object({
      price: z.number().nullable(),
      currency: z.string().nullable(),
      timestamp: z.string().nullable(),
    })
    .describe("Current stock price with timestamp"),

  volume: z
    .object({
      current: z.number().nullable(),
      average_30d: z.number().nullable(),
      change_from_avg: z.number().nullable(),
    })
    .describe("Current trading volume vs. 30-day average"),

  volatility: z
    .object({
      daily: z.number().nullable().describe("Daily volatility (std dev)"),
      annualized_30d: z.number().nullable().describe("30-day annualized volatility (%)"),
    })
    .describe("Volatility measures"),

  beta: z
    .number()
    .nullable()
    .describe("Beta relative to S&P 500"),

  short_term_trend: z
    .object({
      direction: z.enum(["bullish", "bearish", "neutral"]).describe("Trend direction"),
      strength: z.number().nullable().describe("Trend strength score (0-1)"),
      days: z.number().nullable().describe("Number of days in current trend"),
    })
    .describe("Short-term price trend (5-20 days)"),

  long_term_trend: z
    .object({
      direction: z.enum(["bullish", "bearish", "neutral"]).describe("Trend direction"),
      strength: z.number().nullable().describe("Trend strength score (0-1)"),
      weeks: z.number().nullable().describe("Number of weeks in current trend"),
    })
    .describe("Long-term price trend (50+ days)"),

  support_levels: z
    .array(z.number().nullable())
    .describe("Nearest support price levels (ascending order)"),

  resistance_levels: z
    .array(z.number().nullable())
    .describe("Nearest resistance price levels (ascending order)"),

  anomalies: z
    .array(z.string())
    .describe("Detected unusual patterns (gap, spike, abnormal volume)"),

  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Additional observations or data limitations"),
});

const marketDataSubAgent: SubAgent = {
  name: "Market Data Agent",
  systemPrompt: SYSTEM_PROMPT,
  model: llm,
  tools: [internetSearch, ...yahooFinance, ...webCrawl],
  responseFormat,
  description:
    "Analyzes stock trading behavior including price, volume, volatility, beta, trends, and support/resistance levels.",
};

export { marketDataSubAgent };
