import { llm } from "@llm/index";
import { internetSearch } from "@tools/internet-search";
import type { SubAgent } from "deepagents";
import { yahooFinance } from "@mcps/yahoo-finance";
import z from "zod";
import { webCrawl } from "@mcps/web-crawler";
import { read } from "@utils/readFile";

const SYSTEM_PROMPT = `
You are a forecasting and prediction agent that projects future financial performance and stock prices.

For every request:
1. Gather historical financial data and market trends.
2. Understand industry growth rates and guidance.
3. Generate revenue and growth forecasts.
4. Predict stock price using statistical/ML/heuristic methods.
5. Create scenario models (best/base/worst cases).

Core tasks:
- Revenue & growth forecasts (3-5 year horizon)
- Price prediction (range-based with confidence intervals)
- Scenario modeling (bull/base/bear cases)
- Assumption sensitivity analysis

Workflow:
1. Use get_financial_statements → historical revenue, margins, growth rates
2. Use get_stock_quote → current valuation multiples
3. Use get_historical_prices → for technical trend inputs
4. Use internet_search → analyst forecasts, industry reports, management guidance
5. Build three scenarios (best/base/worst) with key assumptions
6. Calculate target prices using DCF or comparables approach

Rules:
- Clearly state all assumptions used in forecasts.
- Show base case as most likely, not just midpoint.
- Provide sensitivity analysis for key drivers.
- Cite sources for bullish/bearish assumptions.
- Never predict with certainty—use ranges/confidence intervals.
- If insufficient data, flag assumptions clearly.

Output format:
Return a structured object with:
- company_name
- forecast_horizon (e.g., "3 years", "5 years")
- base_case
  - revenue_forecast (array by year)
  - growth_rate (CAGR)
  - margin_assumptions (gross, operating, net)
  - earnings_per_share
  - target_price
  - price_target_range (± 1 std dev)
- bull_case
  - key_drivers
  - revenue_upside
  - target_price_upside
- bear_case
  - key_risks
  - revenue_downside
  - target_price_downside
- valuation_methods (DCF/comps/other)
- key_assumptions (array with rationale)
- sensitivity_analysis
  - revenue_sensitivity (±10% revenue change → price impact)
  - margin_sensitivity
- price_prediction_confidence (0-1)
- recommended_range (most likely price range)
- notes
`;

const responseFormat = z.object({
  company_name: z.string().describe("Target company name"),

  forecast_horizon: z
    .string()
    .describe("Forecast period (e.g., '3 years', '5 years')"),

  base_case: z
    .object({
      revenue_forecast: z
        .array(z.object({ year: z.string(), value: z.number() }))
        .describe("Revenue projections by year"),
      growth_rate_cagr: z.number().describe("Compound annual growth rate"),
      gross_margin_assumption: z.number().describe("Gross margin %"),
      operating_margin_assumption: z.number().describe("Operating margin %"),
      earnings_per_share: z
        .array(z.object({ year: z.string(), value: z.number() }))
        .describe("EPS forecast by year"),
      target_price: z.number().describe("Base case target price"),
      price_target_range: z
        .object({
          low: z.number().describe("Lower bound of confidence interval"),
          high: z.number().describe("Upper bound of confidence interval"),
        })
        .describe("95% confidence interval for target price"),
    })
    .describe("Most likely scenario"),

  bull_case: z
    .object({
      key_drivers: z.array(z.string()).describe("Factors enabling better performance"),
      revenue_upside_percent: z.number().describe("Revenue upside vs. base case %"),
      target_price_upside: z.number().describe("Bull case target price"),
      upside_percent: z.number().describe("Potential upside from current price %"),
    })
    .describe("Optimistic scenario"),

  bear_case: z
    .object({
      key_risks: z.array(z.string()).describe("Factors driving worse performance"),
      revenue_downside_percent: z.number().describe("Revenue downside vs. base case %"),
      target_price_downside: z.number().describe("Bear case target price"),
      downside_percent: z.number().describe("Potential downside from current price %"),
    })
    .describe("Pessimistic scenario"),

  valuation_methods: z
    .array(z.enum(["DCF", "comparable_companies", "historical_multiple", "sum_of_parts", "other"]))
    .describe("Valuation methodologies used"),

  key_assumptions: z
    .array(
      z.object({
        assumption: z.string().describe("What is being assumed"),
        rationale: z.string().describe("Why this assumption is made"),
        source: z.string().describe("Source or basis for assumption"),
      })
    )
    .describe("Explicit assumptions underlying forecasts"),

  sensitivity_analysis: z
    .object({
      revenue_sensitivity: z
        .object({
          minus_10_percent: z.number().describe("Target price if revenue 10% below base"),
          plus_10_percent: z.number().describe("Target price if revenue 10% above base"),
        })
        .describe("Revenue sensitivity"),
      margin_sensitivity: z
        .object({
          minus_100_bps: z.number().describe("Target price if margins 100bps below base"),
          plus_100_bps: z.number().describe("Target price if margins 100bps above base"),
        })
        .describe("Margin sensitivity"),
    })
    .describe("Key driver sensitivity"),

  price_prediction_confidence: z
    .number()
    .describe("Overall confidence in price prediction (0-1)"),

  recommended_range: z
    .object({
      low: z.number().describe("Lower end of 12-month price range"),
      high: z.number().describe("Upper end of 12-month price range"),
      midpoint: z.number().describe("Expected price"),
    })
    .describe("Suggested trading/valuation range"),

  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Caveats, data limitations, or alternative scenarios"),
});

// Load earnings-analysis skill for forecasting methodology
const earningsSkill = await read(".agents/skills/earnings-analysis/SKILL.md");

const forecastingPredictionSubAgent: SubAgent = {
  name: "Forecasting / Prediction Agent",
  systemPrompt: SYSTEM_PROMPT,
  model: llm,
  tools: [internetSearch, ...yahooFinance, ...webCrawl],
  responseFormat,
  skills: [earningsSkill],
  description:
    "Generates revenue/growth forecasts, predicts stock prices using multiple methodologies, and produces scenario models.",
};

export { forecastingPredictionSubAgent };
