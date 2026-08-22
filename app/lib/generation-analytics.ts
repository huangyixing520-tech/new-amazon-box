import { ensureProductDataSchema } from "./product-data";
import type { D1Binding } from "./runtime";

type GenerationInput = {
  id: string;
  attemptId?: string;
  userId: string;
  requestId: string;
  mediaType: "image" | "video";
  skill: string;
  prompt: string;
  slot: number;
};

export const GENERATION_TIMEOUT_MS = 12 * 60 * 1000;

function eventId(prefix: string, ...parts: string[]) {
  return `${prefix}:${parts.join(":")}`.slice(0, 240);
}

export async function recordGenerationRequest(
  db: D1Binding,
  input: {
    userId: string;
    requestId: string;
    mediaType: "image" | "video";
    skill: string;
  },
) {
  await ensureProductDataSchema(db);
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT OR IGNORE INTO analytics_events (
      id, user_id, event_name, mode, skill, conversation_id,
      turn_id, generation_id, metadata_json, created_at
    ) VALUES (?, ?, 'generation_requested', ?, ?, NULL, ?, NULL, ?, ?)
  `).bind(
    eventId("request", input.userId, input.requestId),
    input.userId,
    input.mediaType,
    input.skill || null,
    input.requestId,
    JSON.stringify({ source: "server" }),
    now,
  ).run();
}

export async function recordGenerationStarted(
  db: D1Binding,
  input: GenerationInput,
) {
  await ensureProductDataSchema(db);
  const now = new Date().toISOString();
  const requestId = input.requestId || input.id;
  await recordGenerationRequest(db, {
    userId: input.userId,
    requestId,
    mediaType: input.mediaType,
    skill: input.skill,
  });
  const statements = [
    db.prepare(`
      INSERT INTO generation_records (
        id, user_id, request_id, media_type, skill, prompt, status,
        slot_index, created_at, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = CASE
          WHEN generation_records.status IN ('succeeded', 'failed')
            THEN generation_records.status
          ELSE 'running'
        END,
        started_at = COALESCE(generation_records.started_at, excluded.started_at)
      WHERE generation_records.user_id = excluded.user_id
    `).bind(
      input.id,
      input.userId,
      requestId,
      input.mediaType,
      input.skill || null,
      input.prompt,
      Math.max(0, input.slot),
      now,
      now,
    ),
    db.prepare(`
      INSERT OR IGNORE INTO analytics_events (
        id, user_id, event_name, mode, skill, conversation_id,
        turn_id, generation_id, metadata_json, created_at
      ) VALUES (?, ?, 'generation_clicked', ?, ?, NULL, ?, ?, ?, ?)
    `).bind(
      eventId("clicked", input.id),
      input.userId,
      input.mediaType,
      input.skill || null,
      requestId,
      input.id,
      JSON.stringify({ slot: Math.max(0, input.slot), source: "server" }),
      now,
    ),
  ];
  if (input.attemptId && input.attemptId !== input.id) {
    statements.push(db.prepare(`
      DELETE FROM generation_records
      WHERE id = ? AND user_id = ? AND status IN ('queued', 'failed')
    `).bind(input.attemptId, input.userId));
  }
  await db.batch(statements);
}

export async function recordGenerationQueued(
  db: D1Binding,
  input: GenerationInput,
) {
  await ensureProductDataSchema(db);
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO generation_records (
      id, user_id, request_id, media_type, skill, prompt, status,
      slot_index, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      skill = excluded.skill,
      prompt = excluded.prompt
    WHERE generation_records.user_id = excluded.user_id
  `).bind(
    input.id,
    input.userId,
    input.requestId || input.id,
    input.mediaType,
    input.skill || null,
    input.prompt,
    Math.max(0, input.slot),
    now,
  ).run();
}

export async function expireStaleGenerations(
  db: D1Binding,
  userId?: string,
) {
  await ensureProductDataSchema(db);
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - GENERATION_TIMEOUT_MS).toISOString();
  const userClause = userId ? " AND user_id = ?" : "";
  await db.prepare(`
    UPDATE generation_records
    SET status = 'failed', error_message = '生成超过 12 分钟未完成', completed_at = ?
    WHERE status IN ('queued', 'running') AND created_at < ?${userClause}
  `).bind(...(userId ? [now, cutoff, userId] : [now, cutoff])).run();
}

export async function markGenerationStatus(
  db: D1Binding,
  generationId: string,
  userId: string,
  status: "running" | "succeeded" | "failed",
  errorMessage = "",
) {
  await ensureProductDataSchema(db);
  const current = await db.prepare(`
    SELECT id, request_id, media_type, skill, status
    FROM generation_records
    WHERE id = ? AND user_id = ?
  `).bind(generationId, userId).first<{
    id: string;
    request_id: string;
    media_type: string;
    skill: string | null;
    status: string;
  }>();
  if (!current || ["succeeded", "failed"].includes(current.status)) return;
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE generation_records
    SET status = ?, error_message = NULLIF(?, ''),
      started_at = COALESCE(started_at, ?),
      completed_at = CASE WHEN ? IN ('succeeded', 'failed') THEN ? ELSE completed_at END
    WHERE id = ? AND user_id = ?
  `).bind(
    status,
    errorMessage.slice(0, 1000),
    now,
    status,
    now,
    generationId,
    userId,
  ).run();
  if (status === "running") return;
  const eventName = status === "succeeded"
    ? "generation_succeeded"
    : "generation_failed";
  await db.prepare(`
    INSERT OR IGNORE INTO analytics_events (
      id, user_id, event_name, mode, skill, conversation_id,
      turn_id, generation_id, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
  `).bind(
    eventId(status, generationId),
    userId,
    eventName,
    current.media_type,
    current.skill,
    current.request_id,
    generationId,
    JSON.stringify({ error: errorMessage.slice(0, 1000), source: "server" }),
    now,
  ).run();
}

export async function attachGenerationAsset(
  db: D1Binding,
  generationId: string,
  userId: string,
  assetId: string,
) {
  if (!generationId) return;
  await markGenerationStatus(db, generationId, userId, "succeeded");
  await db.prepare(`
    UPDATE generation_records SET asset_id = ?
    WHERE id = ? AND user_id = ?
  `).bind(assetId, generationId, userId).run();
}

export async function recordMediaExported(
  db: D1Binding,
  input: {
    userId: string;
    assetId: string;
    generationId?: string | null;
    mediaType: string;
  },
) {
  await ensureProductDataSchema(db);
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO analytics_events (
      id, user_id, event_name, mode, skill, conversation_id,
      turn_id, generation_id, metadata_json, created_at
    ) VALUES (?, ?, 'media_exported', ?, NULL, NULL, NULL, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    input.userId,
    input.mediaType,
    input.generationId || null,
    JSON.stringify({ assetId: input.assetId, source: "server" }),
    now,
  ).run();
}
