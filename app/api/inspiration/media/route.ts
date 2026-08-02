import { runtimeBindings } from "../../../lib/runtime";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!key.startsWith("inspiration/") || key.includes("..")) {
    return Response.json({ error: "图片地址无效" }, { status: 400 });
  }
  const { GENERATED_ASSETS } = await runtimeBindings();
  if (!GENERATED_ASSETS) return Response.json({ error: "图片存储尚未配置" }, { status: 503 });
  const object = await GENERATED_ASSETS.get(key);
  if (!object) return Response.json({ error: "图片不存在" }, { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
