import {
  createAssetsDateIndexSql,
  createAssetsTableSql,
} from "../../db/schema";
import { ensureIdentitySchema } from "./auth";
import type { D1Binding } from "./runtime";

async function addColumn(db: D1Binding, sql: string) {
  try {
    await db.prepare(sql).run();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("duplicate column")) throw error;
  }
}

export async function ensureAssetsSchema(db: D1Binding) {
  await db.batch([
    db.prepare(createAssetsTableSql),
    db.prepare(createAssetsDateIndexSql),
  ]);
  await addColumn(
    db,
    "ALTER TABLE assets ADD COLUMN role TEXT NOT NULL DEFAULT 'output'",
  );
  await addColumn(
    db,
    "ALTER TABLE assets ADD COLUMN slot_index INTEGER NOT NULL DEFAULT 0",
  );
  await ensureIdentitySchema(db);
}
