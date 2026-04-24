import { z } from "zod";

export const STAGE_ORDER = [
  "sources",
  "extraction",
  "consolidation",
  "outline",
  "script",
  "audit",
] as const;

export const ARTIFACT_STAGES = [
  "extraction",
  "consolidation",
  "outline",
  "script",
  "audit",
] as const;

export type StageKey = (typeof STAGE_ORDER)[number];
export type ArtifactStageKey = (typeof ARTIFACT_STAGES)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  sources: "Fuentes",
  extraction: "Extracción",
  consolidation: "Consolidación",
  outline: "Outline",
  script: "Guión",
  audit: "Auditoría",
};

export const DEFAULT_ALLOWED_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
] as const;

function parseAllowedModels() {
  const raw = process.env.GEMINI_ALLOWED_MODELS?.trim();

  if (!raw) {
    return [...DEFAULT_ALLOWED_MODELS];
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export const ALLOWED_MODELS = parseAllowedModels();

export const DEFAULT_MODEL_BY_STAGE = {
  extraction: process.env.GEMINI_DEFAULT_EXTRACTION_MODEL ?? "gemini-3.1-pro-preview",
  consolidation:
    process.env.GEMINI_DEFAULT_CONSOLIDATION_MODEL ?? "gemini-3.1-pro-preview",
  outline: process.env.GEMINI_DEFAULT_OUTLINE_MODEL ?? "gemini-3.1-pro-preview",
  script: process.env.GEMINI_DEFAULT_SCRIPT_MODEL ?? "gemini-3.1-pro-preview",
  audit: process.env.GEMINI_DEFAULT_AUDIT_MODEL ?? "gemini-3.1-pro-preview",
} satisfies Record<ArtifactStageKey, string>;

export const EPISODE_TYPES = ["summary", "deep_dive"] as const;
export type EpisodeType = (typeof EPISODE_TYPES)[number];

export const ARTIFACT_STATUSES = [
  "generated",
  "edited",
  "approved",
  "failed",
] as const;
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

export const EPISODE_STATUSES = [
  "draft",
  "in_progress",
  "ready",
  "blocked",
] as const;
export type EpisodeStatus = (typeof EPISODE_STATUSES)[number];

export type EpisodeModelConfig = {
  extractionModel: string;
  consolidationModel: string;
  outlineModel: string;
  scriptModel: string;
  auditModel: string;
};

export function createDefaultModelConfig(): EpisodeModelConfig {
  return {
    extractionModel: DEFAULT_MODEL_BY_STAGE.extraction,
    consolidationModel: DEFAULT_MODEL_BY_STAGE.consolidation,
    outlineModel: DEFAULT_MODEL_BY_STAGE.outline,
    scriptModel: DEFAULT_MODEL_BY_STAGE.script,
    auditModel: DEFAULT_MODEL_BY_STAGE.audit,
  };
}

export function getModelConfigKey(stage: ArtifactStageKey): keyof EpisodeModelConfig {
  return `${stage}Model` as keyof EpisodeModelConfig;
}

export function isAllowedModel(modelName: string) {
  return ALLOWED_MODELS.includes(modelName);
}

export const episodeBriefSchema = z.object({
  topic: z.string().min(1),
  episodeType: z.enum(EPISODE_TYPES),
  targetMinutes: z.number().int().min(1).max(240),
  angleHint: z.string().nullable(),
  editorialNotes: z.string().nullable(),
});

const modelIntegerSchema = z.coerce.number().int();
const modelNumberSchema = z.coerce.number();

export const sourceExtractionSchema = z.object({
  sourceId: z.string().min(1),
  sourceSummary: z.string().min(1),
  claims: z.array(
    z.object({
      claimId: z.string().min(1),
      text: z.string().min(1),
      importance: modelIntegerSchema.min(1).max(5),
      kind: z.enum(["fact", "interpretation", "prediction", "opinion"]),
      evidenceQuote: z.string().min(1),
    }),
  ),
  notableDetails: z.array(z.string()),
  anecdotes: z.array(z.string()),
  uncertainties: z.array(z.string()),
  biasSignals: z.array(z.string()),
  mustKeep: z.array(
    z.object({
      item: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
});

export const consolidationSchema = z.object({
  canonicalTopic: z.string().min(1),
  recommendedAngle: z.string().min(1),
  thesis: z.string().min(1),
  corePoints: z.array(
    z.object({
      pointId: z.string().min(1),
      text: z.string().min(1),
      sourceClaimRefs: z.array(z.string().min(1)),
    }),
  ),
  secondaryPoints: z.array(
    z.object({
      pointId: z.string().min(1),
      text: z.string().min(1),
      sourceClaimRefs: z.array(z.string().min(1)),
    }),
  ),
  contradictions: z.array(
    z.object({
      text: z.string().min(1),
      sourceClaimRefs: z.array(z.string().min(1)),
      resolutionNote: z.string().nullable(),
    }),
  ),
  missingQuestions: z.array(z.string()),
  mustCoverClaimRefs: z.array(z.string().min(1)),
});

export const episodeOutlineSchema = z.object({
  hook: z.string().min(1),
  opening: z.string().min(1),
  blocks: z.array(
    z.object({
      blockId: z.string().min(1),
      title: z.string().min(1),
      purpose: z.string().min(1),
      targetMinutes: modelNumberSchema.min(0),
      mustIncludeClaimRefs: z.array(z.string().min(1)),
      notes: z.array(z.string()),
    }),
  ),
  closing: z.string().min(1),
});

export const scriptDraftSchema = z.object({
  title: z.string().min(1),
  scriptMarkdown: z.string().min(1),
  coveredClaimRefs: z.array(z.string().min(1)),
  unresolvedWarnings: z.array(z.string()),
});

export const scriptAuditSchema = z.object({
  pass: z.boolean(),
  score: modelNumberSchema.min(0).max(100),
  missingMustKeep: z.array(z.string()),
  weaklySupportedClaims: z.array(z.string()),
  underusedSources: z.array(z.string()),
  structureProblems: z.array(z.string()),
  suggestedRepairs: z.array(z.string()),
});

export type EpisodeBrief = z.infer<typeof episodeBriefSchema>;
export type SourceExtraction = z.infer<typeof sourceExtractionSchema>;
export type Consolidation = z.infer<typeof consolidationSchema>;
export type EpisodeOutline = z.infer<typeof episodeOutlineSchema>;
export type ScriptDraft = z.infer<typeof scriptDraftSchema>;
export type ScriptAudit = z.infer<typeof scriptAuditSchema>;

export type ArtifactPayloadByStage = {
  extraction: SourceExtraction;
  consolidation: Consolidation;
  outline: EpisodeOutline;
  script: ScriptDraft;
  audit: ScriptAudit;
};

export const artifactSchemaByStage = {
  extraction: sourceExtractionSchema,
  consolidation: consolidationSchema,
  outline: episodeOutlineSchema,
  script: scriptDraftSchema,
  audit: scriptAuditSchema,
} satisfies Record<ArtifactStageKey, z.ZodTypeAny>;

export type ArtifactRow = {
  id: string;
  episodeId: string;
  sourceId: string | null;
  stage: ArtifactStageKey;
  status: ArtifactStatus;
  format: "json";
  modelName: string | null;
  promptVersion: string | null;
  basedOnArtifactIds: string[];
  originalContent: string;
  currentContent: string;
  createdAt: string;
  updatedAt: string;
};

export type SourceRow = {
  id: string;
  episodeId: string;
  orderIndex: number;
  label: string | null;
  rawText: string;
  createdAt: string;
  updatedAt: string;
};

export type EpisodeRow = {
  id: string;
  topic: string;
  episodeType: EpisodeType;
  targetMinutes: number;
  angleHint: string | null;
  editorialNotes: string | null;
  modelConfig: EpisodeModelConfig;
  status: EpisodeStatus;
  createdAt: string;
  updatedAt: string;
};

export function parseModelConfig(raw: string | null | undefined): EpisodeModelConfig {
  if (!raw) {
    return createDefaultModelConfig();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<EpisodeModelConfig>;
    return {
      extractionModel:
        parsed.extractionModel ?? createDefaultModelConfig().extractionModel,
      consolidationModel:
        parsed.consolidationModel ?? createDefaultModelConfig().consolidationModel,
      outlineModel: parsed.outlineModel ?? createDefaultModelConfig().outlineModel,
      scriptModel: parsed.scriptModel ?? createDefaultModelConfig().scriptModel,
      auditModel: parsed.auditModel ?? createDefaultModelConfig().auditModel,
    };
  } catch {
    return createDefaultModelConfig();
  }
}

export function safeJsonParse<T>(value: string, fallback: T) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseArtifactContent<TStage extends ArtifactStageKey>(
  stage: TStage,
  raw: string,
) {
  const parsed = safeJsonParse(raw, {});
  return artifactSchemaByStage[stage].parse(parsed) as ArtifactPayloadByStage[TStage];
}

export function serializeArtifactContent<TStage extends ArtifactStageKey>(
  stage: TStage,
  value: ArtifactPayloadByStage[TStage],
) {
  return JSON.stringify(artifactSchemaByStage[stage].parse(value), null, 2);
}

export function createEpisodeBrief(episode: EpisodeRow): EpisodeBrief {
  return {
    topic: episode.topic,
    episodeType: episode.episodeType,
    targetMinutes: episode.targetMinutes,
    angleHint: episode.angleHint,
    editorialNotes: episode.editorialNotes,
  };
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function summarizeArtifactStatus(status: ArtifactStatus) {
  switch (status) {
    case "generated":
      return "Generado";
    case "edited":
      return "Editado";
    case "approved":
      return "Aprobado";
    case "failed":
      return "Fallido";
  }
}

export function summarizeEpisodeStatus(status: EpisodeStatus) {
  switch (status) {
    case "draft":
      return "Borrador";
    case "in_progress":
      return "En curso";
    case "ready":
      return "Listo";
    case "blocked":
      return "Bloqueado";
  }
}
