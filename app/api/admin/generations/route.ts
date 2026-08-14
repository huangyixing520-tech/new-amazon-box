import { authErrorResponse, requireAdmin } from "../../../lib/auth";
import { ensureAssetsSchema } from "../../../lib/assets-data";
import { ensureProductDataSchema } from "../../../lib/product-data";
import { runtimeBindings } from "../../../lib/runtime";

type GenerationRow = {
  id: string;
  user_id: string;
  email: string;
  media_type: "image" | "video";
  skill: string | null;
  prompt: string;
  status: string;
  slot_index: number;
  asset_id: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

function isoBoundary(value: string | null, end = false) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("日期格式必须为 YYYY-MM-DD");
  const parsed = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+08:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("日期无效");
  return parsed.toISOString();
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { DB } = await runtimeBindings();
    if (!DB) return Response.json({ error: "统计数据库尚未配置" }, { status: 503 });
    await ensureProductDataSchema(DB);
    await ensureAssetsSchema(DB);

    const search = new URL(request.url).searchParams;
    const page = Math.max(1, Number(search.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(search.get("limit") || 25)));
    const where: string[] = [];
    const values: unknown[] = [];
    const from = isoBoundary(search.get("from"));
    const to = isoBoundary(search.get("to"), true);
    if (from) { where.push("created_at >= ?"); values.push(from); }
    if (to) { where.push("created_at <= ?"); values.push(to); }
    if (search.get("userId")) { where.push("user_id = ?"); values.push(search.get("userId")); }
    if (search.get("generationId")) { where.push("id = ?"); values.push(search.get("generationId")); }
    if (search.get("prompt")) {
      where.push("instr(lower(prompt), lower(?)) > 0");
      values.push(search.get("prompt")!.slice(0, 500));
    }
    if (search.get("status")) { where.push("status = ?"); values.push(search.get("status")); }
    if (search.get("mediaType")) { where.push("media_type = ?"); values.push(search.get("mediaType")); }
    if (search.get("skill")) { where.push("skill = ?"); values.push(search.get("skill")); }

    const source = `
      SELECT g.id, g.user_id, u.email, g.media_type, g.skill, g.prompt,
        g.status, g.slot_index, g.asset_id, g.error_message,
        g.created_at, g.completed_at
      FROM generation_records g
      INNER JOIN users u ON u.id = g.user_id
      UNION ALL
      SELECT COALESCE(a.generation_id, a.id) AS id, o.user_id, u.email,
        a.type AS media_type, NULL AS skill, a.prompt, 'succeeded' AS status,
        a.slot_index, a.id AS asset_id, NULL AS error_message,
        a.created_at, a.created_at AS completed_at
      FROM assets a
      INNER JOIN asset_owners o ON o.asset_id = a.id
      INNER JOIN users u ON u.id = o.user_id
      LEFT JOIN generation_records g ON g.id = a.generation_id
      WHERE a.role = 'output' AND g.id IS NULL
    `;
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const count = await DB.prepare(`
      SELECT COUNT(*) AS total FROM (${source}) records ${clause}
    `).bind(...values).first<{ total: number }>();
    const result = await DB.prepare(`
      SELECT * FROM (${source}) records ${clause}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).bind(...values, limit, (page - 1) * limit).all<GenerationRow>();

    return Response.json({
      total: Number(count?.total || 0),
      page,
      limit,
      items: (result.results ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        email: row.email,
        mediaType: row.media_type,
        skill: row.skill,
        prompt: row.prompt,
        status: row.status,
        slot: Number(row.slot_index || 0),
        assetId: row.asset_id,
        error: row.error_message,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        previewUrl: row.asset_id
          ? `/api/admin/assets/${encodeURIComponent(row.asset_id)}`
          : null,
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
