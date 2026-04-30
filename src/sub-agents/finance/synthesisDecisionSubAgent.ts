import { llm } from "@llm/index";
import type { SubAgent } from "deepagents";
import z from "zod";
import { read } from "@utils/readFile";

// Load find-skills for discovering additional capabilities
const findSkillsSkill = await read(".agents/skills/find-skills/SKILL.md");

const SYSTEM_PROMPT = `
You are the synthesis agent—the final decision-making brain that integrates inputs from all other analysis agents.

For every request:
1. Collect and organize all agent outputs.
2. Identify and resolve conflicts between analyses.
3. Weigh evidence by confidence and methodology.
4. Generate a single, coherent investment conclusion.
5. Provide clear reasoning for the recommendation.

Core tasks:
- Multi-agent synthesis (finance, market data, news, competitors, macro, risk, forecast)
- Conflict resolution (when agents disagree)
- Final recommendation (Buy/Hold/Sell)
- Confidence scoring
- Key reasoning with supporting evidence

Workflow:
1. Receive all agent output objects as context.
2. Categorize findings: bullish signals, bearish signals, neutral signals.
3. Weigh factors by confidence and materiality (financials > news > macro).
4. Resolve conflicts by checking data quality, recency, and methodology.
5. Arrive at final recommendation with supporting thesis.

Rules:
- Do not ignore contradictory evidence—acknowledge and resolve.
- Base recommendation on material factors, not noise.
- Clearly explain reasoning for Buy/Hold/Sell.
- Confidence score reflects conviction level and data quality.
- Never recommend without sufficient data—use "Insufficient Data" if needed.

Decision framework:
Consider all dimensions:
- Fundamentals (financial health, profitability, growth)
- Valuation (relative and absolute)
- Catalysts (events that could move price)
- Risks (downside scenarios)
- Sentiment and narrative
- Competitive positioning
- Macro/sector tailwinds or headwinds

Output format:
Return a structured object with:
- company_name
- summary (2-3 sentence thesis statement)
- recommendation
  - action: "Buy" | "Strong Buy" | "Hold" | "Sell" | "Strong Sell" | "Insufficient Data"
  - confidence: 0-1 (conviction level)
  - timeframe: "12 months" (default)
- analysis_integration
  - key_bullish_factors (array with evidence and strength weighting)
  - key_bearish_factors (array with evidence and strength weighting)
  - key_neutral_factors
  - material_conflicts (array of discrepancies found and how resolved)
- price_target
  - base_case
  - bull_case
  - bear_case
  - upside_potential_percent
  - downside_risk_percent
- primary_catalyst (main expected event driving the thesis)
- primary_risk (main risk that could invalidate thesis)
- investment_thesis (structured reasoning leading to conclusion)
  - investment_case (why this makes sense)
  - downside_protection (what limits losses)
  - time_horizon (expected holding period)
  - key_monitoring_points (what to watch)
- supporting_agents (array of agent names whose analysis was most influential)
- notes
`;

const responseFormat = z.object({
  company_name: z.string().describe("Target company name"),

  summary: z
    .string()
    .describe("2-3 sentence executive summary of the investment thesis"),

  recommendation: z
    .object({
      action: z
        .enum(["Buy", "Strong Buy", "Hold", "Sell", "Strong Sell", "Insufficient Data"])
        .describe("Final investment recommendation"),
      confidence: z
        .number()
        .describe("Confidence level in recommendation (0-1)"),
      timeframe: z.string().describe("Expected timeframe for thesis (e.g., '12 months')"),
    })
    .describe("Final investment decision"),

  analysis_integration: z
    .object({
      key_bullish_factors: z
        .array(
          z.object({
            factor: z.string().describe("Bullish factor"),
            evidence: z.string().describe("Supporting evidence"),
            strength: z.number().describe("Impact weight 1-5"),
            source_agent: z.string().describe("Which agent provided this insight"),
          })
        )
        .describe("Top bullish signals ranked by importance"),
      key_bearish_factors: z
        .array(
          z.object({
            factor: z.string().describe("Bearish factor"),
            evidence: z.string().describe("Supporting evidence"),
            strength: z.number().describe("Impact weight 1-5"),
            source_agent: z.string().describe("Which agent provided this insight"),
          })
        )
        .describe("Top bearish signals ranked by importance"),
      key_neutral_factors: z.array(z.string()).describe("Important neutral considerations"),
      material_conflicts: z
        .array(
          z.object({
            conflict_description: z.string().describe("Where agents disagreed"),
            resolution: z.string().describe("How conflict was resolved"),
            credible_source: z.string().describe("Which source was trusted more and why"),
          })
        )
        .describe("Conflicts found and how they were resolved"),
    })
    .describe("Synthesis of all agent inputs"),

  price_target: z
    .object({
      base_case: z.number().describe("Most likely 12-month price target"),
      bull_case: z.number().describe("Optimistic scenario target"),
      bear_case: z.number().describe("Pessimistic scenario target"),
      upside_potential_percent: z.number().describe("Potential upside from current price %"),
      downside_risk_percent: z.number().describe("Potential downside from current price %"),
    })
    .describe("Price target ranges"),

  primary_catalyst: z
    .string()
    .describe("Single most important expected event driving the thesis"),

  primary_risk: z
    .string()
    .describe("Single most important risk to the thesis"),

  investment_thesis: z
    .object({
      investment_case: z
        .string()
        .describe("Why this investment makes sense (the bullish argument)"),
      downside_protection: z
        .string()
        .describe("What limits further losses (margin of safety, catalysts, etc.)"),
      time_horizon: z
        .string()
        .describe("Expected holding period for thesis to play out"),
      key_monitoring_points: z
        .array(z.string())
        .describe("Metrics/events to track for thesis validation"),
    })
    .describe("Structured investment reasoning"),

  supporting_agents: z
    .array(z.string())
    .describe("Which agent analyses were most critical to the conclusion"),

  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Additional context, alternative views, or residual uncertainty"),
});

const synthesisDecisionSubAgent: SubAgent = {
  name: "Synthesis (Decision) Agent",
  systemPrompt: SYSTEM_PROMPT,
  model: llm,
  responseFormat,
  skills: [findSkillsSkill],
  description:
    "Integrates all agent outputs, resolves conflicts, and produces final Buy/Hold/Sell recommendation with confidence and reasoning.",
};

export { synthesisDecisionSubAgent };
