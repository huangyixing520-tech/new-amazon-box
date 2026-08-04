import { createServer } from "node:http";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { imageOutputUrl } from "./image-response.mjs";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_COUNT = 9;
const MAX_IMAGE_RETRIES = 18;
const IMAGE_RETRY_INTERVAL_MS = 10_000;
const TASK_TTL_MS = 24 * 60 * 60 * 1000;

function errorMessage(payload, fallback) {
  if (!payload || typeof payload !== "object") return fallback;
  if (typeof payload.error === "string") return payload.error;
  if (payload.error?.message) return payload.error.message;
  if (typeof payload.message === "string") {
    try {
      const nested = JSON.parse(payload.message);
      return errorMessage(nested, payload.message);
    } catch {
      return payload.message;
    }
  }
  return fallback;
}

function retryableImageError(message) {
  return /(?:429|负载已饱和|稍后再试|overload|rate.?limit|too many requests)/i.test(message);
}

function authorized(requestToken, expectedToken) {
  const supplied = Buffer.from(requestToken || "");
  const expected = Buffer.from(`Bearer ${expectedToken}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function encryptionKey(secret) {
  return createHash("sha256").update(secret).digest();
}

function encryptUpstreamKey(value, secret) {
  if (!secret) throw new Error("USER_KEY_ENCRYPTION_SECRET 尚未配置");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptUpstreamKey(value, secret) {
  const [version, ivValue, tagValue, encryptedValue] = String(value).split(".");
  if (
    version !== "v1" ||
    !ivValue ||
    !tagValue ||
    !encryptedValue ||
    !secret
  ) {
    throw new Error("用户 API Key 密文无效");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function publicTask(task) {
  return {
    id: task.id,
    status: task.status,
    url: task.url,
    error: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function outputDimensions(task) {
  const width = Number(task.outputWidth);
  const height = Number(task.outputHeight);
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width < 1 || height < 1 || width > 4096 || height > 4096) return null;
  return { width, height };
}

async function imageBytes(sourceUrl) {
  if (sourceUrl.startsWith("data:")) {
    const match = sourceUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!match) throw new Error("图片服务返回的图片数据无效");
    return match[2]
      ? Buffer.from(match[3], "base64")
      : Buffer.from(decodeURIComponent(match[3]));
  }
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error("无法读取图片服务返回的图片");
  return Buffer.from(await response.arrayBuffer());
}

async function finalizeImageOutput(sourceUrl, dimensions) {
  if (!dimensions) return sourceUrl;
  const finalImage = await sharp(await imageBytes(sourceUrl))
    .rotate()
    .resize({
      width: dimensions.width,
      height: dimensions.height,
      fit: "cover",
      position: "centre",
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return `data:image/png;base64,${finalImage.toString("base64")}`;
}

export function createTaskServer(options = {}) {
  const configuredRetryDelays = options.retryDelays ?? (
    process.env.IMAGE_RETRY_DELAYS_MS
      ? String(process.env.IMAGE_RETRY_DELAYS_MS).split(",")
      : Array.from(
          { length: MAX_IMAGE_RETRIES },
          () => IMAGE_RETRY_INTERVAL_MS,
        )
  );
  const config = {
    dataDir: options.dataDir ?? process.env.DATA_DIR ?? join(process.cwd(), "data"),
    baseUrl: (options.baseUrl ?? process.env.DOLA_BASE_URL ??
      "https://api.dolaio.cn/aigateway/cisco/v1").replace(/\/$/, ""),
    apiKey: options.apiKey ?? process.env.DOLA_API_KEY,
    userKeyEncryptionSecret:
      options.userKeyEncryptionSecret ??
      process.env.USER_KEY_ENCRYPTION_SECRET,
    token: options.token ?? process.env.TASK_BACKEND_TOKEN,
    model: options.model ?? process.env.IMAGE_MODEL ?? "gpt-image-2",
    concurrency: Math.max(1, Number(options.concurrency ?? process.env.TASK_CONCURRENCY ?? 2)),
    retryDelays: configuredRetryDelays
      .map(Number)
      .filter((delay) => Number.isFinite(delay) && delay >= 0)
      .slice(0, MAX_IMAGE_RETRIES),
  };
  const tasksDir = join(config.dataDir, "tasks");
  const inputsDir = join(config.dataDir, "inputs");
  const pending = [];
  const queued = new Set();
  let active = 0;

  const taskPath = (id) => join(tasksDir, `${id}.json`);
  const inputPath = (id, index) => index === undefined
    ? join(inputsDir, `${id}.bin`)
    : join(inputsDir, `${id}-${index}.bin`);

  async function readTask(id) {
    return JSON.parse(await readFile(taskPath(id), "utf8"));
  }

  async function saveTask(task) {
    task.updatedAt = new Date().toISOString();
    await writeFile(taskPath(task.id), JSON.stringify(task));
  }

  async function runTask(id) {
    const task = await readTask(id);
    task.status = "running";
    task.error = undefined;
    await saveTask(task);
    try {
      const imageInputs = Array.isArray(task.images) && task.images.length
        ? await Promise.all(task.images.map(async (image, index) => ({
            bytes: await readFile(inputPath(id, index)),
            name: image.name,
            type: image.type,
          })))
        : [{
            bytes: await readFile(inputPath(id)),
            name: task.imageName,
            type: task.imageType,
          }];
      const upstreamKey = task.encryptedUpstreamKey
        ? decryptUpstreamKey(
            task.encryptedUpstreamKey,
            config.userKeyEncryptionSecret,
          )
        : config.apiKey;
      if (!upstreamKey) throw new Error("任务没有可用的模型 API Key");
      const request = new FormData();
      request.set("model", task.model || config.model);
      request.set("prompt", task.prompt);
      request.set("size", task.size);
      request.set("quality", task.quality);
      imageInputs.forEach((image) => request.append(
        imageInputs.length === 1 ? "image" : "image[]",
        new Blob([image.bytes], { type: image.type || "image/png" }),
        image.name || "product.png",
      ));
      let url;
      for (let attempt = 0; attempt <= config.retryDelays.length; attempt += 1) {
        const response = await fetch(`${config.baseUrl}/images/edits`, {
          method: "POST",
          headers: { Authorization: `Bearer ${upstreamKey}` },
          body: request,
          signal: AbortSignal.timeout(10 * 60 * 1000),
        });
        const payload = await response.json().catch(() => null);
        url = response.ok ? imageOutputUrl(payload) : undefined;
        if (url) break;

        const message = errorMessage(
          payload,
          response.ok
            ? "图片服务已响应，但没有返回可用图片"
            : `图片生成失败 (${response.status})`,
        );
        const retryDelay = config.retryDelays[attempt];
        if (!retryableImageError(message) || retryDelay === undefined) {
          throw new Error(message);
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
      if (!url) throw new Error("图片服务已响应，但没有返回可用图片");
      url = await finalizeImageOutput(url, outputDimensions(task));
      task.status = "succeeded";
      task.url = url;
      task.error = undefined;
    } catch (error) {
      task.status = "failed";
      task.error = error instanceof Error ? error.message : "图片生成失败";
    }
    await saveTask(task);
  }

  function drain() {
    while (active < config.concurrency && pending.length) {
      const id = pending.shift();
      queued.delete(id);
      active += 1;
      void runTask(id).finally(() => {
        active -= 1;
        drain();
      });
    }
  }

  function enqueue(id) {
    if (queued.has(id)) return;
    queued.add(id);
    pending.push(id);
    drain();
  }

  async function recover() {
    await Promise.all([mkdir(tasksDir, { recursive: true }), mkdir(inputsDir, { recursive: true })]);
    for (const name of await readdir(tasksDir)) {
      if (!name.endsWith(".json")) continue;
      const task = await readTask(name.slice(0, -5)).catch(() => null);
      if (task && ["queued", "running"].includes(task.status)) enqueue(task.id);
    }
  }

  async function cleanup() {
    const cutoff = Date.now() - TASK_TTL_MS;
    for (const name of await readdir(tasksDir).catch(() => [])) {
      if (!name.endsWith(".json")) continue;
      const id = name.slice(0, -5);
      const task = await readTask(id).catch(() => null);
      if (task && Date.parse(task.createdAt) < cutoff && !["queued", "running"].includes(task.status)) {
        await Promise.all([
          rm(taskPath(id), { force: true }),
          rm(inputPath(id), { force: true }),
          ...Array.from(
            { length: Math.max(MAX_UPLOAD_COUNT, task.images?.length ?? 0) },
            (_, index) => rm(inputPath(id, index), { force: true }),
          ),
        ]);
      }
    }
  }

  const ready = recover();
  const cleanupTimer = setInterval(() => void cleanup(), 60 * 60 * 1000);
  cleanupTimer.unref();

  const server = createServer(async (request, response) => {
    try {
      await ready;
      const url = new URL(request.url || "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/health") {
        return json(response, 200, { ok: true, active, queued: pending.length });
      }
      if (!config.token) {
        return json(response, 503, { error: "后台密钥尚未配置" });
      }
      if (!authorized(request.headers.authorization, config.token)) {
        return json(response, 401, { error: "未授权" });
      }
      if (request.method === "GET" && /^\/v1\/image-tasks\/[a-f0-9-]+$/.test(url.pathname)) {
        const id = url.pathname.split("/").pop();
        const task = await readTask(id).catch(() => null);
        return task
          ? json(response, 200, publicTask(task))
          : json(response, 404, { error: "任务不存在或已过期" });
      }
      if (request.method !== "POST" || url.pathname !== "/v1/image-tasks") {
        return json(response, 404, { error: "Not found" });
      }
      const suppliedUpstreamKey = request.headers["x-mercato-upstream-key"];
      const upstreamKey = Array.isArray(suppliedUpstreamKey)
        ? suppliedUpstreamKey[0]
        : suppliedUpstreamKey;
      if (!upstreamKey && !config.apiKey) {
        return json(response, 503, { error: "任务没有可用的模型 API Key" });
      }
      if (upstreamKey && !config.userKeyEncryptionSecret) {
        return json(response, 503, {
          error: "USER_KEY_ENCRYPTION_SECRET 尚未配置",
        });
      }
      const contentLength = Number(request.headers["content-length"] ?? 0);
      if (contentLength > MAX_UPLOAD_BYTES) {
        return json(response, 413, { error: "上传图片总大小不能超过 20MB" });
      }
      const webRequest = new Request("http://localhost/v1/image-tasks", {
        method: "POST",
        headers: request.headers,
        body: Readable.toWeb(request),
        duplex: "half",
      });
      const form = await webRequest.formData();
      const images = form.getAll("image")
        .filter((value) => value instanceof File);
      if (!images.length) return json(response, 400, { error: "请上传商品图片" });
      if (images.length > MAX_UPLOAD_COUNT) {
        return json(response, 400, { error: `最多上传 ${MAX_UPLOAD_COUNT} 张图片` });
      }
      if (images.reduce((total, image) => total + image.size, 0) > MAX_UPLOAD_BYTES) {
        return json(response, 413, { error: "上传图片总大小不能超过 20MB" });
      }
      const id = randomUUID();
      const now = new Date().toISOString();
      const task = {
        id,
        status: "queued",
        prompt: String(form.get("prompt") ?? ""),
        model: String(form.get("model") ?? config.model),
        size: String(form.get("size") ?? "1024x1024"),
        outputWidth: String(form.get("outputWidth") ?? ""),
        outputHeight: String(form.get("outputHeight") ?? ""),
        quality: String(form.get("quality") ?? "medium"),
        images: images.map((image) => ({
          name: image.name,
          type: image.type,
        })),
        encryptedUpstreamKey: upstreamKey
          ? encryptUpstreamKey(upstreamKey, config.userKeyEncryptionSecret)
          : undefined,
        createdAt: now,
        updatedAt: now,
      };
      await Promise.all(images.map(async (image, index) => {
        await writeFile(inputPath(id, index), Buffer.from(await image.arrayBuffer()));
      }));
      await saveTask(task);
      enqueue(id);
      return json(response, 202, publicTask(task));
    } catch (error) {
      return json(response, 500, {
        error: error instanceof Error ? error.message : "任务服务异常",
      });
    }
  });

  server.on("close", () => clearInterval(cleanupTimer));
  return server;
}

const entryPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryPath) {
  const port = Number(process.env.PORT ?? 8788);
  const server = createTaskServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`Mercato image task backend listening on :${port}`);
  });
}
