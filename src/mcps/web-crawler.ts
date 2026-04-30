import "dotenv/config";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const webMCP = new MultiServerMCPClient({
  web: {
    transport: "sse",
    url: process.env.WEB_CRAWLER_URL!,
    headers:{
        Authorization: `Bearer ${process.env.WEB_CRAWLER_API_KEY}`
    }
  },
});

const webCrawl = await webMCP.getTools();

export { webCrawl };