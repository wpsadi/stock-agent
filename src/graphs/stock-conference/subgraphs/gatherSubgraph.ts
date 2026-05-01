import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import type { ConferenceState } from "../types";
import { createInitialState } from "../types";
import { createConferenceThreadId } from "../types";
import { runAgent } from "../nodes/utils/runAgent";
import { CONFERENCE_PARTICIPANTS, type AgentLike } from "../panelRoster";

interface AgentNodeInput {
  state: ConferenceState;
}

const createAgentNode = (agent: AgentLike, key: string) => {
  return async (input: AgentNodeInput) => {
    const { state } = input;
    const { companyName, ticker } = state;
    const participantId = key;
    const threadId = state.agentThreadIds[participantId]
      ?? createConferenceThreadId(companyName, ticker, state.startedAt, participantId);

    const prompt = `Gather comprehensive information about ${companyName} (${ticker}). Include financial data, news sentiment, risk factors, competitive landscape, business model analysis, forecasting scenarios, pattern detection, regulatory environment, and macro/sector context.`;

    try {
      const output = await runAgent(agent, prompt, { threadId });
      let parsed: unknown;
      try {
        parsed = JSON.parse(output);
      } catch {
        parsed = output;
      }

      return {
        state: {
          ...state,
          rawData: { ...(state.rawData || {}), [key]: parsed },
          agentThreadIds: { ...state.agentThreadIds, [participantId]: threadId },
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Agent ${key} error:`, message);
      return {
        state: {
          ...state,
          rawData: { ...(state.rawData || {}), [key]: null },
          agentThreadIds: { ...state.agentThreadIds, [participantId]: threadId },
          errors: [...(state.errors || []), `Agent ${key}: ${message}`],
        },
      };
    }
  };
};

const agentDefs = CONFERENCE_PARTICIPANTS.map((participant) => ({
  name: participant.nodeName,
  agent: participant.agent,
  key: participant.key,
}));

const StateAnnotation = Annotation.Root({
  state: Annotation<ConferenceState>({
    reducer: (prev, next) => {
      // Merge rawData shallowly to allow parallel updates
      if (prev.rawData && next.rawData) {
        return {
          ...prev,
          ...next,
          rawData: { ...prev.rawData, ...next.rawData },
          agentThreadIds: { ...prev.agentThreadIds, ...next.agentThreadIds },
        };
      }
      if (prev.agentThreadIds && next.agentThreadIds) {
        return {
          ...prev,
          ...next,
          agentThreadIds: { ...prev.agentThreadIds, ...next.agentThreadIds },
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
