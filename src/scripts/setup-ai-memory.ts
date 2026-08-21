// scripts/setup-ai-memory.ts
import "dotenv/config";
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";
import { memoryStoreIndex } from "@/lib/ai/memory/store-index";

const store = PostgresStore.fromConnString(process.env.DATABASE_URL!, {
  index: memoryStoreIndex,
});

try {
  await store.setup();
  console.log("长期记忆数据库初始化完成");
} finally {
  await store.stop();
}
