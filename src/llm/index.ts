import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogle } from "@langchain/google";

const llm = new ChatOpenAI( {
    model: process.env.OPENAI_MODEL || "kilo-auto/free",
     apiKey: process.env.OPENAI_API_KEY || "proxy-placeholder",
    temperature: 0.7,
    maxTokens: 8096,
    reasoning:{
        effort:"high"
    },
    timeout: 120000,
    
} );
// const llm= new ChatGoogle("gemma-4-31b-it",{
//     reasoningEffort:"HIGH"
// });

export { llm };