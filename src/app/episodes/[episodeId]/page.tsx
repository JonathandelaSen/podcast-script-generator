import { notFound } from "next/navigation";

import { EpisodeWorkspace } from "@/components/episode-workspace";
import { getEpisodeWorkspace } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const { episodeId } = await params;
  const workspace = await getEpisodeWorkspace(episodeId);

  if (!workspace) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <EpisodeWorkspace {...workspace} />
    </main>
  );
}
