import { StructuredTool } from "@langchain/core/tools";
import { llm } from "@llm/index";

export async function runAgent(
  agent: { name: string; systemPrompt: string; tools?: StructuredTool[] },
  userInput: string
): Promise<string> {
  const messages: any[] = [];

  // Get message constructors at runtime
  const { SystemMessage, HumanMessage, ToolMessage } = await import("@langchain/core/messages");

  messages.push(new SystemMessage(agent.systemPrompt));
  messages.push(new HumanMessage(userInput));

  const agentModel = agent.tools && agent.tools.length ? (llm as any).bindTools(agent.tools) : llm;

  let iteration = 0;
  while (iteration < 10) {
    iteration++;
    const aiMsg = await agentModel.invoke(messages);
    // @ts-ignore
    messages.push(aiMsg);

    // Check tool calls
    // @ts-ignore
    if (!aiMsg.tool_calls || aiMsg.tool_calls.length === 0) {
      const content = aiMsg.content as any;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) return JSON.stringify(content);
      return String(content);
    }

    // Execute tools
    // @ts-ignore
    for (const tc of aiMsg.tool_calls) {
      const tool = agent.tools?.find((t) => t.name === tc.name);
      if (!tool) continue;
      try {
        const result = await tool.invoke(tc.args);
        messages.push(new ToolMessage(String(result ?? ""), tc.id, tc.name));
      } catch (e: any) {
        messages.push(new ToolMessage(`Error: ${e.message}`, tc.id, tc.name));
      }
    }
  }

  throw new Error(`Agent ${agent.name} exceeded iterations`);
}
