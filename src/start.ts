import { llm } from "@llm/index";



llm.invoke("what my age").then((response) => {
  console.log(response);
}).catch((error) => {
  console.error("Error invoking LLM:", error);
});