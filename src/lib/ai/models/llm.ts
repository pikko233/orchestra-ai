import { ChatOpenAI } from "@langchain/openai";

export const llm = new ChatOpenAI({
  model: "gpt-5.6-luna",
  useResponsesApi: true,
  verbosity: "medium",
  reasoning: {
    effort: "low",
    summary: "auto",
  },
  timeout: 120_000,
  maxTokens: 10_000,
  maxRetries: 3,
});
