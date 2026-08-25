import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDashed,
  Loader2,
} from "lucide-react";
import type { AgentTodo } from "@/lib/ai/todos";
import { cn } from "@/lib/utils";

export function AgentTodoList({
  todos,
  active,
}: {
  todos: AgentTodo[];
  active: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const completed = todos.filter((todo) => todo.status === "completed").length;
  const progress = Math.round((completed / todos.length) * 100);

  return (
    <div className="overflow-hidden rounded-t-lg border border-slate-200 bg-slate-50/98 text-xs dark:border-slate-700 dark:bg-slate-900/98">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="font-medium">
          {completed === todos.length ? "任务完成" : "任务进度"}
        </span>
        <span className="ml-auto text-slate-400">
          {completed}/{todos.length}
        </span>
      </button>
      {progress !== 100 && (
        <div className="h-1 bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full bg-blue-500 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {isOpen && (
        <ul className="space-y-2 px-3 py-2.5">
          {todos.map((todo, index) => (
            <li
              key={`${index}-${todo.content}`}
              className="flex items-start gap-2 text-slate-600 dark:text-slate-300"
            >
              {todo.status === "completed" ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
              ) : todo.status === "in_progress" && active ? (
                <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-blue-500" />
              ) : todo.status === "in_progress" ? (
                <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              ) : (
                <Circle className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
              )}
              <span
                className={cn(
                  "leading-relaxed",
                  todo.status === "completed" && "text-slate-400 line-through",
                )}
              >
                {todo.content}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
