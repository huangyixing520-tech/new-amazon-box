import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "../../../../lib/auth";
import { ensureAssetsSchema } from "../../../../lib/assets-data";
import { runtimeBindings } from "../../../../lib/runtime";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
    const runtime = await runtimeBindings();
    if (!runtime.DB || !runtime.GENERATED_ASSETS) {
      return NextResponse.json(
        { error: "资产存储尚未配置" },
        { status: 503 },
      );
    }
    await ensureAssetsSchema(runtime.DB);
    const { id } = await context.params;
    const asset = await runtime.DB.prepare(`
      SELECT object_key, mime_type
      FROM assets
      WHERE id = ?
    `).bind(id).first<{
      object_key: string;
      mime_type: string | null;
    }>();
    if (!asset) {
      return NextResponse.json({ error: "资产不存在" }, { status: 404 });
    }
    const object = await runtime.GENERATED_ASSETS.get(asset.object_key);
    if (!object) {
      return NextResponse.json({ error: "资产文件不存在" }, { status: 404 });
    }
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
