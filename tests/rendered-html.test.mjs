import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Mercato creation workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Mercato AI \| 跨境电商素材创作<\/title>/i);
  assert.match(html, /一张商品图，/);
  assert.match(html, /生成完整商品内容/);
  assert.match(html, /上传你的商品/);
  assert.match(html, /data-testid="skill-trigger"/);
  assert.match(html, /data-testid="region-trigger"/);
  assert.match(html, /data-testid="language-trigger"/);
  assert.match(html, /data-testid="file-input"/);
  assert.match(html, /data-testid="send"/);
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the complete local demo flow and its assets", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    access(new URL("../public/product-main.png", import.meta.url)),
    access(new URL("../public/product-lifestyle.png", import.meta.url)),
    access(new URL("../public/product-outdoor.png", import.meta.url)),
    access(new URL("../public/product-demo.mp4", import.meta.url)),
    access(new URL("../public/mercato-demo-assets.zip", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(page, /选择 Skill/);
  assert.match(page, /Amazon Listing/);
  assert.match(page, /商品套图/);
  assert.match(page, /商品视频/);
  assert.match(page, /listing-result/);
  assert.match(page, /image-result/);
  assert.match(page, /video-result/);
  assert.match(page, /product-demo\.mp4/);
  assert.match(page, /销售地区/);
  assert.match(page, /输出语言/);
  assert.match(page, /startStream/);
  assert.match(page, /停止生成/);
  assert.match(page, /继续生成/);
  assert.match(page, /preview-modal/);
  assert.match(page, /refine-send/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /summary_large_image/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});
