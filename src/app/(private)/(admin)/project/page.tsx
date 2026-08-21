import { ProjectView } from "@/modules/project/ui/views/project-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";
import { SearchParams } from "nuqs/server";
import { loadSearchParams } from "@/modules/project/params";
import { LoadingState } from "@/components/fallback/loading-state";
import { ErrorState } from "@/components/fallback/error-state";

interface Props {
  searchParams: Promise<SearchParams>;
}

const Page = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.project.findMany.queryOptions({
      ...filters,
    }),
  );
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense
        fallback={
          <LoadingState
            title="正在加载项目"
            description="正在获取你的项目列表，请稍候。"
          />
        }
      >
        <ErrorBoundary
          fallback={
            <ErrorState
              title="项目加载失败"
              description="暂时无法获取项目列表，请稍后再试。"
            />
          }
        >
          <ProjectView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default Page;
