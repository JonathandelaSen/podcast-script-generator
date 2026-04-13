import {
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const episodesTable = sqliteTable("episodes", {
  id: text("id").primaryKey(),
  topic: text("topic").notNull(),
  episodeType: text("episode_type").notNull(),
  targetMinutes: integer("target_minutes").notNull(),
  angleHint: text("angle_hint"),
  editorialNotes: text("editorial_notes"),
  modelConfigJson: text("model_config_json").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sourcesTable = sqliteTable("sources", {
  id: text("id").primaryKey(),
  episodeId: text("episode_id")
    .notNull()
    .references(() => episodesTable.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  label: text("label"),
  rawText: text("raw_text").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const artifactsTable = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  episodeId: text("episode_id")
    .notNull()
    .references(() => episodesTable.id, { onDelete: "cascade" }),
  sourceId: text("source_id").references(() => sourcesTable.id, {
    onDelete: "cascade",
  }),
  stage: text("stage").notNull(),
  status: text("status").notNull(),
  format: text("format").notNull(),
  modelName: text("model_name"),
  promptVersion: text("prompt_version"),
  basedOnArtifactIdsJson: text("based_on_artifact_ids_json").notNull(),
  originalContent: text("original_content").notNull(),
  currentContent: text("current_content").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
