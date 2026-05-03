import { notFound } from "next/navigation";

import { EpisodeWorkspace } from "@/components/episode-workspace";
import { getEpisodeWorkspace } from "@/lib/repository";

export const dynamic = "force-dynamic";

type EpisodeStageParam =
  | "sources"
  | "extraction"
  | "consolidation"
  | "outline"
  | "script"
  | "audit";

const validStages = new Set<EpisodeStageParam>([
  "sources",
  "extraction",
  "consolidation",
  "outline",
  "script",
  "audit",
]);

function parseStageParam(stage: string | string[] | undefined): EpisodeStageParam {
  const candidate = Array.isArray(stage) ? stage[0] : stage;
  return validStages.has(candidate as EpisodeStageParam)
    ? (candidate as EpisodeStageParam)
    : "sources";
}

export default async function EpisodePage({
  params,
  searchParams,
}: {
  params: Promise<{ episodeId: string }>;
  searchParams: Promise<{ stage?: string | string[] }>;
}) {
  const { episodeId } = await params;
  const { stage } = await searchParams;
  const initialStage = parseStageParam(stage);
  const workspace = await getEpisodeWorkspace(episodeId);

  if (!workspace) {
    notFound();
  }

  return (
    <main className="flex w-full max-w-none flex-1 flex-col gap-8 py-4 lg:py-6">
      <EpisodeWorkspace
        {...workspace}
        initialStage={initialStage}
      />
    </main>
  );
}
