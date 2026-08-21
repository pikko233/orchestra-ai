// src/lib/ai/store.ts
import "server-only";
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";
import { memoryStoreIndex } from "./store-index";

export const memoryStore = PostgresStore.fromConnString(
  process.env.DATABASE_URL!,
  {
    index: memoryStoreIndex,
    ensureTables: false,
  },
);
