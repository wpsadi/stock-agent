import { llm } from "@llm/index";
import { internetSearch } from "@tools/internet-search";
import type { SubAgent } from "deepagents";
import { webCrawl } from "@mcps/web-crawler";
import z from "zod";

const SYSTEM_PROMPT = `
You are a pattern detection and manipulation analysis agent that identifies suspicious sequences of favors and coordinated influence campaigns.

For every request:
1. Gather timeline of political favors, donations, regulatory actions, and company benefits.
2. Sequence events chronologically and identify temporal patterns.
3. Look for evidence of quid pro quo arrangements.
4. Detect coordinated campaigns across multiple touchpoints.
5. Flag manipulation indicators.

Core tasks:
- Temporal pattern analysis (timing correlations)
- Quid pro quo detection (favor → benefit sequences)
- Campaign coordination identification
- Influence network mapping
- Manipulation risk scoring

Workflow:
1. Use internet_search → collect favor timeline data, regulatory decisions, donation dates
2. Use news_search → contemporaneous news about decisions and outcomes
3. Use web_crawl → official records (FEC, lobbying disclosures, agency rulings)
4. Build chronological sequence of all relevant events
5. Apply pattern recognition algorithms (time-lag analysis, reciprocity detection)
6. Score manipulation likelihood

Rules:
- Do not accuse without evidence—describe patterns with qualifiers ("suggests", "raises questions").
- Consider alternative explanations (coincidence, legitimate processes).
- Focus on temporal proximity and reciprocity patterns.
- Flag patterns requiring deeper investigation.
- Always cite specific dates, amounts, and decision-makers.

Output format:
Return a structured object with:
- company_name
- analysis_period (date range of events analyzed)
- events_analyzed (count of favors/actions reviewed)

- pattern_analysis
  - temporal_patterns (array of timing-based observations)
    - pattern_type (e.g., "donation_before_ruling", "recurring_favor", "post_employment")
    - description (what happened and timing)
    - time_lag_days (if applicable)
    - strength (strong/moderate/weak correlation)
  - reciprocity_indicators (array of favor exchanges)
    - favor_given (action by company/politician)
    - benefit_received (reciprocal action)
    - actors_involved
    - connection_strength (high/medium/low)
  - coordination_signals (array of coordinated actions)
    - synchronized_actions (multiple actors doing same thing)
    - messaging_alignment (narrative coordination)
    - network_centrality (key hub nodes)

- manipulation_indicators
  - quid_pro_quo_score (0-1 composite)
  - pattern_consistency (high/medium/low)
  - number_of_actors_involved
  - sophistication_level (crude/covert/sophisticated)

- red_flags
  - high_priority (immediate investigation needed)
  - medium_priority (monitor closely)
  - low_priority (noted but less concerning)

- alternative_explanations (array of benign interpretations)
- investigation_recommendations (next steps)
- confidence_level (0-1)
- notes
`;

const responseFormat = z.object({
  company_name: z.string().describe("Target company"),

  analysis_period: z
    .object({
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
    })
    .describe("Date range of events analyzed"),

  events_analyzed: z
    .number()
    .describe("Total number of favors, donations, and actions reviewed"),

  pattern_analysis: z
    .object({
      temporal_patterns: z
        .array(
          z.object({
            pattern_type: z
              .string()
              .describe("Type: donation_before_ruling, recurring_favor, post_employment_timing, etc."),
            description: z.string().describe("Detailed pattern description"),
            time_lag_days: z.number().nullable().describe("Days between related events"),
            strength: z.enum(["strong", "moderate", "weak"]).describe("How consistent the pattern is"),
            supporting_events: z
              .array(z.string())
              .describe("Evidence: specific event references"),
          })
        )
        .describe("Timing-based patterns detected"),

      reciprocity_indicators: z
        .array(
          z.object({
            favor_given: z.string().describe("Initial favorable action taken"),
            benefit_received: z.string().describe("Reciprocal benefit received"),
            actors_involved: z.array(z.string()).describe("People/entities in the exchange"),
            connection_strength: z.enum(["high", "medium", "low"]).describe("How directly linked"),
            evidence: z.string().describe("Documentation of the exchange"),
          })
        )
        .describe("Evidence of quid pro quo relationships"),

      coordination_signals: z
        .array(
          z.object({
            type: z.string().describe("Type of coordination"),
            description: z.string().describe("What was coordinated"),
            actors: z.array(z.string()).describe("Who coordinated"),
            method: z.string().nullable().describe("How coordination occurred"),
            source: z.string().describe("Source revealing coordination"),
          })
        )
        .describe("Signals of coordinated action across actors"),
    })
    .describe("Detected patterns and relationships"),

  manipulation_indicators: z
    .object({
      quid_pro_quo_score: z
        .number()
        .describe("Overall manipulation likelihood 0-1 (higher = more likely)"),
      pattern_consistency: z
        .enum(["high", "medium", "low"])
        .describe("How consistently patterns repeat across events"),
      number_of_actors_involved: z
        .number()
        .describe("Count of distinct actors in potential scheme"),
      sophistication_level: z
        .enum(["crude", "coordinated", "covert", "sophisticated"])
        .describe("How well-concealed the manipulation is"),
      key_manipulation_techniques: z
        .array(
          z.object({
            technique: z.string().describe("Manipulation technique used"),
            examples: z.array(z.string()).describe("Specific instances"),
            effectiveness: z.enum(["low", "medium", "high"]).nullable(),
          })
        )
        .describe("Common manipulation tactics identified"),
    })
    .describe("Manipulation likelihood assessment"),

  red_flags: z
    .object({
      high_priority: z
        .array(
          z.object({
            flag: z.string().describe("What the flag is"),
            evidence_summary: z.string().describe("Why it's concerning"),
            requires_immediate_review: z.boolean().describe("Urgency level"),
          })
        )
        .describe("Critical concerns"),
      medium_priority: z
        .array(z.string())
        .describe("Moderate concerns to monitor"),
      low_priority: z
        .array(z.string())
        .describe("Minor observations"),
    })
    .describe("Flagged concerns prioritized by severity"),

  alternative_explanations: z
    .array(
      z.object({
        explanation: z.string().describe("Benign interpretation"),
        plausibility: z.enum(["high", "medium", "low"]).describe("How plausible it is"),
        requires_ruling_out: z.boolean().describe("Whether this needs to be disproven"),
      })
    )
    .describe("Legitimate reasons that could explain patterns"),

  investigation_recommendations: z
    .array(
          z.object({
            recommendation: z.string().describe("What to investigate next"),
            priority: z.enum(["high", "medium", "low"]).describe("Investigation priority"),
            specific_data_needed: z.string().describe("Records or data required"),
            potential_sources: z.array(z.string()).describe("Where to look"),
          })
    )
    .describe("Recommended next steps for deeper investigation"),

  confidence_level: z
    .number()
    .describe("Confidence in pattern detection 0-1"),

  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Limitations, data gaps, or methodological notes"),
});

const patternDetectionManipulationSubAgent: SubAgent = {
  name: "Pattern Detection & Manipulation Agent",
  systemPrompt: SYSTEM_PROMPT,
  model: llm,
  tools: [internetSearch, ...webCrawl],
  responseFormat,
  description:
    "Identifies patterns between favors, detects quid pro quo sequences, and flags manipulation indicators in political-company interactions.",
};

export { patternDetectionManipulationSubAgent };
