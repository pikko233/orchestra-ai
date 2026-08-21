import { OpenAIEmbeddings } from "@langchain/openai";
import type { IndexConfig } from "@langchain/langgraph-checkpoint-postgres/store";

export const memoryStoreIndex: IndexConfig = {
  embed: new OpenAIEmbeddings({
    model: "text-embedding-3-small",
  }),
  dims: 1536,
  fields: ["content"],
};
