import { authErrorResponse, requireAdmin, verifySameOrigin } from "../../../lib/auth";
import {
  loadInspirationCases,
  reorderInspirationCases,
  saveInspirationCase,
  updateInspirationCase,
  type InspirationCaseRecord,
} from "../../../lib/inspiration-data";
import { runtimeBindings } from "../../../lib/runtime";

function text(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function selectedTabs(form: FormData) {
  return form.getAll("tabs").filter(
    (item): item is "featured" | "image" | "video" =>
      item === "featured" || item === "image" || item === "video",
  );
}

function defaultsForTabs(tabs: InspirationCaseRecord["tabs"]): Pick<InspirationCaseRecord, "mode" | "skill"> {
  return tabs.includes("video") && !tabs.includes("image")
    ? { mode: "video", skill: "talking-product-video" }
    : { mode: "image", skill: "white-background-image" };
}

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await requireAdmin(request);
    const form = await request.formData();
    const resultUrl = text(form.get("resultUrl"), 800);
    const prompt = text(form.get("prompt"), 1600);
    const tabs = selectedTabs(form);
    if (!resultUrl || !prompt || !tabs.length) {
      return Response.json({ error: "请填写提示词、分类并上传结果图" }, { status: 400 });
    }
    const inputUrls = form.getAll("inputUrls").filter(
      (item): item is string => typeof item === "string" && item.startsWith("/api/inspiration/media?key="),
    ).slice(0, 9);
    const { DB } = await runtimeBindings();
    if (!DB) return Response.json({ error: "案例数据库尚未就绪" }, { status: 503 });
    const createdAt = new Date().toISOString();
    const defaults = defaultsForTabs(tabs);
    const record: InspirationCaseRecord = {
      id: `case-${crypto.randomUUID()}`,
      tabs,
      ...defaults,
      title: "优秀案例",
      description: "",
      prompt,
      images: [resultUrl],
      inputImages: inputUrls,
      layout: "landscape",
      orderByTab: Object.fromEntries(tabs.map((tab) => [tab, -Date.now()])),
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

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { DB } = await runtimeBindings();
    return Response.json({ cases: await loadInspirationCases(DB) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await requireAdmin(request);
    const form = await request.formData();
    const id = text(form.get("id"), 80);
    const { DB } = await runtimeBindings();
    if (!DB) return Response.json({ error: "案例数据库尚未就绪" }, { status: 503 });
    const current = (await loadInspirationCases(DB)).find((item) => item.id === id);
    if (!current) return Response.json({ error: "案例不存在" }, { status: 404 });
    const prompt = text(form.get("prompt"), 1600);
    const tabs = selectedTabs(form);
    if (!prompt || !tabs.length) {
      return Response.json({ error: "请填写提示词和至少一个分类" }, { status: 400 });
    }
    const uploadedResultUrl = text(form.get("resultUrl"), 800);
    const uploadedInputUrls = form.getAll("inputUrls").filter(
      (item): item is string => typeof item === "string" && item.startsWith("/api/inspiration/media?key="),
    ).slice(0, 9);
    const resultUrl = uploadedResultUrl || current.images[0];
    const inputUrls = uploadedInputUrls.length ? uploadedInputUrls : current.inputImages;
    const next: InspirationCaseRecord = {
      ...current,
      tabs,
      prompt,
      images: [resultUrl],
      inputImages: inputUrls,
      orderByTab: Object.fromEntries(tabs.map((tab) => [
        tab,
        current.orderByTab[tab] ?? -new Date(current.createdAt).getTime(),
      ])),
    };
    return Response.json({ case: await updateInspirationCase(DB, next, user.email) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await requireAdmin(request);
    const body = await request.json() as { tab?: string; orderedIds?: string[] };
    if (
      (body.tab !== "featured" && body.tab !== "image" && body.tab !== "video") ||
      !Array.isArray(body.orderedIds)
    ) return Response.json({ error: "排序信息无效" }, { status: 400 });
    const { DB } = await runtimeBindings();
    if (!DB) return Response.json({ error: "案例数据库尚未就绪" }, { status: 503 });
    return Response.json({
      cases: await reorderInspirationCases(DB, body.tab, body.orderedIds, user.email),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
