"use client";

import { useMemo, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import {
  BoltIcon,
  CheckCheckIcon,
  DatabaseIcon,
  FileClockIcon,
  GitMergeIcon,
  HistoryIcon,
  LayoutListIcon,
  LoaderCircleIcon,
  PlusIcon,
  RefreshCcwIcon,
  SaveIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
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
import { getPromptVersion } from "@/lib/gemini";
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
import { cn } from "@/lib/utils";

type WorkspaceProps = {
  episode: EpisodeRow;
  sources: SourceRow[];
  artifacts: ArtifactRow[];
};

type ActionResult = {
  ok: boolean;
  message: string;
};

type PhaseKey = "sources" | ArtifactStageKey;

const PHASES: Array<{
  key: PhaseKey;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "sources",
    description: "Base documental del episodio con texto bruto y labels internos.",
    icon: DatabaseIcon,
  },
  {
    key: "extraction",
    description: "Una extracción estructurada por cada fuente.",
    icon: BoltIcon,
  },
  {
    key: "consolidation",
    description: "Una síntesis global con enfoque, tesis y mapa de cobertura.",
    icon: GitMergeIcon,
  },
  {
    key: "outline",
    description: "Un outline editorial antes de redactar el monólogo.",
    icon: LayoutListIcon,
  },
  {
    key: "script",
    description: "El guion completo, editable y listo para revisión.",
    icon: ScrollTextIcon,
  },
  {
    key: "audit",
    description: "Chequeo final de cobertura, soporte factual y reparaciones.",
    icon: ShieldCheckIcon,
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
    <section className="rounded-[24px] border border-[rgba(199,196,216,0.12)] bg-white/96 p-5 shadow-[0_12px_24px_rgba(13,28,46,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[rgba(213,227,252,0.72)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Source {String(source.orderIndex + 1).padStart(2, "0")}
          </span>
          <div>
            <p className="text-base font-semibold tracking-[-0.02em] text-foreground">
              {source.label || `Fuente ${source.orderIndex + 1}`}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              La extracción se volverá a generar a partir de este texto.
            </p>
          </div>
        </div>
        <Badge variant="outline">Raw source</Badge>
      </div>

      <form
        className="mt-5 flex flex-col gap-5"
        action={(formData) =>
          onRunAction(() => saveSourceAction(formData))
        }
      >
        <input type="hidden" name="episodeId" value={episodeId} />
        <input type="hidden" name="sourceId" value={source.id} />

        <FieldShell label="Label interno">
          <Input name="label" defaultValue={source.label ?? ""} placeholder="Nombre interno de la fuente" />
        </FieldShell>

        <FieldShell label="Raw text">
          <Textarea
            name="rawText"
            defaultValue={source.rawText}
            placeholder="Texto de la fuente"
            className="min-h-48"
          />
        </FieldShell>

        <div className="flex flex-wrap justify-between gap-3">
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
    </section>
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
    <div className="rounded-[24px] border border-[rgba(199,196,216,0.12)] bg-white/90 p-5">
      <p className="editorial-kicker">Inference Model</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Selecciona el modelo que generará la salida de esta fase.
      </p>
      <div className="mt-3">
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
      <DialogContent className="max-w-4xl border-[rgba(199,196,216,0.18)] bg-[rgba(255,255,255,0.96)]">
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

function VisualJsonViewer({ content }: { content: string }) {
  let data: any;
  try {
    data = JSON.parse(content);
  } catch (e) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
        Error al procesar el JSON: {String(e)}
      </div>
    );
  }

  const renderValue = (value: any, keyPath: string): React.ReactNode => {
    if (value === null) return <span className="text-muted-foreground">null</span>;
    if (typeof value === "boolean") return <Badge variant="outline">{value ? "true" : "false"}</Badge>;
    if (typeof value === "string") return <span className="break-words text-foreground">{value}</span>;
    if (typeof value === "number") return <span className="font-mono text-primary">{value}</span>;
    
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-muted-foreground">[]</span>;
      return (
        <div className="flex flex-col gap-2">
          {value.map((item, idx) => (
            <div key={`${keyPath}-${idx}`} className="rounded-xl border border-[rgba(199,196,216,0.1)] bg-[rgba(255,255,255,0.6)] p-3 shadow-sm">
              <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-widest text-[#777587]">Item {idx + 1}</p>
              {renderValue(item, `${keyPath}-${idx}`)}
            </div>
          ))}
        </div>
      );
    }
    
    if (typeof value === "object") {
      const keys = Object.keys(value);
      if (keys.length === 0) return <span className="text-muted-foreground">{}</span>;
      
      return (
        <div className="flex flex-col gap-3">
          {keys.map((k) => (
            <div key={`${keyPath}-${k}`} className="rounded-xl bg-[rgba(239,244,255,0.4)] p-3 shadow-sm">
              <p className="mb-1 text-[0.7rem] font-bold text-[#454386]">{k}</p>
              <div className="pl-1 text-sm">{renderValue(value[k], `${keyPath}-${k}`)}</div>
            </div>
          ))}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="rounded-[24px] bg-[rgba(248,249,255,0.82)] p-5">
      {renderValue(data, "root")}
    </div>
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
      className="grid gap-4"
      action={(formData) => onRunAction(() => saveArtifactAction(formData))}
    >
      <input type="hidden" name="episodeId" value={episodeId} />
      <input type="hidden" name="artifactId" value={artifact.id} />

      <div className="rounded-[28px] border border-[rgba(199,196,216,0.12)] bg-white/94 p-5 shadow-[0_10px_24px_rgba(13,28,46,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="editorial-kicker">Artifact Editor</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Edición del contenido serializado de la fase.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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

        <Tabs defaultValue="visual" className="mt-6 w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="visual">Visual Format</TabsTrigger>
            <TabsTrigger value="raw">Raw JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="visual" className="mt-0 outline-none">
            <VisualJsonViewer content={artifact.currentContent} />
          </TabsContent>
          <TabsContent value="raw" className="mt-0 outline-none">
            <Textarea
              name="content"
              defaultValue={artifact.currentContent}
              className="min-h-[30rem] rounded-[24px] bg-[rgba(248,249,255,0.82)] font-mono text-xs leading-6"
            />
          </TabsContent>
        </Tabs>
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
      className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"
      action={(formData) => onRunAction(() => saveArtifactAction(formData))}
    >
      <input type="hidden" name="episodeId" value={episodeId} />
      <input type="hidden" name="artifactId" value={artifact.id} />

      <div className="rounded-[28px] border border-[rgba(199,196,216,0.12)] bg-white/96 p-5 shadow-[0_10px_24px_rgba(13,28,46,0.04)]">
        <div className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-[22px] px-4 py-3">
          <div>
            <p className="editorial-kicker">Drafting Studio</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Editor principal del guion con vista sincronizada.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline">
              <SaveIcon data-icon="inline-start" />
              Guardar borrador
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
              Aprobar para auditoría
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-5">
          <FieldShell label="Title">
            <Input name="title" defaultValue={script.title} />
          </FieldShell>
          <FieldShell label="Script markdown">
            <Textarea
              name="scriptMarkdown"
              defaultValue={script.scriptMarkdown}
              className="min-h-[34rem] rounded-[24px] bg-[rgba(248,249,255,0.84)]"
            />
          </FieldShell>
        </div>
      </div>

      <div className="space-y-4">
        <Card size="sm" className="bg-[rgba(255,255,255,0.78)]">
          <CardHeader>
            <p className="editorial-kicker">Preview</p>
            <CardTitle>Lectura rápida del guion</CardTitle>
            <CardDescription>
              Vista editorial para revisar ritmo, bloques y tono de locución.
            </CardDescription>
          </CardHeader>
          <CardContent className="prose prose-neutral max-w-none text-sm leading-7">
            <ReactMarkdown>{script.scriptMarkdown}</ReactMarkdown>
          </CardContent>
        </Card>
      </div>
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
    return <Badge variant="outline">Vacío</Badge>;
  }

  if (approved) {
    return <Badge>Aprobado</Badge>;
  }

  return <Badge variant="secondary">{summarizeArtifactStatus(current.status)}</Badge>;
}

function FieldShell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="editorial-kicker">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] bg-[rgba(239,244,255,0.82)] px-4 py-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function StageTabButton({
  phase,
  index,
  active,
  approved,
  current,
  onSelect,
}: {
  phase: (typeof PHASES)[number];
  index: number;
  active: boolean;
  approved: boolean;
  current: ArtifactRow | null;
  onSelect: () => void;
}) {
  const Icon = phase.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex min-w-[14rem] items-center gap-3 rounded-[22px] border px-4 py-3 text-left transition-all",
        active
          ? "border-transparent bg-white shadow-[0_14px_24px_rgba(13,28,46,0.06)]"
          : "border-[rgba(199,196,216,0.16)] bg-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.78)]",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold",
          active
            ? "primary-gradient text-white shadow-[0_18px_28px_rgba(53,37,205,0.18)]"
            : approved
              ? "bg-primary-fixed text-primary"
              : "bg-[rgba(255,255,255,0.72)] text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Stage {String(index + 1).padStart(2, "0")}
          </span>
          <StageStatusBadge approved={approved} current={current} />
        </div>
        <p className="mt-2 text-sm font-semibold tracking-[-0.01em] text-foreground">
          {STAGE_LABELS[phase.key]}
        </p>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {phase.description}
        </p>
      </div>
    </button>
  );
}

export function EpisodeWorkspace({ episode, sources, artifacts }: WorkspaceProps) {
  const router = useRouter();
  const [activeStage, setActiveStage] = useState<PhaseKey>("sources");
  const [activeSourceTab, setActiveSourceTab] = useState<string>(sources[0]?.id ?? "");
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
  const phaseStates = PHASES.map((phase) => {
    if (phase.key === "sources") {
      return {
        phase,
        current: null,
        approved: sources.every((source) => source.rawText.trim()),
      };
    }

    return {
      phase,
      current: getLatestArtifact(getArtifactsForStage(artifacts, phase.key)),
      approved: Boolean(
        getLatestApprovedArtifact(getArtifactsForStage(artifacts, phase.key)),
      ),
    };
  });
  const activePhase = PHASES.find((phase) => phase.key === activeStage);

  let activePhaseArtifact: ArtifactRow | null = activePhase?.current ?? null;
  if (activeStage === "extraction" && activeSourceTab) {
    activePhaseArtifact = getLatestArtifact(extractionBySource.get(activeSourceTab) ?? []);
  }

  const runAction = (runner: () => Promise<ActionResult>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await runner();
      setMessage(result);
      router.refresh();
    });
  };

  const renderActiveStage = () => {
    if (activeStage === "sources") {
      return (
        <Card className="bg-[rgba(248,249,255,0.78)]">
          <CardHeader className="border-b border-[rgba(199,196,216,0.14)] pb-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="editorial-kicker">Sources</p>
                <CardTitle className="mt-2 text-3xl tracking-[-0.03em]">Deck documental</CardTitle>
                <CardDescription className="mt-2 max-w-2xl">
                  {PHASES.find((phase) => phase.key === "sources")?.description}
                </CardDescription>
              </div>
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
          </CardHeader>
          <CardContent className="space-y-4 py-6">
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
      );
    }

    if (activeStage === "extraction") {
      return (
        <Card className="bg-[rgba(248,249,255,0.78)]">
          <CardHeader className="border-b border-[rgba(199,196,216,0.14)] pb-6">
            <p className="editorial-kicker">Stage 02</p>
            <CardTitle className="mt-2 text-3xl tracking-[-0.03em]">Extracción por fuente</CardTitle>
            <CardDescription>
              {PHASES.find((phase) => phase.key === "extraction")?.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 py-6">
            <div className="grid gap-4 xl:grid-cols-[0.42fr_0.58fr]">
              <ModelSelector
                episodeId={episode.id}
                stage="extraction"
                value={episode.modelConfig.extractionModel}
                onRunAction={runAction}
              />
              <div className="rounded-[24px] bg-[rgba(239,244,255,0.92)] p-5">
                <p className="editorial-kicker">Action</p>
                <Button
                  className="mt-3"
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

            <Tabs defaultValue={sources[0]?.id} value={activeSourceTab} onValueChange={setActiveSourceTab} className="gap-5">
              <TabsList variant="line" className="w-full justify-start overflow-x-auto rounded-[22px] bg-[rgba(239,244,255,0.9)] p-2">
                {sources.map((source) => {
                  const stageArtifacts = extractionBySource.get(source.id) ?? [];
                  return (
                    <TabsTrigger
                      key={source.id}
                      value={source.id}
                      className="rounded-2xl px-4 py-2 data-active:bg-white data-active:shadow-[0_10px_18px_rgba(13,28,46,0.05)]"
                    >
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
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                            {source.label || `Fuente ${source.orderIndex + 1}`}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
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
      );
    }

    if (activeStage === "consolidation") {
      return (
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
      );
    }

    if (activeStage === "outline") {
      return (
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
      );
    }

    if (activeStage === "script") {
      return (
        <StageArtifactSection
          title="Guion"
          description={PHASES.find((phase) => phase.key === "script")?.description ?? ""}
          episode={episode}
          stage="script"
          canGenerate={approvedConsolidation && approvedOutline}
          disabledMessage="Aprueba consolidación y outline antes de redactar el guion."
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
      );
    }

    return (
      <StageArtifactSection
        title="Auditoría"
        description={PHASES.find((phase) => phase.key === "audit")?.description ?? ""}
        episode={episode}
        stage="audit"
        canGenerate={approvedConsolidation && approvedOutline && approvedScript}
        disabledMessage="Aprueba consolidación, outline y guion antes de auditar."
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
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden bg-[rgba(255,255,255,0.78)]">
        <CardHeader className="gap-4 border-b border-[rgba(199,196,216,0.12)] pb-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <p className="editorial-kicker">Episode Workspace</p>
              <CardTitle className="mt-2 text-4xl tracking-[-0.04em]">{episode.topic}</CardTitle>
              <CardDescription className="mt-3 text-base leading-8">
                Actualmente en{" "}
                <span className="font-semibold text-foreground">
                  {activePhase ? STAGE_LABELS[activePhase.key] : "fuentes"}
                </span>
                . El pipeline conserva la lógica real de approvals, pero la experiencia
                visual se está alineando con Stitch fase a fase.
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {episode.episodeType === "summary" ? "Resumen" : "Deep dive"}
              </Badge>
              <Badge variant="outline">{episode.targetMinutes} min</Badge>
              <Badge variant="secondary">{sources.length} fuentes</Badge>
              <Badge>{summarizeEpisodeStatus(episode.status)}</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 py-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] bg-[rgba(239,244,255,0.92)] p-5">
            <p className="editorial-kicker">Editorial brief</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Ángulo</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {episode.angleHint
                    ? episode.angleHint
                    : "Sin ángulo fijado todavía."}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Notas</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {episode.editorialNotes
                    ? episode.editorialNotes
                    : "Sin notas editoriales adicionales."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
            <MetricCard label="Extracciones OK" value={approvedExtractions ? "Sí" : "No"} />
            <MetricCard label="Outline OK" value={approvedOutline ? "Sí" : "No"} />
            <MetricCard label="Script OK" value={approvedScript ? "Sí" : "No"} />
          </div>
        </CardContent>

        <div className="border-t border-[rgba(199,196,216,0.12)] px-5 pb-5 pt-1 md:px-6">
          <div className="flex gap-3 overflow-x-auto py-4">
            {phaseStates.map(({ phase, current, approved }, index) => (
              <StageTabButton
                key={phase.key}
                phase={phase}
                index={index}
                active={activeStage === phase.key}
                approved={approved}
                current={current}
                onSelect={() => setActiveStage(phase.key)}
              />
            ))}
          </div>
        </div>
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

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card size="sm" className="bg-[rgba(255,255,255,0.78)]">
            <CardHeader>
              <p className="editorial-kicker">Pipeline Readiness</p>
              <CardTitle>Narrative status</CardTitle>
              <CardDescription>
                Estado resumido de cada fase antes de seguir avanzando.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {phaseStates.map(({ phase, current, approved }, index) => (
                <button
                  key={phase.key}
                  type="button"
                  onClick={() => setActiveStage(phase.key)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-[18px] px-3 py-3 text-left transition-all",
                    activeStage === phase.key
                      ? "bg-[rgba(239,244,255,0.96)]"
                      : "hover:bg-[rgba(239,244,255,0.62)]",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">
                      {STAGE_LABELS[phase.key]}
                    </p>
                  </div>
                  <StageStatusBadge approved={approved} current={current} />
                </button>
              ))}
            </CardContent>
          </Card>

          <Card size="sm" className="bg-[rgba(255,255,255,0.78)]">
            <CardHeader>
              <p className="editorial-kicker">Brief</p>
              <CardTitle>Editorial inputs</CardTitle>
              <CardDescription>
                Contexto que acompaña todas las fases del episodio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MetaRow
                label="Ángulo"
                value={episode.angleHint || "Sin ángulo fijado todavía."}
              />
              <MetaRow
                label="Notas"
                value={episode.editorialNotes || "Sin notas editoriales adicionales."}
              />
              <MetaRow label="Prompt version" value={getPromptVersion()} />
            </CardContent>
          </Card>

          {activePhaseArtifact ? (
            <Card size="sm" className="bg-[rgba(255,255,255,0.78)]">
              <CardHeader>
                <p className="editorial-kicker">Version Meta</p>
                <CardTitle>Instantánea actual</CardTitle>
                <CardDescription>
                  Estado, fecha y modelo de la versión activa.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetaRow label="Estado" value={summarizeArtifactStatus(activePhaseArtifact.status)} />
                <MetaRow label="Modelo" value={activePhaseArtifact.modelName ?? "Manual"} />
                <MetaRow label="Creado" value={formatDateTime(activePhaseArtifact.createdAt)} />
              </CardContent>
            </Card>
          ) : null}
        </aside>

        <div className="min-w-0">{renderActiveStage()}</div>
      </div>
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
    <Card className="bg-[rgba(248,249,255,0.78)]">
      <CardHeader className="border-b border-[rgba(199,196,216,0.14)] pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="editorial-kicker">{`Stage ${String(PHASES.findIndex((phase) => phase.key === stage) + 1).padStart(2, "0")}`}</p>
            <CardTitle className="mt-2 text-3xl tracking-[-0.03em]">{title}</CardTitle>
            <CardDescription className="mt-2 max-w-2xl">{description}</CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StageStatusBadge
              approved={Boolean(history.find((artifact) => artifact.status === "approved"))}
              current={latestArtifact}
            />
            {latestArtifact?.modelName ? (
              <Badge variant="secondary">{latestArtifact.modelName}</Badge>
            ) : null}
            {history.length > 0 ? (
              <HistoryDialog
                episodeId={episode.id}
                stage={stage}
                artifacts={history}
                onRunAction={onRunAction}
              />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 py-6">
        <div className="grid gap-4 xl:grid-cols-[0.42fr_0.58fr]">
          <ModelSelector
            episodeId={episode.id}
            stage={stage}
            value={modelValue}
            onRunAction={onRunAction}
          />
          <div className="rounded-[24px] bg-[rgba(239,244,255,0.92)] p-5">
            <p className="editorial-kicker">Action</p>
            <Button className="mt-3" onClick={onGenerate} disabled={!canGenerate}>
              <SparklesIcon data-icon="inline-start" />
              Generar {STAGE_LABELS[stage].toLowerCase()}
            </Button>
            {!canGenerate ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{disabledMessage}</p>
            ) : null}
          </div>
        </div>

        <Separator />

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

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] bg-[rgba(255,255,255,0.82)] p-4">
      <p className="editorial-kicker">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">{value}</p>
    </div>
  );
}
