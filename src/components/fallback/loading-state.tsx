import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export const LoadingState = ({
  title = "正在加载",
  description = "请稍候，内容马上就好。",
  className,
}: LoadingStateProps) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-64 flex-1 items-center justify-center px-6 py-12",
        className,
      )}
    >
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
          <Spinner className="size-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
};
