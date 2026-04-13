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
    <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-8 py-4 lg:py-6">
      <EpisodeWorkspace {...workspace} />
    </main>
  );
}
