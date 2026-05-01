import { conferenceGraph } from "./graph";
import type { ConferenceState } from "./types";
import { createInitialState } from "./types";
import { ROUND_TABLE_PARTICIPANTS } from "./panelRoster";

export async function runConference(companyName: string, ticker: string): Promise<ConferenceState> {
  const initialState = createInitialState(companyName, ticker);
  const discussionRounds = initialState.totalRounds - initialState.totalEvaluationRounds;

  console.log(`\n=== STOCK CONFERENCE: ${companyName} (${ticker}) ===`);
  console.log(`Rounds: ${discussionRounds} discussion + ${initialState.totalEvaluationRounds} evaluation (${initialState.totalRounds} total)`);
  console.log(`Round-table panelists: ${ROUND_TABLE_PARTICIPANTS.length} + Moderator\n`);

  const result = await conferenceGraph.invoke({ state: initialState });
  const finalState = (result as { state: ConferenceState }).state;

  console.log(`\n=== COMPLETE ===`);
  console.log(`Rounds completed: ${finalState.currentRound - 1}`);
  console.log(`Messages: ${finalState.roundHistory.length}`);
  console.log(`Report: output/${companyName.replace(/\s+/g, "_")}.md\n`);

  return finalState;
}
