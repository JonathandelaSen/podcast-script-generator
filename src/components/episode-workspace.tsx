"use client";

import { useMemo, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import {
  CheckCheckIcon,
  FileClockIcon,
  HistoryIcon,
  LoaderCircleIcon,
  PlusIcon,
  RefreshCcwIcon,
  SaveIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";

import {
  addSourceAction,
  approveArtifactAction,
  deleteSourceAction,
  generateAuditAction,
  generateConsolidationAction,
  generateExtractionAction,
  generateOutlineAction,
  generateScriptAction,
  revertArtifactAction,
  saveArtifactAction,
  saveSourceAction,
  updateEpisodeModelAction,
} from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type ArtifactRow,
  type ArtifactStageKey,
  type EpisodeRow,
  type ScriptDraft,
  type SourceRow,
  ALLOWED_MODELS,
  STAGE_LABELS,
  formatDateTime,
  parseArtifactContent,
  summarizeArtifactStatus,
  summarizeEpisodeStatus,
} from "@/lib/podcast";

type WorkspaceProps = {
  episode: EpisodeRow;
  sources: SourceRow[];
  artifacts: ArtifactRow[];
};

type ActionResult = {
  ok: boolean;
  message: string;
};

const PHASES: Array<{
  key: "sources" | ArtifactStageKey;
  description: string;
}> = [
  {
    key: "sources",
    description: "Prepara el topic, la duración y las fuentes base del episodio.",
  },
  {
    key: "extraction",
    description: "Una extracción estructurada por cada fuente.",
  },
  {
    key: "consolidation",
    description: "Una síntesis global con enfoque, tesis y mapa de cobertura.",
  },
  {
    key: "outline",
    description: "Un outline editorial antes de redactar el monólogo.",
  },
  {
    key: "script",
    description: "El guión completo, editable y listo para TTS después.",
  },
  {
    key: "audit",
    description: "Chequeo final de cobertura y soporte factual.",
  },
];

function getArtifactsForStage(artifacts: ArtifactRow[], stage: ArtifactStageKey, sourceId?: string) {
  return artifacts.filter(
    (artifact) =>
      artifact.stage === stage &&
      (sourceId ? artifact.sourceId === sourceId : artifact.sourceId === null),
  );
}

function getLatestArtifact(artifacts: ArtifactRow[]) {
  return artifacts[0] ?? null;
}

function getLatestApprovedArtifact(artifacts: ArtifactRow[]) {
  return artifacts.find((artifact) => artifact.status === "approved") ?? null;
}

function SourceEditor({
  episodeId,
  source,
  canDelete,
  onRunAction,
}: {
  episodeId: string;
  source: SourceRow;
  canDelete: boolean;
  onRunAction: (runner: () => Promise<ActionResult>) => void;
}) {
  return (
    <Card size="sm" className="border-border/70 bg-background/70">
      <CardHeader>
        <CardTitle>{source.label || `Fuente ${source.orderIndex + 1}`}</CardTitle>
        <CardDescription>
          La extracción se volverá a generar a partir de este texto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          action={(formData) =>
            onRunAction(() => saveSourceAction(formData))
          }
        >
          <input type="hidden" name="episodeId" value={episodeId} />
          <input type="hidden" name="sourceId" value={source.id} />
          <Input name="label" defaultValue={source.label ?? ""} placeholder="Nombre interno de la fuente" />
          <Textarea
            name="rawText"
            defaultValue={source.rawText}
            placeholder="Texto de la fuente"
            className="min-h-48"
          />
          <div className="flex justify-between">
            <Button type="submit" variant="outline">
              <SaveIcon data-icon="inline-start" />
              Guardar fuente
            </Button>

            <Button
              type="button"
              variant="ghost"
              disabled={!canDelete}
              onClick={() =>
                onRunAction(async () => {
                  const formData = new FormData();
                  formData.set("episodeId", episodeId);
                  formData.set("sourceId", source.id);
                  return deleteSourceAction(formData);
                })
              }
            >
              <Trash2Icon data-icon="inline-start" />
              Eliminar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ModelSelector({
  episodeId,
  stage,
  value,
  onRunAction,
}: {
  episodeId: string;
  stage: ArtifactStageKey;
  value: string;
  onRunAction: (runner: () => Promise<ActionResult>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">Modelo</span>
      <Select
        value={value}
        onValueChange={(nextValue) =>
          onRunAction(async () => {
            if (!nextValue) {
              return { ok: false, message: "Selecciona un modelo válido." };
            }
            const formData = new FormData();
            formData.set("episodeId", episodeId);
            formData.set("stage", stage);
            formData.set("model", nextValue);
            return updateEpisodeModelAction(formData);
          })
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {ALLOWED_MODELS.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function HistoryDialog({
  episodeId,
  stage,
  artifacts,
  onRunAction,
}: {
  episodeId: string;
  stage: ArtifactStageKey;
  artifacts: ArtifactRow[];
  onRunAction: (runner: () => Promise<ActionResult>) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <HistoryIcon data-icon="inline-start" />
        Historial
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{STAGE_LABELS[stage]}</DialogTitle>
          <DialogDescription>
            Cada fila representa una generación o un revert. Editar no borra el contenido original.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[32rem]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {artifacts.map((artifact) => (
                <TableRow key={artifact.id}>
                  <TableCell>{formatDateTime(artifact.createdAt)}</TableCell>
                  <TableCell>{summarizeArtifactStatus(artifact.status)}</TableCell>
                  <TableCell>{artifact.modelName ?? "Manual"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        onRunAction(async () => {
                          const formData = new FormData();
                          formData.set("episodeId", episodeId);
                          formData.set("artifactId", artifact.id);
                          return revertArtifactAction(formData);
                        })
                      }
                    >
                      <RefreshCcwIcon data-icon="inline-start" />
                      Revertir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function JsonArtifactEditor({
  episodeId,
  artifact,
  onRunAction,
}: {
  episodeId: string;
  artifact: ArtifactRow;
  onRunAction: (runner: () => Promise<ActionResult>) => void;
}) {
  return (
    <form
      className="flex flex-col gap-3"
      action={(formData) => onRunAction(() => saveArtifactAction(formData))}
    >
      <input type="hidden" name="episodeId" value={episodeId} />
      <input type="hidden" name="artifactId" value={artifact.id} />
      <Textarea
        name="content"
        defaultValue={artifact.currentContent}
        className="min-h-80 font-mono text-xs"
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="outline">
          <SaveIcon data-icon="inline-start" />
          Guardar edición
        </Button>
        <Button
          type="button"
          onClick={() =>
            onRunAction(async () => {
              const formData = new FormData();
              formData.set("episodeId", episodeId);
              formData.set("artifactId", artifact.id);
              return approveArtifactAction(formData);
            })
          }
        >
          <CheckCheckIcon data-icon="inline-start" />
          Aprobar
        </Button>
      </div>
    </form>
  );
}

function ScriptArtifactEditor({
  episodeId,
  artifact,
  onRunAction,
}: {
  episodeId: string;
  artifact: ArtifactRow;
  onRunAction: (runner: () => Promise<ActionResult>) => void;
}) {
  const script = parseArtifactContent("script", artifact.currentContent) as ScriptDraft;

  return (
    <form
      className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"
      action={(formData) => onRunAction(() => saveArtifactAction(formData))}
    >
      <input type="hidden" name="episodeId" value={episodeId} />
      <input type="hidden" name="artifactId" value={artifact.id} />
      <div className="flex flex-col gap-3">
        <Input name="title" defaultValue={script.title} />
        <Textarea
          name="scriptMarkdown"
          defaultValue={script.scriptMarkdown}
          className="min-h-[30rem]"
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="outline">
            <SaveIcon data-icon="inline-start" />
            Guardar edición
          </Button>
          <Button
            type="button"
            onClick={() =>
              onRunAction(async () => {
                const formData = new FormData();
                formData.set("episodeId", episodeId);
                formData.set("artifactId", artifact.id);
                return approveArtifactAction(formData);
              })
            }
          >
            <CheckCheckIcon data-icon="inline-start" />
            Aprobar
          </Button>
        </div>
      </div>

      <Card size="sm" className="border-border/70">
        <CardHeader>
          <CardTitle>Preview Markdown</CardTitle>
          <CardDescription>Vista rápida para revisar la locución.</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-neutral max-w-none text-sm">
          <ReactMarkdown>{script.scriptMarkdown}</ReactMarkdown>
        </CardContent>
      </Card>
    </form>
  );
}

function StageStatusBadge({
  approved,
  current,
}: {
  approved: boolean;
  current: ArtifactRow | null;
}) {
  if (!current) {
    return <Badge variant="secondary">Vacío</Badge>;
  }

  if (approved) {
    return <Badge>Aprobado</Badge>;
  }

  return <Badge variant="secondary">{summarizeArtifactStatus(current.status)}</Badge>;
}

export function EpisodeWorkspace({ episode, sources, artifacts }: WorkspaceProps) {
  const router = useRouter();
  const [activeStage, setActiveStage] = useState<(typeof PHASES)[number]["key"]>("sources");
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const extractionBySource = useMemo(
    () =>
      new Map(
        sources.map((source) => [
          source.id,
          getArtifactsForStage(artifacts, "extraction", source.id),
        ]),
      ),
    [artifacts, sources],
  );

  const latestConsolidation = getLatestArtifact(getArtifactsForStage(artifacts, "consolidation"));
  const latestOutline = getLatestArtifact(getArtifactsForStage(artifacts, "outline"));
  const latestScript = getLatestArtifact(getArtifactsForStage(artifacts, "script"));
  const latestAudit = getLatestArtifact(getArtifactsForStage(artifacts, "audit"));

  const approvedExtractions = sources.every((source) => {
    const stageArtifacts = extractionBySource.get(source.id) ?? [];
    return Boolean(getLatestApprovedArtifact(stageArtifacts));
  });
  const approvedConsolidation = Boolean(
    getLatestApprovedArtifact(getArtifactsForStage(artifacts, "consolidation")),
  );
  const approvedOutline = Boolean(
    getLatestApprovedArtifact(getArtifactsForStage(artifacts, "outline")),
  );
  const approvedScript = Boolean(
    getLatestApprovedArtifact(getArtifactsForStage(artifacts, "script")),
  );

  const runAction = (runner: () => Promise<ActionResult>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await runner();
      setMessage(result);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-white/60 bg-white/80 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{episode.topic}</CardTitle>
          <CardDescription>
            {episode.episodeType === "summary" ? "Resumen" : "Deep dive"} · {episode.targetMinutes} min · Estado{" "}
            <span className="font-medium text-foreground">{summarizeEpisodeStatus(episode.status)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {episode.angleHint
                ? `Ángulo: ${episode.angleHint}`
                : "Sin ángulo fijado todavía."}
            </p>
            <p className="text-sm text-muted-foreground">
              {episode.editorialNotes
                ? episode.editorialNotes
                : "Sin notas editoriales adicionales."}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {PHASES.map((phase) => {
              const current =
                phase.key === "sources"
                  ? null
                  : getLatestArtifact(getArtifactsForStage(artifacts, phase.key));
              const approved =
                phase.key === "sources"
                  ? sources.every((source) => source.rawText.trim())
                  : Boolean(
                      getLatestApprovedArtifact(getArtifactsForStage(artifacts, phase.key)),
                    );

              return (
                <button
                  key={phase.key}
                  type="button"
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-left text-sm"
                  onClick={() => setActiveStage(phase.key)}
                >
                  <span>{STAGE_LABELS[phase.key]}</span>
                  <StageStatusBadge approved={approved} current={current} />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {message ? (
        <Alert variant={message.ok ? "default" : "destructive"}>
          <AlertTitle>{message.ok ? "Actualizado" : "Atención"}</AlertTitle>
          <AlertDescription>{message.message}</AlertDescription>
        </Alert>
      ) : null}

      {isPending ? (
        <Alert>
          <LoaderCircleIcon className="animate-spin" />
          <AlertTitle>Trabajando</AlertTitle>
          <AlertDescription>
            La acción se está ejecutando. Al terminar refresco el workspace.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={activeStage} onValueChange={(value) => setActiveStage(value as typeof activeStage)}>
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          {PHASES.map((phase) => (
            <TabsTrigger key={phase.key} value={phase.key}>
              {STAGE_LABELS[phase.key]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="sources">
          <Card className="border-white/60 bg-white/80 shadow-sm backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Fuentes</CardTitle>
              <CardDescription>
                {PHASES.find((phase) => phase.key === "sources")?.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() =>
                    runAction(async () => {
                      const formData = new FormData();
                      formData.set("episodeId", episode.id);
                      return addSourceAction(formData);
                    })
                  }
                  disabled={sources.length >= 5}
                >
                  <PlusIcon data-icon="inline-start" />
                  Añadir fuente
                </Button>
              </div>

              {sources.map((source) => (
                <SourceEditor
                  key={source.id}
                  episodeId={episode.id}
                  source={source}
                  canDelete={sources.length > 1}
                  onRunAction={runAction}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extraction">
          <Card className="border-white/60 bg-white/80 shadow-sm backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Extracción por fuente</CardTitle>
              <CardDescription>
                {PHASES.find((phase) => phase.key === "extraction")?.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-4 lg:grid-cols-[0.45fr_0.55fr]">
                <ModelSelector
                  episodeId={episode.id}
                  stage="extraction"
                  value={episode.modelConfig.extractionModel}
                  onRunAction={runAction}
                />
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">Acción</span>
                  <Button
                    onClick={() =>
                      runAction(async () => {
                        const formData = new FormData();
                        formData.set("episodeId", episode.id);
                        return generateExtractionAction(formData);
                      })
                    }
                  >
                    <SparklesIcon data-icon="inline-start" />
                    Generar extracciones
                  </Button>
                </div>
              </div>

              <Tabs defaultValue={sources[0]?.id} className="gap-4">
                <TabsList variant="line" className="w-full justify-start overflow-x-auto">
                  {sources.map((source) => {
                    const stageArtifacts = extractionBySource.get(source.id) ?? [];
                    return (
                      <TabsTrigger key={source.id} value={source.id}>
                        {source.label || `Fuente ${source.orderIndex + 1}`}
                        {getLatestApprovedArtifact(stageArtifacts) ? (
                          <Badge className="ml-2">OK</Badge>
                        ) : null}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {sources.map((source) => {
                  const stageArtifacts = extractionBySource.get(source.id) ?? [];
                  const latest = getLatestArtifact(stageArtifacts);

                  return (
                    <TabsContent key={source.id} value={source.id}>
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {source.label || `Fuente ${source.orderIndex + 1}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Texto base listo para revisar claim a claim.
                            </p>
                          </div>
                          {stageArtifacts.length > 0 ? (
                            <HistoryDialog
                              episodeId={episode.id}
                              stage="extraction"
                              artifacts={stageArtifacts}
                              onRunAction={runAction}
                            />
                          ) : null}
                        </div>

                        {latest ? (
                          <JsonArtifactEditor
                            episodeId={episode.id}
                            artifact={latest}
                            onRunAction={runAction}
                          />
                        ) : (
                          <Alert>
                            <FileClockIcon />
                            <AlertTitle>Aún no hay extracción</AlertTitle>
                            <AlertDescription>
                              Genera la fase para crear una primera versión.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consolidation">
          <StageArtifactSection
            title="Consolidación"
            description={PHASES.find((phase) => phase.key === "consolidation")?.description ?? ""}
            episode={episode}
            stage="consolidation"
            canGenerate={approvedExtractions}
            disabledMessage="Aprueba una extracción para cada fuente antes de consolidar."
            latestArtifact={latestConsolidation}
            history={getArtifactsForStage(artifacts, "consolidation")}
            onGenerate={() =>
              runAction(async () => {
                const formData = new FormData();
                formData.set("episodeId", episode.id);
                return generateConsolidationAction(formData);
              })
            }
            onRunAction={runAction}
          />
        </TabsContent>

        <TabsContent value="outline">
          <StageArtifactSection
            title="Outline"
            description={PHASES.find((phase) => phase.key === "outline")?.description ?? ""}
            episode={episode}
            stage="outline"
            canGenerate={approvedConsolidation}
            disabledMessage="Aprueba la consolidación antes de generar el outline."
            latestArtifact={latestOutline}
            history={getArtifactsForStage(artifacts, "outline")}
            onGenerate={() =>
              runAction(async () => {
                const formData = new FormData();
                formData.set("episodeId", episode.id);
                return generateOutlineAction(formData);
              })
            }
            onRunAction={runAction}
          />
        </TabsContent>

        <TabsContent value="script">
          <StageArtifactSection
            title="Guión"
            description={PHASES.find((phase) => phase.key === "script")?.description ?? ""}
            episode={episode}
            stage="script"
            canGenerate={approvedConsolidation && approvedOutline}
            disabledMessage="Aprueba consolidación y outline antes de redactar el guión."
            latestArtifact={latestScript}
            history={getArtifactsForStage(artifacts, "script")}
            onGenerate={() =>
              runAction(async () => {
                const formData = new FormData();
                formData.set("episodeId", episode.id);
                return generateScriptAction(formData);
              })
            }
            onRunAction={runAction}
          />
        </TabsContent>

        <TabsContent value="audit">
          <StageArtifactSection
            title="Auditoría"
            description={PHASES.find((phase) => phase.key === "audit")?.description ?? ""}
            episode={episode}
            stage="audit"
            canGenerate={approvedConsolidation && approvedOutline && approvedScript}
            disabledMessage="Aprueba consolidación, outline y guión antes de auditar."
            latestArtifact={latestAudit}
            history={getArtifactsForStage(artifacts, "audit")}
            onGenerate={() =>
              runAction(async () => {
                const formData = new FormData();
                formData.set("episodeId", episode.id);
                return generateAuditAction(formData);
              })
            }
            onRunAction={runAction}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StageArtifactSection({
  title,
  description,
  episode,
  stage,
  canGenerate,
  disabledMessage,
  latestArtifact,
  history,
  onGenerate,
  onRunAction,
}: {
  title: string;
  description: string;
  episode: EpisodeRow;
  stage: ArtifactStageKey;
  canGenerate: boolean;
  disabledMessage: string;
  latestArtifact: ArtifactRow | null;
  history: ArtifactRow[];
  onGenerate: () => void;
  onRunAction: (runner: () => Promise<ActionResult>) => void;
}) {
  const modelValue = episode.modelConfig[`${stage}Model` as keyof typeof episode.modelConfig];

  return (
    <Card className="border-white/60 bg-white/80 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 lg:grid-cols-[0.45fr_0.55fr]">
          <ModelSelector
            episodeId={episode.id}
            stage={stage}
            value={modelValue}
            onRunAction={onRunAction}
          />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Acción</span>
            <Button onClick={onGenerate} disabled={!canGenerate}>
              <SparklesIcon data-icon="inline-start" />
              Generar {STAGE_LABELS[stage].toLowerCase()}
            </Button>
            {!canGenerate ? (
              <p className="text-sm text-muted-foreground">{disabledMessage}</p>
            ) : null}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StageStatusBadge
              approved={Boolean(history.find((artifact) => artifact.status === "approved"))}
              current={latestArtifact}
            />
            {latestArtifact?.modelName ? (
              <Badge variant="secondary">{latestArtifact.modelName}</Badge>
            ) : null}
          </div>
          {history.length > 0 ? (
            <HistoryDialog
              episodeId={episode.id}
              stage={stage}
              artifacts={history}
              onRunAction={onRunAction}
            />
          ) : null}
        </div>

        {latestArtifact ? (
          stage === "script" ? (
            <ScriptArtifactEditor
              episodeId={episode.id}
              artifact={latestArtifact}
              onRunAction={onRunAction}
            />
          ) : (
            <JsonArtifactEditor
              episodeId={episode.id}
              artifact={latestArtifact}
              onRunAction={onRunAction}
            />
          )
        ) : (
          <Alert>
            <FileClockIcon />
            <AlertTitle>Sin versión todavía</AlertTitle>
            <AlertDescription>
              Genera esta fase cuando la anterior esté aprobada.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
