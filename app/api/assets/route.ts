import { NextResponse } from "next/server";
import {
  createAssetsDateIndexSql,
  createAssetsTableSql,
} from "../../../db/schema";

type PreparedStatement = {
  bind: (...values: unknown[]) => PreparedStatement;
  run: () => Promise<unknown>;
  all: <T>() => Promise<{ results?: T[] }>;
};

type D1Binding = {
  prepare: (sql: string) => PreparedStatement;
  batch: (statements: PreparedStatement[]) => Promise<unknown>;
};

type R2Binding = {
  put: (
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>;
};

type RuntimeBindings = {
  DB?: D1Binding;
  GENERATED_ASSETS?: R2Binding;
};

type AssetRow = {
  id: string;
  type: "image" | "video";
  title: string;
  prompt: string;
  conversation_id: string;
  turn_id: string;
  created_at: string;
};

async function runtime() {
  try {
    const workers = await import("cloudflare:workers");
    return workers.env as unknown as RuntimeBindings;
  } catch {
    return {};
  }
}

async function ensureSchema(db: D1Binding) {
  await db.batch([
    db.prepare(createAssetsTableSql),
    db.prepare(createAssetsDateIndexSql),
  ]);
}

async function sourceBytes(sourceUrl: string) {
  if (sourceUrl.startsWith("data:")) {
    const match = sourceUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!match) throw new Error("无法读取生成结果");
    const mimeType = match[1] || "application/octet-stream";
    const bytes = match[2]
      ? Uint8Array.from(atob(match[3]), (character) => character.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(match[3]));
    return { buffer: bytes.buffer, mimeType };
  }
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error("无法保存生成结果");
  return {
    buffer: await response.arrayBuffer(),
    mimeType: response.headers.get("content-type") || "application/octet-stream",
  };
}

export async function GET() {
  const { DB } = await runtime();
  if (!DB) return NextResponse.json({ assets: [] });
  await ensureSchema(DB);
  const result = await DB.prepare(`
    SELECT id, type, title, prompt, conversation_id, turn_id, created_at
    FROM assets
    ORDER BY created_at DESC
    LIMIT 500
  `).all<AssetRow>();
  return NextResponse.json({
    assets: (result.results ?? []).map((asset) => ({
      id: asset.id,
      type: asset.type,
      title: asset.title,
      prompt: asset.prompt,
      conversationId: asset.conversation_id,
      turnId: asset.turn_id,
      createdAt: asset.created_at,
      url: `/api/assets/${encodeURIComponent(asset.id)}`,
    })),
  });
}

export async function POST(request: Request) {
  const { DB, GENERATED_ASSETS } = await runtime();
  if (!DB || !GENERATED_ASSETS) {
    return NextResponse.json(
      { error: "资产存储尚未配置" },
      { status: 503 },
    );
  }
  const body = await request.json() as {
    sourceUrl?: string;
    type?: "image" | "video";
    title?: string;
    prompt?: string;
    conversationId?: string;
    turnId?: string;
    createdAt?: string;
  };
  if (
    !body.sourceUrl ||
    !body.type ||
    !body.title ||
    !body.conversationId ||
    !body.turnId
  ) {
    return NextResponse.json({ error: "资产信息不完整" }, { status: 400 });
  }

  await ensureSchema(DB);
  const id = crypto.randomUUID();
  const objectKey = `generated/${body.conversationId}/${id}`;
  const createdAt = body.createdAt || new Date().toISOString();
  const { buffer, mimeType } = await sourceBytes(body.sourceUrl);
  await GENERATED_ASSETS.put(objectKey, buffer, {
    httpMetadata: { contentType: mimeType },
  });
  await DB.prepare(`
    INSERT INTO assets (
      id, object_key, source_url, type, title, prompt,
      conversation_id, turn_id, mime_type, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    objectKey,
    body.sourceUrl,
    body.type,
    body.title,
    body.prompt || "",
    body.conversationId,
    body.turnId,
    mimeType,
    createdAt,
  ).run();

  return NextResponse.json({
    asset: {
      id,
      type: body.type,
      title: body.title,
      prompt: body.prompt || "",
      conversationId: body.conversationId,
      turnId: body.turnId,
      createdAt,
      url: `/api/assets/${encodeURIComponent(id)}`,
    },
  });
}
