import { NextResponse } from "next/server";
import { createAssetsTableSql } from "../../../../db/schema";
import {
  authErrorResponse,
  ensureIdentitySchema,
  requireUser,
  verifyAssetAccessToken,
} from "../../../lib/auth";
import { runtimeBindings } from "../../../lib/runtime";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const requestUrl = new URL(request.url);
    const accessToken = requestUrl.searchParams.get("accessToken") ?? "";
    const hasUpstreamAccess = accessToken
      ? await verifyAssetAccessToken(accessToken, id)
      : false;
    const user = hasUpstreamAccess ? null : await requireUser(request);
    const runtime = await runtimeBindings();
    if (!runtime.DB || !runtime.GENERATED_ASSETS) {
      return NextResponse.json({ error: "资产存储尚未配置" }, { status: 503 });
    }
    await runtime.DB.prepare(createAssetsTableSql).run();
    await ensureIdentitySchema(runtime.DB);
    const asset = hasUpstreamAccess
      ? await runtime.DB.prepare(`
      SELECT a.object_key, a.mime_type, a.type, a.title
      FROM assets a
      WHERE a.id = ?
    `).bind(id).first<{
      object_key: string;
      mime_type: string | null;
      type: "image" | "video";
      title: string;
    }>()
      : await runtime.DB.prepare(`
      SELECT a.object_key, a.mime_type, a.type, a.title
      FROM assets a
      INNER JOIN asset_owners o ON o.asset_id = a.id
      WHERE a.id = ? AND o.user_id = ?
    `).bind(id, user!.id).first<{
      object_key: string;
      mime_type: string | null;
      type: "image" | "video";
      title: string;
    }>();
    if (!asset) return NextResponse.json({ error: "资产不存在" }, { status: 404 });
    const object = await runtime.GENERATED_ASSETS.get(asset.object_key);
    if (!object) return NextResponse.json({ error: "资产文件不存在" }, { status: 404 });
    const wantsPreview = !hasUpstreamAccess && requestUrl.searchParams.get("preview") === "1";
    const wantsDownload = !hasUpstreamAccess && requestUrl.searchParams.get("download") === "1";
    const downloadFormat = requestUrl.searchParams.get("format") === "jpg" ? "jpg" : "png";
    if (asset.type === "image" && (wantsPreview || wantsDownload)) {
      const { default: sharp } = await import("sharp");
      const source = await new Response(object.body).arrayBuffer();
      const image = sharp(Buffer.from(source)).rotate();
      if (wantsPreview) {
        const preview = await image
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 88, effort: 4, smartSubsample: true })
          .toBuffer();
        return new Response(preview, {
          headers: {
            "content-type": "image/webp",
            "cache-control": "private, max-age=86400",
          },
        });
      }
      const filename = asset.title.replace(/[\\/\r\n]+/g, "-").slice(0, 80) || "mercato-image";
      const output = downloadFormat === "jpg"
        ? await image.flatten({ background: "#ffffff" }).jpeg({ quality: 95, mozjpeg: true }).toBuffer()
        : await image.png({ compressionLevel: 9 }).toBuffer();
      return new Response(output, {
        headers: {
          "content-type": downloadFormat === "jpg" ? "image/jpeg" : "image/png",
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${filename}.${downloadFormat}`)}`,
          "cache-control": "private, no-store",
        },
      });
    }
    return new Response(object.body, {
      headers: {
        "content-type":
          object.httpMetadata?.contentType ||
          asset.mime_type ||
          "application/octet-stream",
        "cache-control": hasUpstreamAccess ? "private, no-store" : "private, max-age=3600",
        ...(wantsDownload ? {
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.title)}`,
        } : {}),
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
