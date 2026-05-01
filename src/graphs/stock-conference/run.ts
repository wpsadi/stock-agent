import { conferenceGraph } from "./graph";
import type { ConferenceState } from "./types";
import { createInitialState } from "./types";
import { ROUND_TABLE_PARTICIPANTS } from "./panelRoster";
import { initializeAgentContext, logExecutionStatus } from "@utils/agent-execution-context";

export async function runConference(companyName: string, ticker: string): Promise<ConferenceState> {
  // Initialize datetime context at the start of the conference
  // All agents and subagents will use this baseline
  const executionContext = initializeAgentContext();
  logExecutionStatus("CONFERENCE_START", { company: companyName, ticker });

  const initialState = createInitialState(companyName, ticker);
  const discussionRounds = initialState.totalRounds - initialState.totalEvaluationRounds;

  console.log(`\n=== STOCK CONFERENCE: ${companyName} (${ticker}) ===`);
  console.log(`Execution DateTime: ${executionContext.datetimeContext.formattedTime} (${executionContext.datetimeContext.utcOffset})`);
  console.log(`Rounds: ${discussionRounds} discussion + ${initialState.totalEvaluationRounds} evaluation (${initialState.totalRounds} total)`);
  console.log(`Round-table panelists: ${ROUND_TABLE_PARTICIPANTS.length} + Moderator\n`);

  const result = await conferenceGraph.invoke({ state: initialState });
  const finalState = (result as { state: ConferenceState }).state;

  logExecutionStatus("CONFERENCE_COMPLETE");
  console.log(`\n=== COMPLETE ===`);
  console.log(`Rounds completed: ${finalState.currentRound - 1}`);
  console.log(`Messages: ${finalState.roundHistory.length}`);
  console.log(`Report: output/${companyName.replace(/\s+/g, "_")}.md\n`);

  return finalState;
}
