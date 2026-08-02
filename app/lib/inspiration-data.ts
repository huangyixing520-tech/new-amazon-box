import {
  createInspirationCasesDateIndexSql,
  createInspirationCasesTableSql,
} from "../../db/schema";
import type { D1Binding } from "./runtime";

export type InspirationCaseRecord = {
  id: string;
  tabs: Array<"featured" | "image" | "video">;
  mode: "image" | "video" | "listing";
  skill: string;
  title: string;
  description: string;
  prompt: string;
  images: string[];
  inputImages: string[];
  layout: "suite" | "portrait" | "landscape";
  orderByTab: Partial<Record<"featured" | "image" | "video", number>>;
  createdAt: string;
};

type CaseRow = { case_json: string };

export async function ensureInspirationCasesSchema(db: D1Binding) {
  await db.batch([
    db.prepare(createInspirationCasesTableSql),
    db.prepare(createInspirationCasesDateIndexSql),
  ]);
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function imageList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string =>
    typeof item === "string" && item.startsWith("/api/inspiration/media?key="),
  ).slice(0, 9);
}

function tabList(value: unknown, legacyTab: unknown) {
  const candidates = Array.isArray(value) ? value : [legacyTab];
  const tabs = candidates.filter((item): item is "featured" | "image" | "video" =>
    item === "featured" || item === "image" || item === "video",
  );
  return [...new Set(tabs.length ? tabs : ["image" as const])];
}

function orderMap(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const result: InspirationCaseRecord["orderByTab"] = {};
  for (const tab of ["featured", "image", "video"] as const) {
    if (Number.isFinite(source[tab])) result[tab] = Number(source[tab]);
  }
  return result;
}

export function normalizeInspirationCase(value: unknown): InspirationCaseRecord | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const images = imageList(item.images);
  const id = cleanText(item.id, 80);
  const title = cleanText(item.title, 80);
  const prompt = cleanText(item.prompt, 1600);
  if (!id || !title || !prompt || !images.length) return null;
  return {
    id,
    tabs: tabList(item.tabs, item.tab),
    mode: item.mode === "video" || item.mode === "listing" ? item.mode : "image",
    skill: cleanText(item.skill, 80) || "white-background-image",
    title,
    description: cleanText(item.description, 180),
    prompt,
    images,
    inputImages: imageList(item.inputImages),
    layout: item.layout === "suite" || item.layout === "portrait" ? item.layout : "landscape",
    orderByTab: orderMap(item.orderByTab),
    createdAt: cleanText(item.createdAt, 40) || new Date().toISOString(),
  };
}

export async function loadInspirationCases(db?: D1Binding) {
  if (!db) return [];
  await ensureInspirationCasesSchema(db);
  const rows = await db.prepare(
    "SELECT case_json FROM inspiration_cases ORDER BY created_at DESC",
  ).all<CaseRow>();
  return (rows.results ?? [])
    .map((row) => {
      try { return normalizeInspirationCase(JSON.parse(row.case_json)); }
      catch { return null; }
    })
    .filter((item): item is InspirationCaseRecord => Boolean(item));
}

export async function saveInspirationCase(
  db: D1Binding,
  value: InspirationCaseRecord,
  createdBy: string,
) {
  await ensureInspirationCasesSchema(db);
  await db.prepare(`
    INSERT INTO inspiration_cases (id, case_json, created_at, created_by)
    VALUES (?, ?, ?, ?)
  `).bind(value.id, JSON.stringify(value), value.createdAt, createdBy).run();
  return value;
}

export async function updateInspirationCase(
  db: D1Binding,
  value: InspirationCaseRecord,
  updatedBy: string,
) {
  await ensureInspirationCasesSchema(db);
  await db.prepare(`
    UPDATE inspiration_cases SET case_json = ?, created_by = ? WHERE id = ?
  `).bind(JSON.stringify(value), updatedBy, value.id).run();
  return value;
}

export async function reorderInspirationCases(
  db: D1Binding,
  tab: "featured" | "image" | "video",
  orderedIds: string[],
  updatedBy: string,
) {
  const cases = await loadInspirationCases(db);
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  const updates = cases
    .filter((item) => positions.has(item.id))
    .map((item) => db.prepare(
      "UPDATE inspiration_cases SET case_json = ?, created_by = ? WHERE id = ?",
    ).bind(JSON.stringify({
      ...item,
      orderByTab: { ...item.orderByTab, [tab]: positions.get(item.id) },
    }), updatedBy, item.id));
  if (updates.length) await db.batch(updates);
  return loadInspirationCases(db);
}
