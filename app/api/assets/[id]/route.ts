import { NextResponse } from "next/server";
import { createAssetsTableSql } from "../../../../db/schema";
import {
  authErrorResponse,
  ensureIdentitySchema,
  requireUser,
} from "../../../lib/auth";
import { runtimeBindings } from "../../../lib/runtime";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const runtime = await runtimeBindings();
    if (!runtime.DB || !runtime.GENERATED_ASSETS) {
      return NextResponse.json({ error: "资产存储尚未配置" }, { status: 503 });
    }
    await runtime.DB.prepare(createAssetsTableSql).run();
    await ensureIdentitySchema(runtime.DB);
    const { id } = await context.params;
    const asset = await runtime.DB.prepare(`
      SELECT a.object_key, a.mime_type
      FROM assets a
      INNER JOIN asset_owners o ON o.asset_id = a.id
      WHERE a.id = ? AND o.user_id = ?
    `).bind(id, user.id).first<{
      object_key: string;
      mime_type: string | null;
    }>();
    if (!asset) return NextResponse.json({ error: "资产不存在" }, { status: 404 });
    const object = await runtime.GENERATED_ASSETS.get(asset.object_key);
    if (!object) return NextResponse.json({ error: "资产文件不存在" }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type":
          object.httpMetadata?.contentType ||
          asset.mime_type ||
          "application/octet-stream",
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
