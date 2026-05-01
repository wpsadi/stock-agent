import { llm } from "@llm/index";
import { internetSearch } from "@tools/internet-search";
import type { SubAgent } from "deepagents";
import { news } from "@mcps/news-mcp";
import { webCrawl } from "@mcps/web-crawler";
import z from "zod";

const SYSTEM_PROMPT = `
You are a macro and sector analysis agent that evaluates the external environment for a company or industry.

For every request:
1. Identify the target company's sector and industry.
2. Gather macro and sector-specific data.
3. Assess regulatory landscape.
4. Evaluate interest rate and inflation sensitivity.
5. Provide sector growth outlook.

Core tasks:
- Industry trends and lifecycle stage
- Regulatory impact and policy risks
- Interest rate and inflation sensitivity analysis
- Sector growth forecasts and tailwinds/headwinds

Workflow:
1. Use internet_search → "[industry] trends 2024 2025", "regulatory outlook [industry]", "interest rate sensitivity [sector]"
2. Use news_search → recent regulatory announcements, sector-specific news
3. Use web_crawl → key reports from government agencies (Fed, SEC, EPA, etc.)
4. Synthesize into cohesive sector/macro outlook
5. Rate impact on target company (positive/negative/neutral)

Rules:
- Use only current-year data for forecasts (no outdated training data).
- Cite sources for all claims and forecasts.
- Distinguish between short-term cyclical trends and long-term secular trends.
- Quantify sensitivity where possible (e.g., "100 bps rate hike reduces sector earnings by 5%").
- Flag high regulatory risk sectors.

Output format:
Return a structured object with:
- company_name
- sector
- industry
- macro_analysis
  - gdp_growth_outlook (current year and next)
  - interest_rate_environment (current rates, expected direction)
  - inflation_outlook (current level, expected trend)
  - key_risks (macro-level)
- sector_analysis
  - lifecycle_stage (emerging/growth/mature/declining)
  - growth_drivers (array of primary growth factors)
  - headwinds (array of sector challenges)
  - sector_growth_rate (CAGR estimate)
  - market_size (current and projected)
- regulatory_impact
  - current_regulations (key regulations affecting sector)
  - pending_legislation (upcoming/rumored rules)
  - compliance_cost_impact (low/medium/high)
  - regulatory_risk_score (0-1)
- sensitivity_factors
  - interest_rate_sensitivity (high/medium/low and direction)
  - inflation_sensitivity (high/medium/low)
  - currency_exposure (if relevant)
  - commodity_price_sensitivity (if relevant)
- sector_outlook
  - 1_year_outlook (bullish/bearish/neutral)
  - 3_year_outlook
  - key_investment_themes
  - risk_factors
- notes
`;

const responseFormat = z.object({
  company_name: z
    .string()
    .describe("Target company name"),

  sector: z
    .string()
    .describe("Broad sector (e.g., Technology, Healthcare, Finance)"),

  industry: z
    .string()
    .describe("Specific industry within the sector"),

  macro_analysis: z
    .object({
      gdp_growth_outlook: z
        .object({
          current_year: z.number().nullable(),
          next_year: z.number().nullable(),
          source: z.string().nullable(),
        })
        .describe("GDP growth projections"),
      interest_rate_environment: z
        .object({
          current_policy_rate: z.number().nullable(),
          expected_direction: z.enum(["rising", "falling", "stable"]).nullable(),
          source: z.string().nullable(),
        })
        .describe("Central bank policy rate context"),
      inflation_outlook: z
        .object({
          current_rate: z.number().nullable(),
          expected_trend: z.enum(["accelerating", "decelerating", "stable"]).nullable(),
          source: z.string().nullable(),
        })
        .describe("Inflation trajectory"),
      key_risks: z.array(z.string()).describe("Macroeconomic risks affecting the sector"),
    })
    .describe("Macro environment assessment"),

  sector_analysis: z
    .object({
      lifecycle_stage: z.enum(["emerging", "growth", "mature", "declining"]).describe("Industry lifecycle stage"),
      growth_drivers: z.array(z.string()).describe("Primary factors driving sector growth"),
      headwinds: z.array(z.string()).describe("Challenges and obstacles facing the sector"),
      sector_growth_rate: z
        .object({
          short_term: z.number().nullable().describe("1-year CAGR estimate"),
          medium_term: z.number().nullable().describe("3-year CAGR estimate"),
          source: z.string().nullable(),
        })
        .describe("Sector growth projections"),
      market_size: z
        .object({
          current: z.number().nullable().describe("Current global/regional market size ($)"),
          projected: z.number().nullable().describe("Projected market size"),
          currency: z.string().nullable(),
        })
        .describe("Total addressable market size"),
    })
    .describe("Sector-specific dynamics"),

  regulatory_impact: z
    .object({
      current_regulations: z.array(z.string()).describe("Major regulations currently in force"),
      pending_legislation: z.array(z.string()).describe("Upcoming or proposed regulations"),
      compliance_cost_impact: z.enum(["low", "medium", "high"]).describe("Relative compliance cost burden"),
      regulatory_risk_score: z.number().describe("Regulatory risk score 0-1 (higher = more risk)"),
    })
    .describe("Legal and policy environment"),

  sensitivity_factors: z
    .object({
      interest_rate_sensitivity: z
        .object({
          level: z.enum(["high", "medium", "low"]).describe("Sensitivity to rate changes"),
          direction: z.enum(["positive", "negative"]).describe("How rates affect sector"),
        })
        .describe("Interest rate sensitivity"),
      inflation_sensitivity: z
        .object({
          level: z.enum(["high", "medium", "low"]).describe("Sensitivity to inflation"),
          direction: z.enum(["positive", "negative"]).describe("How inflation affects sector"),
        })
        .describe("Inflation sensitivity"),
      currency_exposure: z
        .object({
          significant: z.boolean().describe("Whether currency risk is material"),
          description: z.string().nullable(),
        })
        .describe("Foreign exchange exposure"),
      commodity_price_sensitivity: z
        .object({
          significant: z.boolean().describe("Whether commodity prices are material"),
          key_commodities: z.array(z.string()).nullable(),
        })
        .describe("Commodity price exposure"),
    })
    .describe("External factor sensitivities"),

  sector_outlook: z
    .object({
      one_year_outlook: z.enum(["bullish", "bearish", "neutral"]).describe("12-month sector outlook"),
      three_year_outlook: z.enum(["bullish", "bearish", "neutral"]).describe("3-year sector outlook"),
      key_investment_themes: z.array(z.string()).describe("Major investment themes in the sector"),
      risk_factors: z.array(z.string()).describe("Top risks to sector outlook"),
    })
    .describe("Forward-looking sector view"),

  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Additional context or data gaps"),
});

const macroSectorSubAgent: SubAgent = {
  name: "Macro & Sector Agent",
  systemPrompt: SYSTEM_PROMPT,
  model: llm,
  tools: [internetSearch, ...news, ...webCrawl],
  responseFormat,
  description:
    "Analyzes industry trends, regulatory environment, interest rate/inflation sensitivity, and sector growth outlook.",
};

export { macroSectorSubAgent };
