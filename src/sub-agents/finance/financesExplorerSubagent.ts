import { llm } from "@llm/index";
import { internetSearch } from "@tools/internet-search";
import type { SubAgent } from "deepagents";
import { yahooFinance } from "@mcps/yahoo-finance";
import z from "zod";
import { read } from "@utils/readFile";
import { webCrawl } from "@mcps/web-crawler";

const SYSTEM_PROMPT = `
You are a financial analysis agent that performs deep financial breakdowns of companies.

For every request:
1. Identify the target company and relevant financial period.
2. Retrieve financial data using available tools.
3. Analyze and compute key financial metrics.
4. Return a structured financial summary.

Core tasks:
- Revenue, profit, and margin analysis
- YoY (Year-over-Year) and QoQ (Quarter-over-Quarter) growth
- Key ratios (P/E, ROE, debt/equity, etc.)
- Cash flow analysis (operating, investing, financing)
- Detect anomalies (sudden spikes, drops, inconsistencies)

Workflow:
1. Use get_financial_statements → for income statement, balance sheet, cash flow
2. Use get_stock_quote → for valuation metrics (P/E, market cap, etc.)
3. Use get_historical_prices → for trend-based insights if needed
4. Cross-check with news if anomalies are detected
5. Normalize and structure output

Rules:
- Never hallucinate financial data.
- If a metric is unavailable, return null.
- Prefer tool-derived values over assumptions.
- Clearly distinguish between calculated vs retrieved values.
- Keep output concise, structured, and data-focused.
- Flag anomalies explicitly.

Output format:
Return a structured object with:
- company_name
- revenue
- profit
- margins
- yoy_growth
- qoq_growth
- key_ratios
- cash_flow
- anomalies
- notes
`;

const responseFormat = z.object({
  company_name: z
    .string()
    .describe("The company being analyzed"),

  revenue: z
    .object({
      value: z.number().nullable(),
      currency: z.string().nullable(),
      period: z.string().nullable(),
    })
    .describe("Total revenue for the latest reported period"),

  profit: z
    .object({
      value: z.number().nullable(),
      currency: z.string().nullable(),
      period: z.string().nullable(),
    })
    .describe("Net profit or income for the latest reported period"),

  margins: z
    .object({
      gross_margin: z.number().nullable(),
      operating_margin: z.number().nullable(),
      net_margin: z.number().nullable(),
    })
    .describe("Profitability margins expressed as percentages"),

  yoy_growth: z
    .object({
      revenue_growth: z.number().nullable(),
      profit_growth: z.number().nullable(),
    })
    .describe("Year-over-year growth percentages"),

  qoq_growth: z
    .object({
      revenue_growth: z.number().nullable(),
      profit_growth: z.number().nullable(),
    })
    .describe("Quarter-over-quarter growth percentages"),

  key_ratios: z
    .object({
      pe_ratio: z.number().nullable(),
      roe: z.number().nullable(),
      debt_to_equity: z.number().nullable(),
    })
    .describe("Important financial ratios for valuation and performance"),

  cash_flow: z
    .object({
      operating: z.number().nullable(),
      investing: z.number().nullable(),
      financing: z.number().nullable(),
    })
    .describe("Cash flow breakdown"),

  anomalies: z
    .array(z.string())
    .describe("Detected unusual patterns or financial irregularities"),

  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Additional observations or missing data notes"),
});

const financeSkill = await read(".agents/skills/financial-statements/SKILL.md")

const financialAnalysisSubAgent: SubAgent = {
  name: "Financial Analysis Agent",
  systemPrompt: SYSTEM_PROMPT,
  model: llm,
  tools: [internetSearch, ...yahooFinance, ...webCrawl],
  responseFormat,
  skills:[financeSkill],
  description:
    "Performs deep financial breakdown including revenue, growth, ratios, cash flow, and anomaly detection.",
};

export { financialAnalysisSubAgent };