import type { D1Binding } from "./runtime";
import {
  DEFAULT_LANDING_CONTENT,
  normalizeLandingContent,
  type LandingContent,
} from "./landing-copy";

const createLandingContentTableSql = `
  CREATE TABLE IF NOT EXISTS landing_content (
    id TEXT PRIMARY KEY,
    content_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT
  )
`;

export async function ensureLandingContentSchema(db: D1Binding) {
  await db.prepare(createLandingContentTableSql).run();
}

export async function loadLandingContent(db?: D1Binding): Promise<LandingContent> {
  if (!db) return DEFAULT_LANDING_CONTENT;
  await ensureLandingContentSchema(db);
  const row = await db.prepare(
    "SELECT content_json FROM landing_content WHERE id = ?",
  ).bind("default").first<{ content_json: string }>();
  if (!row) return DEFAULT_LANDING_CONTENT;
  try {
    return normalizeLandingContent(JSON.parse(row.content_json));
  } catch {
    return DEFAULT_LANDING_CONTENT;
  }
}

export async function saveLandingContent(
  db: D1Binding,
  content: unknown,
  updatedBy: string,
) {
  await ensureLandingContentSchema(db);
  const normalized = normalizeLandingContent(content);
  await db.prepare(`
    INSERT INTO landing_content (id, content_json, updated_at, updated_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content_json = excluded.content_json,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).bind(
    "default",
    JSON.stringify(normalized),
    new Date().toISOString(),
    updatedBy,
  ).run();
  return normalized;
}
