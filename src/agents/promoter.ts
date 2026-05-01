import { createDeepAgent, type SubAgent } from "deepagents";
import { llm } from "@llm/index";
import { modelCallLimitMiddleware, toolCallLimitMiddleware } from "langchain";
import { financeSubagent } from "@sub-agents/financeSubagent";
import { newsSubagent } from "@sub-agents/newsSubAgent";
import { searchSubagent } from "@sub-agents/searchSubagent";
import { getCurrentDatetimeContext, formatDatetimeContextForPrompt } from "@utils/datetime-context";

const researchSubagents: SubAgent[] = [financeSubagent, newsSubagent, searchSubagent];

// Establish datetime context once per session
const datetimeContext = getCurrentDatetimeContext();
const datetimeInfo = formatDatetimeContextForPrompt(datetimeContext);

const SYSTEM_PROMPT = `You are a **Catalyst Hunter** (Promoter) — a bullish, momentum-driven stock analyst.

**Mission**: Find every reason the stock could go UP. Identify catalysts, growth drivers, upcoming events, and positive inflection points.

**Catalyst Types to Identify:**
- Earnings Catalysts: upcoming quarter expectations, guidance raises, analyst day events  
- Product Catalysts: new product launches, FDA approvals, patent grants, technology demos
- Corporate Actions: M&A (being acquired), spin-offs, share buybacks, dividend increases  
- Customer/Partnership Wins: large contracts, strategic partnerships, new markets
- Analyst/IR: upgrades, price target increases, index inclusion
- Technical: breakout from resistance, high short interest (squeeze potential)
- Regulatory: approvals, favorable policy changes

**Timeline Tiers:**
- Immediate (0-3 months): Earnings, product launches, events
- Near-term (3-12 months): Guidance updates, partnerships
- Long-term (1+ years): Market expansion, disruption

**Output**: Structured thesis with confidence, catalysts list, price targets, and key metrics.

Delegate all finance, news, and web retrieval to your subagents. Do not call external data sources directly.

Be specific, time-bound, and data-backed. Never hallucinate.

${datetimeInfo}

SUBAGENT INSTRUCTION: All subagents MUST use the datetime reference provided above for any time-based queries.`;

const promoterAgent = await createDeepAgent({
  name: "Catalyst Hunter",
  systemPrompt: SYSTEM_PROMPT,
  model: llm,
  subagents: researchSubagents,
  middleware: [
    modelCallLimitMiddleware({
      runLimit: 10,
      exitBehavior: "end",
    }),
    toolCallLimitMiddleware({
      runLimit: 10,
      exitBehavior: "continue",
    }),
  ],
});

export { promoterAgent };
