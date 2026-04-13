"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  generateAudit,
  generateConsolidation,
  generateOutline,
  generateScript,
  generateSourceExtraction,
  getPromptVersion,
} from "@/lib/gemini";
import {
  type ArtifactPayloadByStage,
  type ArtifactStageKey,
  type EpisodeModelConfig,
  EPISODE_TYPES,
  createEpisodeBrief,
  getModelConfigKey,
  isAllowedModel,
  parseArtifactContent,
  scriptAuditSchema,
  serializeArtifactContent,
  type SourceExtraction,
} from "@/lib/podcast";
import {
  addSource,
  approveArtifact,
  createArtifact,
  createEpisode,
  deleteSource,
  getApprovedArtifact,
  getArtifactById,
  getEpisode,
  getEpisodeWorkspace,
  revertArtifact,
  setEpisodeStatus,
  touchEpisode,
  updateArtifactContent,
  updateEpisodeModels,
  updateSource,
} from "@/lib/repository";

type ActionResult = {
  ok: boolean;
  message: string;
};

function success(message: string): ActionResult {
  return { ok: true, message };
}

function failure(message: string): ActionResult {
  return { ok: false, message };
}

function ensurePath(episodeId: string) {
  revalidatePath("/");
  revalidatePath(`/episodes/${episodeId}`);
}

function parseString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseNullable(value: FormDataEntryValue | null) {
  const parsed = parseString(value);
  return parsed ? parsed : null;
}

async function getRequiredEpisode(episodeId: string) {
  const episode = await getEpisode(episodeId);

  if (!episode) {
    throw new Error("No se ha encontrado el episodio.");
  }

  return episode;
}

function parseSources(formData: FormData) {
  const sourceEntries = formData.getAll("source").map((entry) => {
    if (typeof entry !== "string") {
      return null;
    }

    const parsed = JSON.parse(entry) as { label: string | null; rawText: string };
    const rawText = parsed.rawText.trim();

    if (!rawText) {
      return null;
    }

    return {
      label: parsed.label?.trim() ? parsed.label.trim() : null,
      rawText,
    };
  });

  return sourceEntries.filter(Boolean) as Array<{ label: string | null; rawText: string }>;
}

function getExtractionInput(extraction: SourceExtraction) {
  return {
    sourceId: extraction.sourceId,
    sourceSummary: extraction.sourceSummary,
    claims: extraction.claims.map((claim) => ({
      ref: `${extraction.sourceId}:${claim.claimId}`,
      text: claim.text,
      importance: claim.importance,
      kind: claim.kind,
      evidenceQuote: claim.evidenceQuote,
    })),
    notableDetails: extraction.notableDetails,
    anecdotes: extraction.anecdotes,
    uncertainties: extraction.uncertainties,
    biasSignals: extraction.biasSignals,
    mustKeep: extraction.mustKeep,
  };
}

export async function createEpisodeAction(formData: FormData) {
  const topic = parseString(formData.get("topic"));
  const episodeType = parseString(formData.get("episodeType"));
  const targetMinutes = Number.parseInt(parseString(formData.get("targetMinutes")), 10);
  const sources = parseSources(formData);

  if (!topic) {
    throw new Error("El topic es obligatorio.");
  }

  if (!EPISODE_TYPES.includes(episodeType as (typeof EPISODE_TYPES)[number])) {
    throw new Error("Tipo de episodio no válido.");
  }

  if (!Number.isFinite(targetMinutes) || targetMinutes < 1) {
    throw new Error("La duración objetivo no es válida.");
  }

  if (sources.length < 1 || sources.length > 5) {
    throw new Error("Debes proporcionar entre 1 y 5 fuentes.");
  }

  const episodeId = await createEpisode({
    topic,
    episodeType: episodeType as (typeof EPISODE_TYPES)[number],
    targetMinutes,
    angleHint: parseNullable(formData.get("angleHint")),
    editorialNotes: parseNullable(formData.get("editorialNotes")),
    sources,
  });

  ensurePath(episodeId);
  redirect(`/episodes/${episodeId}`);
}

export async function updateEpisodeModelAction(formData: FormData) {
  const episodeId = parseString(formData.get("episodeId"));
  const stage = parseString(formData.get("stage")) as ArtifactStageKey;
  const model = parseString(formData.get("model"));

  try {
    const episode = await getRequiredEpisode(episodeId);

    if (!isAllowedModel(model)) {
      return failure("Modelo no permitido.");
    }

    const nextConfig: EpisodeModelConfig = {
      ...episode.modelConfig,
      [getModelConfigKey(stage)]: model,
    };

    await updateEpisodeModels(episodeId, nextConfig);
    ensurePath(episodeId);
    return success("Modelo actualizado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo actualizar el modelo.");
  }
}

export async function saveSourceAction(formData: FormData) {
  const sourceId = parseString(formData.get("sourceId"));
  const episodeId = parseString(formData.get("episodeId"));

  try {
    await updateSource(sourceId, {
      label: parseNullable(formData.get("label")),
      rawText: parseString(formData.get("rawText")),
    });
    await touchEpisode(episodeId);
    ensurePath(episodeId);
    return success("Fuente guardada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar la fuente.");
  }
}

export async function addSourceAction(formData: FormData) {
  const episodeId = parseString(formData.get("episodeId"));

  try {
    const workspace = await getEpisodeWorkspace(episodeId);

    if (!workspace) {
      return failure("No se ha encontrado el episodio.");
    }

    if (workspace.sources.length >= 5) {
      return failure("La v1 admite un máximo de 5 fuentes.");
    }

    await addSource(episodeId);
    ensurePath(episodeId);
    return success("Fuente añadida.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo añadir la fuente.");
  }
}

export async function deleteSourceAction(formData: FormData) {
  const episodeId = parseString(formData.get("episodeId"));
  const sourceId = parseString(formData.get("sourceId"));

  try {
    const workspace = await getEpisodeWorkspace(episodeId);

    if (!workspace) {
      return failure("No se ha encontrado el episodio.");
    }

    if (workspace.sources.length <= 1) {
      return failure("El episodio necesita al menos una fuente.");
    }

    await deleteSource(sourceId);
    ensurePath(episodeId);
    return success("Fuente eliminada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo eliminar la fuente.");
  }
}

export async function saveArtifactAction(formData: FormData) {
  const artifactId = parseString(formData.get("artifactId"));
  const episodeId = parseString(formData.get("episodeId"));

  try {
    const artifact = await getArtifactById(artifactId);

    if (!artifact) {
      return failure("No se ha encontrado la versión.");
    }

    let content = parseString(formData.get("content"));

    if (artifact.stage === "script") {
      const existing = parseArtifactContent("script", artifact.currentContent);
      const next = {
        ...existing,
        title: parseString(formData.get("title")),
        scriptMarkdown: parseString(formData.get("scriptMarkdown")),
      };

      content = serializeArtifactContent("script", next);
    } else {
      parseArtifactContent(artifact.stage, content);
    }

    await updateArtifactContent(artifactId, content);
    ensurePath(episodeId);
    return success("Versión guardada.");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "No se pudo guardar la versión.",
    );
  }
}

export async function approveArtifactAction(formData: FormData) {
  const artifactId = parseString(formData.get("artifactId"));
  const episodeId = parseString(formData.get("episodeId"));

  try {
    const artifact = await getArtifactById(artifactId);

    if (!artifact) {
      return failure("No se ha encontrado la versión.");
    }

    if (artifact.stage === "audit") {
      const audit = scriptAuditSchema.parse(JSON.parse(artifact.currentContent));

      if (!audit.pass) {
        await setEpisodeStatus(episodeId, "blocked");
        ensurePath(episodeId);
        return failure(
          "La auditoría ha fallado. Revisa el guión y regenera antes de aprobar.",
        );
      }

      await setEpisodeStatus(episodeId, "ready");
    }

    await approveArtifact(artifactId);
    ensurePath(episodeId);
    return success("Versión aprobada.");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "No se pudo aprobar la versión.",
    );
  }
}

export async function revertArtifactAction(formData: FormData) {
  const artifactId = parseString(formData.get("artifactId"));
  const episodeId = parseString(formData.get("episodeId"));

  try {
    const newId = await revertArtifact(artifactId);

    if (!newId) {
      return failure("No se ha encontrado la versión a revertir.");
    }

    ensurePath(episodeId);
    return success("Se ha creado una nueva versión a partir del histórico.");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "No se pudo revertir la versión.",
    );
  }
}

export async function generateExtractionAction(formData: FormData) {
  const episodeId = parseString(formData.get("episodeId"));

  try {
    const workspace = await getEpisodeWorkspace(episodeId);

    if (!workspace) {
      return failure("No se ha encontrado el episodio.");
    }

    for (const source of workspace.sources) {
      if (!source.rawText.trim()) {
        return failure("Todas las fuentes deben tener texto antes de extraer.");
      }
    }

    const brief = createEpisodeBrief(workspace.episode);
    const model = workspace.episode.modelConfig.extractionModel;

    for (const source of workspace.sources) {
      const extraction = await generateSourceExtraction({
        model,
        brief,
        source,
      });

      await createArtifact({
        episodeId,
        sourceId: source.id,
        stage: "extraction",
        status: "generated",
        modelName: model,
        promptVersion: getPromptVersion(),
        basedOnArtifactIds: [],
        content: serializeArtifactContent("extraction", extraction),
      });
    }

    ensurePath(episodeId);
    return success("Extracciones generadas.");
  } catch (error) {
    await setEpisodeStatus(episodeId, "blocked");
    ensurePath(episodeId);
    return failure(
      error instanceof Error ? error.message : "No se pudieron generar las extracciones.",
    );
  }
}

async function getApprovedExtractionInputs(episodeId: string) {
  const workspace = await getEpisodeWorkspace(episodeId);

  if (!workspace) {
    throw new Error("No se ha encontrado el episodio.");
  }

  const extractions = [];

  for (const source of workspace.sources) {
    const artifact = await getApprovedArtifact(episodeId, "extraction", source.id);

    if (!artifact) {
      throw new Error(
        "Debes aprobar una extracción por cada fuente antes de continuar.",
      );
    }

    extractions.push(getExtractionInput(parseArtifactContent("extraction", artifact.currentContent)));
  }

  return { workspace, extractions };
}

async function createStageArtifact<TStage extends Exclude<ArtifactStageKey, "extraction">>(params: {
  episodeId: string;
  stage: TStage;
  model: string;
  basedOnArtifactIds: string[];
  payload: ArtifactPayloadByStage[TStage];
}) {
  await createArtifact({
    episodeId: params.episodeId,
    stage: params.stage,
    status: "generated",
    modelName: params.model,
    promptVersion: getPromptVersion(),
    basedOnArtifactIds: params.basedOnArtifactIds,
    content: serializeArtifactContent(params.stage, params.payload),
  });
}

export async function generateConsolidationAction(formData: FormData) {
  const episodeId = parseString(formData.get("episodeId"));

  try {
    const { workspace, extractions } = await getApprovedExtractionInputs(episodeId);
    const brief = createEpisodeBrief(workspace.episode);
    const model = workspace.episode.modelConfig.consolidationModel;
    const approvedIds = [];

    for (const source of workspace.sources) {
      const artifact = await getApprovedArtifact(episodeId, "extraction", source.id);
      if (artifact) {
        approvedIds.push(artifact.id);
      }
    }

    const consolidation = await generateConsolidation({
      model,
      brief,
      extractions,
    });

    await createStageArtifact({
      episodeId,
      stage: "consolidation",
      model,
      basedOnArtifactIds: approvedIds,
      payload: consolidation,
    });

    ensurePath(episodeId);
    return success("Consolidación generada.");
  } catch (error) {
    await setEpisodeStatus(episodeId, "blocked");
    ensurePath(episodeId);
    return failure(
      error instanceof Error ? error.message : "No se pudo generar la consolidación.",
    );
  }
}

export async function generateOutlineAction(formData: FormData) {
  const episodeId = parseString(formData.get("episodeId"));

  try {
    const { workspace } = await getApprovedExtractionInputs(episodeId);
    const approvedConsolidation = await getApprovedArtifact(
      episodeId,
      "consolidation",
    );

    if (!approvedConsolidation) {
      return failure("Debes aprobar una consolidación antes de generar el outline.");
    }

    const outline = await generateOutline({
      model: workspace.episode.modelConfig.outlineModel,
      brief: createEpisodeBrief(workspace.episode),
      consolidation: parseArtifactContent(
        "consolidation",
        approvedConsolidation.currentContent,
      ),
    });

    await createStageArtifact({
      episodeId,
      stage: "outline",
      model: workspace.episode.modelConfig.outlineModel,
      basedOnArtifactIds: [approvedConsolidation.id],
      payload: outline,
    });

    ensurePath(episodeId);
    return success("Outline generado.");
  } catch (error) {
    await setEpisodeStatus(episodeId, "blocked");
    ensurePath(episodeId);
    return failure(error instanceof Error ? error.message : "No se pudo generar el outline.");
  }
}

export async function generateScriptAction(formData: FormData) {
  const episodeId = parseString(formData.get("episodeId"));

  try {
    const { workspace, extractions } = await getApprovedExtractionInputs(episodeId);
    const approvedConsolidation = await getApprovedArtifact(
      episodeId,
      "consolidation",
    );
    const approvedOutline = await getApprovedArtifact(episodeId, "outline");

    if (!approvedConsolidation || !approvedOutline) {
      return failure(
        "Debes aprobar consolidación y outline antes de generar el guión.",
      );
    }

    const script = await generateScript({
      model: workspace.episode.modelConfig.scriptModel,
      brief: createEpisodeBrief(workspace.episode),
      extractions,
      consolidation: parseArtifactContent(
        "consolidation",
        approvedConsolidation.currentContent,
      ),
      outline: parseArtifactContent("outline", approvedOutline.currentContent),
    });

    await createStageArtifact({
      episodeId,
      stage: "script",
      model: workspace.episode.modelConfig.scriptModel,
      basedOnArtifactIds: [approvedConsolidation.id, approvedOutline.id],
      payload: script,
    });

    ensurePath(episodeId);
    return success("Guión generado.");
  } catch (error) {
    await setEpisodeStatus(episodeId, "blocked");
    ensurePath(episodeId);
    return failure(error instanceof Error ? error.message : "No se pudo generar el guión.");
  }
}

export async function generateAuditAction(formData: FormData) {
  const episodeId = parseString(formData.get("episodeId"));

  try {
    const { workspace, extractions } = await getApprovedExtractionInputs(episodeId);
    const approvedConsolidation = await getApprovedArtifact(
      episodeId,
      "consolidation",
    );
    const approvedOutline = await getApprovedArtifact(episodeId, "outline");
    const approvedScript = await getApprovedArtifact(episodeId, "script");

    if (!approvedConsolidation || !approvedOutline || !approvedScript) {
      return failure(
        "Debes aprobar consolidación, outline y guión antes de generar la auditoría.",
      );
    }

    const audit = await generateAudit({
      model: workspace.episode.modelConfig.auditModel,
      brief: createEpisodeBrief(workspace.episode),
      extractions,
      consolidation: parseArtifactContent(
        "consolidation",
        approvedConsolidation.currentContent,
      ),
      outline: parseArtifactContent("outline", approvedOutline.currentContent),
      script: parseArtifactContent("script", approvedScript.currentContent),
    });

    await createStageArtifact({
      episodeId,
      stage: "audit",
      model: workspace.episode.modelConfig.auditModel,
      basedOnArtifactIds: [
        approvedConsolidation.id,
        approvedOutline.id,
        approvedScript.id,
      ],
      payload: audit,
    });

    if (audit.pass) {
      await setEpisodeStatus(episodeId, "in_progress");
    } else {
      await setEpisodeStatus(episodeId, "blocked");
    }

    ensurePath(episodeId);
    return success("Auditoría generada.");
  } catch (error) {
    await setEpisodeStatus(episodeId, "blocked");
    ensurePath(episodeId);
    return failure(
      error instanceof Error ? error.message : "No se pudo generar la auditoría.",
    );
  }
}
