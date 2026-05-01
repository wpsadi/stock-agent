import { StructuredTool } from "@langchain/core/tools";
import { llm } from "@llm/index";

export async function runAgent(
  agent: { name: string; systemPrompt?: string; tools?: StructuredTool[]; invoke?: ( ...args: any[] ) => Promise<any> },
  userInput: string,
  options?: { threadId?: string }
): Promise<string> {
  const threadId = options?.threadId ?? `${agent.name}-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 8 )}`;

  if ( typeof agent.invoke === "function" ) {
    const result = await agent.invoke(
      {
        messages: [{ role: "user", content: userInput }],
      },
      {
        configurable: {
          thread_id: threadId,
        },
      }
    );

    if ( typeof result === "string" ) return result;
    if ( result?.content ) {
      const content = result.content as any;
      if ( typeof content === "string" ) return content;
      if ( Array.isArray( content ) ) return JSON.stringify( content );
      return String( content );
    }
    if ( Array.isArray( result?.messages ) && result.messages.length > 0 ) {
      const lastMessage = result.messages[result.messages.length - 1];
      const content = lastMessage?.content;
      if ( typeof content === "string" ) return content;
      if ( Array.isArray( content ) ) return JSON.stringify( content );
      return JSON.stringify( lastMessage ?? result );
    }
    return JSON.stringify( result );
  }

  const messages: any[] = [];

  // Get message constructors at runtime
  const { SystemMessage, HumanMessage, ToolMessage } = await import( "@langchain/core/messages" );

  messages.push( new SystemMessage( agent.systemPrompt ) );
  messages.push( new HumanMessage( userInput ) );

  const agentModel = agent.tools && agent.tools.length ? ( llm as any ).bindTools( agent.tools ) : llm;

  let iteration = 0;
  while ( iteration < 10 ) {
    iteration++;
    const aiMsg = await agentModel.invoke( messages );
    // @ts-ignore
    messages.push( aiMsg );

    // Check tool calls
    // @ts-ignore
    if ( !aiMsg.tool_calls || aiMsg.tool_calls.length === 0 ) {
      const content = aiMsg.content as any;
      if ( typeof content === "string" ) return content;
      if ( Array.isArray( content ) ) return JSON.stringify( content );
      return String( content );
    }

    // Execute tools
    // @ts-ignore
    for ( const tc of aiMsg.tool_calls ) {
      const tool = agent.tools?.find( ( t ) => t.name === tc.name );
      if ( !tool ) continue;
      try {
        const result = await tool.invoke( tc.args );
        messages.push( new ToolMessage( String( result ?? "" ), tc.id, tc.name ) );
      } catch ( e: any ) {
        messages.push( new ToolMessage( `Error: ${e.message}`, tc.id, tc.name ) );
      }
    }
  }

  throw new Error( `Agent ${agent.name} exceeded iterations` );
}
