export type AgentTodo = {
  content: string;
  status: "pending" | "in_progress" | "completed";
};

export function parseAgentTodos(value: unknown): AgentTodo[] | undefined {
  if (!Array.isArray(value)) return;
  if (
    !value.every(
      (todo) =>
        todo &&
        typeof todo === "object" &&
        typeof todo.content === "string" &&
        ["pending", "in_progress", "completed"].includes(todo.status),
    )
  ) {
    return;
  }

  return value as AgentTodo[];
}
