import "dotenv/config";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { createInitialState } from "./types";
import { gatherSubgraph } from "./subgraphs/gatherSubgraph";
import { roundSubgraph } from "./subgraphs/roundSubgraph";
import { compileMemorandum } from "./nodes/compileMemorandum";
import { compileFinalReport } from "./nodes/compileFinalReport";
import type { ConferenceState } from "./types";

export const StateAnnotation = Annotation.Root( {
  state: Annotation<ConferenceState>( {
    reducer: ( prev, next ) => {
      // Custom merge for rawData to support parallel agent updates
      if ( prev.rawData && next.rawData ) {
        return {
          ...prev,
          ...next,
          rawData: { ...prev.rawData, ...next.rawData },
          agentThreadIds: { ...prev.agentThreadIds, ...next.agentThreadIds },
        };
      }
      if ( prev.agentThreadIds && next.agentThreadIds ) {
        return {
          ...prev,
          ...next,
          agentThreadIds: { ...prev.agentThreadIds, ...next.agentThreadIds },
        };
      }
      return { ...prev, ...next };
    },
    default: () => createInitialState( "", "" ),
  } ),
} );

export function buildConferenceGraph() {
  const builder = new StateGraph( StateAnnotation );

  builder
    .addNode( "gather", gatherSubgraph )
    .addNode( "memorandum", compileMemorandum )
    .addNode( "round", roundSubgraph )
    .addNode( "report", compileFinalReport )
    .addEdge( START, "gather" )
    .addEdge( "gather", "memorandum" )
    .addEdge( "memorandum", "round" )
    .addConditionalEdges( "round", ( state: { state: ConferenceState } ) => {
      if ( state.state.currentRound < state.state.totalRounds ) {
        return "round";
      }
      return "report";
    } )
    .addEdge( "report", END );

  return builder;
}

export const conferenceGraph = buildConferenceGraph().compile( {
  checkpointer: true,
} );
