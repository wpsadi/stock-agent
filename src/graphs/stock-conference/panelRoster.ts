import { promoterAgent } from "../../agents/promoter";
import { demoterAgent } from "../../agents/demoter";
import { financialAnalyst, newsSentimentAnalyst, riskAssessmentAgent } from "../../agents/bench";
import { forecaster, competitiveAnalyst, businessModelExpert, patternDetectionExpert, regulatoryAnalyst, macroSectorAnalyst } from "../../agents/extendedBench";
import { coreFinanceAgent, coreNewsAgent } from "../../agents/core";
import type { StructuredTool } from "@langchain/core/tools";
import { PanelistRole, type RawDataCollection } from "./types";

export type AgentLike = {
  name: string;
  systemPrompt?: string;
  tools?: StructuredTool[];
  invoke?: ( ...args: any[] ) => Promise<unknown>;
};

export type PanelistType = "gatherer" | "promoter" | "demoter" | "core";

export interface PanelParticipant {
  nodeName: string;
  key: keyof RawDataCollection;
  name: string;
  role: PanelistRole;
  type: PanelistType;
  agent: AgentLike;
}

export const CONFERENCE_PARTICIPANTS: PanelParticipant[] = [
  { nodeName: "promoter", key: "promoter", name: promoterAgent.name, role: PanelistRole.PROMOTER, type: "promoter", agent: promoterAgent },
  { nodeName: "demoter", key: "demoter", name: demoterAgent.name, role: PanelistRole.DEMOTER, type: "demoter", agent: demoterAgent },
  { nodeName: "financialAnalyst", key: "financialAnalyst", name: financialAnalyst.name, role: PanelistRole.BENCH, type: "gatherer", agent: financialAnalyst },
  { nodeName: "newsSentiment", key: "newsSentiment", name: newsSentimentAnalyst.name, role: PanelistRole.BENCH, type: "gatherer", agent: newsSentimentAnalyst },
  { nodeName: "riskAssessor", key: "riskAssessor", name: riskAssessmentAgent.name, role: PanelistRole.BENCH, type: "gatherer", agent: riskAssessmentAgent },
  { nodeName: "forecaster", key: "forecaster", name: forecaster.name, role: PanelistRole.BENCH, type: "gatherer", agent: forecaster },
  { nodeName: "competitiveAnalyst", key: "competitiveAnalyst", name: competitiveAnalyst.name, role: PanelistRole.BENCH, type: "gatherer", agent: competitiveAnalyst },
  { nodeName: "businessModelExpert", key: "businessModelExpert", name: businessModelExpert.name, role: PanelistRole.BENCH, type: "gatherer", agent: businessModelExpert },
  { nodeName: "patternDetector", key: "patternDetector", name: patternDetectionExpert.name, role: PanelistRole.BENCH, type: "gatherer", agent: patternDetectionExpert },
  { nodeName: "regulatoryAnalyst", key: "regulatoryAnalyst", name: regulatoryAnalyst.name, role: PanelistRole.BENCH, type: "gatherer", agent: regulatoryAnalyst },
  { nodeName: "macroSectorAnalyst", key: "macroSectorAnalyst", name: macroSectorAnalyst.name, role: PanelistRole.BENCH, type: "gatherer", agent: macroSectorAnalyst },
  { nodeName: "coreFinance", key: "coreFinance", name: coreFinanceAgent.name, role: PanelistRole.BENCH, type: "core", agent: coreFinanceAgent },
  { nodeName: "coreNews", key: "coreNews", name: coreNewsAgent.name, role: PanelistRole.BENCH, type: "core", agent: coreNewsAgent },
];

export const ROUND_TABLE_PARTICIPANTS = CONFERENCE_PARTICIPANTS;

export const REACTION_PANELISTS = CONFERENCE_PARTICIPANTS.filter(
  (participant) => participant.role === PanelistRole.PROMOTER || participant.role === PanelistRole.DEMOTER
);
