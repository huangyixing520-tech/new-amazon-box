import { authErrorResponse, requireAdmin } from "../../../../../lib/auth";
import { ensureAssetsSchema } from "../../../../../lib/assets-data";
import {
  ensureProductDataSchema,
  safeJson,
} from "../../../../../lib/product-data";
import { runtimeBindings } from "../../../../../lib/runtime";

type UserRow = {
  id: string;
  email: string;
  name: string;
  picture_url: string | null;
  created_at: string;
  last_active: string | null;
};

type ConversationRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type TurnRow = {
  id: string;
  conversation_id: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
};

type AssetRow = {
  id: string;
  type: "image" | "video";
  title: string;
  prompt: string;
  conversation_id: string;
  turn_id: string;
  slot_index: number;
  created_at: string;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
    const { DB } = await runtimeBindings();
    if (!DB) {
      return Response.json({ error: "用户数据存储尚未配置" }, { status: 503 });
    }
    await ensureProductDataSchema(DB);
    await ensureAssetsSchema(DB);
    const { id } = await context.params;
    const user = await DB.prepare(`
      SELECT u.id, u.email, u.name, u.picture_url, u.created_at,
        MAX(e.created_at) AS last_active
      FROM users u
      LEFT JOIN analytics_events e ON e.user_id = u.id
      WHERE u.id = ?
      GROUP BY u.id, u.email, u.name, u.picture_url, u.created_at
    `).bind(id).first<UserRow>();
    if (!user) {
      return Response.json({ error: "用户不存在" }, { status: 404 });
    }

    const [conversationResult, turnResult, assetResult] = await Promise.all([
      DB.prepare(`
        SELECT id, title, created_at, updated_at
        FROM conversations
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT 200
      `).bind(id).all<ConversationRow>(),
      DB.prepare(`
        SELECT id, conversation_id, payload_json, created_at, updated_at
        FROM conversation_turns
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 500
      `).bind(id).all<TurnRow>(),
      DB.prepare(`
        SELECT a.id, a.type, a.title,
          COALESCE(NULLIF(g.prompt, ''), a.prompt) AS prompt, a.conversation_id,
          a.turn_id, a.slot_index, a.created_at
        FROM assets a
        INNER JOIN asset_owners o ON o.asset_id = a.id
        LEFT JOIN generation_records g ON g.id = a.generation_id
        WHERE o.user_id = ? AND a.role = 'output'
        ORDER BY a.created_at DESC
        LIMIT 1000
      `).bind(id).all<AssetRow>(),
    ]);

    const assetsByTurn = new Map<string, AssetRow[]>();
    for (const asset of assetResult.results ?? []) {
      const assets = assetsByTurn.get(asset.turn_id) ?? [];
      assets.push(asset);
      assetsByTurn.set(asset.turn_id, assets);
    }
    const turnsByConversation = new Map<string, Array<Record<string, unknown>>>();
    let listingCount = 0;
    for (const row of turnResult.results ?? []) {
      const payload = safeJson<Record<string, unknown>>(row.payload_json, {});
      if (payload.listing) listingCount += 1;
      const assets = (assetsByTurn.get(row.id) ?? [])
        .sort((left, right) => left.slot_index - right.slot_index)
        .map((asset) => ({
          id: asset.id,
          type: asset.type,
          title: asset.title,
          prompt: asset.prompt,
          slot: asset.slot_index,
          createdAt: asset.created_at,
          url: `/api/admin/assets/${encodeURIComponent(asset.id)}?preview=1`,
        }));
      const turns = turnsByConversation.get(row.conversation_id) ?? [];
      turns.push({
        id: row.id,
        conversationId: row.conversation_id,
        title: payload.title || "未命名生成",
        prompt: payload.prompt || "",
        mode: payload.mode || "image",
        skill: payload.skill || "unknown",
        phase: payload.phase || "",
        error: payload.error || null,
        completed: Number(payload.completed || 0),
        listing: payload.listing || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        assets,
      });
      turnsByConversation.set(row.conversation_id, turns);
    }

    const conversations = (conversationResult.results ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      turns: turnsByConversation.get(row.id) ?? [],
    }));
    const assets = assetResult.results ?? [];

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        pictureUrl: user.picture_url,
        createdAt: user.created_at,
        lastActive: user.last_active,
      },
      summary: {
        conversations: conversations.length,
        generations: turnResult.results?.length ?? 0,
        images: assets.filter((asset) => asset.type === "image").length,
        videos: assets.filter((asset) => asset.type === "video").length,
        listings: listingCount,
      },
      conversations,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
