import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createTaskServer } from "./server.mjs";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
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
  context.after(() => upstream.close());

  const backend = createTaskServer({
    dataDir,
    baseUrl: `http://127.0.0.1:${upstreamPort}`,
    apiKey: "dola-test",
    token: "backend-test",
    concurrency: 1,
  });
  const backendPort = await listen(backend);
  context.after(() => backend.close());

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
  context.after(() => backend.close());

  assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/v1/image-tasks/not-found`)).status, 401);
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
  context.after(() => upstream.close());

  const backend = createTaskServer({
    dataDir,
    baseUrl: `http://127.0.0.1:${upstreamPort}`,
    apiKey: "dola-test",
    token: "backend-test",
    retryDelays: [1],
  });
  const backendPort = await listen(backend);
  context.after(() => backend.close());

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
