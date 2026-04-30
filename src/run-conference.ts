import { runConference } from "./graphs/stock-conference/run";

async function main() {
  const company = process.argv[2] || "Apple Inc.";
  const ticker = process.argv[3] || "AAPL";

  await runConference(company, ticker);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});