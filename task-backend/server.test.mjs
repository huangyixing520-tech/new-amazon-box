import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { createTaskServer } from "./server.mjs";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test("returns immediately, runs the image job, and exposes its result", async (context) => {
  const dataDir = await mkdtemp(join(tmpdir(), "mercato-task-"));
  context.after(() => rm(dataDir, { recursive: true, force: true }));

  const upstream = createServer(async (request, response) => {
    assert.equal(request.url, "/images/edits");
    assert.equal(request.headers.authorization, "Bearer dola-test");
    await new Promise((resolve) => setTimeout(resolve, 120));
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ b64_json: "generated-image" }] }));
  });
  const upstreamPort = await listen(upstream);
  context.after(() => close(upstream));

  const backend = createTaskServer({
    dataDir,
    baseUrl: `http://127.0.0.1:${upstreamPort}`,
    apiKey: "dola-test",
    token: "backend-test",
    concurrency: 1,
  });
  const backendPort = await listen(backend);
  context.after(() => close(backend));

  const form = new FormData();
  form.set("prompt", "Keep the product exact");
  form.set("image", new File(["product"], "product.png", { type: "image/png" }));
  const startedAt = Date.now();
  const createdResponse = await fetch(`http://127.0.0.1:${backendPort}/v1/image-tasks`, {
    method: "POST",
    headers: { Authorization: "Bearer backend-test" },
    body: form,
  });
  assert.equal(createdResponse.status, 202);
  assert.ok(Date.now() - startedAt < 100);
  const created = await createdResponse.json();
  assert.equal(created.status, "queued");

  let completed;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 30));
    const response = await fetch(
      `http://127.0.0.1:${backendPort}/v1/image-tasks/${created.id}`,
      { headers: { Authorization: "Bearer backend-test" } },
    );
    completed = await response.json();
    if (completed.status === "succeeded") break;
  }
  assert.equal(completed.status, "succeeded");
  assert.equal(completed.url, "data:image/png;base64,generated-image");
});

test("exports an exact final A+ canvas instead of the provider working ratio", async (context) => {
  const dataDir = await mkdtemp(join(tmpdir(), "mercato-task-final-canvas-"));
  context.after(() => rm(dataDir, { recursive: true, force: true }));
  const sourcePng = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><rect width="1536" height="1024" fill="#243447"/></svg>',
  ).toString("base64");
  const upstream = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ b64_json: sourcePng }] }));
  });
  const upstreamPort = await listen(upstream);
  context.after(() => close(upstream));

  const backend = createTaskServer({
    dataDir,
    baseUrl: `http://127.0.0.1:${upstreamPort}`,
    apiKey: "dola-test",
    token: "backend-test",
  });
  const backendPort = await listen(backend);
  context.after(() => close(backend));

  const form = new FormData();
  form.set("image", new File(["product"], "product.png", { type: "image/png" }));
  form.set("outputWidth", "1464");
  form.set("outputHeight", "600");
  const created = await fetch(`http://127.0.0.1:${backendPort}/v1/image-tasks`, {
    method: "POST",
    headers: { Authorization: "Bearer backend-test" },
    body: form,
  }).then((response) => response.json());

  let completed;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    completed = await fetch(
      `http://127.0.0.1:${backendPort}/v1/image-tasks/${created.id}`,
      { headers: { Authorization: "Bearer backend-test" } },
    ).then((response) => response.json());
    if (completed.status !== "queued" && completed.status !== "running") break;
  }
  assert.equal(completed.status, "succeeded");
  const finalBuffer = Buffer.from(String(completed.url).split(",")[1], "base64");
  const metadata = await sharp(finalBuffer).metadata();
  assert.deepEqual([metadata.width, metadata.height], [1464, 600]);
});

test("protects task endpoints while keeping health public", async (context) => {
  const dataDir = await mkdtemp(join(tmpdir(), "mercato-task-auth-"));
  context.after(() => rm(dataDir, { recursive: true, force: true }));
  const backend = createTaskServer({
    dataDir,
    baseUrl: "http://127.0.0.1:1",
    apiKey: "dola-test",
    token: "backend-test",
  });
  const port = await listen(backend);
  context.after(() => close(backend));

  assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/v1/image-tasks/not-found`)).status, 401);
});

test("caps image task concurrency at ten", async (context) => {
  const dataDir = await mkdtemp(join(tmpdir(), "mercato-task-concurrency-"));
  context.after(() => rm(dataDir, { recursive: true, force: true }));
  const backend = createTaskServer({
    dataDir,
    apiKey: "dola-test",
    token: "backend-test",
    concurrency: 100,
  });
  const port = await listen(backend);
  context.after(() => close(backend));

  const health = await fetch(`http://127.0.0.1:${port}/health`).then(
    (response) => response.json(),
  );
  assert.equal(health.concurrency, 10);
});

test("retries a logical 429 returned with HTTP 200", async (context) => {
  const dataDir = await mkdtemp(join(tmpdir(), "mercato-task-retry-"));
  context.after(() => rm(dataDir, { recursive: true, force: true }));
  let upstreamCalls = 0;
  const upstream = createServer((_request, response) => {
    upstreamCalls += 1;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(
      upstreamCalls === 1
        ? {
            typeCode: 1000,
            message: JSON.stringify({
              error: {
                message: "当前分组上游负载已饱和，请稍后再试",
                code: "429",
              },
            }),
          }
        : { data: [{ url: "https://example.com/generated.png" }] },
    ));
  });
  const upstreamPort = await listen(upstream);
  context.after(() => close(upstream));

  const backend = createTaskServer({
    dataDir,
    baseUrl: `http://127.0.0.1:${upstreamPort}`,
    apiKey: "dola-test",
    token: "backend-test",
    retryDelays: [1],
  });
  const backendPort = await listen(backend);
  context.after(() => close(backend));

  const form = new FormData();
  form.set("image", new File(["product"], "product.png", { type: "image/png" }));
  const created = await fetch(`http://127.0.0.1:${backendPort}/v1/image-tasks`, {
    method: "POST",
    headers: { Authorization: "Bearer backend-test" },
    body: form,
  }).then((response) => response.json());

  let completed;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    completed = await fetch(
      `http://127.0.0.1:${backendPort}/v1/image-tasks/${created.id}`,
      { headers: { Authorization: "Bearer backend-test" } },
    ).then((response) => response.json());
    if (completed.status === "succeeded") break;
  }
  assert.equal(completed.status, "succeeded");
  assert.equal(completed.url, "https://example.com/generated.png");
  assert.equal(upstreamCalls, 2);
});

test("retries retryable overloads at most 18 times", async (context) => {
  const dataDir = await mkdtemp(join(tmpdir(), "mercato-task-eighteen-retries-"));
  context.after(() => rm(dataDir, { recursive: true, force: true }));
  let upstreamCalls = 0;
  const upstream = createServer((_request, response) => {
    upstreamCalls += 1;
    response.writeHead(429, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      error: { message: "当前分组上游负载已饱和，请稍后再试" },
    }));
  });
  const upstreamPort = await listen(upstream);
  context.after(() => close(upstream));

  const backend = createTaskServer({
    dataDir,
    baseUrl: `http://127.0.0.1:${upstreamPort}`,
    apiKey: "dola-test",
    token: "backend-test",
    retryDelays: Array.from({ length: 24 }, () => 0),
  });
  const backendPort = await listen(backend);
  context.after(() => close(backend));

  const form = new FormData();
  form.set("image", new File(["product"], "product.png", { type: "image/png" }));
  const created = await fetch(`http://127.0.0.1:${backendPort}/v1/image-tasks`, {
    method: "POST",
    headers: { Authorization: "Bearer backend-test" },
    body: form,
  }).then((response) => response.json());

  let completed;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    completed = await fetch(
      `http://127.0.0.1:${backendPort}/v1/image-tasks/${created.id}`,
      { headers: { Authorization: "Bearer backend-test" } },
    ).then((response) => response.json());
    if (completed.status === "failed") break;
  }
  assert.equal(completed.status, "failed");
  assert.equal(upstreamCalls, 19);
});

test("forwards up to nine reference images in one generation task", async (context) => {
  const dataDir = await mkdtemp(join(tmpdir(), "mercato-task-reference-images-"));
  context.after(() => rm(dataDir, { recursive: true, force: true }));
  let upstreamBody = "";
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    upstreamBody = Buffer.concat(chunks).toString("utf8");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ url: "https://example.com/multi.png" }] }));
  });
  const upstreamPort = await listen(upstream);
  context.after(() => close(upstream));

  const backend = createTaskServer({
    dataDir,
    baseUrl: `http://127.0.0.1:${upstreamPort}`,
    apiKey: "dola-test",
    token: "backend-test",
    retryDelays: [],
  });
  const backendPort = await listen(backend);
  context.after(() => close(backend));

  const form = new FormData();
  form.append("image", new File(["primary"], "primary.png", { type: "image/png" }));
  form.append("image", new File(["detail"], "detail.png", { type: "image/png" }));
  const created = await fetch(`http://127.0.0.1:${backendPort}/v1/image-tasks`, {
    method: "POST",
    headers: { Authorization: "Bearer backend-test" },
    body: form,
  }).then((response) => response.json());

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    const completed = await fetch(
      `http://127.0.0.1:${backendPort}/v1/image-tasks/${created.id}`,
      { headers: { Authorization: "Bearer backend-test" } },
    ).then((response) => response.json());
    if (completed.status === "succeeded") break;
  }
  assert.match(upstreamBody, /name="image\[\]"/);
  assert.match(upstreamBody, /filename="primary.png"/);
  assert.match(upstreamBody, /filename="detail.png"/);

  const tooMany = new FormData();
  for (let index = 0; index < 10; index += 1) {
    tooMany.append(
      "image",
      new File([String(index)], `reference-${index + 1}.png`, { type: "image/png" }),
    );
  }
  const rejected = await fetch(`http://127.0.0.1:${backendPort}/v1/image-tasks`, {
    method: "POST",
    headers: { Authorization: "Bearer backend-test" },
    body: tooMany,
  });
  assert.equal(rejected.status, 400);
  assert.match(await rejected.text(), /最多上传 9 张图片/);
});

test("uses a per-user key without exposing or persisting it in plaintext", async (context) => {
  const dataDir = await mkdtemp(join(tmpdir(), "mercato-task-user-key-"));
  context.after(() => rm(dataDir, { recursive: true, force: true }));

  const upstream = createServer((request, response) => {
    assert.equal(request.headers.authorization, "Bearer user-specific-key");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ url: "https://example.com/user.png" }] }));
  });
  const upstreamPort = await listen(upstream);
  context.after(() => close(upstream));

  const backend = createTaskServer({
    dataDir,
    baseUrl: `http://127.0.0.1:${upstreamPort}`,
    token: "backend-test",
    userKeyEncryptionSecret: "test-encryption-secret-with-at-least-32-characters",
    retryDelays: [],
  });
  const backendPort = await listen(backend);
  context.after(() => close(backend));

  const form = new FormData();
  form.set("prompt", "One image only");
  form.set("model", "dolaio/gpt-image-2");
  form.set("image", new File(["product"], "product.png", { type: "image/png" }));
  const created = await fetch(`http://127.0.0.1:${backendPort}/v1/image-tasks`, {
    method: "POST",
    headers: {
      Authorization: "Bearer backend-test",
      "X-Mercato-Upstream-Key": "user-specific-key",
    },
    body: form,
  }).then((response) => response.json());

  const persisted = await readFile(
    join(dataDir, "tasks", `${created.id}.json`),
    "utf8",
  );
  assert.equal(persisted.includes("user-specific-key"), false);
  assert.equal(JSON.parse(persisted).model, "dolaio/gpt-image-2");
  assert.equal(JSON.stringify(created).includes("user-specific-key"), false);

  let completed;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    completed = await fetch(
      `http://127.0.0.1:${backendPort}/v1/image-tasks/${created.id}`,
      { headers: { Authorization: "Bearer backend-test" } },
    ).then((response) => response.json());
    if (completed.status === "succeeded") break;
  }
  assert.equal(completed.status, "succeeded");
  assert.equal(completed.url, "https://example.com/user.png");
});
