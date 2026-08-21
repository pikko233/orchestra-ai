"use client";

import { DataPagination } from "@/components/pagination/data-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Edit, Play, Trash2, Zap } from "lucide-react";
import { useProjectFilters } from "../../hooks/use-project-filters";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/fallback/empty-state";

export const ProjectList = () => {
  const [filters, setFilters] = useProjectFilters();
  const trpc = useTRPC();
  const router = useRouter();
  const { data } = useSuspenseQuery(
    trpc.project.findMany.queryOptions({
      ...filters,
    }),
  );

  if (data.items.length === 0) {
    const isSearching = filters.search.trim().length > 0;

    return (
      <EmptyState
        title={isSearching ? "未找到匹配的项目" : "还没有项目"}
        description={
          isSearching
            ? "请尝试更换搜索关键词。"
            : "点击右上角的“创建项目”开始搭建你的第一个项目。"
        }
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((project) => (
          <Card
            key={project.id}
            onClick={() => router.push(`/project/${project.id}`)}
            className="rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 hover:-translate-y-1 transition-all duration-300 cursor-pointer hover:shadow-2xl"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between items-center">
                <span className="truncate font-medium">{project.name}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                  未启用
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3 dark:text-blue-50 text-blue-600" />
                  description
                </span>
                <span>
                  {formatDistanceToNow(project.updatedAt, {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button size="sm" variant="outline">
                  <Play className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-auto flex justify-end">
        <DataPagination
          page={filters.page}
          totalPages={data.totalPages}
          onPageChange={(page) =>
            setFilters({
              ...filters,
              page,
            })
          }
        />
      </div>
    </div>
  );
};
