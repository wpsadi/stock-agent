import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogle } from "@langchain/google";

const llm = new ChatOpenAI({
    model: process.env.OPENAI_MODEL,
    configuration: {
    //    fetchOptions:{
    //     proxy:process.env.WEB_PROXY!
    //    }
    },
});
// const llm= new ChatGoogle("gemma-4-31b-it",{
//     reasoningEffort:"HIGH"
// });

export { llm };