import { llm } from "@llm/index";
import { internetSearch } from "@tools/internet-search";
import type { SubAgent } from "deepagents";
import { yahooFinance } from "@mcps/yahoo-finance";
import z from "zod";
import { webCrawl } from "@mcps/web-crawler";
import { read } from "@utils/readFile";

// Load financial-statements skill for peer comparison analysis
const financialStatementsSkill = await read(".agents/skills/financial-statements/SKILL.md");

const SYSTEM_PROMPT = `
You are a competitor analysis agent that performs relative positioning analysis.

For every request:
1. Identify the target company and its primary competitors.
2. Gather financial data for all companies.
3. Compare key metrics across peers.
4. Estimate relative market positioning.
5. Map strengths and weaknesses.

Core tasks:
- Competitor identification (direct and indirect)
- Financial comparison (revenue, margins, growth, valuation)
- Market share estimation
- Strength/weakness mapping (SWOT-like analysis)

Workflow:
1. Use internet_search → identify 3-5 key competitors (search "[company] competitors" or "[industry] leading companies")
2. Use get_financial_statements → for target and each competitor
3. Use get_stock_quote → for valuation metrics
4. Compute relative rankings across metrics
5. Synthesize competitive positioning
6. Flag areas where target outperforms/underperforms peers

Rules:
- Always include at least 3 competitors in analysis.
- Normalize financial data to same currency and period.
- Rank competitors for each key metric.
- Use market share data if available; otherwise estimate from revenue.
- Distinguish between direct and indirect competitors.
- Never assume competitor data—always retrieve via tools.

Output format:
Return a structured object with:
- target_company
- industry
- competitors (array of competitor names/tickers)
- market_analysis
  - target_revenue
  - market_leader (name with largest market share)
  - market_concentration (fragmented/oligopoly/monopoly)
  - estimated_market_share (target's estimated share %)
- financial_comparison (table-like structure)
  - revenue_ranking (target's rank among peers)
  - growth_ranking
  - margin_ranking
  - valuation_ranking
- comparative_metrics
  - revenue
  - revenue_growth
  - gross_margin
  - operating_margin
  - pe_ratio
  - debt_to_equity
  - (each as object with target_value, peer_average, percentile)
- strengths (array of target's competitive advantages)
- weaknesses (array of target's competitive disadvantages)
- threats (from competitors)
- opportunities (relative to peers)
- notes
`;

const responseFormat = z.object({
  target_company: z
    .string()
    .describe("The main company being analyzed"),

  industry: z
    .string()
    .describe("Industry or sector classification"),

  competitors: z
    .array(
      z.object({
        name: z.string().describe("Competitor company name"),
        ticker: z.string().describe("Competitor stock ticker"),
      })
    )
    .describe("List of key competitors analyzed"),

  market_analysis: z
    .object({
      target_revenue: z.number().nullable().describe("Target company's revenue"),
      market_leader: z.string().nullable().describe("Company with largest market share"),
      market_concentration: z.enum(["fragmented", "oligopoly", "monopoly", "competitive"]).describe("Market structure"),
      estimated_market_share: z.number().nullable().describe("Target's estimated market share percentage"),
    })
    .describe("High-level market positioning"),

  financial_comparison: z
    .object({
      revenue_ranking: z.number().describe("Target's revenue rank among peers (1 = largest)"),
      growth_ranking: z.number().describe("Target's growth rank among peers (1 = fastest)"),
      margin_ranking: z.number().describe("Target's margin rank among peers (1 = highest)"),
      valuation_ranking: z.number().describe("Target's valuation rank among peers (1 = cheapest)"),
    })
    .describe("Relative rankings vs. competitors"),

  comparative_metrics: z
    .object({
      revenue: z.object({
        target_value: z.number().nullable(),
        peer_average: z.number().nullable(),
        peer_median: z.number().nullable(),
        percentile: z.number().nullable(),
      }),
      revenue_growth: z.object({
        target_value: z.number().nullable(),
        peer_average: z.number().nullable(),
        peer_median: z.number().nullable(),
        percentile: z.number().nullable(),
      }),
      gross_margin: z.object({
        target_value: z.number().nullable(),
        peer_average: z.number().nullable(),
        peer_median: z.number().nullable(),
        percentile: z.number().nullable(),
      }),
      operating_margin: z.object({
        target_value: z.number().nullable(),
        peer_average: z.number().nullable(),
        peer_median: z.number().nullable(),
        percentile: z.number().nullable(),
      }),
      pe_ratio: z.object({
        target_value: z.number().nullable(),
        peer_average: z.number().nullable(),
        peer_median: z.number().nullable(),
        percentile: z.number().nullable(),
      }),
      debt_to_equity: z.object({
        target_value: z.number().nullable(),
        peer_average: z.number().nullable(),
        peer_median: z.number().nullable(),
        percentile: z.number().nullable(),
      }),
    })
    .describe("Side-by-side metric comparison with peer stats"),

  strengths: z
    .array(z.string())
    .describe("Target's competitive advantages relative to peers"),

  weaknesses: z
    .array(z.string())
    .describe("Target's competitive disadvantages relative to peers"),

  threats: z
    .array(z.string())
    .describe("External threats from competitors or market position"),

  opportunities: z
    .array(z.string())
    .describe("Opportunities based on competitive gaps or weaknesses"),

  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Additional insights or data limitations"),
});

const competitorAnalysisSubAgent: SubAgent = {
  name: "Competitor Analysis Agent",
  systemPrompt: SYSTEM_PROMPT,
  model: llm,
  tools: [internetSearch, ...yahooFinance, ...webCrawl],
  responseFormat,
  skills: [financialStatementsSkill],
  description:
    "Identifies competitors, compares financials, estimates market share, and maps strengths/weaknesses for relative positioning.",
};

export { competitorAnalysisSubAgent };
