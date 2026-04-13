import fs from "node:fs";
import path from "node:path";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "@/lib/schema";

const dbFilePath = process.env.PODCAST_DB_PATH
  ? path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.PODCAST_DB_PATH)
  : path.join(
      /* turbopackIgnore: true */ process.cwd(),
      "data",
      "podcast-script-generator.db",
    );

fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

const client = createClient({
  url: `file:${dbFilePath}`,
});

let initializationPromise: Promise<void> | null = null;

async function executeWithRetry(statement: string, retries = 12) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await client.execute(statement);
      return;
    } catch (error) {
      const isBusy =
        error instanceof Error &&
        "code" in error &&
        (error as { code?: string }).code === "SQLITE_BUSY";

      if (!isBusy || attempt === retries - 1) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
}

export function ensureDatabase() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    await executeWithRetry("PRAGMA journal_mode = WAL");
    await executeWithRetry("PRAGMA busy_timeout = 5000");

    await executeWithRetry(`
      CREATE TABLE IF NOT EXISTS episodes (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        episode_type TEXT NOT NULL,
        target_minutes INTEGER NOT NULL,
        angle_hint TEXT,
        editorial_notes TEXT,
        model_config_json TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await executeWithRetry(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        order_index INTEGER NOT NULL,
        label TEXT,
        raw_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await executeWithRetry(`
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        source_id TEXT REFERENCES sources(id) ON DELETE CASCADE,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        format TEXT NOT NULL,
        model_name TEXT,
        prompt_version TEXT,
        based_on_artifact_ids_json TEXT NOT NULL,
        original_content TEXT NOT NULL,
        current_content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await executeWithRetry(`
      CREATE INDEX IF NOT EXISTS sources_episode_id_idx
      ON sources(episode_id, order_index)
    `);

    await executeWithRetry(`
      CREATE INDEX IF NOT EXISTS artifacts_lookup_idx
      ON artifacts(episode_id, stage, source_id, created_at DESC)
    `);
  })();

  return initializationPromise;
}

export const databaseReady = ensureDatabase();

export const db = drizzle(client, { schema });
