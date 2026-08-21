import { cn } from "@/lib/utils";
import { ArrowUp, Loader2, Paperclip, Wand2 } from "lucide-react";

interface Props {
  input: string;
  setInput: (value: string) => void;
  sendMessage: () => void;
  loading: boolean;
}

export const ChatInput = ({ input, setInput, sendMessage, loading }: Props) => {
  return (
    <div className={cn("py-1")}>
      <div className="p-4 shrink-0">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm focus-within:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-slate-600">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="输入消息…（Shift + Enter 换行）"
            className="max-h-32 min-h-10 w-full resize-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
            rows={2}
          />

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
            <button className="rounded p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
              <Wand2 size={16} />
            </button>

            <div className="flex items-center gap-1">
              <button className="rounded p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                <Paperclip size={16} />
              </button>

              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className={cn(
                  "flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg",
                  input.trim()
                    ? "cursor-pointer bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                    : "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600",
                )}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    发送 <ArrowUp size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
