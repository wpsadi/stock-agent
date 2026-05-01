import { llm } from "@llm/index";
import { news } from "@mcps/news-mcp";
import { internetSearch } from "@tools/internet-search";
import type { SubAgent } from "deepagents";
import z from "zod";

const SYSTEM_PROMPT = `
You are a news aggregation and sentiment analysis agent focused on financial markets and companies.

For every request:
1. Identify the target company, ticker, or topic.
2. Retrieve latest news using available tools.
3. Aggregate and score sentiment.
4. Detect key events (mergers, lawsuits, product launches, etc.).
5. Track narrative shifts over time if timeframe specified.

Core tasks:
- Latest news aggregation from multiple sources
- Sentiment scoring (bullish/bearish/neutral with confidence)
- Event detection (M&A, litigation, product launches, management changes)
- Narrative evolution tracking (how story changed over time)

Workflow:
1. Use news_search → for recent articles (last 7-30 days)
2. Use internet_search → for broader coverage if needed
3. Categorize each article: event type, sentiment, source credibility
4. Compute aggregate sentiment weighted by source reliability
5. Identify emerging vs. persistent narratives
6. Flag contradictory reporting or sentiment shifts

Rules:
- Cite sources explicitly with dates.
- Distinguish between factual events and opinion pieces.
- Weight sentiment by source credibility (e.g., Reuters > blog).
- If sentiment is mixed, break down by article count.
- Never invent news—only use retrieved articles.

Output format:
Return a structured object with:
- topic (company name or ticker)
- time_period (e.g., "last 7 days", "last 30 days")
- news_summary (2–3 line TL;DR)
- article_count (total articles analyzed)
- sentiment
  - overall: "bullish" | "bearish" | "neutral" | "mixed"
  - score: -1 to 1 (negative to positive)
  - confidence: 0–1
- sentiment_breakdown
  - bullish: count
  - bearish: count
  - neutral: count
- key_events (array of detected events with type, date, description)
- narrative_shifts (if multi-period comparison requested)
  - previous_period_sentiment
  - change_reason
- top_headlines (array of 3–5 most important headlines with source and date)
- sources (array of unique sources)
- notes
`;

const responseFormat = z.object({
  topic: z
    .string()
    .describe("Company name or ticker symbol being analyzed"),

  time_period: z
    .string()
    .describe("Time period covered (e.g., 'last 7 days', 'last 30 days')"),

  news_summary: z
    .string()
    .describe("Brief 2-3 line summary of overall news narrative"),

  article_count: z
    .number()
    .describe("Total number of articles analyzed"),

  sentiment: z
    .object({
      overall: z.enum(["bullish", "bearish", "neutral", "mixed"]).describe("Overall sentiment classification"),
      score: z.number().describe("Sentiment score from -1 (bearish) to 1 (bullish)"),
      confidence: z.number().describe("Confidence in sentiment classification (0-1)"),
    })
    .describe("Aggregate sentiment analysis"),

  sentiment_breakdown: z
    .object({
      bullish: z.number().describe("Number of bullish articles"),
      bearish: z.number().describe("Number of bearish articles"),
      neutral: z.number().describe("Number of neutral articles"),
    })
    .describe("Breakdown by sentiment category"),

  key_events: z
    .array(
      z.object({
        type: z.string().describe("Event type (e.g., M&A, lawsuit, product launch, earnings)"),
        date: z.string().describe("Event date"),
        description: z.string().describe("Brief description of the event"),
        source: z.string().describe("Source of the information"),
      })
    )
    .describe("Detected significant events"),

  narrative_shifts: z
    .object({
      detected: z.boolean().describe("Whether narrative shift was detected"),
      previous_period_sentiment: z.string().nullable().describe("Sentiment in previous period if comparable"),
      change_reason: z.string().nullable().describe("Reason for sentiment change"),
    })
    .describe("Narrative evolution tracking"),

  top_headlines: z
    .array(
      z.object({
        title: z.string().describe("Headline title"),
        source: z.string().describe("News source"),
        date: z.string().describe("Publication date"),
        url: z.string().nullable().describe("Article URL if available"),
      })
    )
    .describe("Top 3-5 most important headlines"),

  sources: z
    .array(z.string())
    .describe("List of unique news sources"),

  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Additional observations or data limitations"),
});

const newsSentimentSubAgent: SubAgent = {
  name: "News & Sentiment Agent",
  systemPrompt: SYSTEM_PROMPT,
  model: llm,
  tools: [...news, internetSearch],
  responseFormat,
  description:
    "Aggregates latest financial news, scores sentiment, detects key events, and tracks narrative shifts over time.",
};

export { newsSentimentSubAgent };
