import { conferenceGraph } from "./graph";
import type { ConferenceState } from "./types";
import { createInitialState } from "./types";

export async function runConference(companyName: string, ticker: string): Promise<ConferenceState> {
  const initialState = createInitialState(companyName, ticker);

  console.log(`\n=== STOCK CONFERENCE: ${companyName} (${ticker}) ===`);
  console.log(`Rounds: 4 discussion + 2 evaluation (5 total)`);
  console.log(`Panelists: 12 (Promoter, Demoter, Moderator + 9 Bench)\n`);

  const result = await conferenceGraph.invoke({ state: initialState });
  const finalState = (result as { state: ConferenceState }).state;

  console.log(`\n=== COMPLETE ===`);
  console.log(`Rounds completed: ${finalState.currentRound - 1}`);
  console.log(`Messages: ${finalState.roundHistory.length}`);
  console.log(`Report: output/${companyName.replace(/\s+/g, "_")}.md\n`);

  return finalState;
}