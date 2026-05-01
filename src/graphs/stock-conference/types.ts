export enum RoundType {
  DISCUSSION = "discussion",
  EVALUATION_1 = "evaluation_1",
  EVALUATION_2 = "evaluation_2",
}

export enum PanelistRole {
  PROMOTER = "promoter",
  DEMOTER = "demoter",
  MODERATOR = "moderator",
  BENCH = "bench",
}

export enum ThesisDirection {
  BULLISH = "bullish",
  BEARISH = "bearish",
  NEUTRAL = "neutral",
}

import type { BaseMessage } from "@langchain/core/messages";

export type AgentThreadIdentityMap = Record<string, string>;

function normalizeThreadSegment( value: string ): string {
  return value.toLowerCase().replace( /[^a-z0-9]+/g, "-" ).replace( /^-+|-+$/g, "" ) || "unknown";
}

export function createConferenceThreadId(
  companyName: string,
  ticker: string,
  startedAt: number,
  participantId: string
): string {
  const tickerSegment = ticker.trim() ? normalizeThreadSegment( ticker ) : "";
  const companySegment = normalizeThreadSegment( companyName );
  const participantSegment = normalizeThreadSegment( participantId );
  return `stock-conference-${tickerSegment || companySegment}-${startedAt}-${participantSegment}`;
}

export interface TranscriptMessage {
  speaker: string;
  speakerRole: PanelistRole;
  speakerType?: string;
  message: string;
  target?: string;
  targetRole?: PanelistRole;
  targetType?: string;
  isQuestion: boolean;
  roundNumber: number;
}

export interface RawDataCollection {
  promoter: any;
  demoter: any;
  financialAnalyst: any;
  newsSentiment: any;
  riskAssessor: any;
  forecaster: any;
  competitiveAnalyst: any;
  businessModelExpert: any;
  patternDetector: any;
  regulatoryAnalyst: any;
  macroSectorAnalyst: any;
  coreFinance: any;
  coreNews: any;
}

export interface AgentThesis {
  direction: ThesisDirection;
  rationale: string;
  keyCatalysts?: string[];
  keyRisks?: string[];
  confidence: number;
}

export interface PeerReview {
  reviewer: string;
  target: string;
  review: string;
  strengths?: string[];
  weaknesses?: string[];
  rating?: number;
}

export interface ModeratorLog {
  roundsCompleted: number;
  questionsAsked: Record<string, string[]>;
  turnOrder: string[];
  currentTurnIndex: number;
}

export interface ConferenceState {
  companyName: string;
  ticker: string;
  gatheringComplete: boolean;
  rawData: RawDataCollection | null;
  memorandum: string;
  currentRound: number;
  totalRounds: number;
  totalEvaluationRounds: number;
  roundType: RoundType;
  roundHistory: TranscriptMessage[];
  agentTheses: Record<string, AgentThesis>;
  peerReviews: Record<string, PeerReview[]>;
  moderatorLog: ModeratorLog;
  finalReport: string;
  isComplete: boolean;
  errors: string[];
  startedAt: number;
  completedAt?: number;
  messages: BaseMessage[]; // Chat message history
  agentThreadIds: AgentThreadIdentityMap;
}

export function createInitialState(companyName: string, ticker: string): ConferenceState {
  const now = Date.now();
  return {
    companyName,
    ticker,
    gatheringComplete: false,
    rawData: null,
    memorandum: "",
    currentRound: 1,
    totalRounds: 5,
    totalEvaluationRounds: 2,
    roundType: RoundType.DISCUSSION,
    roundHistory: [],
    agentTheses: {},
    peerReviews: {},
    moderatorLog: {
      roundsCompleted: 0,
      questionsAsked: {},
      turnOrder: [],
      currentTurnIndex: 0,
    },
    finalReport: "",
    isComplete: false,
    errors: [],
    startedAt: now,
    completedAt: undefined,
    messages: [],
    agentThreadIds: {},
  };
}
