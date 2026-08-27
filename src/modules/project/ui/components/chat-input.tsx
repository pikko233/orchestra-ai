import { cn } from "@/lib/utils";
import { ArrowUp, Loader2, Paperclip, Wand2, X } from "lucide-react";
import type { PendingChatImage } from "@/lib/ai/images/types";

interface Props {
  input: string;
  setInput: (value: string) => void;
  sendMessage: () => void;
  loading: boolean;
  pendingImages: PendingChatImage[];
  attachmentError?: string;
  addImages: (files: File[]) => void;
  removeImage: (id: string) => void;
}

export const ChatInput = ({
  input,
  setInput,
  sendMessage,
  loading,
  pendingImages,
  attachmentError,
  addImages,
  removeImage,
}: Props) => {
  const canSend = input.trim().length > 0 || pendingImages.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm focus-within:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-slate-600">
      {pendingImages.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {pendingImages.map((image) => (
            <div
              key={image.id}
              className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.previewUrl}
                alt={image.file.name}
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(image.id)}
                disabled={loading}
                aria-label={`移除 ${image.file.name}`}
                className="absolute top-1 right-1 rounded-full bg-black/65 p-0.5 text-white hover:bg-black/80 disabled:opacity-50"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {attachmentError && (
        <p role="alert" className="mb-2 text-xs text-red-500">
          {attachmentError}
        </p>
      )}
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
        <button
          type="button"
          className="rounded p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          <Wand2 size={16} />
        </button>

        <div className="flex items-center gap-1">
          <label
            className={cn(
              "rounded p-1.5 text-slate-400 dark:text-slate-500",
              loading
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:text-slate-600 dark:hover:text-slate-300",
            )}
          >
            <span className="sr-only">添加图片</span>
            <Paperclip size={16} />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={loading}
              className="sr-only"
              onChange={(event) => {
                addImages(Array.from(event.currentTarget.files ?? []));
                event.currentTarget.value = "";
              }}
            />
          </label>

          <button
            type="button"
            aria-label="发送"
            onClick={sendMessage}
            disabled={!canSend || loading}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2 py-2 text-sm",
              canSend
                ? "cursor-pointer bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                : "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600",
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
