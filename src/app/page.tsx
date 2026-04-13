import Link from "next/link";
import { ArrowRightIcon, DatabaseIcon, ListTodoIcon } from "lucide-react";

import { NewEpisodeForm } from "@/components/new-episode-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listEpisodes } from "@/lib/repository";
import { formatDateTime, summarizeEpisodeStatus } from "@/lib/podcast";

export const dynamic = "force-dynamic";

export default async function Home() {
  const episodes = await listEpisodes();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden border-white/60 bg-white/80 shadow-sm backdrop-blur-sm">
          <CardHeader className="gap-3 border-b border-border/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(238,244,255,0.95))] pb-6">
            <Badge variant="secondary" className="w-fit">
              Pipeline editorial local-first
            </Badge>
            <CardTitle className="max-w-2xl text-3xl leading-tight sm:text-4xl">
              Convierte textos pegados en un guión de podcast trazable y editable.
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              Cada fase usa Gemini desde servidor, guarda original y edición, y te deja aprobar o revertir antes de seguir.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 py-6 md:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-background/75 p-4">
              <DatabaseIcon className="mb-3" />
              <p className="font-medium text-foreground">SQLite + Drizzle</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Persistencia local con historial de artifacts y configuración de modelos por fase.
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/75 p-4">
              <Sparkline />
              <p className="mt-3 font-medium text-foreground">Paso a paso</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Fuentes, extracción, consolidación, outline, guión y auditoría.
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/75 p-4">
              <ListTodoIcon className="mb-3" />
              <p className="font-medium text-foreground">Control editorial</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Edita cada fase, guarda cambios y fuerza que la siguiente solo lea versiones aprobadas.
              </p>
            </div>
          </CardContent>
        </Card>

        <NewEpisodeForm />
      </section>

      <section>
        <Card className="border-white/60 bg-white/80 shadow-sm backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Episodios recientes</CardTitle>
            <CardDescription>
              Reabre cualquier workspace y retoma el proceso donde lo dejaste.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {episodes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background/70 p-8 text-sm text-muted-foreground">
                Aún no hay episodios. Crea el primero con el formulario de arriba.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {episodes.map((episode) => (
                  <Link key={episode.id} href={`/episodes/${episode.id}`}>
                    <Card size="sm" className="h-full border-border/70 bg-background/75 transition-transform hover:-translate-y-0.5">
                      <CardHeader>
                        <CardTitle>{episode.topic}</CardTitle>
                        <CardDescription>
                          {episode.episodeType === "summary" ? "Resumen" : "Deep dive"} ·{" "}
                          {episode.targetMinutes} min
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">
                            {summarizeEpisodeStatus(episode.status)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {episode.sourceCount} fuentes
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Actualizado {formatDateTime(episode.updatedAt)}
                        </p>
                        <div className="flex items-center text-sm font-medium text-foreground">
                          Abrir workspace
                          <ArrowRightIcon className="ml-2 size-4" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Sparkline() {
  return (
    <div className="flex h-6 items-end gap-1">
      <span className="h-2 w-2 rounded-full bg-primary/40" />
      <span className="h-3 w-2 rounded-full bg-primary/55" />
      <span className="h-5 w-2 rounded-full bg-primary/70" />
      <span className="h-4 w-2 rounded-full bg-primary/60" />
      <span className="h-6 w-2 rounded-full bg-primary" />
    </div>
  );
}
