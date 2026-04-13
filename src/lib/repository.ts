import { randomUUID } from "node:crypto";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { databaseReady, db } from "@/lib/db";
import {
  type ArtifactRow,
  type ArtifactStageKey,
  type ArtifactStatus,
  type EpisodeModelConfig,
  type EpisodeRow,
  type EpisodeStatus,
  type EpisodeType,
  type SourceRow,
  createDefaultModelConfig,
  parseModelConfig,
  safeJsonParse,
} from "@/lib/podcast";
import { artifactsTable, episodesTable, sourcesTable } from "@/lib/schema";

type CreateEpisodeInput = {
  topic: string;
  episodeType: EpisodeType;
  targetMinutes: number;
  angleHint: string | null;
  editorialNotes: string | null;
  sources: Array<{ label: string | null; rawText: string }>;
};

function nowIso() {
  return new Date().toISOString();
}

function mapEpisode(row: typeof episodesTable.$inferSelect): EpisodeRow {
  return {
    id: row.id,
    topic: row.topic,
    episodeType: row.episodeType as EpisodeType,
    targetMinutes: row.targetMinutes,
    angleHint: row.angleHint,
    editorialNotes: row.editorialNotes,
    modelConfig: parseModelConfig(row.modelConfigJson),
    status: row.status as EpisodeStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSource(row: typeof sourcesTable.$inferSelect): SourceRow {
  return {
    id: row.id,
    episodeId: row.episodeId,
    orderIndex: row.orderIndex,
    label: row.label,
    rawText: row.rawText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapArtifact(row: typeof artifactsTable.$inferSelect): ArtifactRow {
  return {
    id: row.id,
    episodeId: row.episodeId,
    sourceId: row.sourceId,
    stage: row.stage as ArtifactStageKey,
    status: row.status as ArtifactStatus,
    format: "json",
    modelName: row.modelName,
    promptVersion: row.promptVersion,
    basedOnArtifactIds: safeJsonParse(row.basedOnArtifactIdsJson, [] as string[]),
    originalContent: row.originalContent,
    currentContent: row.currentContent,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listEpisodes() {
  await databaseReady;
  const rows = await db
    .select({
      id: episodesTable.id,
      topic: episodesTable.topic,
      episodeType: episodesTable.episodeType,
      targetMinutes: episodesTable.targetMinutes,
      angleHint: episodesTable.angleHint,
      editorialNotes: episodesTable.editorialNotes,
      modelConfigJson: episodesTable.modelConfigJson,
      status: episodesTable.status,
      createdAt: episodesTable.createdAt,
      updatedAt: episodesTable.updatedAt,
      sourceCount: sql<number>`(
        select count(*) from ${sourcesTable}
        where ${sourcesTable.episodeId} = ${episodesTable.id}
      )`,
    })
    .from(episodesTable)
    .orderBy(desc(episodesTable.updatedAt));

  return rows.map((row) => ({
    ...mapEpisode(row),
    sourceCount: row.sourceCount,
  }));
}

export async function createEpisode(input: CreateEpisodeInput) {
  await databaseReady;
  const episodeId = randomUUID();
  const timestamp = nowIso();
  const modelConfig = createDefaultModelConfig();

  await db.transaction(async (tx) => {
    await tx.insert(episodesTable).values({
      id: episodeId,
      topic: input.topic,
      episodeType: input.episodeType,
      targetMinutes: input.targetMinutes,
      angleHint: input.angleHint,
      editorialNotes: input.editorialNotes,
      modelConfigJson: JSON.stringify(modelConfig),
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    if (input.sources.length > 0) {
      await tx.insert(sourcesTable).values(
        input.sources.map((source, index) => ({
          id: randomUUID(),
          episodeId,
          orderIndex: index,
          label: source.label,
          rawText: source.rawText,
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
      );
    }
  });

  return episodeId;
}

export async function getEpisode(episodeId: string) {
  await databaseReady;
  const row = await db.query.episodesTable.findFirst({
    where: eq(episodesTable.id, episodeId),
  });

  return row ? mapEpisode(row) : null;
}

export async function getEpisodeWorkspace(episodeId: string) {
  await databaseReady;
  const [episode, sources, artifacts] = await Promise.all([
    getEpisode(episodeId),
    db.query.sourcesTable.findMany({
      where: eq(sourcesTable.episodeId, episodeId),
      orderBy: (table, helpers) => [helpers.asc(table.orderIndex)],
    }),
    db.query.artifactsTable.findMany({
      where: eq(artifactsTable.episodeId, episodeId),
      orderBy: (table, helpers) => [helpers.desc(table.createdAt)],
    }),
  ]);

  if (!episode) {
    return null;
  }

  return {
    episode,
    sources: sources.map(mapSource),
    artifacts: artifacts.map(mapArtifact),
  };
}

export async function updateEpisodeModels(
  episodeId: string,
  modelConfig: EpisodeModelConfig,
) {
  await databaseReady;
  const timestamp = nowIso();
  await db
    .update(episodesTable)
    .set({
      modelConfigJson: JSON.stringify(modelConfig),
      updatedAt: timestamp,
    })
    .where(eq(episodesTable.id, episodeId));
}

export async function setEpisodeStatus(episodeId: string, status: EpisodeStatus) {
  await databaseReady;
  await db
    .update(episodesTable)
    .set({
      status,
      updatedAt: nowIso(),
    })
    .where(eq(episodesTable.id, episodeId));
}

export async function addSource(episodeId: string) {
  await databaseReady;
  const existing = await db.query.sourcesTable.findMany({
    where: eq(sourcesTable.episodeId, episodeId),
    orderBy: (table, helpers) => [helpers.desc(table.orderIndex)],
    limit: 1,
  });

  const nextIndex = existing[0]?.orderIndex ? existing[0].orderIndex + 1 : 0;
  const timestamp = nowIso();

  await db.insert(sourcesTable).values({
    id: randomUUID(),
    episodeId,
    orderIndex: nextIndex,
    label: `Fuente ${nextIndex + 1}`,
    rawText: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await setEpisodeStatus(episodeId, "draft");
}

export async function updateSource(
  sourceId: string,
  values: { label: string | null; rawText: string },
) {
  await databaseReady;
  await db
    .update(sourcesTable)
    .set({
      label: values.label,
      rawText: values.rawText,
      updatedAt: nowIso(),
    })
    .where(eq(sourcesTable.id, sourceId));
}

export async function deleteSource(sourceId: string) {
  await databaseReady;
  const source = await db.query.sourcesTable.findFirst({
    where: eq(sourcesTable.id, sourceId),
  });

  if (!source) {
    return;
  }

  await db.delete(sourcesTable).where(eq(sourcesTable.id, sourceId));
  await setEpisodeStatus(source.episodeId, "draft");
}

type CreateArtifactInput = {
  episodeId: string;
  stage: ArtifactStageKey;
  sourceId?: string | null;
  status: ArtifactStatus;
  modelName: string | null;
  promptVersion: string;
  basedOnArtifactIds: string[];
  content: string;
};

export async function createArtifact(input: CreateArtifactInput) {
  await databaseReady;
  const timestamp = nowIso();
  const artifactId = randomUUID();

  await db.insert(artifactsTable).values({
    id: artifactId,
    episodeId: input.episodeId,
    sourceId: input.sourceId ?? null,
    stage: input.stage,
    status: input.status,
    format: "json",
    modelName: input.modelName,
    promptVersion: input.promptVersion,
    basedOnArtifactIdsJson: JSON.stringify(input.basedOnArtifactIds),
    originalContent: input.content,
    currentContent: input.content,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await setEpisodeStatus(input.episodeId, "in_progress");
  return artifactId;
}

export async function markArtifactFailed(
  artifactId: string,
  message: string,
  episodeId: string,
  stage: ArtifactStageKey,
  modelName: string | null,
) {
  await databaseReady;
  const content = JSON.stringify({ error: message }, null, 2);
  const timestamp = nowIso();

  await db.insert(artifactsTable).values({
    id: artifactId,
    episodeId,
    sourceId: null,
    stage,
    status: "failed",
    format: "json",
    modelName,
    promptVersion: "v1",
    basedOnArtifactIdsJson: "[]",
    originalContent: content,
    currentContent: content,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await setEpisodeStatus(episodeId, "blocked");
}

export async function updateArtifactContent(artifactId: string, content: string) {
  await databaseReady;
  await db
    .update(artifactsTable)
    .set({
      currentContent: content,
      status: "edited",
      updatedAt: nowIso(),
    })
    .where(eq(artifactsTable.id, artifactId));
}

export async function approveArtifact(artifactId: string) {
  await databaseReady;
  await db
    .update(artifactsTable)
    .set({
      status: "approved",
      updatedAt: nowIso(),
    })
    .where(eq(artifactsTable.id, artifactId));
}

export async function getArtifactById(artifactId: string) {
  await databaseReady;
  const artifact = await db.query.artifactsTable.findFirst({
    where: eq(artifactsTable.id, artifactId),
  });

  return artifact ? mapArtifact(artifact) : null;
}

export async function revertArtifact(artifactId: string) {
  await databaseReady;
  const artifact = await getArtifactById(artifactId);

  if (!artifact) {
    return null;
  }

  const timestamp = nowIso();
  const newId = randomUUID();

  await db.insert(artifactsTable).values({
    id: newId,
    episodeId: artifact.episodeId,
    sourceId: artifact.sourceId,
    stage: artifact.stage,
    status: "edited",
    format: "json",
    modelName: artifact.modelName,
    promptVersion: artifact.promptVersion,
    basedOnArtifactIdsJson: JSON.stringify([artifact.id]),
    originalContent: artifact.currentContent,
    currentContent: artifact.currentContent,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return newId;
}

export async function getApprovedArtifact(
  episodeId: string,
  stage: ArtifactStageKey,
  sourceId?: string,
) {
  await databaseReady;
  const where = sourceId
    ? and(
        eq(artifactsTable.episodeId, episodeId),
        eq(artifactsTable.stage, stage),
        eq(artifactsTable.sourceId, sourceId),
        eq(artifactsTable.status, "approved"),
      )
    : and(
        eq(artifactsTable.episodeId, episodeId),
        eq(artifactsTable.stage, stage),
        isNull(artifactsTable.sourceId),
        eq(artifactsTable.status, "approved"),
      );

  const artifact = await db.query.artifactsTable.findFirst({
    where,
    orderBy: (table, helpers) => [helpers.desc(table.createdAt)],
  });

  return artifact ? mapArtifact(artifact) : null;
}

export async function getLatestArtifact(
  episodeId: string,
  stage: ArtifactStageKey,
  sourceId?: string,
) {
  await databaseReady;
  const where = sourceId
    ? and(
        eq(artifactsTable.episodeId, episodeId),
        eq(artifactsTable.stage, stage),
        eq(artifactsTable.sourceId, sourceId),
      )
    : and(
        eq(artifactsTable.episodeId, episodeId),
        eq(artifactsTable.stage, stage),
        isNull(artifactsTable.sourceId),
      );

  const artifact = await db.query.artifactsTable.findFirst({
    where,
    orderBy: (table, helpers) => [helpers.desc(table.createdAt)],
  });

  return artifact ? mapArtifact(artifact) : null;
}

export async function getSourceArtifacts(episodeId: string, sourceId: string) {
  await databaseReady;
  const rows = await db.query.artifactsTable.findMany({
    where: and(
      eq(artifactsTable.episodeId, episodeId),
      eq(artifactsTable.stage, "extraction"),
      eq(artifactsTable.sourceId, sourceId),
    ),
    orderBy: (table, helpers) => [helpers.desc(table.createdAt)],
  });

  return rows.map(mapArtifact);
}

export async function touchEpisode(episodeId: string) {
  await databaseReady;
  await db
    .update(episodesTable)
    .set({
      updatedAt: nowIso(),
    })
    .where(eq(episodesTable.id, episodeId));
}
