import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { llm } from "@llm/index";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

const StateAnnotation = MessagesAnnotation;

export const chatNode = async (input: { messages: any[], state?: any }) => {
  const lastMessage = input.messages[input.messages.length - 1];
  const userMessage = lastMessage.content;

  // Use the LLM to interpret the user's request and potentially invoke the conference graph
  const contextPrompt = `
You are a helpful assistant for a Stock Conference Analysis system.
The user can ask you to:
1. Start a conference analysis for a company (e.g., "Analyze AAPL" or "Run conference for Tesla")
2. Ask about the current status of a conference
3. Get insights from a completed conference
4. Ask questions about how the conference works

If the user wants to start a conference for a specific company:
- Identify the company name or ticker
- Respond with: "Starting conference analysis for [Company] ([Ticker])..."

If the user asks about status, respond with current state information.
Otherwise, answer conversationally.

User message: ${userMessage}
  `;

  const result = await llm.invoke([
    new SystemMessage(contextPrompt),
    new HumanMessage(userMessage),
  ]);

  const response = typeof result.content === "string" ? result.content : JSON.stringify(result.content);

  return {
    messages: [
      new AIMessage({
        content: response,
        additional_kwargs: { agent: "chat" },
      }),
    ],
  };
};

export const chatGraph = () => {
  const builder = new StateGraph(StateAnnotation);

  builder.addNode("chat", chatNode);
  // @ts-ignore - edge typing issue with START
  builder.addEdge(START, "chat");

  return builder.compile();
};
