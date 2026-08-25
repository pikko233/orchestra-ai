import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentTodos } from "./todos";

test("parses valid agent todos", () => {
  const todos = [
    { content: "检查代码", status: "completed" },
    { content: "修改文件", status: "in_progress" },
  ];

  assert.deepEqual(parseAgentTodos(todos), todos);
  assert.equal(parseAgentTodos([{ content: "无效", status: "failed" }]), undefined);
});
