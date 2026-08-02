import { authErrorResponse, requireAdmin, verifySameOrigin } from "../../../lib/auth";
import { saveInspirationCase, type InspirationCaseRecord } from "../../../lib/inspiration-data";
import { runtimeBindings } from "../../../lib/runtime";

const imageTypes = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"],
  ["image/gif", "gif"], ["image/avif", "avif"],
]);
const maxFileSize = 10 * 1024 * 1024;

function text(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function storeImage(file: File, kind: "result" | "input") {
  const extension = imageTypes.get(file.type);
  if (!extension) throw new Error("仅支持 JPG、PNG、WebP、GIF 或 AVIF 图片");
  if (!file.size || file.size > maxFileSize) throw new Error("单张图片不能超过 10 MB");
  const { GENERATED_ASSETS } = await runtimeBindings();
  if (!GENERATED_ASSETS) throw new Error("案例图片存储尚未配置");
  const key = `inspiration/${kind}/${crypto.randomUUID()}.${extension}`;
  await GENERATED_ASSETS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  return `/api/inspiration/media?key=${encodeURIComponent(key)}`;
}

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await requireAdmin(request);
    const form = await request.formData();
    const result = form.get("resultImage");
    const title = text(form.get("title"), 80);
    const prompt = text(form.get("prompt"), 1600);
    if (!(result instanceof File) || !title || !prompt) {
      return Response.json({ error: "请填写标题、提示词并上传结果图" }, { status: 400 });
    }
    const inputFiles = form.getAll("inputImages").filter(
      (item): item is File => item instanceof File && item.size > 0,
    );
    if (inputFiles.length > 9) return Response.json({ error: "输入图最多 9 张" }, { status: 400 });
    const [resultUrl, ...inputUrls] = await Promise.all([
      storeImage(result, "result"),
      ...inputFiles.map((file) => storeImage(file, "input")),
    ]);
    const { DB } = await runtimeBindings();
    if (!DB) return Response.json({ error: "案例数据库尚未就绪" }, { status: 503 });
    const createdAt = new Date().toISOString();
    const record: InspirationCaseRecord = {
      id: `case-${crypto.randomUUID()}`,
      tab: "image",
      mode: "image",
      skill: text(form.get("skill"), 80) || "white-background-image",
      title,
      description: text(form.get("description"), 180),
      prompt,
      images: [resultUrl],
      inputImages: inputUrls,
      layout: "landscape",
      createdAt,
    };
    return Response.json({ case: await saveInspirationCase(DB, record, user.email) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "案例上传失败";
    if (message.includes("仅支持") || message.includes("不能超过")) {
      return Response.json({ error: message }, { status: 415 });
    }
    return authErrorResponse(error);
  }
}
