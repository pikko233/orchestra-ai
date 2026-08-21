import { Suspense } from "react";
import { TopNav } from "@/components/nav/top-nav";
import { ProjectListHeader } from "../sections/project-list-header";
import { ProjectList } from "../sections/project-list";
import { LoadingState } from "@/components/fallback/loading-state";

export const ProjectView = () => {
  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-gray-900">
      <TopNav />

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-15">
        {/* 工具栏 */}
        <ProjectListHeader />

        {/* 工作流卡片和分页 */}
        <Suspense
          fallback={
            <LoadingState
              title="正在加载项目"
              description="正在获取你的项目列表，请稍候。"
            />
          }
        >
          <ProjectList />
        </Suspense>
      </main>
    </div>
  );
};
