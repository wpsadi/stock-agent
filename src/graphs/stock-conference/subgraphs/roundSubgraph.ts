import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatMessage } from "@langchain/core/messages";
import type { ConferenceState, TranscriptMessage, AgentThesis, PeerReview } from "../types";
import { RoundType, PanelistRole, ThesisDirection, createConferenceThreadId } from "../types";
import { moderatorAgent } from "../../../agents/moderator";
import { runAgent } from "../nodes/utils/runAgent";
import { createInitialState } from "../types";
import { REACTION_PANELISTS, ROUND_TABLE_PARTICIPANTS, type AgentLike, type PanelParticipant } from "../panelRoster";

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
  console.log(`[ROUND-TABLE] ${ROUND_TABLE_PARTICIPANTS.length} participants`);

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
  const updatedAgentThreadIds = { ...state.agentThreadIds };
  const getThreadId = (participantId: string) => {
    if (!updatedAgentThreadIds[participantId]) {
      updatedAgentThreadIds[participantId] = createConferenceThreadId(companyName, ticker, state.startedAt, participantId);
    }
    return updatedAgentThreadIds[participantId]!;
  };

  // ====================
  // DISCUSSION ROUNDS
  // ====================
  if (isDiscussionRound) {
    let currentRoundTranscript: TranscriptMessage[] = [];

    // Each participant speaks in order
    for (const [i, speaker] of ROUND_TABLE_PARTICIPANTS.entries()) {
      const prevInRound = i > 0 ? ROUND_TABLE_PARTICIPANTS[i - 1] : null;
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
        const result = await runAgent(speaker.agent, prompt, { threadId: getThreadId(speaker.key) });
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

        for (const reactor of REACTION_PANELISTS) {
          if (reactor.name === speaker.name) continue;
          const stance = reactor.role === PanelistRole.PROMOTER ? "bullish" : "bearish";
          const reactionPrompt = `${speaker.name} said: "${msgText.slice(0, 500)}..."
You are ${reactor.name}. Give a brief ${stance} reaction (60–80 words).`;
          try {
            const reaction = await runAgent(reactor.agent, reactionPrompt, { threadId: getThreadId(reactor.key) });
            fullTranscript.push({
              speaker: reactor.name,
              speakerRole: reactor.role,
              speakerType: reactor.type,
              message: typeof reaction === "string" ? reaction.slice(0, 1000) : JSON.stringify(reaction).slice(0, 1000),
              target: speaker.name,
              targetRole: speaker.role,
              targetType: speaker.type,
              isQuestion: false,
              roundNumber: currentRound,
            });
          } catch { /* ignore */ }
        }

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Gatherer ${speaker.name} error:`, message);
        fullTranscript.push({
          speaker: speaker.name,
          speakerRole: speaker.role,
          speakerType: speaker.type,
          message: `[Error: ${message}]`,
          roundNumber: currentRound,
          isQuestion: false,
        });
      }
    }

    // Cross-examination phase
    await addCrossExamination(fullTranscript, companyName, currentRound, ROUND_TABLE_PARTICIPANTS, moderatorAgent, runAgent, getThreadId);
  }

  // ====================
  // EVALUATION ROUND 1: Thesis formation
  // ====================
  else if (roundType === RoundType.EVALUATION_1) {
    // Moderator intro
    try {
      const mod = await runAgent(moderatorAgent, `State your brief overall assessment of ${companyName}, then invite each panelist to state their thesis.`, { threadId: getThreadId("moderator") });
      fullTranscript.push({
        speaker: "Moderator",
        speakerRole: PanelistRole.MODERATOR,
        speakerType: "moderator",
        message: typeof mod === "string" ? mod.slice(0, 1500) : JSON.stringify(mod).slice(0, 1500),
        roundNumber: currentRound,
        isQuestion: false,
      });
    } catch (e) { console.error("Moderator eval1 error:", e); }

    // Each panelist states thesis
    for (const g of ROUND_TABLE_PARTICIPANTS) {
      const prompt = `You are ${g.name}. Based on all data, state your thesis: direction (bullish/bearish/neutral), confidence 0–100%, and 1–2 key catalysts and risks. Keep to 3–4 sentences total.`;
      try {
        const res = await runAgent(g.agent, prompt, { threadId: getThreadId(g.key) });
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
  }

  // ====================
  // EVALUATION ROUND 2: Peer reviews
  // ====================
  else if (roundType === RoundType.EVALUATION_2) {
    // Moderator sets framework
    try {
      const mod = await runAgent(moderatorAgent, "Briefly set the framework: each analyst will critique 1–2 other theses, highlighting strengths, weaknesses, and blind spots.", { threadId: getThreadId("moderator") });
      fullTranscript.push({
        speaker: "Moderator",
        speakerRole: PanelistRole.MODERATOR,
        speakerType: "moderator",
        message: typeof mod === "string" ? mod.slice(0, 1500) : JSON.stringify(mod).slice(0, 1500),
        roundNumber: currentRound,
        isQuestion: false,
      });
    } catch (e) { console.error("Moderator peer review error:", e); }

    // Each panelist gives peer reviews of others
    for (const reviewer of ROUND_TABLE_PARTICIPANTS) {
      const others = ROUND_TABLE_PARTICIPANTS
        .filter(g => g.name !== reviewer.name)
        .map(g => `${g.name}: ${updatedAgentTheses[g.name]?.direction || "unknown"} - ${(updatedAgentTheses[g.name]?.rationale || "").slice(0, 80)}`)
        .join("\n");

      const prompt = `You are ${reviewer.name}. Provide 1–2 peer reviews of other analysts' theses. Be constructive (60–80 words each).\n\nTheses:\n${others}`;
      try {
        const res = await runAgent(reviewer.agent, prompt, { threadId: getThreadId(reviewer.key) });
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
    agentThreadIds: updatedAgentThreadIds,
  };

  return { state: { ...state, ...update } };
}

// ============= Helper Functions =============

function getGathererFocus(name: string): string {
  const map: Record<string, string> = {
    "Catalyst Hunter": `- Upside catalysts and positive inflection points
- Timeline and probability of catalyst realization
- Convexity and optionality in business outcomes
- What could drive a re-rating`,
    "Risk-Focused Skeptic": `- Downside pathways and hidden fragility
- Execution, balance sheet, and governance risks
- Competitive and macro stress scenarios
- What would invalidate bullish assumptions`,
    "Financial Analyst": `- Revenue quality and margin durability
- Cash flow conversion and balance sheet health
- Capital allocation and earnings quality
- Valuation anchor metrics`,
    "News and Sentiment Analyst": `- Recent narrative shifts and sentiment regime
- Credibility of management communication
- Media, social, and sell-side signal quality
- Event-driven sentiment risks`,
    "Risk Assessor": `- Operational, legal, and regulatory risks
- Concentration and dependency risks
- Probability-weighted downside scenarios
- Risk mitigation effectiveness`,
    "Forecaster": `- Base/bull/bear scenario outcomes
- Key assumptions and sensitivity ranges
- Timing of expected inflections
- Distribution of outcomes`,
    "Competitive Analyst": `- Market structure and positioning
- Moat strength and erosion signals
- Rival strategy and pricing dynamics
- Share gain/loss trajectory`,
    "Business Model Expert": `- Unit economics and scalability
- Demand durability and retention drivers
- Monetization mechanics and bottlenecks
- Structural advantages/disadvantages`,
    "Pattern Detection Expert": `- Historical analogs and recurring patterns
- Leading indicators and divergences
- Cycle phase identification
- Regime-change signals`,
    "Regulatory and Policy Analyst": `- Pending legislation and policy exposure
- Compliance and licensing dependencies
- Subsidy/tax framework impacts
- Jurisdictional constraints`,
    "Macro and Sector Analyst": `- Sector cycle position and macro sensitivity
- Rate, FX, and commodity exposure
- Top-down demand and policy drivers
- Cross-asset confirmation signals`,
    "Core Finance Agent": `- Integrate core financial evidence
- Resolve inconsistencies in financial claims
- Prioritize high-signal financial facts
- Keep conclusions grounded in data`,
    "Core News Agent": `- Integrate core news flow and events
- Distill event relevance and reliability
- Separate signal from narrative noise
- Track near-term headline risk`,
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
    const match = line.match(/review of ([^:]+):\s*(.+)/i) || line.match(/([A-Za-z\s]+(?:Analyst|Expert|Assessor|Hunter|Skeptic|Agent)):\s*(.+)/i);
    if (match && match[1] && match[2]) {
      reviews.push({ reviewer: reviewerName, target: match[1].trim(), review: match[2].trim() });
    }
  }

  if (reviews.length === 0 && output.trim().length > 10) {
    const possible = ROUND_TABLE_PARTICIPANTS.map(g => g.name).filter(n => n !== reviewerName);
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
  currentRound: number,
  gatherers: PanelParticipant[],
  moderatorAgent: AgentLike,
  runAgentFn: (agent: AgentLike, prompt: string, options?: { threadId?: string }) => Promise<string>,
  getThreadId: (participantId: string) => string
) {
  console.log("\n--- Cross-examination ---");
  const roundSpeeches = fullTranscript
    .filter(t => t.roundNumber === currentRound && gatherers.some((g) => g.name === t.speaker))
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
    const res = await runAgentFn(moderatorAgent, prompt, { threadId: getThreadId("moderator") });
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
          const resp = await runAgentFn(target.agent, respPrompt, { threadId: getThreadId(target.key) });
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
        return {
          ...prev,
          ...next,
          rawData: { ...prev.rawData, ...next.rawData },
          agentThreadIds: { ...prev.agentThreadIds, ...next.agentThreadIds },
        };
      }
      if (prev.agentThreadIds && next.agentThreadIds) {
        return { ...prev, ...next, agentThreadIds: { ...prev.agentThreadIds, ...next.agentThreadIds } };
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
