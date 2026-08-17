import {
  createAnalyticsEventsDateIndexSql,
  createAnalyticsEventsTableSql,
  createAnalyticsEventsUserIndexSql,
  createConversationTurnsIndexSql,
  createConversationTurnsTableSql,
  createConversationReadStatesTableSql,
  createConversationsTableSql,
  createConversationsUserIndexSql,
  createGenerationRecordsDateIndexSql,
  createGenerationRecordsTableSql,
  createGenerationRecordsUserIndexSql,
} from "../../db/schema";
import { ensureIdentitySchema } from "./auth";
import type { D1Binding } from "./runtime";

export async function ensureProductDataSchema(db: D1Binding) {
  await ensureIdentitySchema(db);
  await db.batch([
    db.prepare(createConversationsTableSql),
    db.prepare(createConversationsUserIndexSql),
    db.prepare(createConversationReadStatesTableSql),
    db.prepare(createConversationTurnsTableSql),
    db.prepare(createConversationTurnsIndexSql),
    db.prepare(createAnalyticsEventsTableSql),
    db.prepare(createAnalyticsEventsDateIndexSql),
    db.prepare(createAnalyticsEventsUserIndexSql),
    db.prepare(createGenerationRecordsTableSql),
    db.prepare(createGenerationRecordsUserIndexSql),
    db.prepare(createGenerationRecordsDateIndexSql),
  ]);
  try {
    await db.prepare(
      "ALTER TABLE analytics_events ADD COLUMN generation_id TEXT",
    ).run();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("duplicate column")) throw error;
  }
}

export function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
