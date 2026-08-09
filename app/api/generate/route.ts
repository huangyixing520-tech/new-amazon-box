import {
  authErrorResponse,
  ensureIdentitySchema,
  userApiKey,
} from "../../lib/auth";
import type { D1Binding } from "../../lib/runtime";
import {
  imageOutputSpec,
  singleImageTaskBoundary,
} from "../../image-output-spec.mjs";
import {
  listingSse,
  listingTextFromPayload,
  validatedListingFromPayload,
} from "../../listing-response.mjs";
import amazonImageSkillPrompt from "../../../skills/amazon-image-set/references/amazon-image-skill.md?raw";
import videoReplicaAnalysisPrompt from "../../../skills/video-replica/references/video-analysis-prompt.md?raw";

const BASE_URL =
  process.env.DOLA_BASE_URL?.replace(/\/$/, "") ??
  "https://api.dolaio.cn/aigateway/cisco/v1";
const LISTING_MODELS = Array.from(new Set([
  process.env.LISTING_MODEL ?? "MiniMax-M3",
  process.env.LISTING_FALLBACK_MODEL ?? "dolaio/gpt-5.6-terra",
  process.env.AGENT_FALLBACK_MODEL ?? "dolaio/gpt-5.6-terra",
]));
const VIDEO_MODEL = process.env.VIDEO_MODEL ?? "novai/seedance-2.0-mini";
const VIDEO_ANALYSIS_MODELS = Array.from(new Set([
  process.env.VIDEO_ANALYSIS_MODEL ?? LISTING_MODELS[0],
  process.env.VIDEO_ANALYSIS_FALLBACK_MODEL ?? LISTING_MODELS[1],
  process.env.AGENT_FALLBACK_MODEL ?? LISTING_MODELS[2],
]));
const MAX_UPLOADS = 9;

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
  "Selling Point layout L1: one-theme product hero with one concise benefit and unobstructed product identity. For wearable or carry products use W1 instead, with a real person and no added visible text or graphics",
  "Selling Point layout L2: two to four concise benefit areas arranged around an unobstructed product. For wearable or carry products use W2 instead, with a real person and no added visible text or graphics",
  "Selling Point layout L3: centered product information composition with two to four supported details. For wearable or carry products use W3 instead, with a real person and no added visible text or graphics",
  "Selling Point layout L4: product naturally integrated into a complete, believable lifestyle scene with clean negative space. For wearable or carry products use W4 instead, with a real person and no added visible text or graphics",
  "Selling Point layout L5: product plus one to three verifiable material, craft, or construction detail views. For wearable or carry products use W5 instead, with a real person and no added visible text or graphics",
  "Selling Point layout L6: real use, handling, operation, wearing, sitting, or lying scene supported by the product references",
  "Selling Point layout L7 only if the references prove real colors, sizes, accessories, or bundle contents; otherwise create a distinct eligible layout without inventing variants",
  "Selling Point layout L8 only if a truthful before-and-after change can be shown without exaggeration; otherwise create a distinct eligible layout without unsupported claims",
];

const aPlusPrompts = [
  "A+ layout L1: one-theme premium product story with an unobstructed hero product and concise copy",
  "A+ layout L2: two to four structured brand or benefit areas with consistent hierarchy and spacing",
  "A+ layout L4: premium product story in a complete, believable lifestyle environment with natural negative space",
  "A+ layout L5: product plus one to three verifiable material, craft, or construction detail views",
  "A+ layout L6: truthful real-use, wearing, handling, or operation evidence with the product as the focal point",
];

const mobileAPlusPrompts = [
  "Mobile A+ layout L10: adapt only the supplied corresponding completed Premium A+ image to the 600 by 450 landscape canvas. Preserve its theme, scene, selling point, copy, product, and brand style; only crop, scale, and rearrange as needed",
];

const amazonImageSkillHostRules = `
The product UI has already confirmed output type, quantity, sales region, image language, A+ type, and ratio. Do not ask questions or output JSON; generate this one assigned image now.
Treat slot type "main" as image_type="selling_point" and module_type="Selling Point". Treat "a-plus" as image_type="aplus" and use Standard A+ only when A+ type is standard, otherwise Premium A+. Treat "a-plus-mobile" as image_type="aplus" and module_type="Mobile A+".
The host sends one independent request per output. Follow the assigned slot direction, keep its layout distinct from the other numbered slots, and reuse the exact batch settings below. Explicit user instructions still override UI settings and defaults.
`;

function formContext(form: FormData) {
  const region = String(form.get("region") ?? "us");
  const language = String(form.get("language") ?? "en");
  const platform = String(form.get("platform") ?? "amazon");
  const brandColor = String(form.get("brandColor") ?? "auto");
  const brandColorDescription = brandColor === "auto"
    ? "Auto-detect a coherent primary color from the supplied product and brand assets"
    : brandColor;
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
    }. Publishing platform: ${platform}. Brand primary color: ${brandColorDescription}. Typography direction: ${fontStyle}.`,
    generationText: `Selling-point images: ${mainImageCount}. Selling-point image ratio: ${mainImageRatio}. A+ type: ${aPlusType}. A+ images: ${aPlusCount}.`,
  };
}

function taskBackend() {
  const url = process.env.TASK_BACKEND_URL?.replace(/\/$/, "");
  const token = process.env.TASK_BACKEND_TOKEN;
  if (!url || !token) throw new Error("图片任务后台尚未配置");
  return { url, token };
}

async function taskBackendFetch(url: string, init?: RequestInit) {
  const timeout = Math.max(
    1_000,
    Number(process.env.TASK_BACKEND_REQUEST_TIMEOUT_MS ?? 15_000),
  );
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`图片任务服务连接失败，请稍后重试 (${detail})`);
  }
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

function completionText(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => item && typeof item === "object" && "text" in item
        ? String((item as { text?: unknown }).text ?? "")
        : "")
      .join("\n")
      .trim();
  }
}

async function analyzeReferenceVideo(
  videoDataUrl: string,
  userPrompt: string,
  apiKey: string,
) {
  const failures: string[] = [];
  for (const model of VIDEO_ANALYSIS_MODELS) {
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          stream: false,
          messages: [
            { role: "system", content: videoReplicaAnalysisPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this reference video. User replacement request: ${userPrompt || "Replace the source product with the uploaded product while preserving the reference structure."}`,
                },
                { type: "video_url", video_url: { url: videoDataUrl } },
              ],
            },
          ],
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        failures.push(`${model}: ${upstreamError(payload, `HTTP ${response.status}`)}`);
        continue;
      }
      const storyboard = (completionText(payload) || listingTextFromPayload(payload)).trim();
      if (!storyboard) {
        failures.push(`${model}: 没有返回分镜脚本`);
        continue;
      }
      return storyboard;
    } catch (error) {
      failures.push(`${model}: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }
  throw new Error(`参考视频分析失败。${failures.join("；")}`);
}

const supportedImageMediaTypes = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function detectedImageMediaType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  const signature = String.fromCharCode(...bytes.subarray(0, 12));
  if (signature.startsWith("GIF87a") || signature.startsWith("GIF89a")) return "image/gif";
  if (signature.startsWith("RIFF") && signature.slice(8, 12) === "WEBP") return "image/webp";
}

async function normalizedImageFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = supportedImageMediaTypes.has(file.type)
    ? file.type
    : detectedImageMediaType(bytes);
  if (!mediaType) throw new Error(`无法识别图片格式：${file.name || "未命名图片"}`);
  return {
    bytes,
    file: mediaType === file.type
      ? file
      : new File([bytes], file.name || "product.png", { type: mediaType }),
    mediaType,
  };
}

async function fileDataUrl(file: File) {
  const { bytes, mediaType } = await normalizedImageFile(file);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${mediaType};base64,${btoa(binary)}`;
}

function uploadedImages(form: FormData) {
  return form.getAll("image")
    .filter((value): value is File => value instanceof File);
}

function uploadedReferenceVideo(form: FormData) {
  const value = form.get("referenceVideo");
  return value instanceof File && value.size ? value : undefined;
}

async function listingMessages(form: FormData) {
  const skill = String(form.get("skill") ?? "amazon-listing");
  const context = formContext(form);
  const prompt = String(form.get("prompt") ?? "");
  const images = await Promise.all(
    uploadedImages(form).map(async (image) => (await normalizedImageFile(image)).file),
  );
  const imageNames = images.length
    ? images.map((image, index) => `${index + 1}. ${image.name}`).join("\n")
    : "No uploaded product image";
  const userText = `[FORM]
Generation mode: Listing generation
Skill: ${skill}
Uploaded images (${images.length}):
${imageNames}

[BRAND GENE]
${context.brandText}

[GENERATION SETTINGS]
${context.generationText}

[USER INPUT]
${prompt || "Create a complete marketplace listing from the supplied product information."}

Treat the first uploaded image as the primary product identity. Use the remaining images only as supplementary references for angles, details, packaging and usage context. Inspect every supplied image carefully. Distinguish visible facts from assumptions and never invent non-visible specifications.`;
  const userContent = images.length
    ? [
        { type: "text", text: userText },
        ...await Promise.all(images.map(async (image) => ({
          type: "image_url",
          image_url: { url: await fileDataUrl(image) },
        }))),
      ]
    : userText;

  return [
    {
      role: "system",
      content: `You are Mercato, an Amazon Listing copywriting specialist. Follow the Amazon Listing Copy Skill below exactly.
The host has already routed this request to the selected Listing capability.
Do not create a plan, break the task into steps, choose another capability, or describe an execution process.
Generate the final listing directly in a single response.
Return only valid JSON, without markdown fences or commentary.
Write all customer-facing copy in the requested output language.
Title is a hard limit of 75 characters including spaces and punctuation. Use: core category keyword + one or two supported attributes/specifications/materials + a concise differentiator. Never use ! ? _ * $ @ # %, promotion words, or repeat a keyword more than twice.
Write exactly five bullets. Each must begin with a bold 3-8 word Benefit in the output language, then explain Advantage, then close with evidence-based Feature. Cover in order: core function; material/safety; scenario/audience; ease of use; specification/set/after-sales.
Use natural localized phrasing for the selected language and market. Cover functional, scenario, audience, comparison and concern intent without keyword stuffing.
Do not invent certifications, medical claims, exact dimensions, materials, battery capacity, performance figures, included accessories, operating mechanism, price, discount, coupon, tax, shipping, inventory or fulfillment terms. Unknown is better than invented.
Never output competitor brand names. Sif keyword data, Amazon frontend search references, and the user's sensitive-word library are not connected yet: treat all three as unavailable, derive natural market keywords from visible facts and user-provided information, and do not mention these missing sources.
Return exactly 20 unique target-language keywords: core 2, highWeight 3, title 3, bullet 6, description 3, backend 3. Backend terms must not already occur in the title or bullets.
Use this schema:
{
  "title": "target-language title, maximum 75 characters",
  "brand": "brand or Generic",
  "category": "breadcrumb category",
  "salePrice": "user-supplied numeric string or empty string",
  "listPrice": "user-supplied numeric string or empty string",
  "bullets": ["**Benefit** Advantage. Feature."],
  "description": "one persuasive paragraph",
  "aPlusHeadline": "short brand headline",
  "specifications": {"Product type": "visible fact", "Recommended use": "reasonable use case", "Other visible attribute": "visible fact or Not confirmed"},
  "productUrlSlug": "UPPERCASE-SLUG",
  "keywords": {"core": ["keyword", "keyword"], "highWeight": ["keyword", "keyword", "keyword"], "title": ["keyword", "keyword", "keyword"], "bullet": ["keyword", "keyword", "keyword", "keyword", "keyword", "keyword"], "description": ["keyword", "keyword", "keyword"], "backend": ["keyword", "keyword", "keyword"]}
}`,
    },
    {
      role: "user",
      content: userContent,
    },
  ];
}

async function createListing(form: FormData, apiKey: string) {
  const messages = await listingMessages(form);
  const failures: string[] = [];

  for (const model of LISTING_MODELS) {
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0,
          max_tokens: 5000,
          stream: false,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        failures.push(`${model}: ${upstreamError(payload, `HTTP ${response.status}`)}`);
        continue;
      }
      const listing = validatedListingFromPayload(payload);
      return new Response(listingSse(listing), {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Mercato-Generation-Architecture": "validated-listing-json",
          "X-Mercato-Listing-Model": model,
        },
      });
    } catch (error) {
      failures.push(`${model}: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  return jsonError(`Listing 生成失败。${failures.join("；")}`, 502);
}

async function recordTask(
  db: D1Binding,
  taskId: string,
  userId: string,
  kind: "image" | "video",
) {
  await ensureIdentitySchema(db);
  await db.prepare(`
    INSERT OR REPLACE INTO generation_tasks (id, user_id, kind, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(taskId, userId, kind, new Date().toISOString()).run();
}

async function ownsTask(db: D1Binding, taskId: string, userId: string) {
  await ensureIdentitySchema(db);
  return Boolean(await db.prepare(
    "SELECT id FROM generation_tasks WHERE id = ? AND user_id = ?",
  ).bind(taskId, userId).first<{ id: string }>());
}

async function createImage(
  form: FormData,
  apiKey: string,
  userId: string,
  db: D1Binding,
) {
  const images = await Promise.all(
    uploadedImages(form).map(async (image) => (await normalizedImageFile(image)).file),
  );
  if (!images.length) return jsonError("请上传商品图片", 400);

  const skill = String(form.get("skill") ?? "amazon-scene-image");
  const slot = Math.max(0, Number(form.get("slot") ?? 0));
  const slotIndex = Math.max(0, Number(form.get("slotIndex") ?? slot));
  const rawSlotType = String(form.get("slotType") ?? "");
  const slotType = ["main", "a-plus", "a-plus-mobile"].includes(rawSlotType)
    ? rawSlotType
    : "";
  const prompt = String(form.get("prompt") ?? "");
  const context = formContext(form);
  const outputSpec = imageOutputSpec({
    slotType,
    slotIndex,
    aPlusType: context.aPlusType,
    mainImageRatio: context.mainImageRatio,
  });
  const preset = slotType === "main"
    ? mainImagePrompts[slotIndex % mainImagePrompts.length]
    : slotType === "a-plus"
      ? aPlusPrompts[slotIndex % aPlusPrompts.length]
      : slotType === "a-plus-mobile"
        ? mobileAPlusPrompts[slotIndex % mobileAPlusPrompts.length]
        : imagePrompts[skill]?.[slot] ?? imagePrompts["amazon-scene-image"][0];
  const useAmazonImageSkill = Boolean(slotType) &&
    ["amazon-image-set", "amazon-listing"].includes(skill);
  const request = new FormData();
  request.set(
    "prompt",
    `${singleImageTaskBoundary}
Deliverable: ${outputSpec.label}.
Format: ${outputSpec.formatInstruction}
Creative direction for this slot only: ${preset}.
${context.brandText}
${context.generationText}
${useAmazonImageSkill ? `${amazonImageSkillHostRules}\nAuthoritative Amazon image Skill:\n${amazonImageSkillPrompt}` : ""}
The first uploaded image is the primary product identity. Remaining images are supplementary references for angles, details, packaging and usage context. Preserve the product's identity, silhouette, proportions, colors, logo and visible functional details.
The user's overall request is background context only and must not change this single-image task boundary: ${prompt}
Final output contract: ${singleImageTaskBoundary} Render one continuous edge-to-edge canvas. Integrate any benefits or details into that single composition; do not place separate sub-images, inset frames, alternate views, or mini-scenes inside it.`.trim(),
  );
  request.set(
    "size",
    slotType
      ? outputSpec.providerSize
      : skill === "china-seeding-image"
        ? "1024x1536"
        : slot >= 4 && ["amazon-image-set", "ecommerce-image-set"].includes(skill)
          ? "1536x1024"
          : process.env.IMAGE_DEFAULT_SQUARE_SIZE ?? "1024x1024",
  );
  request.set("quality", process.env.IMAGE_DEFAULT_QUALITY ?? "medium");
  if (slotType) {
    request.set("outputWidth", String(outputSpec.outputWidth));
    request.set("outputHeight", String(outputSpec.outputHeight));
  }
  images.forEach((image) => request.append("image", image, image.name || "product.png"));

  const backend = taskBackend();
  const response = await taskBackendFetch(`${backend.url}/v1/image-tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${backend.token}`,
      "X-Mercato-Upstream-Key": apiKey,
    },
    body: request,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return jsonError(
      upstreamError(payload, `图片任务创建失败 (${response.status})`),
      response.status,
    );
  }
  const taskId = taskField(payload, ["id", "task_id"]);
  if (!taskId) return jsonError("图片任务后台没有返回任务 ID", 502);
  await recordTask(db, taskId, userId, "image");
  return Response.json(payload, { status: 202 });
}

async function createVideo(
  form: FormData,
  apiKey: string,
  userId: string,
  db: D1Binding,
) {
  const images = uploadedImages(form);
  const image = images[0];
  if (!image) return jsonError("请至少上传 1 张商品图片", 400);
  const prompt = String(form.get("prompt") ?? "");
  const skill = String(form.get("skill") ?? "video-replica");
  const referenceVideo = uploadedReferenceVideo(form);
  if (skill === "video-replica" && !referenceVideo) {
    return jsonError("视频复刻需要上传 1 个参考视频", 400);
  }
  if (referenceVideo && !referenceVideo.type.startsWith("video/")) {
    return jsonError("参考视频文件格式不正确", 400);
  }
  if (referenceVideo && referenceVideo.size > 100 * 1024 * 1024) {
    return jsonError("参考视频不能超过 100 MB", 400);
  }
  const imageDataUrls = await Promise.all(images.map(fileDataUrl));
  const referenceVideoDataUrl = referenceVideo
    ? await fileDataUrl(referenceVideo)
    : undefined;
  const context = formContext(form);
  const replicaStoryboard = skill === "video-replica" && referenceVideoDataUrl
    ? await analyzeReferenceVideo(referenceVideoDataUrl, prompt, apiKey)
    : "";
  const skillDirection = skill === "talking-product-video"
    ? "Create a direct-response product demonstration with a natural presenter-led sales rhythm, clear product handling and believable spoken-delivery pacing."
    : "Recreate the reference video's shot order, camera movement, pacing, transitions and product demonstration rhythm. Treat the reference video only as motion and composition guidance. Replace its subject with the supplied product and preserve the supplied product identity exactly.";
  const referenceContent = referenceVideoDataUrl
    ? [{
        type: "video_url",
        video_url: { url: referenceVideoDataUrl },
        role: "reference_video",
      }]
    : [];
  const productContent = imageDataUrls.map((url, index) => ({
    type: "image_url",
    image_url: { url },
    role: index === 0 ? "first_frame" : "reference_image",
  }));
  const response = await fetch(`${BASE_URL}/contents/generations/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
          } ${replicaStoryboard ? `Reference-video storyboard:\n${replicaStoryboard}\nUse this storyboard as the shot-by-shot generation structure.` : ""} The first product image is the primary identity reference; the remaining product images provide supplementary views and details. Replace the source product with the supplied product. Do not copy visible brands, platform UI, usernames, watermarks or unsupported claims from the reference video. Only reproduce on-screen captions identified by the storyboard. Keep the exact supplied product identity.`,
        },
        ...referenceContent,
        ...productContent,
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
  const task = videoTask(payload);
  if (!task.id) return jsonError("视频服务没有返回任务 ID", 502);
  await recordTask(db, task.id, userId, "video");
  return Response.json(task);
}

export async function POST(request: Request) {
  try {
    const {
      user,
      apiKey,
      DB,
    } = await userApiKey(request);
    const form = await request.formData();
    if (uploadedImages(form).length > MAX_UPLOADS) {
      return jsonError(`最多上传 ${MAX_UPLOADS} 张图片`, 400);
    }
    const action = String(form.get("action") ?? "");
    if (action === "listing") return await createListing(form, apiKey);
    if (action === "image") {
      return await createImage(form, apiKey, user.id, DB);
    }
    if (action === "video") {
      return await createVideo(form, apiKey, user.id, DB);
    }
    return jsonError("未知生成类型", 400);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const {
      user,
      apiKey,
      DB,
    } = await userApiKey(request);
    const search = new URL(request.url).searchParams;
    const imageTaskId = search.get("imageTaskId");
    if (imageTaskId) {
      if (!/^[a-f0-9-]+$/.test(imageTaskId)) {
        return jsonError("无效的图片任务 ID", 400);
      }
      if (!(await ownsTask(DB, imageTaskId, user.id))) {
        return jsonError("任务不存在", 404);
      }
      const backend = taskBackend();
      const response = await taskBackendFetch(
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
    if (!(await ownsTask(DB, taskId, user.id))) {
      return jsonError("任务不存在", 404);
    }
    const response = await fetch(
      `${BASE_URL}/contents/generations/tasks/${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
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
    return authErrorResponse(error);
  }
}
