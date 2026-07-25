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
  assert.match(html, /生成亚马逊链接/);
  assert.doesNotMatch(html, /生成完整商品内容/);
  assert.match(html, /工作区导航/);
  assert.match(html, /个人账户/);
  assert.doesNotMatch(html, /主导航/);
  assert.doesNotMatch(html, /AI COMMERCE STUDIO|CREATE FOR ANY MARKET|上传商品，选择 Skill|上传你的商品，开始创作/);
  assert.match(html, /data-testid="skill-trigger"/);
  assert.match(html, /data-testid="region-trigger"/);
  assert.match(html, /data-testid="language-trigger"/);
  assert.match(html, /data-testid="file-input"/);
  assert.match(html, /data-testid="send"/);
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the complete local demo flow and its assets", async () => {
  const [page, layout, styles, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
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
  assert.match(page, /Amazon A\+／卖点套图/);
  assert.match(page, /跨境电商套图/);
  assert.match(page, /Amazon 人物场景图/);
  assert.match(page, /国内电商主图/);
  assert.match(page, /种草组图/);
  assert.match(page, /商品白底精修/);
  assert.match(page, /商品视频/);
  assert.match(page, /listing-result/);
  assert.match(page, /image-result/);
  assert.match(page, /single-image-result/);
  assert.match(page, /video-result/);
  assert.match(page, /product-demo\.mp4/);
  assert.match(page, /销售地区/);
  assert.match(page, /输出语言/);
  assert.match(page, /streamTurn/);
  assert.match(page, /停止生成/);
  assert.match(page, /继续生成/);
  assert.match(page, /preview-modal/);
  assert.match(page, /conversation-send/);
  assert.match(page, /listing-title-input/);
  assert.match(page, /download-listing/);
  assert.match(page, /conversation-turn/);
  assert.match(page, /const conversationTitle = "便携咖啡机创作"/);
  assert.match(page, /<strong>\{turn\.title\}<\/strong>/);
  assert.match(page, /screen === "studio"/);
  assert.doesNotMatch(page, /持续创作 · 结果不会覆盖|studio-kicker/);
  assert.match(page, /conversation-context-menu/);
  assert.match(page, /重命名对话/);
  assert.match(page, /对话已删除/);
  assert.match(page, /prefix="技能"/);
  assert.match(page, /account-trigger/);
  assert.match(page, /account-menu/);
  assert.match(page, /帮助与支持/);
  assert.match(page, /让 Mercato 帮我生成/);
  assert.match(page, /promptIdeas/);
  assert.match(page, /prefers-reduced-motion: reduce/);
  assert.match(page, /<h1>一张商品图，生成亚马逊链接<\/h1>/);
  assert.doesNotMatch(page, /一张商品图，<br \/>生成亚马逊链接/);
  assert.match(page, /<span className="brand-mark" aria-hidden="true">♥<\/span>/);
  assert.match(page, /\n            ↑\n/);
  assert.doesNotMatch(page, /\n            ↗\n/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /summary_large_image/);
  assert.match(styles, /--accent: #c9f33e/);
  assert.match(styles, /\.home-workspace::after/);
  assert.match(styles, /background-size: 5px 5px, 7px 7px/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});
