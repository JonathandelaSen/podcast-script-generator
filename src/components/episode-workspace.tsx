"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { diffLines, diffWordsWithSpace, type Change } from "diff";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  BadgeCheckIcon,
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
  XCircleIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

import {
  addSourceAction,
  adjustArtifactAction,
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
  unapproveArtifactAction,
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
import { cn } from "@/lib/utils";

type WorkspaceProps = {
  episode: EpisodeRow;
  sources: SourceRow[];
  artifacts: ArtifactRow[];
  initialStage?: PhaseKey;
};

type ActionResult = {
  ok: boolean;
  message: string;
};

type ActionFeedback = ActionResult & {
  title: string;
};

type ActionKind = "default" | "generation";

type PendingAction = {
  id: string;
  label: string;
  kind: ActionKind;
};

type RunActionOptions = {
  id: string;
  pendingLabel: string;
  successTitle: string;
  failureTitle: string;
  kind?: ActionKind;
};

type RunAction = (
  options: RunActionOptions,
  runner: () => Promise<ActionResult>,
) => void;

type PhaseKey = "sources" | ArtifactStageKey;
type ArtifactViewMode = "edit" | "preview" | "compare";
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type ArtifactVersionState = {
  selectedArtifactIds: Record<string, string>;
  compareArtifactIds: Record<string, string>;
  artifactViewModes: Record<string, ArtifactViewMode>;
  onSelectArtifact: (scopeKey: string, artifactId: string) => void;
  onSelectCompareArtifact: (scopeKey: string, artifactId: string) => void;
  onSelectViewMode: (scopeKey: string, mode: ArtifactViewMode) => void;
};

type DiffRow =
  | { kind: "same"; before: string; after: string }
  | { kind: "changed"; before: string; after: string }
  | { kind: "removed"; before: string; after: null }
  | { kind: "added"; before: null; after: string };

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

const AI_ADJUSTMENT_PLACEHOLDERS: Record<ArtifactStageKey, string> = {
  extraction:
    "Ej: incluye esta anécdota en sourceSummary y mustKeep, manteniendo las citas literales...",
  consolidation:
    "Ej: refuerza el ángulo sobre el impacto económico y conserva los mustCoverClaimRefs...",
  outline:
    "Ej: abre con una escena más concreta y mueve la contradicción al segundo bloque...",
  script:
    "Ej: refuerza la apertura, conserva todos los claims cubiertos y añade esta anécdota...",
  audit:
    "Ej: revisa con más dureza la cobertura de fuentes secundarias y sugiere reparaciones concretas...",
};

function getArtifactsForStage(artifacts: ArtifactRow[], stage: ArtifactStageKey, sourceId?: string) {
  return artifacts.filter(
    (artifact) =>
      artifact.stage === stage &&
      (sourceId
        ? artifact.sourceId === sourceId
        : stage === "extraction"
          ? artifact.sourceId !== null
          : artifact.sourceId === null),
  );
}

function getLatestArtifact(artifacts: ArtifactRow[]) {
  return artifacts[0] ?? null;
}

function getLatestApprovedArtifact(artifacts: ArtifactRow[]) {
  return artifacts.find((artifact) => artifact.status === "approved") ?? null;
}

function getVersionScopeKey(stage: ArtifactStageKey, sourceId?: string | null) {
  return stage === "extraction" && sourceId
    ? `${stage}:${sourceId}`
    : `${stage}:stage`;
}

function getSelectedArtifact(artifacts: ArtifactRow[], selectedArtifactId?: string) {
  return artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0] ?? null;
}

function getVersionLabel(artifact: ArtifactRow, artifacts: ArtifactRow[]) {
  const index = artifacts.findIndex((item) => item.id === artifact.id);
  const versionNumber = index >= 0 ? artifacts.length - index : artifacts.length;
  const status = summarizeArtifactStatus(artifact.status);
  return `v${versionNumber} · ${status} · ${formatDateTime(artifact.createdAt)}`;
}

function getDefaultCompareArtifact(
  artifacts: ArtifactRow[],
  activeArtifact: ArtifactRow | null,
) {
  if (!activeArtifact || artifacts.length < 2) {
    return null;
  }

  const activeIndex = artifacts.findIndex((artifact) => artifact.id === activeArtifact.id);
  const adjacentOlder = activeIndex >= 0 ? artifacts[activeIndex + 1] : null;
  const adjacentNewer = activeIndex > 0 ? artifacts[activeIndex - 1] : null;
  return adjacentOlder ?? adjacentNewer ?? null;
}

function getCompareArtifact(
  artifacts: ArtifactRow[],
  activeArtifact: ArtifactRow | null,
  compareArtifactId?: string,
) {
  if (!activeArtifact) {
    return null;
  }

  const selected = artifacts.find(
    (artifact) => artifact.id === compareArtifactId && artifact.id !== activeArtifact.id,
  );

  return selected ?? getDefaultCompareArtifact(artifacts, activeArtifact);
}

function splitDiffLines(change: Pick<Change, "value">) {
  const lines = change.value.split("\n");

  if (lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.length > 0 ? lines : [""];
}

function stringifyJsonForDiff(content: string) {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function getArtifactDiffText(stage: ArtifactStageKey, artifact: ArtifactRow) {
  if (stage !== "script") {
    return stringifyJsonForDiff(artifact.currentContent);
  }

  try {
    const script = parseArtifactContent("script", artifact.currentContent) as ScriptDraft;
    return [`# ${script.title}`, "", script.scriptMarkdown].join("\n");
  } catch {
    return artifact.currentContent;
  }
}

function getArtifactPreviewTitle(stage: ArtifactStageKey, artifact: ArtifactRow) {
  if (stage !== "script") {
    return STAGE_LABELS[stage];
  }

  try {
    return (parseArtifactContent("script", artifact.currentContent) as ScriptDraft).title;
  } catch {
    return "Guion";
  }
}

function buildDiffRows(changes: Change[]) {
  const rows: DiffRow[] = [];

  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index];
    const nextChange = changes[index + 1];

    if (change.removed && nextChange?.added) {
      rows.push({
        kind: "changed",
        before: change.value,
        after: nextChange.value,
      });
      index += 1;
      continue;
    }

    if (change.added) {
      rows.push({ kind: "added", before: null, after: change.value });
      continue;
    }

    if (change.removed) {
      rows.push({ kind: "removed", before: change.value, after: null });
      continue;
    }

    rows.push({
      kind: "same",
      before: change.value,
      after: change.value,
    });
  }

  return rows;
}

function renderChangedText(before: string, after: string, side: "before" | "after") {
  return diffWordsWithSpace(before, after)
    .filter((change) => (side === "before" ? !change.added : !change.removed))
    .map((change, index) => (
      <span
        key={index}
        className={cn(
          side === "before" &&
            change.removed &&
            "rounded bg-[rgba(255,218,214,0.82)] px-0.5 text-[#93000a] line-through decoration-[#93000a]/70",
          side === "after" &&
            change.added &&
            "rounded bg-[rgba(214,244,224,0.9)] px-0.5 text-[#0f5f34]",
        )}
      >
        {change.value}
      </span>
    ));
}

function SourceEditor({
  episodeId,
  source,
  canDelete,
  pendingActionId,
  onRunAction,
}: {
  episodeId: string;
  source: SourceRow;
  canDelete: boolean;
  pendingActionId: string | null;
  onRunAction: RunAction;
}) {
  const saveActionId = `save-source-${source.id}`;
  const deleteActionId = `delete-source-${source.id}`;
  const saving = pendingActionId === saveActionId;
  const deleting = pendingActionId === deleteActionId;

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
          onRunAction(
            {
              id: saveActionId,
              pendingLabel: "Guardando fuente",
              successTitle: "Fuente guardada",
              failureTitle: "No se pudo guardar la fuente",
            },
            () => saveSourceAction(formData),
          )
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
          <Button type="submit" variant="outline" disabled={saving}>
            {saving ? (
              <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            Guardar fuente
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={!canDelete || deleting}
            onClick={() =>
              onRunAction(
                {
                  id: deleteActionId,
                  pendingLabel: "Eliminando fuente",
                  successTitle: "Fuente eliminada",
                  failureTitle: "No se pudo eliminar la fuente",
                },
                async () => {
                  const formData = new FormData();
                  formData.set("episodeId", episodeId);
                  formData.set("sourceId", source.id);
                  return deleteSourceAction(formData);
                },
              )
            }
          >
            {deleting ? (
              <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
            ) : (
              <Trash2Icon data-icon="inline-start" />
            )}
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
  pendingActionId,
  onRunAction,
}: {
  episodeId: string;
  stage: ArtifactStageKey;
  value: string;
  pendingActionId: string | null;
  onRunAction: RunAction;
}) {
  const actionId = `model-${stage}`;
  const updating = pendingActionId === actionId;

  return (
    <div className="rounded-[24px] border border-[rgba(199,196,216,0.12)] bg-white/90 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="editorial-kicker">Inference Model</p>
        {updating ? (
          <Badge variant="secondary">
            <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
            Guardando
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Selecciona el modelo que generará la salida de esta fase.
      </p>
      <div className="mt-3">
        <Select
          value={value}
          disabled={updating}
          onValueChange={(nextValue) =>
            onRunAction(
              {
                id: actionId,
                pendingLabel: "Guardando modelo",
                successTitle: "Modelo actualizado",
                failureTitle: "No se pudo actualizar el modelo",
              },
              async () => {
                if (!nextValue) {
                  return { ok: false, message: "Selecciona un modelo válido." };
                }
                const formData = new FormData();
                formData.set("episodeId", episodeId);
                formData.set("stage", stage);
                formData.set("model", nextValue);
                return updateEpisodeModelAction(formData);
              },
            )
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
  activeArtifactId,
  pendingActionId,
  onSelectArtifact,
  onRunAction,
}: {
  episodeId: string;
  stage: ArtifactStageKey;
  artifacts: ArtifactRow[];
  activeArtifactId: string | null;
  pendingActionId: string | null;
  onSelectArtifact: (artifactId: string) => void;
  onRunAction: RunAction;
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
                <TableHead>Versión</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {artifacts.map((artifact) => (
                <TableRow key={artifact.id}>
                  <TableCell className="font-semibold">
                    v{artifacts.length - artifacts.findIndex((item) => item.id === artifact.id)}
                  </TableCell>
                  <TableCell>{formatDateTime(artifact.createdAt)}</TableCell>
                  <TableCell>{summarizeArtifactStatus(artifact.status)}</TableCell>
                  <TableCell>{artifact.modelName ?? "Manual"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant={artifact.id === activeArtifactId ? "secondary" : "ghost"}
                      disabled={artifact.id === activeArtifactId}
                      onClick={() => onSelectArtifact(artifact.id)}
                    >
                      Ver
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pendingActionId === `revert-artifact-${artifact.id}`}
                      onClick={() =>
                        onRunAction(
                          {
                            id: `revert-artifact-${artifact.id}`,
                            pendingLabel: "Revirtiendo versión",
                            successTitle: "Versión revertida",
                            failureTitle: "No se pudo revertir la versión",
                          },
                          async () => {
                            const formData = new FormData();
                            formData.set("episodeId", episodeId);
                            formData.set("artifactId", artifact.id);
                            return revertArtifactAction(formData);
                          },
                        )
                      }
                    >
                      {pendingActionId === `revert-artifact-${artifact.id}` ? (
                        <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
                      ) : (
                        <RefreshCcwIcon data-icon="inline-start" />
                      )}
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

function ArtifactVersionToolbar({
  scopeKey,
  stage,
  artifacts,
  activeArtifact,
  compareArtifact,
  viewMode,
  onSelectArtifact,
  onSelectCompareArtifact,
  onSelectViewMode,
}: {
  scopeKey: string;
  stage: ArtifactStageKey;
  artifacts: ArtifactRow[];
  activeArtifact: ArtifactRow;
  compareArtifact: ArtifactRow | null;
  viewMode: ArtifactViewMode;
  onSelectArtifact: (scopeKey: string, artifactId: string) => void;
  onSelectCompareArtifact: (scopeKey: string, artifactId: string) => void;
  onSelectViewMode: (scopeKey: string, mode: ArtifactViewMode) => void;
}) {
  const canCompare = artifacts.length > 1 && Boolean(compareArtifact);

  return (
    <div className="rounded-[26px] border border-[rgba(199,196,216,0.14)] bg-white/82 p-4 shadow-[0_10px_24px_rgba(13,28,46,0.04)]">
      <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.42fr)_minmax(220px,0.42fr)_auto] xl:items-end">
        <div>
          <p className="editorial-kicker">Versión activa</p>
          <Select
            value={activeArtifact.id}
            onValueChange={(artifactId) => {
              if (artifactId) {
                onSelectArtifact(scopeKey, artifactId);
              }
            }}
          >
            <SelectTrigger className="mt-2 w-full">
              <SelectValue>{getVersionLabel(activeArtifact, artifacts)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {artifacts.map((artifact) => (
                  <SelectItem key={artifact.id} value={artifact.id}>
                    {getVersionLabel(artifact, artifacts)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="editorial-kicker">Comparar con</p>
          <Select
            value={compareArtifact?.id ?? "none"}
            disabled={!canCompare}
            onValueChange={(artifactId) => {
              if (artifactId) {
                onSelectCompareArtifact(scopeKey, artifactId);
              }
            }}
          >
            <SelectTrigger className="mt-2 w-full">
              <SelectValue>
                {compareArtifact
                  ? getVersionLabel(compareArtifact, artifacts)
                  : "Sin versión comparable"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {artifacts
                  .filter((artifact) => artifact.id !== activeArtifact.id)
                  .map((artifact) => (
                    <SelectItem key={artifact.id} value={artifact.id}>
                      {getVersionLabel(artifact, artifacts)}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <Tabs
          value={viewMode}
          onValueChange={(value) =>
            onSelectViewMode(scopeKey, value as ArtifactViewMode)
          }
          className="min-w-0"
        >
          <TabsList className="h-10 w-full rounded-2xl bg-[rgba(239,244,255,0.92)] p-1 xl:w-fit">
            <TabsTrigger value="edit" className="px-3">
              Editar
            </TabsTrigger>
            <TabsTrigger value="preview" className="px-3">
              Vista
            </TabsTrigger>
            <TabsTrigger value="compare" className="px-3" disabled={!canCompare}>
              Comparar
            </TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="hidden" />
          <TabsContent value="preview" className="hidden" />
          <TabsContent value="compare" className="hidden" />
        </Tabs>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline">{STAGE_LABELS[stage]}</Badge>
        <Badge variant="secondary">{summarizeArtifactStatus(activeArtifact.status)}</Badge>
        {activeArtifact.modelName ? (
          <Badge variant="secondary">{activeArtifact.modelName}</Badge>
        ) : null}
      </div>
    </div>
  );
}

function DiffColumn({
  title,
  label,
  rows,
  side,
}: {
  title: string;
  label: string;
  rows: DiffRow[];
  side: "before" | "after";
}) {
  return (
    <div className="min-w-0 rounded-[24px] border border-[rgba(199,196,216,0.14)] bg-white/88">
      <div className="border-b border-[rgba(199,196,216,0.14)] px-4 py-3">
        <p className="editorial-kicker">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="max-h-[62vh] min-h-[24rem] overflow-y-auto overscroll-contain p-4 pr-2">
        <div className="min-w-full whitespace-pre-wrap break-words pb-8 pr-2 font-mono text-xs leading-6 text-foreground">
          {rows.map((row, rowIndex) => {
            const text = side === "before" ? row.before : row.after;

            if (text === null) {
              return (
                <div
                  key={rowIndex}
                  className="min-h-6 rounded-lg px-2 text-muted-foreground/45"
                >
                  {" "}
                </div>
              );
            }

            if (row.kind === "changed") {
              return (
                <div
                  key={rowIndex}
                  className="my-1 rounded-xl bg-[rgba(239,244,255,0.72)] px-2 py-1"
                >
                  {renderChangedText(row.before, row.after, side)}
                </div>
              );
            }

            const changed =
              (row.kind === "removed" && side === "before") ||
              (row.kind === "added" && side === "after");
            const tone =
              row.kind === "removed" && side === "before"
                ? "bg-[rgba(255,218,214,0.72)] text-[#93000a]"
                : row.kind === "added" && side === "after"
                  ? "bg-[rgba(214,244,224,0.82)] text-[#0f5f34]"
                  : "text-foreground";

            return splitDiffLines({ value: text }).map((line, lineIndex) => (
              <div
                key={`${rowIndex}-${lineIndex}`}
                className={cn(
                  "min-h-6 rounded-lg px-2",
                  changed ? tone : "hover:bg-[rgba(239,244,255,0.5)]",
                )}
              >
                {line || " "}
              </div>
            ));
          })}
        </div>
      </div>
    </div>
  );
}

function WordDiffLine({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const changes = diffWordsWithSpace(before, after);

  return (
    <div className="rounded-[22px] border border-[rgba(199,196,216,0.14)] bg-[rgba(248,249,255,0.72)] p-4 text-sm leading-7">
      <p className="editorial-kicker">Cambio de título</p>
      <p className="mt-2">
        {changes.map((change, index) => (
          <span
            key={index}
            className={cn(
              change.added && "rounded bg-[rgba(214,244,224,0.9)] px-1 text-[#0f5f34]",
              change.removed && "rounded bg-[rgba(255,218,214,0.8)] px-1 text-[#93000a] line-through",
            )}
          >
            {change.value}
          </span>
        ))}
      </p>
    </div>
  );
}

function ArtifactDiffViewer({
  stage,
  beforeArtifact,
  afterArtifact,
  artifacts,
}: {
  stage: ArtifactStageKey;
  beforeArtifact: ArtifactRow;
  afterArtifact: ArtifactRow;
  artifacts: ArtifactRow[];
}) {
  const beforeText = getArtifactDiffText(stage, beforeArtifact);
  const afterText = getArtifactDiffText(stage, afterArtifact);
  const changes = diffLines(beforeText, afterText);
  const rows = buildDiffRows(changes);

  return (
    <div className="space-y-4">
      {stage === "script" ? (
        <WordDiffLine
          before={getArtifactPreviewTitle(stage, beforeArtifact)}
          after={getArtifactPreviewTitle(stage, afterArtifact)}
        />
      ) : null}
      <div className="grid min-h-0 gap-4 xl:grid-cols-2">
        <DiffColumn
          title={getVersionLabel(beforeArtifact, artifacts)}
          label="Anterior"
          rows={rows}
          side="before"
        />
        <DiffColumn
          title={getVersionLabel(afterArtifact, artifacts)}
          label="Activa"
          rows={rows}
          side="after"
        />
      </div>
    </div>
  );
}

function ArtifactReadOnlyPreview({
  stage,
  artifact,
}: {
  stage: ArtifactStageKey;
  artifact: ArtifactRow;
}) {
  if (stage !== "script") {
    return (
      <div className="rounded-[28px] border border-[rgba(199,196,216,0.12)] bg-white/94 p-5 shadow-[0_10px_24px_rgba(13,28,46,0.04)]">
        <VisualJsonViewer content={artifact.currentContent} />
      </div>
    );
  }

  let script: ScriptDraft;
  try {
    script = parseArtifactContent("script", artifact.currentContent) as ScriptDraft;
  } catch (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
        Error al procesar el guion: {String(error)}
      </div>
    );
  }

  return (
    <Card className="bg-[rgba(255,255,255,0.78)]">
      <CardHeader>
        <p className="editorial-kicker">Vista de lectura</p>
        <CardTitle>{script.title}</CardTitle>
        <CardDescription>
          Versión seleccionada renderizada sin controles de edición.
        </CardDescription>
      </CardHeader>
      <CardContent className="prose prose-neutral max-w-none text-sm leading-7">
        <ReactMarkdown>{script.scriptMarkdown}</ReactMarkdown>
      </CardContent>
    </Card>
  );
}

function VersionedArtifactPanel({
  episodeId,
  stage,
  artifacts,
  pendingActionId,
  versionState,
  onRunAction,
}: {
  episodeId: string;
  stage: ArtifactStageKey;
  artifacts: ArtifactRow[];
  pendingActionId: string | null;
  versionState: ArtifactVersionState;
  onRunAction: RunAction;
}) {
  const scopeKey = getVersionScopeKey(stage, artifacts[0]?.sourceId);
  const activeArtifact = getSelectedArtifact(
    artifacts,
    versionState.selectedArtifactIds[scopeKey],
  );

  if (!activeArtifact) {
    return null;
  }

  const compareArtifact = getCompareArtifact(
    artifacts,
    activeArtifact,
    versionState.compareArtifactIds[scopeKey],
  );
  const requestedMode = versionState.artifactViewModes[scopeKey] ?? "edit";
  const viewMode =
    requestedMode === "compare" && !compareArtifact ? "edit" : requestedMode;

  const handleSelectArtifact = (scope: string, artifactId: string) => {
    versionState.onSelectArtifact(scope, artifactId);

    if (versionState.compareArtifactIds[scope] === artifactId) {
      const nextActiveArtifact = artifacts.find((artifact) => artifact.id === artifactId) ?? null;
      const nextCompareArtifact = getDefaultCompareArtifact(artifacts, nextActiveArtifact);
      if (nextCompareArtifact) {
        versionState.onSelectCompareArtifact(scope, nextCompareArtifact.id);
      }
    }
  };

  return (
    <div className="space-y-4">
      <ArtifactVersionToolbar
        scopeKey={scopeKey}
        stage={stage}
        artifacts={artifacts}
        activeArtifact={activeArtifact}
        compareArtifact={compareArtifact}
        viewMode={viewMode}
        onSelectArtifact={handleSelectArtifact}
        onSelectCompareArtifact={versionState.onSelectCompareArtifact}
        onSelectViewMode={versionState.onSelectViewMode}
      />

      {viewMode === "compare" && compareArtifact ? (
        <ArtifactDiffViewer
          stage={stage}
          beforeArtifact={compareArtifact}
          afterArtifact={activeArtifact}
          artifacts={artifacts}
        />
      ) : viewMode === "preview" ? (
        <ArtifactReadOnlyPreview stage={stage} artifact={activeArtifact} />
      ) : stage === "script" ? (
        <ScriptArtifactEditor
          key={activeArtifact.id}
          episodeId={episodeId}
          artifact={activeArtifact}
          pendingActionId={pendingActionId}
          onRunAction={onRunAction}
        />
      ) : (
        <JsonArtifactEditor
          key={activeArtifact.id}
          episodeId={episodeId}
          artifact={activeArtifact}
          pendingActionId={pendingActionId}
          onRunAction={onRunAction}
        />
      )}
    </div>
  );
}

function VisualJsonViewer({ content }: { content: string }) {
  let data: JsonValue;
  try {
    data = JSON.parse(content);
  } catch (e) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
        Error al procesar el JSON: {String(e)}
      </div>
    );
  }

  const renderValue = (value: JsonValue, keyPath: string): React.ReactNode => {
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
      const objectValue = value;
      const keys = Object.keys(objectValue);
      if (keys.length === 0) return <span className="text-muted-foreground">{}</span>;
      
      return (
        <div className="flex flex-col gap-3">
          {keys.map((k) => (
            <div key={`${keyPath}-${k}`} className="rounded-xl bg-[rgba(239,244,255,0.4)] p-3 shadow-sm">
              <p className="mb-1 text-[0.7rem] font-bold text-[#454386]">{k}</p>
              <div className="pl-1 text-sm">{renderValue(objectValue[k], `${keyPath}-${k}`)}</div>
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

function AIAdjustmentPanel({
  episodeId,
  artifact,
  pendingActionId,
  onRunAction,
  compact = false,
}: {
  episodeId: string;
  artifact: ArtifactRow;
  pendingActionId: string | null;
  onRunAction: RunAction;
  compact?: boolean;
}) {
  const [instruction, setInstruction] = useState("");
  const actionId = `adjust-artifact-${artifact.id}`;
  const adjusting = pendingActionId === actionId;
  const disabled = adjusting || !instruction.trim();

  return (
    <div
      className={cn(
        "rounded-[24px] border border-[rgba(53,37,205,0.14)] bg-[rgba(239,244,255,0.78)] p-4",
        compact ? "shadow-none" : "shadow-[0_12px_24px_rgba(53,37,205,0.06)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="editorial-kicker">Ajustes IA</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            Crear una nueva versión
          </p>
        </div>
        {adjusting ? (
          <Badge variant="secondary">
            <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
            Ajustando
          </Badge>
        ) : null}
      </div>

      <Textarea
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder={AI_ADJUSTMENT_PLACEHOLDERS[artifact.stage]}
        className={cn(
          "mt-3 rounded-[20px] bg-white/90",
          compact ? "min-h-28" : "min-h-32",
        )}
        disabled={adjusting}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">
          La versión actual queda intacta.
        </p>
        <Button
          type="button"
          disabled={disabled}
          onClick={() =>
            onRunAction(
              {
                id: actionId,
                pendingLabel: "Ajustando con IA",
                successTitle: "Ajuste generado",
                failureTitle: "No se pudo ajustar la versión",
                kind: "generation",
              },
              async () => {
                const formData = new FormData();
                formData.set("episodeId", episodeId);
                formData.set("artifactId", artifact.id);
                formData.set("instruction", instruction);
                const result = await adjustArtifactAction(formData);

                if (result.ok) {
                  setInstruction("");
                }

                return result;
              },
            )
          }
        >
          {adjusting ? (
            <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
          ) : (
            <SparklesIcon data-icon="inline-start" />
          )}
          Ajustar con IA
        </Button>
      </div>
    </div>
  );
}

function ArtifactApprovalControl({
  episodeId,
  artifact,
  pendingActionId,
  onRunAction,
  approveLabel,
  approvePendingLabel,
  approveSuccessTitle,
  approveFailureTitle,
}: {
  episodeId: string;
  artifact: ArtifactRow;
  pendingActionId: string | null;
  onRunAction: RunAction;
  approveLabel: string;
  approvePendingLabel: string;
  approveSuccessTitle: string;
  approveFailureTitle: string;
}) {
  const approveActionId = `approve-artifact-${artifact.id}`;
  const unapproveActionId = `unapprove-artifact-${artifact.id}`;
  const approving = pendingActionId === approveActionId;
  const unapproving = pendingActionId === unapproveActionId;
  const approved = artifact.status === "approved";

  const buildFormData = () => {
    const formData = new FormData();
    formData.set("episodeId", episodeId);
    formData.set("artifactId", artifact.id);
    return formData;
  };

  if (approved) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[rgba(53,37,205,0.14)] bg-[rgba(239,244,255,0.82)] px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          <BadgeCheckIcon className="size-4" />
          Aprobada
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={unapproving}
          onClick={() =>
            onRunAction(
              {
                id: unapproveActionId,
                pendingLabel: "Desaprobando versión",
                successTitle: "Versión desaprobada",
                failureTitle: "No se pudo desaprobar la versión",
              },
              () => unapproveArtifactAction(buildFormData()),
            )
          }
        >
          {unapproving ? (
            <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
          ) : (
            <XCircleIcon data-icon="inline-start" />
          )}
          Desaprobar
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      disabled={approving}
      onClick={() =>
        onRunAction(
          {
            id: approveActionId,
            pendingLabel: approvePendingLabel,
            successTitle: approveSuccessTitle,
            failureTitle: approveFailureTitle,
          },
          () => approveArtifactAction(buildFormData()),
        )
      }
    >
      {approving ? (
        <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
      ) : (
        <CheckCheckIcon data-icon="inline-start" />
      )}
      {approveLabel}
    </Button>
  );
}

function JsonArtifactEditor({
  episodeId,
  artifact,
  pendingActionId,
  onRunAction,
}: {
  episodeId: string;
  artifact: ArtifactRow;
  pendingActionId: string | null;
  onRunAction: RunAction;
}) {
  const saveActionId = `save-artifact-${artifact.id}`;
  const saving = pendingActionId === saveActionId;

  return (
    <form
      className="grid gap-4"
      action={(formData) =>
        onRunAction(
          {
            id: saveActionId,
            pendingLabel: "Guardando versión",
            successTitle: "Versión guardada",
            failureTitle: "No se pudo guardar la versión",
          },
          () => saveArtifactAction(formData),
        )
      }
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
            <Button type="submit" variant="outline" disabled={saving}>
              {saving ? (
                <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              Guardar edición
            </Button>
            <ArtifactApprovalControl
              episodeId={episodeId}
              artifact={artifact}
              pendingActionId={pendingActionId}
              onRunAction={onRunAction}
              approveLabel="Aprobar"
              approvePendingLabel="Aprobando versión"
              approveSuccessTitle="Versión aprobada"
              approveFailureTitle="No se pudo aprobar la versión"
            />
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

        <div className="mt-5">
          <AIAdjustmentPanel
            episodeId={episodeId}
            artifact={artifact}
            pendingActionId={pendingActionId}
            onRunAction={onRunAction}
            compact
          />
        </div>
      </div>
    </form>
  );
}

function ScriptArtifactEditor({
  episodeId,
  artifact,
  pendingActionId,
  onRunAction,
}: {
  episodeId: string;
  artifact: ArtifactRow;
  pendingActionId: string | null;
  onRunAction: RunAction;
}) {
  const script = parseArtifactContent("script", artifact.currentContent) as ScriptDraft;
  const saveActionId = `save-artifact-${artifact.id}`;
  const saving = pendingActionId === saveActionId;

  return (
    <form
      className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.32fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.34fr)]"
      action={(formData) =>
        onRunAction(
          {
            id: saveActionId,
            pendingLabel: "Guardando borrador",
            successTitle: "Borrador guardado",
            failureTitle: "No se pudo guardar el borrador",
          },
          () => saveArtifactAction(formData),
        )
      }
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
            <Button type="submit" variant="outline" disabled={saving}>
              {saving ? (
                <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              Guardar borrador
            </Button>
            <ArtifactApprovalControl
              episodeId={episodeId}
              artifact={artifact}
              pendingActionId={pendingActionId}
              onRunAction={onRunAction}
              approveLabel="Aprobar para auditoría"
              approvePendingLabel="Aprobando guion"
              approveSuccessTitle="Guion aprobado"
              approveFailureTitle="No se pudo aprobar el guion"
            />
          </div>
        </div>

        <div className="mt-5">
          <AIAdjustmentPanel
            episodeId={episodeId}
            artifact={artifact}
            pendingActionId={pendingActionId}
            onRunAction={onRunAction}
          />
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
    return <Badge variant="outline">Sin versión</Badge>;
  }

  if (approved) {
    return <Badge>Aprobada</Badge>;
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

function SourceReviewSelector({
  episodeId,
  sources,
  extractionBySource,
  activeSourceId,
  onSelectSource,
  pendingActionId,
  versionState,
  onRunAction,
}: {
  episodeId: string;
  sources: SourceRow[];
  extractionBySource: Map<string, ArtifactRow[]>;
  activeSourceId: string;
  onSelectSource: (sourceId: string) => void;
  pendingActionId: string | null;
  versionState: ArtifactVersionState;
  onRunAction: RunAction;
}) {
  const activeSource =
    sources.find((source) => source.id === activeSourceId) ?? sources[0] ?? null;

  if (!activeSource) {
    return (
      <Alert>
        <FileClockIcon />
        <AlertTitle>Sin fuentes</AlertTitle>
        <AlertDescription>
          Añade una fuente antes de generar extracciones.
        </AlertDescription>
      </Alert>
    );
  }

  const activeArtifacts = extractionBySource.get(activeSource.id) ?? [];
  const latest = getLatestArtifact(activeArtifacts);
  const scopeKey = getVersionScopeKey("extraction", activeSource.id);
  const activeArtifact = getSelectedArtifact(
    activeArtifacts,
    versionState.selectedArtifactIds[scopeKey],
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(240px,0.32fr)_minmax(0,1fr)]">
      <div className="rounded-[28px] border border-[rgba(199,196,216,0.14)] bg-[rgba(255,255,255,0.68)] p-3 shadow-[0_12px_28px_rgba(13,28,46,0.04)]">
        <div className="px-2 pb-3 pt-1">
          <p className="editorial-kicker">Fuentes</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Revisa y decide cada extracción individualmente.
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
          {sources.map((source) => {
            const stageArtifacts = extractionBySource.get(source.id) ?? [];
            const sourceLatest = getLatestArtifact(stageArtifacts);
            const approved = Boolean(getLatestApprovedArtifact(stageArtifacts));
            const active = activeSource.id === source.id;
            const statusLabel = !sourceLatest
              ? "Sin extracción"
              : approved
                ? "Aprobada"
                : "Pendiente de aprobación";

            return (
              <button
                key={source.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectSource(source.id)}
                className={cn(
                  "min-w-[16rem] rounded-[22px] border p-4 text-left transition-all xl:min-w-0",
                  active
                    ? "border-transparent bg-white shadow-[0_16px_26px_rgba(13,28,46,0.08)]"
                    : "border-[rgba(199,196,216,0.14)] bg-[rgba(248,249,255,0.72)] hover:bg-white/92",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl",
                      approved
                        ? "bg-primary-fixed text-primary"
                        : sourceLatest
                          ? "bg-[rgba(255,247,214,0.96)] text-[#6f5400]"
                          : "bg-[rgba(239,244,255,0.92)] text-muted-foreground",
                    )}
                  >
                    {approved ? (
                      <BadgeCheckIcon className="size-4" />
                    ) : sourceLatest ? (
                      <FileClockIcon className="size-4" />
                    ) : (
                      <XCircleIcon className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground">
                      {source.label || `Fuente ${source.orderIndex + 1}`}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-xs font-semibold",
                        approved
                          ? "text-primary"
                          : sourceLatest
                            ? "text-[#6f5400]"
                            : "text-muted-foreground",
                      )}
                    >
                      {statusLabel}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <MetaRow
                    label="Estado"
                    value={sourceLatest ? summarizeArtifactStatus(sourceLatest.status) : "Vacío"}
                  />
                  <MetaRow
                    label="Versión"
                    value={sourceLatest ? formatDateTime(sourceLatest.createdAt) : "Pendiente"}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-[28px] border border-[rgba(199,196,216,0.14)] bg-white/78 p-5 shadow-[0_12px_28px_rgba(13,28,46,0.04)]">
          <div>
            <p className="editorial-kicker">Fuente activa</p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-foreground">
              {activeSource.label || `Fuente ${activeSource.orderIndex + 1}`}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Texto base listo para revisar claim a claim.
            </p>
          </div>
          {activeArtifacts.length > 0 ? (
            <HistoryDialog
              episodeId={episodeId}
              stage="extraction"
              artifacts={activeArtifacts}
              activeArtifactId={activeArtifact?.id ?? null}
              pendingActionId={pendingActionId}
              onSelectArtifact={(artifactId) =>
                versionState.onSelectArtifact(scopeKey, artifactId)
              }
              onRunAction={onRunAction}
            />
          ) : null}
        </div>

        {latest ? (
          <VersionedArtifactPanel
            episodeId={episodeId}
            stage="extraction"
            artifacts={activeArtifacts}
            pendingActionId={pendingActionId}
            versionState={versionState}
            onRunAction={onRunAction}
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
    </div>
  );
}

function StageTabButton({
  episodeId,
  phase,
  index,
  active,
  approved,
  current,
  onSelect,
}: {
  episodeId: string;
  phase: (typeof PHASES)[number];
  index: number;
  active: boolean;
  approved: boolean;
  current: ArtifactRow | null;
  onSelect: () => void;
}) {
  const Icon = phase.icon;

  return (
    <Link
      href={`/episodes/${episodeId}?stage=${phase.key}`}
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex min-w-[14rem] flex-1 items-center gap-3 rounded-[22px] border px-4 py-3 text-left transition-all",
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
    </Link>
  );
}

export function EpisodeWorkspace({
  episode,
  sources,
  artifacts,
  initialStage = "sources",
}: WorkspaceProps) {
  const router = useRouter();
  const [activeStage, setActiveStage] = useState<PhaseKey>(initialStage);
  const [activeSourceId, setActiveSourceId] = useState<string>(sources[0]?.id ?? "");
  const [message, setMessage] = useState<ActionFeedback | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<Record<string, string>>({});
  const [compareArtifactIds, setCompareArtifactIds] = useState<Record<string, string>>({});
  const [artifactViewModes, setArtifactViewModes] = useState<Record<string, ArtifactViewMode>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setActiveStage(initialStage);
  }, [initialStage]);

  const versionState: ArtifactVersionState = {
    selectedArtifactIds,
    compareArtifactIds,
    artifactViewModes,
    onSelectArtifact: (scopeKey, artifactId) =>
      setSelectedArtifactIds((current) => ({ ...current, [scopeKey]: artifactId })),
    onSelectCompareArtifact: (scopeKey, artifactId) =>
      setCompareArtifactIds((current) => ({ ...current, [scopeKey]: artifactId })),
    onSelectViewMode: (scopeKey, mode) =>
      setArtifactViewModes((current) => ({ ...current, [scopeKey]: mode })),
  };

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

    if (phase.key === "extraction") {
      return {
        phase,
        current: getLatestArtifact(getArtifactsForStage(artifacts, "extraction")),
        approved: approvedExtractions,
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
  const activePhaseState = phaseStates.find(({ phase }) => phase.key === activeStage);
  const activePhase = activePhaseState?.phase;
  const selectedSource =
    sources.find((source) => source.id === activeSourceId) ?? sources[0] ?? null;

  let activePhaseArtifact: ArtifactRow | null = activePhaseState?.current ?? null;
  if (activeStage === "extraction" && selectedSource) {
    const sourceArtifacts = extractionBySource.get(selectedSource.id) ?? [];
    activePhaseArtifact = getSelectedArtifact(
      sourceArtifacts,
      selectedArtifactIds[getVersionScopeKey("extraction", selectedSource.id)],
    );
  } else if (activeStage !== "sources") {
    const stageArtifacts = getArtifactsForStage(artifacts, activeStage);
    activePhaseArtifact = getSelectedArtifact(
      stageArtifacts,
      selectedArtifactIds[getVersionScopeKey(activeStage)],
    );
  }

  const runAction: RunAction = (options, runner) => {
    setMessage(null);
    setPendingAction({
      id: options.id,
      label: options.pendingLabel,
      kind: options.kind ?? "default",
    });
    startTransition(async () => {
      try {
        const result = await runner();
        setMessage({
          ...result,
          title: result.ok ? options.successTitle : options.failureTitle,
        });
        router.refresh();
      } catch (error) {
        setMessage({
          ok: false,
          title: options.failureTitle,
          message: error instanceof Error ? error.message : "La acción no se pudo completar.",
        });
      } finally {
        setPendingAction(null);
      }
    });
  };
  const pendingActionId = pendingAction?.id ?? null;
  const longRunningAction = isPending && pendingAction?.kind === "generation" ? pendingAction : null;

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
                  runAction(
                    {
                      id: "add-source",
                      pendingLabel: "Añadiendo fuente",
                      successTitle: "Fuente añadida",
                      failureTitle: "No se pudo añadir la fuente",
                    },
                    async () => {
                      const formData = new FormData();
                      formData.set("episodeId", episode.id);
                      return addSourceAction(formData);
                    },
                  )
                }
                disabled={sources.length >= 5 || pendingActionId === "add-source"}
              >
                {pendingActionId === "add-source" ? (
                  <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <PlusIcon data-icon="inline-start" />
                )}
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
                pendingActionId={pendingActionId}
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
                pendingActionId={pendingActionId}
                onRunAction={runAction}
              />
              <div className="rounded-[24px] bg-[rgba(239,244,255,0.92)] p-5">
                <p className="editorial-kicker">Action</p>
                {pendingActionId === "generate-extraction" ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Generando una extracción por fuente.
                  </p>
                ) : null}
                <Button
                  className="mt-3"
                  onClick={() =>
                    runAction(
                      {
                        id: "generate-extraction",
                        pendingLabel: "Generando extracciones",
                        successTitle: "Extracciones generadas",
                        failureTitle: "No se pudieron generar las extracciones",
                        kind: "generation",
                      },
                      async () => {
                        const formData = new FormData();
                        formData.set("episodeId", episode.id);
                        return generateExtractionAction(formData);
                      },
                    )
                  }
                  disabled={pendingActionId === "generate-extraction"}
                >
                  {pendingActionId === "generate-extraction" ? (
                    <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <SparklesIcon data-icon="inline-start" />
                  )}
                  Generar extracciones
                </Button>
              </div>
            </div>

            <SourceReviewSelector
              episodeId={episode.id}
              sources={sources}
              extractionBySource={extractionBySource}
              activeSourceId={selectedSource?.id ?? ""}
              onSelectSource={setActiveSourceId}
              pendingActionId={pendingActionId}
              versionState={versionState}
              onRunAction={runAction}
            />
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
            runAction(
              {
                id: "generate-consolidation",
                pendingLabel: "Generando consolidación",
                successTitle: "Consolidación generada",
                failureTitle: "No se pudo generar la consolidación",
                kind: "generation",
              },
              async () => {
                const formData = new FormData();
                formData.set("episodeId", episode.id);
                return generateConsolidationAction(formData);
              },
            )
          }
          pendingActionId={pendingActionId}
          versionState={versionState}
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
            runAction(
              {
                id: "generate-outline",
                pendingLabel: "Generando outline",
                successTitle: "Outline generado",
                failureTitle: "No se pudo generar el outline",
                kind: "generation",
              },
              async () => {
                const formData = new FormData();
                formData.set("episodeId", episode.id);
                return generateOutlineAction(formData);
              },
            )
          }
          pendingActionId={pendingActionId}
          versionState={versionState}
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
            runAction(
              {
                id: "generate-script",
                pendingLabel: "Generando guion",
                successTitle: "Guion generado",
                failureTitle: "No se pudo generar el guion",
                kind: "generation",
              },
              async () => {
                const formData = new FormData();
                formData.set("episodeId", episode.id);
                return generateScriptAction(formData);
              },
            )
          }
          pendingActionId={pendingActionId}
          versionState={versionState}
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
          runAction(
            {
              id: "generate-audit",
              pendingLabel: "Generando auditoría",
              successTitle: "Auditoría generada",
              failureTitle: "No se pudo generar la auditoría",
              kind: "generation",
            },
            async () => {
              const formData = new FormData();
              formData.set("episodeId", episode.id);
              return generateAuditAction(formData);
            },
          )
        }
        pendingActionId={pendingActionId}
        versionState={versionState}
        onRunAction={runAction}
      />
    );
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
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

        <CardContent className="space-y-4 py-6">
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
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
              <MetricCard label="Extracciones aprobadas" value={approvedExtractions ? "Completas" : "Pendientes"} />
              <MetricCard label="Outline aprobado" value={approvedOutline ? "Sí" : "Pendiente"} />
              <MetricCard label="Script aprobado" value={approvedScript ? "Sí" : "Pendiente"} />
            </div>
          </div>

          {activePhaseArtifact ? (
            <div className="rounded-[28px] bg-[rgba(255,255,255,0.68)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="editorial-kicker">Version Meta</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Instantánea contextual de la versión activa.
                  </p>
                </div>
                <StageStatusBadge
                  approved={activePhaseArtifact.status === "approved"}
                  current={activePhaseArtifact}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetaRow label="Estado" value={summarizeArtifactStatus(activePhaseArtifact.status)} />
                <MetaRow label="Modelo" value={activePhaseArtifact.modelName ?? "Manual"} />
                <MetaRow label="Creado" value={formatDateTime(activePhaseArtifact.createdAt)} />
                <MetaRow label="Prompt version" value={activePhaseArtifact.promptVersion ?? "Sin versión"} />
              </div>
            </div>
          ) : null}
        </CardContent>

        <div className="border-t border-[rgba(199,196,216,0.12)] px-5 pb-5 pt-1 md:px-6">
          <div className="flex gap-3 overflow-x-auto py-4">
            {phaseStates.map(({ phase, current, approved }, index) => (
              <StageTabButton
                key={phase.key}
                episodeId={episode.id}
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
          <AlertTitle>{message.title}</AlertTitle>
          <AlertDescription>{message.message}</AlertDescription>
        </Alert>
      ) : null}

      {longRunningAction ? (
        <Alert className="py-3">
          <LoaderCircleIcon className="animate-spin" />
          <AlertTitle>{longRunningAction.label}</AlertTitle>
          <AlertDescription>
            Esta tarea puede tardar un poco. El workspace se refrescará al terminar.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="min-w-0">{renderActiveStage()}</div>
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
  pendingActionId,
  versionState,
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
  pendingActionId: string | null;
  versionState: ArtifactVersionState;
  onRunAction: RunAction;
}) {
  const modelValue = episode.modelConfig[`${stage}Model` as keyof typeof episode.modelConfig];
  const generateActionId = `generate-${stage}`;
  const generating = pendingActionId === generateActionId;
  const scopeKey = getVersionScopeKey(stage);
  const activeArtifact = getSelectedArtifact(
    history,
    versionState.selectedArtifactIds[scopeKey],
  );

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
                activeArtifactId={activeArtifact?.id ?? null}
                pendingActionId={pendingActionId}
                onSelectArtifact={(artifactId) =>
                  versionState.onSelectArtifact(scopeKey, artifactId)
                }
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
            pendingActionId={pendingActionId}
            onRunAction={onRunAction}
          />
          <div className="rounded-[24px] bg-[rgba(239,244,255,0.92)] p-5">
            <p className="editorial-kicker">Action</p>
            {generating ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Generación en curso para esta fase.
              </p>
            ) : null}
            <Button className="mt-3" onClick={onGenerate} disabled={!canGenerate || generating}>
              {generating ? (
                <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
              ) : (
                <SparklesIcon data-icon="inline-start" />
              )}
              Generar {STAGE_LABELS[stage].toLowerCase()}
            </Button>
            {!canGenerate ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{disabledMessage}</p>
            ) : null}
          </div>
        </div>

        <Separator />

        {latestArtifact ? (
          <VersionedArtifactPanel
            episodeId={episode.id}
            stage={stage}
            artifacts={history}
            pendingActionId={pendingActionId}
            versionState={versionState}
            onRunAction={onRunAction}
          />
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
