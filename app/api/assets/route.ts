import { NextResponse } from "next/server";
import {
  authErrorResponse,
  ensureIdentitySchema,
  requireUser,
} from "../../lib/auth";
import { ensureAssetsSchema } from "../../lib/assets-data";
import { runtimeBindings, type D1Binding } from "../../lib/runtime";
import { normalizedImageOutputDimensions } from "../../asset-output-spec.mjs";
import { attachGenerationAsset } from "../../lib/generation-analytics";

type AssetRow = {
  id: string;
  type: "image" | "video";
  title: string;
  prompt: string;
  conversation_id: string;
  turn_id: string;
  generation_id: string | null;
  role: "input" | "output";
  slot_index: number;
  created_at: string;
};

type AssetBody = {
  sourceUrl?: string;
  imageTaskId?: string;
  type?: "image" | "video";
  title?: string;
  prompt?: string;
  conversationId?: string;
  turnId?: string;
  generationId?: string;
  createdAt?: string;
  role?: "input" | "output";
  slot?: number;
  outputWidth?: number;
  outputHeight?: number;
};

function taskBackend() {
  const url = process.env.TASK_BACKEND_URL?.replace(/\/$/, "");
  const token = process.env.TASK_BACKEND_TOKEN;
  if (!url || !token) throw new Error("图片任务后台尚未配置");
  return { url, token };
}

function taskField(payload: unknown, keys: string[]): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  for (const [key, value] of Object.entries(payload)) {
    if (keys.includes(key) && typeof value === "string") return value;
    const nested = taskField(value, keys);
    if (nested) return nested;
  }
}

async function taskResultSource(
  DB: D1Binding,
  taskId: string,
  userId: string,
) {
  if (!/^[a-f0-9-]+$/i.test(taskId)) throw new Error("无效的图片任务 ID");
  await ensureIdentitySchema(DB);
  const owned = await DB.prepare(`
    SELECT id FROM generation_tasks WHERE id = ? AND user_id = ?
  `).bind(taskId, userId).first();
  if (!owned) throw new Error("图片任务不存在或无权访问");

  const backend = taskBackend();
  const response = await fetch(
    `${backend.url}/v1/image-tasks/${encodeURIComponent(taskId)}`,
    {
      headers: { Authorization: `Bearer ${backend.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(taskField(payload, ["error", "message"]) || "图片任务结果读取失败");
  }
  const status = String(taskField(payload, ["status", "state"]) || "").toLowerCase();
  if (!["succeeded", "success", "completed", "done"].includes(status)) {
    throw new Error(
      ["failed", "error", "cancelled", "canceled"].includes(status)
        ? taskField(payload, ["error", "message"]) || "图片生成失败"
        : "图片任务尚未完成",
    );
  }
  const sourceUrl = taskField(payload, ["url", "image_url", "imageUrl"]);
  if (!sourceUrl) throw new Error("图片任务没有返回有效结果");
  return sourceUrl;
}

type BinarySource = {
  arrayBuffer(): Promise<ArrayBuffer>;
  type?: string;
};

async function sourceBytes(source: string | BinarySource) {
  if (typeof source !== "string") {
    return {
      buffer: await source.arrayBuffer(),
      mimeType: source.type || "application/octet-stream",
    };
  }
  const sourceUrl = source;
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
        a.conversation_id, a.turn_id, a.generation_id,
        a.role, a.slot_index, a.created_at
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
        generationId: asset.generation_id,
        role: asset.role,
        slot: asset.slot_index,
        createdAt: asset.created_at,
        url: `/api/assets/${encodeURIComponent(asset.id)}?preview=1`,
        downloadUrl: `/api/assets/${encodeURIComponent(asset.id)}?download=1&format=png`,
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
    const isMultipart = request.headers.get("content-type")
      ?.toLowerCase()
      .startsWith("multipart/form-data");
    const form = isMultipart ? await request.formData() : null;
    const formText = (key: string) => {
      const value = form?.get(key);
      return typeof value === "string" ? value : undefined;
    };
    const formNumber = (key: string) => {
      const value = formText(key);
      if (!value) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const fileValue = form?.get("file");
    const file = fileValue && typeof fileValue !== "string"
      ? fileValue
      : null;
    const body: AssetBody = form
      ? {
          type: formText("type") as AssetBody["type"],
          title: formText("title"),
          prompt: formText("prompt"),
          conversationId: formText("conversationId"),
          turnId: formText("turnId"),
          generationId: formText("generationId"),
          imageTaskId: formText("imageTaskId"),
          createdAt: formText("createdAt"),
          role: formText("role") as AssetBody["role"],
          slot: formNumber("slot"),
          outputWidth: formNumber("outputWidth"),
          outputHeight: formNumber("outputHeight"),
        }
      : await request.json() as AssetBody;
    if (
      (!body.sourceUrl && !file && !body.imageTaskId) ||
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
    const resolvedSource = file ?? body.sourceUrl ?? await taskResultSource(
      DB,
      body.imageTaskId!,
      user.id,
    );
    const source = await sourceBytes(resolvedSource);
    const existing = await DB.prepare(`
      SELECT a.id, a.object_key
      FROM assets a
      INNER JOIN asset_owners o ON o.asset_id = a.id
      WHERE o.user_id = ?
        AND a.turn_id = ?
        AND a.role = ?
        AND a.type = ?
        AND a.slot_index = ?
    `).bind(user.id, body.turnId, role, body.type, slot).all<{
      id: string;
      object_key: string | null;
    }>();
    for (const asset of existing.results ?? []) {
      await DB.batch([
        DB.prepare("DELETE FROM asset_owners WHERE asset_id = ? AND user_id = ?")
          .bind(asset.id, user.id),
        DB.prepare("DELETE FROM assets WHERE id = ?").bind(asset.id),
      ]);
      if (asset.object_key) {
        await GENERATED_ASSETS.delete?.(asset.object_key);
      }
    }
    const id = crypto.randomUUID();
    const objectKey = `generated/${user.id}/${body.conversationId}/${id}`;
    const createdAt = body.createdAt || new Date().toISOString();
    const requestedDimensions = body.type === "image" && role === "output"
      ? normalizedImageOutputDimensions(body.outputWidth, body.outputHeight)
      : null;
    let storedBuffer = source.buffer;
    let storedMimeType = source.mimeType;
    if (requestedDimensions) {
      const { default: sharp } = await import("sharp");
      const resized = await sharp(Buffer.from(source.buffer))
        .rotate()
        .resize({
          width: requestedDimensions.width,
          height: requestedDimensions.height,
          fit: "fill",
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
      storedBuffer = resized.buffer.slice(
        resized.byteOffset,
        resized.byteOffset + resized.byteLength,
      );
      storedMimeType = "image/png";
    }
    // Register the object key before writing the file. ENOSPC recovery scans the
    // database for live keys, so concurrent uploads must already be visible or
    // another request can mistake an in-flight file for an orphan and delete it.
    await DB.batch([
      DB.prepare(`
        INSERT INTO assets (
          id, object_key, source_url, type, title, prompt,
          conversation_id, turn_id, generation_id, mime_type,
          role, slot_index, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        objectKey,
        body.sourceUrl || (body.imageTaskId ? `task:${body.imageTaskId}` : ""),
        body.type,
        body.title,
        body.prompt || "",
        body.conversationId,
        body.turnId,
        body.generationId || body.imageTaskId || null,
        storedMimeType,
        role,
        slot,
        createdAt,
      ),
      DB.prepare(`
        INSERT INTO asset_owners (asset_id, user_id, created_at)
        VALUES (?, ?, ?)
      `).bind(id, user.id, createdAt),
    ]);

    const storeAsset = () => GENERATED_ASSETS.put(objectKey, storedBuffer, {
      httpMetadata: { contentType: storedMimeType },
    });
    try {
      try {
        await storeAsset();
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (
          !GENERATED_ASSETS.cleanupUnreferencedGenerated ||
          (!message.includes("enospc") && !message.includes("no space left"))
        ) {
          throw error;
        }
        const referenced = await DB.prepare(`
          SELECT a.object_key
          FROM assets a
          INNER JOIN asset_owners o ON o.asset_id = a.id
          WHERE a.object_key LIKE 'generated/%'
        `).all<{ object_key: string | null }>();
        const referencedKeys = new Set(
          (referenced.results ?? [])
            .map((asset) => asset.object_key)
            .filter((key): key is string => Boolean(key)),
        );
        await GENERATED_ASSETS.cleanupUnreferencedGenerated(referencedKeys);
        await storeAsset();
      }
    } catch (error) {
      await DB.batch([
        DB.prepare("DELETE FROM asset_owners WHERE asset_id = ? AND user_id = ?")
          .bind(id, user.id),
        DB.prepare("DELETE FROM assets WHERE id = ?").bind(id),
      ]);
      await GENERATED_ASSETS.delete?.(objectKey);
      throw error;
    }

    const generationId = body.generationId || body.imageTaskId;
    if (role === "output" && generationId) {
      await attachGenerationAsset(DB, generationId, user.id, id);
    }

    return NextResponse.json({
      asset: {
        id,
        type: body.type,
        title: body.title,
        prompt: body.prompt || "",
        conversationId: body.conversationId,
        turnId: body.turnId,
        generationId: body.generationId || body.imageTaskId || null,
        role,
        slot,
        createdAt,
        url: `/api/assets/${encodeURIComponent(id)}?preview=1`,
        downloadUrl: `/api/assets/${encodeURIComponent(id)}?download=1&format=png`,
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
