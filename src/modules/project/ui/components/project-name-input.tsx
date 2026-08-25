"use client";

import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface Props {
  projectId: string;
  projectName: string;
}

export const ProjectNameInput = ({ projectId, projectName }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [initialName, setInitialName] = useState(projectName);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateProject = useMutation(trpc.project.update.mutationOptions());

  const handleBlur = () => {
    setIsEditing(false);
    if (!initialName.trim() || initialName.trim() === projectName) {
      setInitialName(projectName);
      return;
    }

    const promise = updateProject
      .mutateAsync({
        id: projectId,
        name: initialName,
      })
      .then((project) => {
        void queryClient.invalidateQueries(
          trpc.project.findOne.queryOptions({ id: projectId }),
        );
        void queryClient.invalidateQueries(
          trpc.project.findMany.queryOptions(),
        );
        return project;
      });

    toast.promise(promise, {
      loading: "修改中请稍后...",
      success: "项目名称修改成功～",
      error: "项目名称修改失败",
    });
  };

  return (
    <>
      {isEditing ? (
        <Input
          autoFocus
          placeholder="请输入项目名称"
          value={initialName}
          onChange={(e) => setInitialName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleBlur();
            }

            if (e.key === "Escape") {
              setInitialName(projectName);
              setIsEditing(false);
            }
          }}
          className="text-sm font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      ) : (
        <div
          className="cursor-pointer truncate rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-400"
          onClick={() => setIsEditing(true)}
        >
          {projectName}
        </div>
      )}
    </>
  );
};
