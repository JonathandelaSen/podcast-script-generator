import Link from "next/link";
import type { ReactElement } from "react";
import {
  ArrowRightIcon,
  Edit3Icon,
  FileTextIcon,
  PlusIcon,
  SearchIcon,
  WandSparklesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { listEpisodes } from "@/lib/repository";
import { formatDateTime } from "@/lib/podcast";

export const dynamic = "force-dynamic";

export default async function Home() {
  const episodes = await listEpisodes();

  const totalEpisodes = episodes.length;
  const inProgressEpisodes = episodes.filter((episode) => episode.status === "in_progress").length;
  const readyEpisodes = episodes.filter((episode) => episode.status === "ready").length;
  const draftEpisodes = episodes.filter((episode) => episode.status === "draft").length;

  return (
    <main className="relative">
      <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Active Episodes</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            Manage your ongoing narrative structures and script pipelines from a centralized architectural view.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search projects..."
              className="w-64 rounded-xl border-0 bg-[rgba(239,244,255,0.96)] py-2.5 pl-10 pr-4 text-sm text-foreground outline-none ring-0 placeholder:text-[#777587] focus:ring-2 focus:ring-primary/20"
            />
            <SearchIcon className="absolute left-3 top-2.5 size-[1.05rem] text-[#777587]" />
          </div>

          <Link href="/new-project">
            <Button size="lg">
              <PlusIcon data-icon="inline-start" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      <section className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-4">
        <DashboardStat label="Total Episodes" value={String(totalEpisodes)} accent />
        <DashboardStat label="In Progress" value={String(inProgressEpisodes)} badge="Active" />
        <DashboardStat label="Ready for Audit" value={String(readyEpisodes).padStart(2, "0")} />
        <DashboardStat label="Drafts" value={String(draftEpisodes).padStart(2, "0")} />
      </section>

      <section className="overflow-hidden rounded-xl bg-[rgba(239,244,255,0.96)] p-1">
        <table className="w-full border-separate border-spacing-y-1 text-left">
          <thead>
            <tr className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <th className="px-6 py-4">Project / Episode</th>
              <th className="px-6 py-4">Topic</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Last Updated</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {episodes.length === 0 ? (
              <tr>
                <td colSpan={5} className="rounded-xl bg-white px-6 py-12">
                  <div className="flex flex-col items-start gap-4">
                    <p className="text-lg font-semibold tracking-tight text-foreground">
                      No episodes yet.
                    </p>
                    <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                      Start your first project to populate the ledger. The new episode flow lives behind a focused panel instead of competing with the dashboard.
                    </p>
                    <Link href="/new-project">
                      <Button>
                        <WandSparklesIcon data-icon="inline-start" />
                        Launch Wizard
                      </Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              episodes.map((episode) => (
                <tr key={episode.id} className="group cursor-pointer rounded-xl bg-white transition-colors hover:bg-white">
                  <td className="rounded-l-xl px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className={`flex size-10 items-center justify-center rounded-lg ${iconTone(episode.status)}`}>
                        {iconForStatus(episode.status)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{episode.topic}</p>
                        <p className="mt-1 text-[0.75rem] text-muted-foreground">
                          {episode.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-[0.875rem] font-medium text-foreground">
                      {episode.angleHint || (episode.episodeType === "summary" ? "Summary episode" : "Deep dive episode")}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <StatusPill status={episode.status} />
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-[0.875rem] text-muted-foreground">{formatDateTime(episode.updatedAt)}</p>
                  </td>
                  <td className="rounded-r-xl px-6 py-5 text-right">
                    <Link
                      href={`/episodes/${episode.id}`}
                      className="inline-flex items-center text-[#777587] transition-colors hover:text-primary"
                    >
                      <ArrowRightIcon className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section id="new-episode" className="mt-16 rounded-2xl border border-dashed border-[rgba(199,196,216,0.3)] bg-[rgba(213,227,252,0.24)] p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-xl font-bold text-foreground">Architect a New Narrative</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Ready to begin the next exploration? Open the episode wizard to capture topic, angle, timing and source deck without cluttering the dashboard itself.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link href="/new-project">
                <Button variant="outline" size="lg">
                  <WandSparklesIcon data-icon="inline-start" />
                  Launch Wizard
                </Button>
              </Link>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Dashboard focused, wizard on demand
                <ArrowRightIcon className="size-4" />
              </span>
            </div>
          </div>

          <div className="relative h-48 w-full overflow-hidden rounded-xl bg-[rgba(239,244,255,0.92)] lg:w-64">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(53,37,205,0.2),transparent_28%),linear-gradient(140deg,rgba(255,255,255,0.95),rgba(213,227,252,0.8))]" />
            <div className="absolute inset-x-6 top-8 space-y-4">
              <div className="h-px bg-[rgba(119,117,135,0.18)]" />
              <div className="grid gap-3">
                <div className="rounded-lg bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sources</p>
                </div>
                <div className="rounded-lg bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Outline</p>
                </div>
                <div className="rounded-lg bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Script</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Link href="/new-project">
        <button className="primary-gradient fixed bottom-8 right-8 z-50 flex size-14 items-center justify-center rounded-full text-white shadow-2xl transition-transform duration-200 hover:scale-110 active:scale-95">
          <PlusIcon className="size-5" />
        </button>
      </Link>
    </main>
  );
}

function DashboardStat({
  label,
  value,
  accent = false,
  badge,
}: {
  label: string;
  value: string;
  accent?: boolean;
  badge?: string;
}) {
  return (
    <div className="rounded-xl border border-[rgba(199,196,216,0.1)] bg-white p-6 shadow-sm">
      <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="flex items-center gap-3">
        <p className={`text-4xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
        {badge ? (
          <span className="rounded-full bg-[rgba(182,180,255,0.24)] px-2 py-0.5 text-[0.7rem] font-bold text-[#454386]">
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "ready") {
    return <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-tight text-green-700">Ready</span>;
  }

  if (status === "in_progress") {
    return <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-tight text-indigo-700">In Progress</span>;
  }

  if (status === "blocked") {
    return <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-tight text-red-700">Blocked</span>;
  }

  return <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-tight text-slate-500">Draft</span>;
}

function iconTone(status: string) {
  if (status === "ready") {
    return "bg-[rgba(226,223,255,0.8)] text-primary";
  }

  if (status === "in_progress") {
    return "bg-[rgba(226,223,255,0.8)] text-[#58579b]";
  }

  return "bg-[rgba(213,227,252,0.72)] text-[#777587]";
}

function iconForStatus(status: string) {
  if (status === "ready") {
    return <FileTextIcon className="size-4" />;
  }

  if (status === "in_progress") {
    return <Edit3Icon className="size-4" />;
  }

  return <FileTextIcon className="size-4" />;
}
