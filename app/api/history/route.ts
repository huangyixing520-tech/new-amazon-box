import { NextResponse } from "next/server";
import { authErrorResponse, requireUser, verifySameOrigin } from "../../lib/auth";
import { ensureAssetsSchema } from "../../lib/assets-data";
import { ensureProductDataSchema, safeJson } from "../../lib/product-data";
import { runtimeBindings } from "../../lib/runtime";

type ConversationRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  unread: number;
};

type TurnRow = {
  id: string;
  payload_json: string;
};

type AssetRow = {
  id: string;
  type: "image" | "video";
  conversation_id: string;
  turn_id: string;
  role: "input" | "output";
  slot_index: number;
};

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const { DB } = await runtimeBindings();
    if (!DB) return NextResponse.json({ conversations: [], turns: [] });
    await ensureProductDataSchema(DB);
    await ensureAssetsSchema(DB);
    const [conversationResult, turnResult, assetResult] = await Promise.all([
      DB.prepare(`
        SELECT c.id, c.title, c.created_at, c.updated_at,
          COALESCE(r.unread, 0) AS unread
        FROM conversations c
        LEFT JOIN conversation_read_states r
          ON r.conversation_id = c.id AND r.user_id = c.user_id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
      `).bind(user.id).all<ConversationRow>(),
      DB.prepare(`
        SELECT id, payload_json
        FROM conversation_turns
        WHERE user_id = ?
        ORDER BY created_at ASC
      `).bind(user.id).all<TurnRow>(),
      DB.prepare(`
        SELECT a.id, a.type, a.conversation_id, a.turn_id, a.role, a.slot_index
        FROM assets a
        INNER JOIN asset_owners o ON o.asset_id = a.id
        WHERE o.user_id = ?
        ORDER BY a.created_at ASC
      `).bind(user.id).all<AssetRow>(),
    ]);
    const assetsByTurn = new Map<string, AssetRow[]>();
    for (const asset of assetResult.results ?? []) {
      const current = assetsByTurn.get(asset.turn_id) ?? [];
      current.push(asset);
      assetsByTurn.set(asset.turn_id, current);
    }
    const turns = (turnResult.results ?? []).map((row) => {
      const turn = safeJson<Record<string, unknown>>(row.payload_json, {});
      const turnAssets = assetsByTurn.get(row.id) ?? [];
      const inputImages: string[] = [];
      turnAssets
        .filter((asset) => asset.role === "input" && asset.type === "image")
        .sort((left, right) => left.slot_index - right.slot_index)
        .forEach((asset) => {
          inputImages[asset.slot_index] =
            `/api/assets/${encodeURIComponent(asset.id)}?preview=1`;
        });
      const outputImages: string[] = [];
      turnAssets
        .filter((asset) => asset.role === "output" && asset.type === "image")
        .sort((left, right) => left.slot_index - right.slot_index)
        .forEach((asset) => {
          outputImages[asset.slot_index] =
            `/api/assets/${encodeURIComponent(asset.id)}?preview=1`;
        });
      const outputVideo = turnAssets.find(
        (asset) => asset.role === "output" && asset.type === "video",
      );
      const restored = {
        ...turn,
        productImage: inputImages[0] || "/product-main.webp",
        productImages: inputImages,
        images: outputImages,
        videoUrl: outputVideo
          ? `/api/assets/${encodeURIComponent(outputVideo.id)}?preview=1`
          : undefined,
      };
      if (turn.running) {
        return {
          ...restored,
          running: false,
          phase: "生成已中断，可重新生成",
          error: "页面关闭前任务尚未完成",
        };
      }
      return restored;
    });
    return NextResponse.json({
      conversations: (conversationResult.results ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        unread: Boolean(row.unread),
      })),
      turns,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await requireUser(request);
    const { DB } = await runtimeBindings();
    if (!DB) return NextResponse.json({ error: "历史数据库尚未配置" }, { status: 503 });
    await ensureProductDataSchema(DB);
    const body = await request.json() as {
      action?: "upsert-conversation" | "upsert-turn" | "rename-conversation" | "delete-conversation" | "mark-read" | "mark-unread";
      conversation?: { id?: string; title?: string; createdAt?: string };
      turn?: Record<string, unknown> & { id?: string; conversationId?: string; createdAt?: string };
      conversationId?: string;
      title?: string;
    };
    const now = new Date().toISOString();

    if (body.action === "upsert-conversation" && body.conversation?.id) {
      const createdAt = body.conversation.createdAt || now;
      await DB.prepare(`
        INSERT INTO conversations (id, user_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          updated_at = excluded.updated_at
        WHERE user_id = excluded.user_id
      `).bind(
        body.conversation.id,
        user.id,
        body.conversation.title || "新对话",
        createdAt,
        now,
      ).run();
      return NextResponse.json({ ok: true });
    }

    if (body.action === "upsert-turn" && body.turn?.id && body.turn.conversationId) {
      const conversation = await DB.prepare(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
      ).bind(body.turn.conversationId, user.id).first<{ id: string }>();
      if (!conversation) return NextResponse.json({ error: "对话不存在" }, { status: 404 });
      const payload = {
        ...body.turn,
        productImage: "",
        productImages: [],
        images: [],
        videoUrl: undefined,
      };
      await DB.batch([
        DB.prepare(`
          INSERT INTO conversation_turns (
          id, conversation_id, user_id, payload_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at
          WHERE user_id = excluded.user_id
        `).bind(
          body.turn.id,
          body.turn.conversationId,
          user.id,
          JSON.stringify(payload),
          body.turn.createdAt || now,
          now,
        ),
        DB.prepare(`
          UPDATE conversations SET updated_at = ?
          WHERE id = ? AND user_id = ?
        `).bind(now, body.turn.conversationId, user.id),
      ]);
      return NextResponse.json({ ok: true });
    }

    if (
      (body.action === "mark-read" || body.action === "mark-unread") &&
      body.conversationId
    ) {
      await DB.prepare(`
        INSERT INTO conversation_read_states (user_id, conversation_id, unread, updated_at)
        SELECT ?, id, ?, ? FROM conversations
        WHERE id = ? AND user_id = ?
        ON CONFLICT(user_id, conversation_id) DO UPDATE SET
          unread = excluded.unread,
          updated_at = excluded.updated_at
      `).bind(
        user.id,
        body.action === "mark-unread" ? 1 : 0,
        now,
        body.conversationId,
        user.id,
      ).run();
      return NextResponse.json({ ok: true });
    }

    if (body.action === "rename-conversation" && body.conversationId && body.title) {
      await DB.prepare(`
        UPDATE conversations SET title = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(body.title, now, body.conversationId, user.id).run();
      return NextResponse.json({ ok: true });
    }

    if (body.action === "delete-conversation" && body.conversationId) {
      await DB.prepare(
        "DELETE FROM conversations WHERE id = ? AND user_id = ?",
      ).bind(body.conversationId, user.id).run();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "未知历史记录操作" }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
