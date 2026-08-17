import { runtimeBindings } from "./runtime";

const imageTypes = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"],
  ["image/gif", "gif"], ["image/avif", "avif"],
]);
const maxFileSize = 10 * 1024 * 1024;

export async function storeInspirationImage(file: File, kind: "result" | "input") {
  const extension = imageTypes.get(file.type);
  if (!extension) throw new Error("仅支持 JPG、PNG、WebP、GIF 或 AVIF 图片");
  if (!file.size || file.size > maxFileSize) throw new Error("单张图片不能超过 10 MB");
  const { GENERATED_ASSETS } = await runtimeBindings();
  if (!GENERATED_ASSETS) throw new Error("案例图片存储尚未配置");
  const { default: sharp } = await import("sharp");
  const output = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .webp({ quality: 88, effort: 4, smartSubsample: true })
    .toBuffer();
  const key = `inspiration/${kind}/${crypto.randomUUID()}.webp`;
  await GENERATED_ASSETS.put(key, output, {
    httpMetadata: { contentType: "image/webp" },
  });
  return `/api/inspiration/media?key=${encodeURIComponent(key)}`;
}
