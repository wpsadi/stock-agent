import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const newsMCP = new MultiServerMCPClient( {
    news: {
        transport: "stdio",
        "command": "npx",
        "args": ["-y", "@newsmcp/server"]
    },
} );

const news = await newsMCP.getTools();

export { news };