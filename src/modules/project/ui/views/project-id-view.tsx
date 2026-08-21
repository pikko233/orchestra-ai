"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AIBuilder } from "../sections/ai-builder";

interface Props {
  projectId: string;
}

export const ProjectIdView = ({ projectId }: Props) => {
  const trpc = useTRPC();
  const { data: project } = useSuspenseQuery(
    trpc.project.findOne.queryOptions({ id: projectId }),
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-slate-950">
      <AIBuilder project={project} />
    </div>
  );
};
