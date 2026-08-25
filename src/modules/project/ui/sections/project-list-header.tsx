"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectFilters } from "../../hooks/use-project-filters";
import { DEFAULT_PAGE } from "@/constants";
import { Plus } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

const ProjectSearchInput = () => {
  const [filters, setFilters] = useProjectFilters();

  return (
    <Input
      value={filters.search}
      onChange={(e) =>
        setFilters({
          ...filters,
          page: DEFAULT_PAGE,
          search: e.target.value,
        })
      }
      placeholder="搜索项目名称"
      className="w-56 rounded-lg border-gray-300 dark:border-gray-700"
    />
  );
};

export const ProjectListHeader = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const router = useRouter();

  const createProject = useMutation(trpc.project.create.mutationOptions());

  const handleCreateProject = () => {
    const promise = createProject
      .mutateAsync({ name: "Untitled Project" })
      .then((project) => {
        void queryClient.invalidateQueries(
          trpc.project.findMany.queryOptions(),
        );
        router.push(`/project/${project.id}`);
        return project;
      });

    toast.promise(
      promise,
      {
        loading: "项目创建中...",
        success: "项目创建成功",
        error: "项目创建失败",
      },
    );
  };

  return (
    <div className="flex flex-wrap justify-between items-center mb-6">
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
        我的项目
      </h1>
      <div className="flex gap-3">
        <ProjectSearchInput />
        <Button
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 dark:bg-blue-700 dark:hover:bg-blue-800 dark:text-white"
          onClick={handleCreateProject}
          disabled={createProject.isPending}
        >
          <Plus className="h-4 w-4" />
          创建项目
        </Button>
      </div>
    </div>
  );
};
