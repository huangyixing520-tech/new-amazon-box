import {
  authErrorResponse,
  requireAdmin,
  verifySameOrigin,
} from "../../../../lib/auth";
import { runtimeBindings } from "../../../../lib/runtime";

const slots = new Set([
  "hero",
  "listing",
  "lifestyle",
  "scene",
  "videoPoster",
]);
const imageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);
const maxFileSize = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    await requireAdmin(request);
    const { GENERATED_ASSETS } = await runtimeBindings();
    if (!GENERATED_ASSETS) {
      return Response.json(
        { error: "落地页图片存储尚未配置" },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const slot = String(form.get("slot") ?? "");
    if (!(file instanceof File) || !slots.has(slot)) {
      return Response.json({ error: "上传信息不完整" }, { status: 400 });
    }
    const extension = imageTypes.get(file.type);
    if (!extension) {
      return Response.json(
        { error: "仅支持 JPG、PNG、WebP、GIF 或 AVIF 图片" },
        { status: 415 },
      );
    }
    if (!file.size || file.size > maxFileSize) {
      return Response.json(
        { error: "单张图片不能超过 10 MB" },
        { status: 413 },
      );
    }

    const { default: sharp } = await import("sharp");
    const output = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .webp({ quality: 88, effort: 4, smartSubsample: true })
      .toBuffer();
    const key = `landing/${slot}/${crypto.randomUUID()}.webp`;
    await GENERATED_ASSETS.put(key, output, {
      httpMetadata: { contentType: "image/webp" },
    });
    return Response.json({
      url: `/api/landing/media?key=${encodeURIComponent(key)}`,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
