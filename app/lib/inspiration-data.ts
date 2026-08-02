import {
  createInspirationCasesDateIndexSql,
  createInspirationCasesTableSql,
} from "../../db/schema";
import type { D1Binding } from "./runtime";

export type InspirationCaseRecord = {
  id: string;
  tab: "featured" | "image" | "video";
  mode: "image" | "video" | "listing";
  skill: string;
  title: string;
  description: string;
  prompt: string;
  images: string[];
  inputImages: string[];
  layout: "suite" | "portrait" | "landscape";
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
    tab: item.tab === "video" || item.tab === "featured" ? item.tab : "image",
    mode: item.mode === "video" || item.mode === "listing" ? item.mode : "image",
    skill: cleanText(item.skill, 80) || "white-background-image",
    title,
    description: cleanText(item.description, 180),
    prompt,
    images,
    inputImages: imageList(item.inputImages),
    layout: item.layout === "suite" || item.layout === "portrait" ? item.layout : "landscape",
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
