import { ProjectIdView } from "@/modules/project/ui/views/project-id-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { LoadingState } from "@/components/fallback/loading-state";
import { ErrorState } from "@/components/fallback/error-state";

interface Props {
  params: Promise<{
    projectId: string;
  }>;
}

const Page = async ({ params }: Props) => {
  const { projectId } = await params;

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.project.findOne.queryOptions({ id: projectId }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense
        fallback={
          <LoadingState
            title="正在加载项目"
            description="正在准备项目工作区，请稍候。"
          />
        }
      >
        <ErrorBoundary
          fallback={
            <ErrorState
              title="项目加载失败"
              description="暂时无法打开该项目，请稍后再试。"
            />
          }
        >
          <ProjectIdView projectId={projectId} />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default Page;
