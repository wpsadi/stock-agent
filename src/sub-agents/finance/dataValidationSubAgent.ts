import { llm } from "@llm/index";
import { internetSearch } from "@tools/internet-search";
import type { SubAgent } from "deepagents";
import { yahooFinance } from "@mcps/yahoo-finance";
import z from "zod";
import { webCrawl } from "@mcps/web-crawler";

const SYSTEM_PROMPT = `
You are a data validation agent—the trust layer that ensures data quality and consistency.

For every request:
1. Receive a dataset or structured output from any agent.
2. Cross-check values against independent sources.
3. Detect stale, suspicious, or low-quality inputs.
4. Normalize values into consistent units and formats.
5. Flag uncertainties and data gaps.

Core tasks:
- Cross-check conflicting data points
- Detect stale or outdated information
- Normalize outputs (currencies, units, periods)
- Identify data quality issues (missing, approximate, estimated)
- Validate consistency across sources

Workflow:
1. Identify all numeric claims or data points in input.
2. For each material data point, verify using internet_search or alternative tools if conflict suspected.
3. Check timestamp of sources—reject data older than 2 years unless specified otherwise.
4. Normalize: convert all currencies to USD (with conversion date), all units to standard (thousands/millions/billions).
5. Flag anomalies: values that deviate >20% from alternative sources.
6. Return clean, validated dataset with quality indicators.

Rules:
- Prioritize primary sources (SEC filings, official company releases) over secondary sources.
- If two sources conflict, choose the more recent and more authoritative.
- Never guess—if uncertain, flag as "unverified" or "estimation required".
- Mark all derived/calculated values distinctly from raw data.
- Require source attribution for all retained data points.

Output format:
Return a structured object with:
- original_input_summary (brief description of what was validated)
- validation_results
  - total_data_points (count)
  - validated_count
  - flagged_count
  - stale_count (data >24 months)
  - estimated_count (marked as estimate)
- data_points (array of validated items)
  - field_name
  - original_value
  - validated_value (or null if unvalidated)
  - source (where validated from)
  - is_stale (boolean)
  - is_estimated (boolean)
  - confidence (0-1)
  - notes
- conflicts_detected (array of discrepancies found)
  - field
  - sources_conflicting
  - resolved_value
  - resolution_reason
- normalization_actions (array of conversions applied)
- data_quality_score (overall 0-1 composite)
- recommendations (actions to improve data quality)
- notes
`;

const responseFormat = z.object({
  original_input_summary: z
    .string()
    .describe("Brief description of the input data that was validated"),

  validation_results: z
    .object({
      total_data_points: z.number().describe("Total number of data points checked"),
      validated_count: z.number().describe("Number successfully validated"),
      flagged_count: z.number().describe("Number flagged for quality concerns"),
      stale_count: z.number().describe("Number outdated (>24 months)"),
      estimated_count: z.number().describe("Number marked as estimates"),
    })
    .describe("Summary of validation effort"),

  data_points: z
    .array(
      z.object({
        field_name: z.string().describe("Name of the data field"),
        original_value: z.any().describe("Original value before validation"),
        validated_value: z.any().nullable().describe("Validated value (null if unvalidated)"),
        source: z.string().nullable().describe("Source of validated data"),
        is_stale: z.boolean().describe("Whether data is outdated"),
        is_estimated: z.boolean().describe("Whether value is an estimate"),
        confidence: z.number().describe("Confidence in validated value (0-1)"),
        notes: z.string().nullable().describe("Validation notes or concerns"),
      })
    )
    .describe("Per-field validation results"),

  conflicts_detected: z
    .array(
      z.object({
        field: z.string().describe("Data field with conflict"),
        sources_conflicting: z.array(z.string()).describe("Different sources and their values"),
        resolved_value: z.any().describe("Value chosen after resolution"),
        resolution_reason: z.string().describe("Why this value was selected"),
      })
    )
    .describe("Conflicts found and how they were resolved"),

  normalization_actions: z
    .array(
      z.object({
        field: z.string().describe("Field that was normalized"),
        original_unit: z.string().describe("Original unit/currency"),
        normalized_unit: z.string().describe("Target unit/currency"),
        conversion_factor: z.number().nullable().describe("Conversion applied if any"),
      })
    )
    .describe("Unit and currency normalizations performed"),

  data_quality_score: z
    .number()
    .describe("Overall data quality score 0-1 (higher is better)"),

  recommendations: z
    .array(z.string())
    .describe("Suggested actions to improve data quality"),

  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Important validation context or warnings"),
});

const dataValidationSubAgent: SubAgent = {
  name: "Data Validation Agent",
  systemPrompt: SYSTEM_PROMPT,
  model: llm,
  tools: [internetSearch, ...yahooFinance, ...webCrawl],
  responseFormat,
  description:
    "Cross-checks data against multiple sources, detects stale/low-quality inputs, normalizes units, and flags uncertainties.",
};

export { dataValidationSubAgent };
