import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const yahooFinanceMCP = new MultiServerMCPClient( {
    finance: {
        transport: "stdio",
          "command": "uvx",
      "args": ["yfmcp"]
    },
} );

const yahooFinance = await yahooFinanceMCP.getTools();

export { yahooFinance };