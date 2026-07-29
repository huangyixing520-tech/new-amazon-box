import {
  createAnalyticsEventsDateIndexSql,
  createAnalyticsEventsTableSql,
  createAnalyticsEventsUserIndexSql,
  createConversationTurnsIndexSql,
  createConversationTurnsTableSql,
  createConversationsTableSql,
  createConversationsUserIndexSql,
} from "../../db/schema";
import { ensureIdentitySchema } from "./auth";
import type { D1Binding } from "./runtime";

export async function ensureProductDataSchema(db: D1Binding) {
  await ensureIdentitySchema(db);
  await db.batch([
    db.prepare(createConversationsTableSql),
    db.prepare(createConversationsUserIndexSql),
    db.prepare(createConversationTurnsTableSql),
    db.prepare(createConversationTurnsIndexSql),
    db.prepare(createAnalyticsEventsTableSql),
    db.prepare(createAnalyticsEventsDateIndexSql),
    db.prepare(createAnalyticsEventsUserIndexSql),
  ]);
}

export function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
