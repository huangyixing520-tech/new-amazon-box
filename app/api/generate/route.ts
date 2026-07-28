const BASE_URL =
  process.env.DOLA_BASE_URL?.replace(/\/$/, "") ??
  "https://api.dolaio.cn/aigateway/cisco/v1";
const AGENT_MODEL = process.env.AGENT_MODEL ?? "MiniMax-M3";
const VIDEO_MODEL = process.env.VIDEO_MODEL ?? "novai/seedance-2.0-mini";

const languageNames: Record<string, string> = {
  en: "English",
  zh: "Chinese",
  ja: "Japanese",
  ru: "Russian",
  it: "Italian",
  fr: "French",
  es: "Spanish",
  de: "German",
  ko: "Korean",
  th: "Thai",
  pt: "Portuguese",
  ms: "Malay",
  nl: "Dutch",
  pl: "Polish",
  sv: "Swedish",
  tr: "Turkish",
  other: "the user-selected language",
};

const regionNames: Record<string, string> = {
  us: "United States",
  cn: "China",
  eu: "European Union",
  jp: "Japan",
  br: "Brazil",
  kr: "South Korea",
  tha: "Thailand",
  ru: "Russia",
  uk: "United Kingdom",
  in: "India",
  phl: "Philippines",
  id: "Indonesia",
  mys: "Malaysia",
  vnm: "Vietnam",
  mx: "Mexico",
  latam: "Latin America",
  gcc: "Gulf Cooperation Council / Middle East",
  other: "the user-selected market",
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

const mainImagePrompts = [
  "Amazon-compliant ecommerce hero image, pure white background, centered product, accurate shape and color, realistic soft shadow, no text",
  "Ecommerce feature image showing the product's clearest visible benefit with a focused commercial composition",
  "Lifestyle image showing the product in believable everyday use",
  "Detail image emphasizing visible materials, construction and craftsmanship",
  "Scale and portability image with a clean marketplace composition",
  "Accessory or usage-step image using only details supported by the reference product",
  "Alternative lifestyle image for a second realistic use case",
  "Premium closing image with the product as the clear focal point",
];

const aPlusPrompts = [
  "Wide Amazon A+ brand banner with a premium product story composition and clean negative space",
  "Wide Amazon A+ benefit banner focused on the strongest visible product advantage",
  "Wide Amazon A+ lifestyle banner showing a believable use environment",
  "Wide Amazon A+ craftsmanship banner with refined macro product details",
  "Wide Amazon A+ closing banner with cohesive brand atmosphere and a clear product focal point",
];

const mobileAPlusPrompts = [
  "Vertical mobile Amazon A+ brand banner derived from the desktop brand story with a phone-first composition",
  "Vertical mobile Amazon A+ benefit banner with one clear product advantage and generous safe margins",
  "Vertical mobile Amazon A+ lifestyle banner with a believable use environment",
  "Vertical mobile Amazon A+ craftsmanship banner with refined macro product details",
  "Vertical mobile Amazon A+ closing banner with cohesive brand atmosphere and a clear product focal point",
];

function formContext(form: FormData) {
  const region = String(form.get("region") ?? "us");
  const language = String(form.get("language") ?? "en");
  const platform = String(form.get("platform") ?? "amazon");
  const brandColor = String(form.get("brandColor") ?? "#111111");
  const fontStyle = String(form.get("fontStyle") ?? "auto");
  const aPlusType = String(form.get("aPlusType") ?? "advanced");
  const aPlusCount = Math.max(0, Number(form.get("aPlusCount") ?? 0));
  const mainImageCount = Math.max(0, Number(form.get("mainImageCount") ?? 0));
  const mainImageRatio = String(form.get("mainImageRatio") ?? "1:1");
  return {
    region,
    language,
    platform,
    brandColor,
    fontStyle,
    aPlusType,
    aPlusCount,
    mainImageCount,
    mainImageRatio,
    brandText: `Sales market: ${regionNames[region] ?? region}. Output language: ${
      languageNames[language] ?? language
    }. Publishing platform: ${platform}. Brand primary color: ${brandColor}. Typography direction: ${fontStyle}.`,
    generationText: `Main and secondary images: ${mainImageCount}. Main and secondary image ratio: ${mainImageRatio}. A+ type: ${aPlusType}. A+ images: ${aPlusCount}.`,
  };
}

function apiKey() {
  const value = process.env.DOLA_API_KEY;
  if (!value) throw new Error("DOLA_API_KEY 尚未配置");
  return value;
}

function taskBackend() {
  const url = process.env.TASK_BACKEND_URL?.replace(/\/$/, "");
  const token = process.env.TASK_BACKEND_TOKEN;
  if (!url || !token) throw new Error("图片任务后台尚未配置");
  return { url, token };
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
  const skill = String(form.get("skill") ?? "amazon-listing");
  const context = formContext(form);
  const prompt = String(form.get("prompt") ?? "");
  const image = form.get("image");
  const imageName = image instanceof File ? image.name : "uploaded product image";
  const userText = `[FORM]
Generation mode: Listing generation
Skill: ${skill}
Uploaded image: ${imageName}

[BRAND GENE]
${context.brandText}

[GENERATION SETTINGS]
${context.generationText}

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
      upstreamError(payload, `Listing 请求失败 (${response.status})`),
      response.status,
    );
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Mercato-Generation-Architecture": "direct-mode-skill",
    },
  });
}

async function createImage(form: FormData) {
  const image = form.get("image");
  if (!(image instanceof File)) return jsonError("请上传商品图片", 400);

  const skill = String(form.get("skill") ?? "amazon-scene-image");
  const slot = Math.max(0, Number(form.get("slot") ?? 0));
  const slotIndex = Math.max(0, Number(form.get("slotIndex") ?? slot));
  const rawSlotType = String(form.get("slotType") ?? "");
  const slotType = ["main", "a-plus", "a-plus-mobile"].includes(rawSlotType)
    ? rawSlotType
    : "";
  const prompt = String(form.get("prompt") ?? "");
  const context = formContext(form);
  const preset = slotType === "main"
    ? mainImagePrompts[slotIndex % mainImagePrompts.length]
    : slotType === "a-plus"
      ? aPlusPrompts[slotIndex % aPlusPrompts.length]
      : slotType === "a-plus-mobile"
        ? mobileAPlusPrompts[slotIndex % mobileAPlusPrompts.length]
        : imagePrompts[skill]?.[slot] ?? imagePrompts["amazon-scene-image"][0];
  const request = new FormData();
  request.set(
    "prompt",
    `${preset}. ${context.brandText} ${context.generationText} Preserve the uploaded product's identity, silhouette, proportions, colors, logo and visible functional details. Do not combine multiple layouts into a collage. Create exactly one finished image for this single task. ${prompt}`.trim(),
  );
  request.set(
    "size",
    slotType === "a-plus-mobile"
      || skill === "china-seeding-image"
      || (slotType === "main" && context.mainImageRatio === "3:4")
      ? "1024x1536"
      : slotType === "a-plus"
        || (slot >= 4 && ["amazon-image-set", "ecommerce-image-set"].includes(skill))
        ? "1536x1024"
        : process.env.IMAGE_DEFAULT_SQUARE_SIZE ?? "1024x1024",
  );
  request.set("quality", process.env.IMAGE_DEFAULT_QUALITY ?? "medium");
  request.set("image", image, image.name || "product.png");

  const backend = taskBackend();
  const response = await fetch(`${backend.url}/v1/image-tasks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${backend.token}` },
    body: request,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return jsonError(
      upstreamError(payload, `图片任务创建失败 (${response.status})`),
      response.status,
    );
  }
  return Response.json(payload, { status: 202 });
}

async function createVideo(form: FormData) {
  const image = form.get("image");
  if (!(image instanceof File)) return jsonError("请上传商品图片", 400);
  const dataUrl = await fileDataUrl(image);
  const prompt = String(form.get("prompt") ?? "");
  const skill = String(form.get("skill") ?? "video-replica");
  const context = formContext(form);
  const skillDirection = skill === "talking-product-video"
    ? "Create a direct-response product demonstration with a natural presenter-led sales rhythm, clear product handling and believable spoken-delivery pacing."
    : "Create a polished visual recreation based on the user's requested pacing, shot language and product presentation style.";
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
          text: `${skillDirection} ${context.brandText} ${
            prompt || "Create a polished 15-second ecommerce product video."
          } Keep the exact product identity. No subtitles, overlays, prices, watermarks or newly generated visible text.`,
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
    const search = new URL(request.url).searchParams;
    const imageTaskId = search.get("imageTaskId");
    if (imageTaskId) {
      if (!/^[a-f0-9-]+$/.test(imageTaskId)) {
        return jsonError("无效的图片任务 ID", 400);
      }
      const backend = taskBackend();
      const response = await fetch(
        `${backend.url}/v1/image-tasks/${encodeURIComponent(imageTaskId)}`,
        {
          headers: { Authorization: `Bearer ${backend.token}` },
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        return jsonError(
          upstreamError(payload, `图片任务查询失败 (${response.status})`),
          response.status,
        );
      }
      return Response.json(payload);
    }

    const taskId = search.get("taskId");
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
