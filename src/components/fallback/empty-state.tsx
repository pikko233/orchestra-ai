import { cn } from "@/lib/utils";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export const EmptyState = ({
  title = "暂无内容",
  description = "这里还没有可以展示的内容。",
  className,
}: EmptyStateProps) => {
  return (
    <div
      className={cn(
        "flex min-h-64 flex-1 items-center justify-center px-6 py-12",
        className,
      )}
    >
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FolderOpen className="size-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
};
