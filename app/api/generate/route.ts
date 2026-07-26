import { imageOutputUrl } from "./image-response.mjs";

const BASE_URL =
  process.env.DOLA_BASE_URL?.replace(/\/$/, "") ??
  "https://api.dolaio.cn/aigateway/cisco/v1";
const AGENT_MODEL = process.env.AGENT_MODEL ?? "MiniMax-M3";
const IMAGE_MODEL = process.env.IMAGE_MODEL ?? "yunwu/gpt-image-2";
const VIDEO_MODEL = process.env.VIDEO_MODEL ?? "novai/seedance-2.0-mini";

const languageNames: Record<string, string> = {
  en: "English",
  de: "German",
  jp: "Japanese",
  zh: "Simplified Chinese",
};

const regionNames: Record<string, string> = {
  us: "Amazon US",
  uk: "Amazon UK",
  de: "Amazon Germany",
  jp: "Amazon Japan",
  sea: "Southeast Asia",
};

const imagePrompts: Record<string, string[]> = {
  "amazon-image-set": [
    "Amazon-compliant square hero image, pure white background, centered product, realistic studio lighting, no text",
    "Square ecommerce feature image showing the product's most important benefit, premium commercial photography",
    "Square lifestyle image showing the product in realistic everyday use",
    "Square detail image emphasizing materials, construction and craftsmanship",
    "Wide Amazon A+ banner, premium brand story composition, clean negative space",
    "Wide Amazon A+ benefit banner, polished marketplace advertising photography",
  ],
  "ecommerce-image-set": [
    "Square cross-border ecommerce hero image, clean premium studio scene",
    "Square product benefit image, modern international marketplace style",
    "Square lifestyle use-case image, natural people and believable environment",
    "Square product detail image, macro commercial photography",
    "Wide ecommerce brand banner, premium editorial composition",
    "Wide product story banner with polished commercial lighting",
  ],
  "china-seeding-image": [
    "Vertical 3:4 social commerce cover, authentic lifestyle photography, tasteful Chinese social media aesthetic, no visible text",
    "Vertical 3:4 product detail recommendation image, warm natural light",
    "Vertical 3:4 real-life usage scene, aspirational but believable",
    "Vertical 3:4 product routine image, cohesive with the other images",
  ],
  "amazon-scene-image": [
    "Square Amazon lifestyle image showing a person naturally using the product, realistic commercial photography",
  ],
  "china-ecommerce-main-image": [
    "Square Chinese ecommerce main image, premium product advertising composition, clear product focus",
  ],
  "white-background-image": [
    "Square marketplace hero image, pure white background, centered product, accurate shape and color, realistic soft shadow, no text",
  ],
};

function apiKey() {
  const value = process.env.DOLA_API_KEY;
  if (!value) throw new Error("DOLA_API_KEY 尚未配置");
  return value;
}

function jsonError(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

function upstreamError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const value = payload as {
    error?: { message?: string } | string;
    message?: string;
  };
  if (typeof value.error === "string") return value.error;
  return value.error?.message ?? value.message ?? fallback;
}

function taskField(payload: unknown, keys: string[]) {
  if (!payload || typeof payload !== "object") return undefined;
  for (const [key, value] of Object.entries(payload)) {
    if (keys.includes(key) && typeof value === "string") return value;
    const nested = taskField(value, keys);
    if (nested) return nested;
  }
}

function videoTask(payload: unknown) {
  return {
    id: taskField(payload, ["id", "task_id"]),
    status: taskField(payload, ["status", "state"]),
    videoUrl: taskField(payload, ["video_url", "videoUrl"]),
    posterUrl: taskField(payload, ["poster_url", "posterUrl", "thumbnail_url"]),
  };
}

async function fileDataUrl(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${file.type || "image/png"};base64,${btoa(binary)}`;
}

async function listingMessages(form: FormData) {
  const skill = String(form.get("skill") ?? "listing");
  const region = String(form.get("region") ?? "us");
  const language = String(form.get("language") ?? "en");
  const prompt = String(form.get("prompt") ?? "");
  const image = form.get("image");
  const imageName = image instanceof File ? image.name : "uploaded product image";
  const userText = `[FORM]
Skill: ${skill}
Sales market: ${regionNames[region] ?? region}
Output language: ${languageNames[language] ?? language}
Uploaded image: ${imageName}

[USER INPUT]
${prompt || "Create a complete marketplace listing from the supplied product information."}

Inspect the product image carefully. Distinguish visible facts from assumptions and never invent non-visible specifications.`;
  const userContent = image instanceof File
    ? [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: await fileDataUrl(image) } },
      ]
    : userText;

  return [
    {
      role: "system",
      content: `You are Mercato, a senior cross-border ecommerce listing specialist.
The host has already routed this request to the selected Listing capability.
Do not create a plan, break the task into steps, choose another capability, or describe an execution process.
Generate the final listing directly in a single response.
Return only valid JSON, without markdown fences or commentary.
Write all customer-facing copy in the requested output language.
Do not invent certifications, medical claims, exact dimensions, materials, battery capacity or performance figures unless supplied by the user.
Unknown is better than invented. Never infer power source, heating, pressure, compatibility, included accessories or operating mechanism from appearance alone.
Every bullet and specification must be supported by the uploaded image or user text. Use "Not confirmed" for an important unknown instead of guessing.
Describe a visible control as "visible control button", never as "one-touch operation" unless the user explicitly supplied that behavior.
Pricing is an AI merchandising suggestion rather than a product fact. Always return non-empty numeric salePrice and listPrice strings appropriate for the selected market.
Use this schema:
{
  "title": "marketplace title",
  "brand": "brand or Generic",
  "category": "breadcrumb category",
  "salePrice": "numeric string",
  "listPrice": "numeric string",
  "bullets": ["five concise benefits"],
  "description": "one persuasive paragraph",
  "aPlusHeadline": "short brand headline",
  "specifications": {"Product type": "visible fact", "Recommended use": "reasonable use case", "Other visible attribute": "visible fact or Not confirmed"},
  "productUrlSlug": "UPPERCASE-SLUG"
}`,
    },
    {
      role: "user",
      content: userContent,
    },
  ];
}

async function createListing(form: FormData) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AGENT_MODEL,
      messages: await listingMessages(form),
      temperature: 0.4,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => null);
    return jsonError(
      upstreamError(payload, `Agent 请求失败 (${response.status})`),
      response.status,
    );
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Mercato-Agent-Architecture": "route-execute",
    },
  });
}

async function createImage(form: FormData) {
  const image = form.get("image");
  if (!(image instanceof File)) return jsonError("请上传商品图片", 400);

  const skill = String(form.get("skill") ?? "amazon-scene-image");
  const slot = Math.max(0, Number(form.get("slot") ?? 0));
  const prompt = String(form.get("prompt") ?? "");
  const preset = imagePrompts[skill]?.[slot] ?? imagePrompts["amazon-scene-image"][0];
  const request = new FormData();
  request.set("model", IMAGE_MODEL);
  request.set(
    "prompt",
    `${preset}. Preserve the uploaded product's identity, silhouette, proportions, colors, logo and functional details. ${prompt}`.trim(),
  );
  request.set(
    "size",
    skill === "china-seeding-image"
      ? "1024x1536"
      : slot >= 4 && ["amazon-image-set", "ecommerce-image-set"].includes(skill)
        ? "1536x1024"
        : process.env.IMAGE_DEFAULT_SQUARE_SIZE ?? "1024x1024",
  );
  request.set("quality", process.env.IMAGE_DEFAULT_QUALITY ?? "medium");
  request.set("image", image, image.name || "product.png");

  const response = await fetch(`${BASE_URL}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: request,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return jsonError(
      upstreamError(payload, `图片生成失败 (${response.status})`),
      response.status,
    );
  }

  const url = imageOutputUrl(payload);
  if (url) return Response.json({ url });
  console.warn("Image response contained no image", {
    model: IMAGE_MODEL,
    responseKeys: payload && typeof payload === "object"
      ? Object.keys(payload).slice(0, 12)
      : [],
  });
  return jsonError("图片服务已响应，但没有返回可用图片，请重试");
}

async function createVideo(form: FormData) {
  const image = form.get("image");
  if (!(image instanceof File)) return jsonError("请上传商品图片", 400);
  const dataUrl = await fileDataUrl(image);
  const prompt = String(form.get("prompt") ?? "");
  const response = await fetch(`${BASE_URL}/contents/generations/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VIDEO_MODEL,
      resolution: process.env.VIDEO_DEFAULT_RESOLUTION ?? "720p",
      ratio: "9:16",
      duration: Number(process.env.VIDEO_DEFAULT_DURATION_SECONDS ?? 15),
      watermark: false,
      content: [
        {
          type: "text",
          text: `${prompt || "Create a polished 15-second ecommerce product video."} Keep the exact product identity. No subtitles, overlays, prices, watermarks or newly generated visible text.`,
        },
        {
          type: "image_url",
          image_url: { url: dataUrl },
          role: "first_frame",
        },
      ],
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return jsonError(
      upstreamError(payload, `视频任务创建失败 (${response.status})`),
      response.status,
    );
  }
  return Response.json(videoTask(payload));
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const action = String(form.get("action") ?? "");
    if (action === "listing") return await createListing(form);
    if (action === "image") return await createImage(form);
    if (action === "video") return await createVideo(form);
    return jsonError("未知生成类型", 400);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "生成失败");
  }
}

export async function GET(request: Request) {
  try {
    const taskId = new URL(request.url).searchParams.get("taskId");
    if (!taskId || !/^[A-Za-z0-9._:-]+$/.test(taskId)) {
      return jsonError("无效的视频任务 ID", 400);
    }
    const response = await fetch(
      `${BASE_URL}/contents/generations/tasks/${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${apiKey()}` } },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return jsonError(
        upstreamError(payload, `视频任务查询失败 (${response.status})`),
        response.status,
      );
    }
    return Response.json(videoTask(payload));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "查询失败");
  }
}
