import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { llm } from "@llm/index";
import { ChatMessage } from "@langchain/core/messages";
import type { ConferenceState, TranscriptMessage, AgentThesis, PeerReview } from "../types";
import { RoundType, PanelistRole, ThesisDirection } from "../types";
import { promoterAgent } from "../../../agents/promoter";
import { demoterAgent } from "../../../agents/demoter";
import { financialAnalyst, riskAssessmentAgent } from "../../../agents/bench";
import { forecaster, businessModelExpert, regulatoryAnalyst } from "../../../agents/extendedBench";
import { politicalConnectionsSubAgent } from "../../../sub-agents/finance";
import { moderatorAgent } from "../../../agents/moderator";
import { runAgent } from "../nodes/utils/runAgent";
import { createInitialState } from "../types";

// 6 Gatherer agents - each speaks individually in round-robin order
type GathererSpec = {
  name: string;
  role: PanelistRole;
  agent: any;
  type: "gatherer";
};

const GATHERERS: GathererSpec[] = [
  { name: "Political Connections Analyst", role: PanelistRole.BENCH, agent: politicalConnectionsSubAgent, type: "gatherer" },
  { name: "Regulatory and Policy Analyst", role: PanelistRole.BENCH, agent: regulatoryAnalyst, type: "gatherer" },
  { name: "Risk Assessor", role: PanelistRole.BENCH, agent: riskAssessmentAgent, type: "gatherer" },
  { name: "Financial Analyst", role: PanelistRole.BENCH, agent: financialAnalyst, type: "gatherer" },
  { name: "Business Model Expert", role: PanelistRole.BENCH, agent: businessModelExpert, type: "gatherer" },
  { name: "Forecaster", role: PanelistRole.BENCH, agent: forecaster, type: "gatherer" },
];

// ============= Round Node =============

async function runRoundNode(input: { state: ConferenceState }): Promise<{ state: Partial<ConferenceState> }> {
  const { state } = input;
  const {
    companyName, ticker, currentRound, totalRounds, memorandum,
    roundHistory, moderatorLog, agentTheses, peerReviews, messages
  } = state;

  const discussionRounds = totalRounds - 2;
  const isDiscussionRound = currentRound <= discussionRounds;

  let roundType: RoundType;
  if (isDiscussionRound) roundType = RoundType.DISCUSSION;
  else if (currentRound === discussionRounds + 1) roundType = RoundType.EVALUATION_1;
  else roundType = RoundType.EVALUATION_2;

  console.log(`\n[ROUND ${currentRound}/${totalRounds}] ${roundType} for ${companyName}`);

  const prevTranscript = roundHistory.map(r =>
    `[R${r.roundNumber}] ${r.speaker}${r.target ? `->${r.target}` : ""}: ${r.message}`
  ).join("\n");
  const thesesTxt = Object.entries(agentTheses)
    .map(([a, t]) => `${a}: ${t.direction} (conf: ${Math.round(t.confidence * 100)}%)`)
    .join("\n");

  const fullTranscript: TranscriptMessage[] = [...roundHistory];

  // Mutable copies for updates (avoid direct state mutation)
  let updatedAgentTheses = { ...agentTheses };
  let updatedPeerReviews = { ...peerReviews };

  // ====================
  // DISCUSSION ROUNDS
  // ====================
  if (isDiscussionRound) {
    let currentRoundTranscript: TranscriptMessage[] = [];

    // Each gatherer speaks in order
    for (const [i, speaker] of GATHERERS.entries()) {
      const prevInRound = i > 0 ? GATHERERS[i - 1] : null;
      const prevInRoundMsg = prevInRound
        ? currentRoundTranscript.filter(t => t.speaker === prevInRound.name).pop()
        : null;

      console.log(`\n--- ${speaker.name}'s turn (Round ${currentRound}) ---`);

      const prompt = `
Company: ${companyName} (${ticker})
Round ${currentRound}/${totalRounds}
You: ${speaker.name}

Previous rounds:
${prevTranscript || "(none)"}

${prevInRound ? `Previous this round (${prevInRound.name}):
"${prevInRoundMsg?.message?.slice(0, 400) || ''}..."
` : "You open this round."}

Current tentative theses:
${thesesTxt || "(none)"}

Your focus:
${getGathererFocus(speaker.name)}

Respond to previous speaker if relevant, add your analysis, optionally pose 1–2 questions to others.
Keep to 180–220 words. Be concise and analytical.
`;

      try {
        const result = await runAgent(speaker.agent, prompt);
        const msgText = (typeof result === "string" ? result : JSON.stringify(result)).slice(0, 2000);

        const entry: TranscriptMessage = {
          speaker: speaker.name,
          speakerRole: speaker.role,
          speakerType: speaker.type,
          message: msgText,
          roundNumber: currentRound,
          isQuestion: false,
        };
        fullTranscript.push(entry);
        currentRoundTranscript.push(entry);

        // Promoter reaction
        const promPrompt = `${speaker.name} said: "${msgText.slice(0, 500)}..."
You are the Catalyst Hunter (Promoter). Give a brief bullish reaction (60–80 words).`;
        try {
          const prom = await runAgent(promoterAgent, promPrompt);
          fullTranscript.push({
            speaker: "Catalyst Hunter (Promoter)",
            speakerRole: PanelistRole.PROMOTER,
            speakerType: "promoter",
            message: typeof prom === "string" ? prom.slice(0, 1000) : JSON.stringify(prom).slice(0, 1000),
            target: speaker.name,
            targetRole: speaker.role,
            targetType: speaker.type,
            isQuestion: false,
            roundNumber: currentRound,
          });
        } catch { /* ignore */ }

        // Demoter reaction
        const demPrompt = `${speaker.name} said: "${msgText.slice(0, 500)}..."
You are the Risk-Focused Skeptic (Demoter). Give a brief bearish reaction (60–80 words).`;
        try {
          const dem = await runAgent(demoterAgent, demPrompt);
          fullTranscript.push({
            speaker: "Risk-Focused Skeptic (Demoter)",
            speakerRole: PanelistRole.DEMOTER,
            speakerType: "demoter",
            message: typeof dem === "string" ? dem.slice(0, 1000) : JSON.stringify(dem).slice(0, 1000),
            target: speaker.name,
            targetRole: speaker.role,
            targetType: speaker.type,
            isQuestion: false,
            roundNumber: currentRound,
          });
        } catch { /* ignore */ }

      } catch (err: any) {
        console.error(`Gatherer ${speaker.name} error:`, err.message);
        fullTranscript.push({
          speaker: speaker.name,
          speakerRole: speaker.role,
          speakerType: speaker.type,
          message: `[Error: ${err.message}]`,
          roundNumber: currentRound,
          isQuestion: false,
        });
      }
    }

    // Cross-examination phase
    await addCrossExamination(fullTranscript, companyName, ticker, currentRound, GATHERERS, moderatorAgent, runAgent);
  }

  // ====================
  // EVALUATION ROUND 1: Thesis formation
  // ====================
  else if (roundType === RoundType.EVALUATION_1) {
    // Moderator intro
    try {
      const mod = await runAgent(moderatorAgent, `State your brief overall assessment of ${companyName}, then invite each panelist to state their thesis.`);
      fullTranscript.push({
        speaker: "Moderator",
        speakerRole: PanelistRole.MODERATOR,
        speakerType: "moderator",
        message: typeof mod === "string" ? mod.slice(0, 1500) : JSON.stringify(mod).slice(0, 1500),
        roundNumber: currentRound,
        isQuestion: false,
      });
    } catch (e) { console.error("Moderator eval1 error:", e); }

    // Each gatherer states thesis
    for (const g of GATHERERS) {
      const prompt = `You are ${g.name}. Based on all data, state your thesis: direction (bullish/bearish/neutral), confidence 0–100%, and 1–2 key catalysts and risks. Keep to 3–4 sentences total.`;
      try {
        const res = await runAgent(g.agent, prompt);
        const msg = (typeof res === "string" ? res : JSON.stringify(res)).slice(0, 1500);
        fullTranscript.push({
          speaker: g.name,
          speakerRole: g.role,
          speakerType: g.type,
          message: msg,
          roundNumber: currentRound,
          isQuestion: false,
        });
        const thesis = parseThesis(msg, g.name);
        if (thesis) updatedAgentTheses[g.name] = thesis;
      } catch (err) {
        console.error(`Thesis error ${g.name}:`, err);
      }
    }

    // Promoter & Demoter theses
    for (const p of [promoterAgent, demoterAgent] as const) {
      const name = p.name;
      try {
        const res = await runAgent(p, `As ${name}, state your thesis for ${companyName} in 3–4 sentences (direction, confidence, key points).`);
        const msg = (typeof res === "string" ? res : JSON.stringify(res)).slice(0, 1500);
        fullTranscript.push({
          speaker: name,
          speakerRole: name.includes("Promoter") ? PanelistRole.PROMOTER : PanelistRole.DEMOTER,
          speakerType: name.includes("Promoter") ? "promoter" : "demoter",
          message: msg,
          roundNumber: currentRound,
          isQuestion: false,
        });
        const thesis = parseThesis(msg, name);
        if (thesis) updatedAgentTheses[name] = thesis;
      } catch (err) {
        console.error(`Thesis error ${name}:`, err);
      }
    }
  }

  // ====================
  // EVALUATION ROUND 2: Peer reviews
  // ====================
  else if (roundType === RoundType.EVALUATION_2) {
    // Moderator sets framework
    try {
      const mod = await runAgent(moderatorAgent, "Briefly set the framework: each analyst will critique 1–2 other theses, highlighting strengths, weaknesses, and blind spots.");
      fullTranscript.push({
        speaker: "Moderator",
        speakerRole: PanelistRole.MODERATOR,
        speakerType: "moderator",
        message: typeof mod === "string" ? mod.slice(0, 1500) : JSON.stringify(mod).slice(0, 1500),
        roundNumber: currentRound,
        isQuestion: false,
      });
    } catch (e) { console.error("Moderator peer review error:", e); }

    // Each gatherer gives peer reviews of others
    for (const reviewer of GATHERERS) {
      const others = GATHERERS
        .filter(g => g.name !== reviewer.name)
        .map(g => `${g.name}: ${updatedAgentTheses[g.name]?.direction || "unknown"} - ${(updatedAgentTheses[g.name]?.rationale || "").slice(0, 80)}`)
        .join("\n");

      const prompt = `You are ${reviewer.name}. Provide 1–2 peer reviews of other analysts' theses. Be constructive (60–80 words each).\n\nTheses:\n${others}`;
      try {
        const res = await runAgent(reviewer.agent, prompt);
        const msg = (typeof res === "string" ? res : JSON.stringify(res)).slice(0, 1500);
        fullTranscript.push({
          speaker: reviewer.name,
          speakerRole: reviewer.role,
          speakerType: reviewer.type,
          message: msg,
          roundNumber: currentRound,
          isQuestion: false,
        });

        const parsed = parsePeerReviews(msg, reviewer.name);
        for (const r of parsed) {
          if (!updatedPeerReviews[r.target]) updatedPeerReviews[r.target] = [];
          updatedPeerReviews[r.target]!.push(r);
        }
      } catch (err) {
        console.error(`Peer review error ${reviewer.name}:`, err);
      }
    }
  }

  // Convert transcript to chat messages
  const newChatMessages = fullTranscript.map(t =>
    new ChatMessage({
      content: `[${t.speaker}${t.target ? ` → ${t.target}` : ""}]: ${t.message}`,
      role: t.speakerRole,
      additional_kwargs: {
        speaker: t.speaker,
        target: t.target,
        isQuestion: t.isQuestion,
        roundNumber: t.roundNumber,
      },
    })
  );

  const isFinal = currentRound >= totalRounds;

  const update: Partial<ConferenceState> = {
    roundHistory: fullTranscript,
    moderatorLog: { ...moderatorLog, roundsCompleted: moderatorLog.roundsCompleted + 1 },
    currentRound: isFinal ? currentRound : currentRound + 1,
    roundType: isFinal ? roundType : undefined,
    isComplete: isFinal,
    completedAt: isFinal ? Date.now() : undefined,
    messages: [...messages, ...newChatMessages],
    agentTheses: updatedAgentTheses,
    peerReviews: updatedPeerReviews,
  };

  return { state: { ...state, ...update } };
}

// ============= Helper Functions =============

function getGathererFocus(name: string): string {
  const map: Record<string, string> = {
    "Political Connections Analyst": `- Political connections: campaign contributions, lobbying, PAC spending
- Regulatory favors: government contracts, subsidies, tax benefits
- Conflicts of interest: revolving door, board political roles
- Political risk: exposure to policy changes, party alignment
- Focus: Founders/executives' political influence and government favors`,
    "Regulatory and Policy Analyst": `- Pending legislation and regulations
- Government approvals, permits, licenses
- Subsidies, tax incentives, government programs
- Compliance requirements and enforcement actions
- Trade policy and international regulations`,
    "Risk Assessor": `- Political and regulatory risks (material >20% revenue)
- Concentration risk from government contracts/subsidies
- Legal exposures, investigations
- Public policy sensitivity
- Country/regional political stability`,
    "Financial Analyst": `- Financial statement impact of government favors
- Subsidies, tax credits, effect on earnings
- Government contract revenue quality & sustainability
- Off-balance sheet political risks
- How political connections affect financial metrics`,
    "Business Model Expert": `- How government favors shape the business model
- Dependence on regulatory advantages
- Competitive moat from political connections
- Sustainability of politically-driven advantages
- Unit economics with/without government support`,
    "Forecaster": `- Impact of political/regulatory changes on future financials
- Scenarios: policy change, election outcomes
- DCF adjustments for political risk premium
- Timing of legislative impacts
- Probability-weighted outcomes by political alignment`,
  };
  return map[name] || "Provide expert analysis in your specialty area.";
}

function parseThesis(output: string, agentName: string): AgentThesis | null {
  const lower = output.toLowerCase();
  let direction: "bullish" | "bearish" | "neutral" = "neutral";
  if (lower.includes("bullish") || lower.includes("positive") || lower.includes("optimistic")) direction = "bullish";
  else if (lower.includes("bearish") || lower.includes("negative") || lower.includes("pessimistic")) direction = "bearish";

  const confMatch = output.match(/(\d+)%\s*confidence/i) || output.match(/confidence:?\s*(\d+)/i);
  const confidence = confMatch && confMatch[1] ? Math.min(100, Math.max(0, parseInt(confMatch[1]))) / 100 : 0.5;

  const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const rationale = sentences.length > 0 ? sentences.slice(0, 2).join(". ") + "." : output.slice(0, 200);

  return { direction: direction as ThesisDirection, confidence, rationale };
}

function parsePeerReviews(output: string, reviewerName: string): Array<{reviewer: string; target: string; review: string}> {
  const reviews: Array<{reviewer: string; target: string; review: string}> = [];
  const lines = output.split("\n").filter(l => l.trim().length > 0);

  for (const line of lines) {
    const match = line.match(/review of ([^:]+):\s*(.+)/i) || line.match(/([A-Za-z\s]+(?:Analyst|Expert|Assessor|Hunter|Skeptic)):\s*(.+)/i);
    if (match && match[1] && match[2]) {
      reviews.push({ reviewer: reviewerName, target: match[1].trim(), review: match[2].trim() });
    }
  }

  if (reviews.length === 0 && output.trim().length > 10) {
    const possible = GATHERERS.map(g => g.name).filter(n => n !== reviewerName);
    reviews.push({
      reviewer: reviewerName,
      target: possible.length > 0 ? possible[0]! : "All Analysts",
      review: output.slice(0, 800),
    });
  }
  return reviews;
}

async function addCrossExamination(
  fullTranscript: TranscriptMessage[],
  companyName: string,
  ticker: string,
  currentRound: number,
  gatherers: GathererSpec[],
  moderatorAgent: any,
  runAgent: any
) {
  console.log("\n--- Cross-examination ---");
  const roundSpeeches = fullTranscript
    .filter(t => t.roundNumber === currentRound && t.speakerType === "gatherer")
    .map(t => `${t.speaker}: ${t.message.slice(0, 200)}...`)
    .join("\n\n");

  if (roundSpeeches.length < 50) return;

  const prompt = `
Company: ${companyName}
${roundSpeeches}

As moderator, ask 2 targeted follow-up questions to specific gatherers to probe contradictions or blind spots.
Format: "To [Name]: [question]"
Keep questions concise (40–60 words).
`;

  try {
    const res = await runAgent(moderatorAgent, prompt);
    const txt = typeof res === "string" ? res : JSON.stringify(res);
    const questions = parseQuestionsList(txt);

    for (const q of questions.slice(0, 2)) {
      const targetName = q.target || "Analyst";
      const target = gatherers.find(g =>
        targetName.toLowerCase().includes(g.name.toLowerCase().split(" ")[0] ?? "") ||
        g.name.toLowerCase().includes(targetName.toLowerCase().split(" ")[0] ?? "")
      );

      fullTranscript.push({
        speaker: "Moderator",
        speakerRole: PanelistRole.MODERATOR,
        speakerType: "moderator",
        message: `To ${targetName}: ${q.question}`,
        target: targetName,
        targetRole: target?.role ?? PanelistRole.BENCH,
        targetType: "gatherer",
        isQuestion: true,
        roundNumber: currentRound,
      });

      if (target) {
        const respPrompt = `You are ${target.name}. Moderator asks: "${q.question}". Respond concisely (80–120 words).`;
        try {
          const resp = await runAgent(target.agent, respPrompt);
          const respMsg = typeof resp === "string" ? resp : JSON.stringify(resp);
          fullTranscript.push({
            speaker: target.name,
            speakerRole: target.role,
            speakerType: target.type,
            message: respMsg.slice(0, 1500),
            target: "Moderator",
            targetRole: PanelistRole.MODERATOR,
            targetType: "moderator",
            isQuestion: false,
            roundNumber: currentRound,
          });
        } catch (e) { console.error(`Cross-exam error ${target.name}:`, e); }
      }
    }
  } catch (e) {
    console.error("Cross-examination failed:", e);
  }
}

function parseQuestionsList(text: string): Array<{target: string; question: string}> {
  const questions: Array<{target: string; question: string}> = [];
  const lines = text.split("\n").map(l => l.trim()).filter(l => l && l.length > 5 && (l.includes("?") || l.toLowerCase().includes("to ")));

  for (const line of lines) {
    const clean = line.replace(/^\d+\.\s*/, "");
    const match = clean.match(/to\s+([^:]+):\s*(.+)/i);
    if (match && match[1] && match[2]) {
      questions.push({ target: match[1].trim(), question: match[2].trim() });
    }
  }

  if (questions.length === 0) {
    const pot = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.endsWith("?") && s.length > 15);
    for (const q of pot.slice(0, 2)) questions.push({ target: "Analyst", question: q.slice(0, -1) });
  }

  return questions;
}

// ============= Build Subgraph =============

const StateAnnotation = Annotation.Root({
  state: Annotation<ConferenceState>({
    reducer: (prev, next) => {
      if (prev.rawData && next.rawData) {
        return { ...prev, ...next, rawData: { ...prev.rawData, ...next.rawData } };
      }
      return { ...prev, ...next };
    },
    default: () => createInitialState("", ""),
  }),
});

const builder = new StateGraph(StateAnnotation);
builder.addNode("runRound", runRoundNode);
// @ts-ignore
builder.addEdge(START, "runRound");
// @ts-ignore
builder.addEdge("runRound", END);

export const roundSubgraph = builder.compile();
