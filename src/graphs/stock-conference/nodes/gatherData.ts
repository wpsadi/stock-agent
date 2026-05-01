import { promoterAgent } from "../../../agents/promoter";
import { demoterAgent } from "../../../agents/demoter";
import { financialAnalyst, newsSentimentAnalyst, riskAssessmentAgent } from "../../../agents/bench";
import { forecaster, competitiveAnalyst, businessModelExpert, patternDetectionExpert, regulatoryAnalyst, macroSectorAnalyst } from "../../../agents/extendedBench";
import { coreFinanceAgent, coreNewsAgent } from "../../../agents/core";
import type { ConferenceState, RawDataCollection } from "../types";
import { createConferenceThreadId } from "../types";
import { runAgent } from "./utils/runAgent";

const AGENTS = [
  { key: "promoter", agent: promoterAgent },
  { key: "demoter", agent: demoterAgent },
  { key: "financialAnalyst", agent: financialAnalyst },
  { key: "newsSentiment", agent: newsSentimentAnalyst },
  { key: "riskAssessor", agent: riskAssessmentAgent },
  { key: "forecaster", agent: forecaster },
  { key: "competitiveAnalyst", agent: competitiveAnalyst },
  { key: "businessModelExpert", agent: businessModelExpert },
  { key: "patternDetector", agent: patternDetectionExpert },
  { key: "regulatoryAnalyst", agent: regulatoryAnalyst },
  { key: "macroSectorAnalyst", agent: macroSectorAnalyst },
  { key: "coreFinance", agent: coreFinanceAgent },
  { key: "coreNews", agent: coreNewsAgent },
] as const;

type AgentKey = (typeof AGENTS)[number]["key"];

export const gatherData = async (input: { state: ConferenceState }) => {
  const { state } = input;
  const { companyName, ticker } = state;

  const prompt = `Gather comprehensive information about ${companyName} (${ticker}). Include financial data, news sentiment, risk factors, competitive landscape, business model analysis, forecasting scenarios, pattern detection, regulatory environment, and macro/sector context.`;

  console.log(`\n[GATHER_DATA] Starting parallel collection for ${companyName} (${ticker})...`);
  const threadIdsByKey = { ...state.agentThreadIds };

  const results = await Promise.allSettled(
    AGENTS.map(async ({ key, agent }) => {
      const threadId = threadIdsByKey[key] ?? createConferenceThreadId(companyName, ticker, state.startedAt, key);
      threadIdsByKey[key] = threadId;
      try {
        const output = await runAgent(agent, prompt, { threadId });
        try {
          return { key, data: JSON.parse(output), error: null };
        } catch {
          return { key, data: output, error: null };
        }
      } catch (err: any) {
        console.error(`[GATHER_DATA] error ${key}:`, err.message);
        return { key, data: null, error: err.message };
      }
    })
  );

  const rawData: Record<string, unknown> = {};
  results.forEach((result, idx) => {
    const agent = AGENTS[idx];
    if (!agent) return;
    const key = agent.key;
    if (result.status === "fulfilled") {
      const value = result.value;
      if (value && value.data !== null) {
        rawData[key] = value.data;
        console.log(`[GATHER_DATA] ok ${key}`);
      } else {
        rawData[key] = null;
      }
    } else {
      rawData[key] = null;
    }
  });

  console.log("[GATHER_DATA] done\n");
  return {
    state: {
      ...state,
      gatheringComplete: true,
      rawData: rawData as unknown as RawDataCollection,
      agentThreadIds: threadIdsByKey,
    },
  };
};
