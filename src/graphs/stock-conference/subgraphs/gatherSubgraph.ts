import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import type { ConferenceState } from "../types";
import { createInitialState } from "../types";
import { runAgent } from "../nodes/utils/runAgent";
import { promoterAgent } from "../../../agents/promoter";
import { demoterAgent } from "../../../agents/demoter";
import { financialAnalyst, newsSentimentAnalyst, riskAssessmentAgent } from "../../../agents/bench";
import { forecaster, competitiveAnalyst, businessModelExpert, patternDetectionExpert, regulatoryAnalyst, macroSectorAnalyst } from "../../../agents/extendedBench";
import { financeSubagent as coreFinanceAgent } from "../../../sub-agents/financeSubagent";
import { newsSubagent as coreNewsAgent } from "../../../sub-agents/newsSubAgent";

interface AgentNodeInput {
  state: ConferenceState;
}

const createAgentNode = (agent: { name: string; systemPrompt: string; tools?: any[] }, key: string) => {
  return async (input: AgentNodeInput) => {
    const { state } = input;
    const { companyName, ticker } = state;

    const prompt = `Gather comprehensive information about ${companyName} (${ticker}). Include financial data, news sentiment, risk factors, competitive landscape, business model analysis, forecasting scenarios, pattern detection, regulatory environment, and macro/sector context.`;

    try {
      const output = await runAgent(agent, prompt);
      let parsed: any;
      try {
        parsed = JSON.parse(output);
      } catch {
        parsed = output;
      }

      return {
        state: {
          ...state,
          rawData: { ...(state.rawData || {}), [key]: parsed },
        },
      };
    } catch (err: any) {
      console.error(`Agent ${key} error:`, err.message);
      return {
        state: {
          ...state,
          rawData: { ...(state.rawData || {}), [key]: null },
          errors: [...(state.errors || []), `Agent ${key}: ${err.message}`],
        },
      };
    }
  };
};

const agentDefs = [
  { name: "promoter", agent: promoterAgent, key: "promoter" },
  { name: "demoter", agent: demoterAgent, key: "demoter" },
  { name: "financialAnalyst", agent: financialAnalyst, key: "financialAnalyst" },
  { name: "newsSentiment", agent: newsSentimentAnalyst, key: "newsSentiment" },
  { name: "riskAssessor", agent: riskAssessmentAgent, key: "riskAssessor" },
  { name: "forecaster", agent: forecaster, key: "forecaster" },
  { name: "competitiveAnalyst", agent: competitiveAnalyst, key: "competitiveAnalyst" },
  { name: "businessModelExpert", agent: businessModelExpert, key: "businessModelExpert" },
  { name: "patternDetector", agent: patternDetectionExpert, key: "patternDetector" },
  { name: "regulatoryAnalyst", agent: regulatoryAnalyst, key: "regulatoryAnalyst" },
  { name: "macroSectorAnalyst", agent: macroSectorAnalyst, key: "macroSectorAnalyst" },
  { name: "coreFinance", agent: coreFinanceAgent, key: "coreFinance" },
  { name: "coreNews", agent: coreNewsAgent, key: "coreNews" },
];

const StateAnnotation = Annotation.Root({
  state: Annotation<ConferenceState>({
    reducer: (prev, next) => {
      // Merge rawData shallowly to allow parallel updates
      if (prev.rawData && next.rawData) {
        return {
          ...prev,
          ...next,
          rawData: { ...prev.rawData, ...next.rawData },
        };
      }
      return { ...prev, ...next };
    },
    default: () => createInitialState("", ""),
  }),
});

const builder = new StateGraph(StateAnnotation);

// Add all agent nodes
agentDefs.forEach(({ name, agent: a, key }) => {
  builder.addNode(name, createAgentNode(a, key));
});

// Join node to mark gathering complete
builder.addNode("gather_join", async (input: AgentNodeInput) => {
  const { state } = input;
  return { state: { ...state, gatheringComplete: true } };
});

// Initial node to start parallelism
builder.addNode("gather_init", async () => ({}));
// @ts-ignore
builder.addEdge(START, "gather_init");

// Fan out: init routes to all agents in parallel
// @ts-ignore
builder.addConditionalEdges("gather_init", () => agentDefs.map((d) => d.name));

// Each agent goes to join
agentDefs.forEach(({ name }) => {
  // @ts-ignore
  builder.addEdge(name, "gather_join");
});

// @ts-ignore
builder.addEdge("gather_join", END);

export const gatherSubgraph = builder.compile();

