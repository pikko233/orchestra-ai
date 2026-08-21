import { cn } from "@/lib/utils";
import { CircleAlert } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export const ErrorState = ({
  title = "内容加载失败",
  description = "暂时无法获取内容，请稍后再试。",
  className,
}: ErrorStateProps) => {
  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-64 flex-1 items-center justify-center px-6 py-12",
        className,
      )}
    >
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <CircleAlert className="size-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
};
