import { llm } from "@llm/index";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { writeFile } from "fs/promises";
import { join } from "path";
import type { ConferenceState, AgentThesis, PeerReview } from "../types";
import { ROUND_TABLE_PARTICIPANTS } from "../panelRoster";

export const compileFinalReport = async (input: { state: ConferenceState }) => {
  const { state } = input;
  const { companyName, ticker, memorandum, roundHistory, agentTheses, peerReviews, startedAt, completedAt, messages } = state;

  const duration = completedAt ? ((completedAt - startedAt) / 1000).toFixed(1) : "unknown";
  console.log(`\n[REPORT] Generating for ${companyName}...`);

  const transcriptText = roundHistory
    .map((r) => `[R${r.roundNumber}] ${r.speaker}${r.target ? `->${r.target}` : ""}: ${r.message}`)
    .join("\n");

  const thesesText = Object.entries(agentTheses)
    .map(([a, t]) => `${a}: ${(t as AgentThesis).direction.toUpperCase()} (conf: ${Math.round((t as AgentThesis).confidence * 100)}%) - ${(t as AgentThesis).rationale}`)
    .join("\n");

  const peerText = Object.entries(peerReviews)
    .map(([tgt, revs]) => `${tgt}:\n  ${revs.map((r: PeerReview) => `${r.reviewer}: ${r.review}`).join("\n  ")}`)
    .join("\n");
  const expectedPanelists = ROUND_TABLE_PARTICIPANTS.map((p) => p.name).join(", ");

  const systemPrompt = `You are an equity research analyst compiling a comprehensive conference report.

Write a professional markdown report (3000-4000 words) with:

1. Executive Summary
2. Investment Thesis Spectrum (Bull, Bear, Consensus)
3. Data & Analysis Deep Dive (financials, risks, competition, business model, valuation, technicals, regulatory, macro)
4. Conference Highlights (key debates, Q&A insights)
5. Panelist Positions (table)
6. Peer Review Summary
7. Moderator Synthesis
8. Actionable Takeaways (catalysts, risks, decision framework)
9. Appendices

Use charts where appropriate (placeholders ok).
Start with YAML frontmatter.`;

  const humanPrompt = `Company: ${companyName} (${ticker})
Duration: ${duration}s

## Pre-Conference Memorandum
${memorandum}

## Full Transcript (${roundHistory.length} messages)
${transcriptText}

## Individual Theses
${thesesText || "(none)"}

## Expected Round-Table Panelists (${ROUND_TABLE_PARTICIPANTS.length})
${expectedPanelists}

## Peer Reviews
${peerText || "(none)"}

Write full report now.`;

  const result = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(humanPrompt),
  ]);
  const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);

  const outputPath = join(process.cwd(), "output", `${companyName.replace(/\s+/g, "_")}.md`);
  await writeFile(outputPath, content);
  console.log(`[REPORT] Saved to ${outputPath}`);

  // Append final report generation to messages
  const newMessages = [
    new SystemMessage({ content: systemPrompt, additional_kwargs: { stage: "compileFinalReport", type: "system" } }),
    new HumanMessage({ content: humanPrompt, additional_kwargs: { stage: "compileFinalReport", type: "human" } }),
    new AIMessage({ content, additional_kwargs: { stage: "compileFinalReport", type: "ai", outputPath } }),
  ];

  return { state: { ...state, finalReport: content, isComplete: true, completedAt: Date.now(), messages: [...messages, ...newMessages] } };
};
