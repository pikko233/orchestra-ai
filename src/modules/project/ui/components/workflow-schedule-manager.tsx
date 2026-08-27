"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Clock3, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/client";

export function WorkflowScheduleManager({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const query = trpc.workflow.schedules.queryOptions({ projectId });
  const { data: schedules = [], isLoading, isError, refetch } = useQuery(query);
  const setEnabled = useMutation(
    trpc.workflow.setScheduleEnabled.mutationOptions(),
  );
  const deleteSchedule = useMutation(
    trpc.workflow.deleteSchedule.mutationOptions(),
  );
  const enabledCount = schedules.filter((schedule) => schedule.enabled).length;

  const refresh = () => queryClient.invalidateQueries(query);

  const handleToggle = (scheduleId: string, enabled: boolean) => {
    const request = setEnabled
      .mutateAsync({ projectId, scheduleId, enabled })
      .then(refresh);
    toast.promise(request, {
      loading: enabled ? "正在启用…" : "正在停用…",
      success: enabled ? "定时任务已启用" : "定时任务已停用",
      error: "更新定时任务失败",
    });
  };

  const handleDelete = (scheduleId: string) => {
    if (!window.confirm("确定删除这个定时任务吗？")) return;
    const request = deleteSchedule
      .mutateAsync({ projectId, scheduleId })
      .then(refresh);
    toast.promise(request, {
      loading: "正在删除…",
      success: "定时任务已删除",
      error: "删除定时任务失败",
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => {
          setOpen(true);
          void refetch();
        }}
        aria-label="管理定时任务"
        title="管理定时任务"
        className="relative mb-2"
      >
        <Clock3 />
        {enabledCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-blue-600 px-1 text-center text-[10px] leading-4 text-white">
            {enabledCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="gap-0 dark:border-slate-800 dark:bg-slate-950">
          <SheetHeader className="border-b border-slate-200 pr-12 dark:border-slate-800">
            <SheetTitle>定时任务</SheetTitle>
            <SheetDescription>管理当前工作流的自动执行计划</SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {isLoading && (
              <div className="flex h-32 items-center justify-center text-slate-500">
                <Loader2 className="animate-spin" />
              </div>
            )}
            {isError && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                定时任务加载失败
              </p>
            )}
            {!isLoading && !isError && schedules.length === 0 && (
              <div className="flex h-56 flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400">
                <CalendarClock className="mb-3 size-8" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  暂无定时任务
                </p>
                <p className="mt-1 max-w-56 text-xs leading-5">
                  可以在 AI Chat 中描述执行时间和任务内容来创建。
                </p>
              </div>
            )}
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <article
                  key={schedule.id}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium">{schedule.name}</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {schedule.cron} · {schedule.timezone}
                      </p>
                    </div>
                    <Switch
                      checked={schedule.enabled}
                      disabled={setEnabled.isPending}
                      onCheckedChange={(enabled) =>
                        handleToggle(schedule.id, enabled)
                      }
                      aria-label={`${schedule.enabled ? "停用" : "启用"}${schedule.name}`}
                    />
                  </div>

                  <dl className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <ScheduleDetail
                      label="下次执行"
                      value={formatDate(schedule.nextRunAt, schedule.timezone)}
                    />
                    <ScheduleDetail
                      label="最近执行"
                      value={formatDate(schedule.lastRunAt, schedule.timezone)}
                    />
                    <ScheduleDetail label="收件邮箱" value={schedule.recipientEmail} />
                  </dl>

                  {schedule.lastError && (
                    <p className="mt-3 break-words rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      {schedule.lastError}
                    </p>
                  )}

                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deleteSchedule.isPending}
                      onClick={() => handleDelete(schedule.id)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      <Trash2 />
                      删除
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ScheduleDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 break-all text-right">{value}</dd>
    </div>
  );
}

function formatDate(value: string | null, timeZone: string) {
  if (!value) return "尚未执行";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
