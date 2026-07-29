import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  authErrorResponse,
  requireUser,
} from "../../lib/auth";
import { ensureAssetsSchema } from "../../lib/assets-data";
import {
  runtimeBindings,
} from "../../lib/runtime";

type AssetRow = {
  id: string;
  type: "image" | "video";
  title: string;
  prompt: string;
  conversation_id: string;
  turn_id: string;
  role: "input" | "output";
  slot_index: number;
  created_at: string;
};

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

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const { DB } = await runtimeBindings();
    if (!DB) return NextResponse.json({ assets: [] });
    await ensureAssetsSchema(DB);
    const result = await DB.prepare(`
      SELECT a.id, a.type, a.title, a.prompt,
        a.conversation_id, a.turn_id, a.role, a.slot_index, a.created_at
      FROM assets a
      INNER JOIN asset_owners o ON o.asset_id = a.id
      WHERE o.user_id = ? AND a.role = 'output'
      ORDER BY a.created_at DESC
      LIMIT 500
    `).bind(user.id).all<AssetRow>();
    return NextResponse.json({
      assets: (result.results ?? []).map((asset) => ({
        id: asset.id,
        type: asset.type,
        title: asset.title,
        prompt: asset.prompt,
        conversationId: asset.conversation_id,
        turnId: asset.turn_id,
        role: asset.role,
        slot: asset.slot_index,
        createdAt: asset.created_at,
        url: `/api/assets/${encodeURIComponent(asset.id)}`,
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const { DB, GENERATED_ASSETS } = await runtimeBindings();
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
      role?: "input" | "output";
      slot?: number;
      outputWidth?: number;
      outputHeight?: number;
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

    await ensureAssetsSchema(DB);
    const role = body.role === "input" ? "input" : "output";
    const slot = Number.isFinite(body.slot) ? Math.max(0, Number(body.slot)) : 0;
    const existing = await DB.prepare(`
      SELECT a.id
      FROM assets a
      INNER JOIN asset_owners o ON o.asset_id = a.id
      WHERE o.user_id = ? AND a.turn_id = ? AND a.role = ? AND a.slot_index = ?
    `).bind(user.id, body.turnId, role, slot).all<{ id: string }>();
    for (const asset of existing.results ?? []) {
      await DB.batch([
        DB.prepare("DELETE FROM asset_owners WHERE asset_id = ? AND user_id = ?")
          .bind(asset.id, user.id),
        DB.prepare("DELETE FROM assets WHERE id = ?").bind(asset.id),
      ]);
    }
    const id = crypto.randomUUID();
    const objectKey = `generated/${user.id}/${body.conversationId}/${id}`;
    const createdAt = body.createdAt || new Date().toISOString();
    const source = await sourceBytes(body.sourceUrl);
    const outputWidth = Number(body.outputWidth);
    const outputHeight = Number(body.outputHeight);
    const shouldResize =
      body.type === "image" &&
      role === "output" &&
      Number.isInteger(outputWidth) &&
      Number.isInteger(outputHeight) &&
      outputWidth > 0 &&
      outputHeight > 0;
    const storedBytes = shouldResize
      ? await sharp(Buffer.from(source.buffer))
          .resize(outputWidth, outputHeight, {
            fit: "cover",
            position: "centre",
          })
          .png()
          .toBuffer()
      : new Uint8Array(source.buffer);
    const mimeType = shouldResize ? "image/png" : source.mimeType;
    await GENERATED_ASSETS.put(objectKey, storedBytes, {
      httpMetadata: { contentType: mimeType },
    });
    await DB.batch([
      DB.prepare(`
        INSERT INTO assets (
          id, object_key, source_url, type, title, prompt,
          conversation_id, turn_id, mime_type, role, slot_index, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        role,
        slot,
        createdAt,
      ),
      DB.prepare(`
        INSERT INTO asset_owners (asset_id, user_id, created_at)
        VALUES (?, ?, ?)
      `).bind(id, user.id, createdAt),
    ]);

    return NextResponse.json({
      asset: {
        id,
        type: body.type,
        title: body.title,
        prompt: body.prompt || "",
        conversationId: body.conversationId,
        turnId: body.turnId,
        role,
        slot,
        createdAt,
        url: `/api/assets/${encodeURIComponent(id)}`,
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
