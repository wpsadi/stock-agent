import { llm } from "@llm/index";
import { internetSearch } from "@tools/internet-search";
import type { SubAgent } from "deepagents";
import { yahooFinance } from "@mcps/yahoo-finance";
import { news } from "@mcps/news-mcp";
import z from "zod";
import { webCrawl } from "@mcps/web-crawler";
import { read } from "@utils/readFile";

// Load financial-statements skill for detailed financial analysis
const financialStatementsSkill = await read(".agents/skills/financial-statements/SKILL.md");

const SYSTEM_PROMPT = `
You are a risk assessment agent specialized in identifying and quantifying downside risks.

For every request:
1. Identify the target company.
2. Gather financial, operational, legal, and market data.
3. Evaluate each risk category.
4. Assign severity and likelihood scores.
5. Prioritize risks by materiality.

Core tasks:
- Financial risks (debt levels, liquidity, burn rate, covenant risk)
- Operational risks (supply chain, technology, customer concentration)
- Legal/regulatory risks (pending litigation, investigations, compliance)
- Market risks (competition, disruption, cyclicality, FX)

Workflow:
1. Use get_financial_statements → assess balance sheet strength, cash flow health
2. Use get_company_info → understand business model and concentration risks
3. Use news_search → recent litigation, regulatory actions, operational issues
4. Use internet_search → "[company] lawsuit", "[company] regulatory", "[company] debt", "[company] risks"
5. Score each risk dimension (1-5 for severity and likelihood)
6. Calculate composite risk score

Rules:
- Never assume—verify every risk factor with data or credible sources.
- Distinguish between actual events and potential risks.
- Be quantitative where possible (debt/EBITDA, cash runway months, % concentration).
- If data unavailable, explicitly note "unknown" rather than assume benign.
- Prioritize risks that could threaten solvency or business continuity.

Output format:
Return a structured object with:
- company_name
- overall_risk_score (0-1 composite score)
- risk_categories
  - financial_risk
    - debt_level (description and D/E ratio)
    - liquidity_risk (cash position, current ratio)
    - burn_rate (for unprofitable cos: monthly cash burn)
    - covenant_risk (debt covenant proximity)
    - severity (1-5)
    - likelihood (1-5)
  - operational_risk
    - supply_chain_dependencies
    - customer_concentration (% from top 3/5/10)
    - technology_risk (legacy systems, cyber)
    - severity (1-5)
    - likelihood (1-5)
  - legal_regulatory_risk
    - pending_litigation (summary and potential exposure)
    - regulatory_investigations
    - compliance_issues
    - severity (1-5)
    - likelihood (1-5)
  - market_risk
    - competitive_pressure (disruption risk)
    - cyclicality_sensitivity
    - foreign_exchange_risk
    - severity (1-5)
    - likelihood (1-5)
- identified_risks (detailed array of specific risks)
  - category
  - description
  - severity (1-5)
  - likelihood (1-5)
  - potential_impact ($ or qualitative)
  - mitigation (if any)
- financial_health_metrics
  - debt_to_ebitda
  - cash_runway_months (if negative earnings)
  - interest_coverage_ratio
  - current_ratio
  - quick_ratio
- red_flags (array of critical concerns requiring immediate attention)
- notes
`;

const responseFormat = z.object({
  company_name: z.string().describe("Target company name"),

  overall_risk_score: z
    .number()
    .describe("Composite risk score 0 (low risk) to 1 (high risk)"),

  risk_categories: z
    .object({
      financial_risk: z
        .object({
          debt_level: z
            .object({
              description: z.string(),
              debt_to_equity: z.number().nullable(),
            })
            .describe("Debt burden assessment"),
          liquidity_risk: z
            .object({
              description: z.string(),
              current_ratio: z.number().nullable(),
              cash_position: z.number().nullable(),
            })
            .describe("Liquidity position"),
          burn_rate: z
            .object({
              description: z.string(),
              monthly_burn: z.number().nullable(),
              runway_months: z.number().nullable(),
            })
            .describe("Cash burn rate if unprofitable"),
          covenant_risk: z
            .string()
            .nullable()
            .describe("Debt covenant proximity risk"),
          severity: z.number().describe("Severity score 1-5"),
          likelihood: z.number().describe("Likelihood score 1-5"),
        })
        .describe("Financial risks"),
      operational_risk: z
        .object({
          supply_chain_dependencies: z.string().nullable(),
          customer_concentration: z
            .object({
              top3_percent: z.number().nullable(),
              top5_percent: z.number().nullable(),
            })
            .describe("Revenue concentration risk"),
          technology_risk: z.string().nullable(),
          severity: z.number().describe("Severity score 1-5"),
          likelihood: z.number().describe("Likelihood score 1-5"),
        })
        .describe("Operational risks"),
      legal_regulatory_risk: z
        .object({
          pending_litigation: z
            .array(
              z.object({
                case_description: z.string(),
                potential_exposure: z.number().nullable(),
                status: z.string(),
              })
            )
            .describe("Ongoing legal cases"),
          regulatory_investigations: z.array(z.string()).describe("Active investigations"),
          compliance_issues: z.array(z.string()).describe("Known compliance problems"),
          severity: z.number().describe("Severity score 1-5"),
          likelihood: z.number().describe("Likelihood score 1-5"),
        })
        .describe("Legal and regulatory risks"),
      market_risk: z
        .object({
          competitive_pressure: z.string().nullable(),
          cyclicality_sensitivity: z.string().nullable(),
          foreign_exchange_risk: z.string().nullable(),
          severity: z.number().describe("Severity score 1-5"),
          likelihood: z.number().describe("Likelihood score 1-5"),
        })
        .describe("Market and external risks"),
    })
    .describe("Four-category risk breakdown"),

  identified_risks: z
    .array(
      z.object({
        category: z.string().describe("Risk category (financial/operational/legal/market)"),
        description: z.string().describe("Specific risk description"),
        severity: z.number().describe("Severity 1-5"),
        likelihood: z.number().describe("Likelihood 1-5"),
        potential_impact: z.string().describe("Potential financial or business impact"),
        mitigation: z.string().nullable().describe("Existing mitigation measures"),
      })
    )
    .describe("Detailed list of all identified risks"),

  financial_health_metrics: z
    .object({
      debt_to_ebitda: z.number().nullable().describe("Leverage ratio"),
      cash_runway_months: z.number().nullable().describe("Months of cash remaining"),
      interest_coverage_ratio: z.number().nullable().describe("EBIT/interest expense"),
      current_ratio: z.number().nullable().describe("Current assets/current liabilities"),
      quick_ratio: z.number().nullable().describe("Quick assets/current liabilities"),
    })
    .describe("Key financial health indicators"),

  red_flags: z
    .array(z.string())
    .describe("Critical risks requiring immediate attention"),

  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Additional risk context or concerns"),
});

const riskAssessmentSubAgent: SubAgent = {
  name: "Risk Assessment Agent",
  systemPrompt: SYSTEM_PROMPT,
  model: llm,
  tools: [internetSearch, ...yahooFinance, ...news, ...webCrawl],
  responseFormat,
  skills: [financialStatementsSkill],
  description:
    "Identifies and prioritizes financial, operational, legal, and market risks with severity/likelihood scoring.",
};

export { riskAssessmentSubAgent };
