import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { imageOutputUrl } from "../task-backend/image-response.mjs";
import { imageTaskCount } from "../app/image-task-count.mjs";

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
  assert.match(html, /data-testid="mode-trigger"/);
  assert.match(html, /data-testid="brand-gene-trigger"/);
  assert.match(html, /data-testid="skill-trigger"/);
  assert.match(html, /data-testid="file-input"/);
  assert.match(html, /data-testid="send"/);
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the complete generation flow and its assets", async () => {
  const [page, layout, styles, packageJson, generateRoute, taskBackend] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/generate/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../task-backend/server.mjs", import.meta.url), "utf8"),
    access(new URL("../public/product-main.png", import.meta.url)),
    access(new URL("../public/product-lifestyle.png", import.meta.url)),
    access(new URL("../public/product-outdoor.png", import.meta.url)),
    access(new URL("../public/product-demo.mp4", import.meta.url)),
    access(new URL("../public/mercato-demo-assets.zip", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(page, /图片生成/);
  assert.match(page, /视频生成/);
  assert.match(page, /Listing 生成/);
  assert.match(page, /商品套图/);
  assert.match(page, /跨境电商套图/);
  assert.match(page, /人物场景图/);
  assert.match(page, /国内电商主图/);
  assert.match(page, /种草组图/);
  assert.match(page, /商品白底图/);
  assert.match(page, /视频复刻/);
  assert.match(page, /带货口播/);
  assert.match(page, /亚马逊 Listing/);
  assert.match(page, /链接复刻/);
  assert.match(page, /品牌基因/);
  assert.match(page, /高级 \+ 手机 A\+/);
  assert.match(page, /a-plus-count-trigger/);
  assert.match(page, /main-image-count-trigger/);
  assert.match(page, /main-image-ratio-trigger/);
  assert.match(page, /主副图比例/);
  assert.match(page, /"1:1"/);
  assert.match(page, /"3:4"/);
  assert.match(page, /brand-gene-panel/);
  assert.match(page, /font-style-select/);
  assert.match(page, /platform-select/);
  assert.match(page, /listing-result/);
  assert.match(page, /image-result/);
  assert.match(page, /single-image-result/);
  assert.match(page, /video-result/);
  assert.match(page, /product-demo\.mp4/);
  assert.match(page, /销售国家\/地区/);
  assert.match(page, /生成内容语言/);
  assert.match(page, /🇺🇸 US（美国）/);
  assert.match(page, /🇬🇧 UK（英国）/);
  assert.match(page, /🇵🇭 PHL（菲律宾）/);
  assert.match(page, /🌍 GCC（中东）/);
  assert.match(page, /🌐 其他地区/);
  assert.match(page, /意大利语/);
  assert.match(page, /葡萄牙语/);
  assert.match(page, /土耳其语/);
  assert.match(page, /其他语言/);
  assert.match(page, /brandContext/);
  assert.match(page, /hasSuiteSettings\(skill\)/);
  assert.match(page, /skillId === "amazon-listing"/);
  assert.match(page, /1 个 Listing \+/);
  assert.match(page, /generatedAPlusImages/);
  assert.match(page, /generatedMobileAPlusImages/);
  assert.match(page, /runGeneration/);
  assert.match(page, /visibleAgentText/);
  assert.match(page, /plainListingText/);
  assert.match(page, /AI merchandising suggestion/);
  assert.match(page, /<think>\[\\s\\S\]/);
  assert.match(page, /AI-generated draft/);
  assert.match(page, /Review all claims before publishing/);
  assert.match(page, /featureStats\.map/);
  assert.match(page, /\^not confirmed\$/i);
  assert.doesNotMatch(page, /<div><b>20 BAR<\/b>/);
  assert.doesNotMatch(page, /1,284 ratings/);
  assert.match(page, /fetch\("\/api\/generate"/);
  assert.doesNotMatch(page, /const streamTurn/);
  assert.match(page, /停止生成/);
  assert.match(page, /重新生成/);
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
  assert.match(page, /setPromptIdeaText/);
  assert.match(page, /current\.slice\(0, -1\)/);
  assert.match(page, /fullIdea\.slice\(0, promptIdeaText\.length \+ 1\)/);
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
  assert.match(generateRoute, /MiniMax-M3/);
  assert.match(taskBackend, /yunwu\/gpt-image-2/);
  assert.match(generateRoute, /novai\/seedance-2\.0-mini/);
  assert.match(generateRoute, /\/chat\/completions/);
  assert.match(taskBackend, /\/images\/edits/);
  assert.match(generateRoute, /\/contents\/generations\/tasks/);
  assert.match(generateRoute, /videoTask\(payload\)/);
  assert.match(generateRoute, /videoUrl: taskField/);
  assert.match(generateRoute, /Unknown is better than invented/);
  assert.match(generateRoute, /Do not create a plan/);
  assert.match(generateRoute, /Generate the final listing directly/);
  assert.match(generateRoute, /X-Mercato-Generation-Architecture/);
  assert.match(generateRoute, /direct-mode-skill/);
  assert.match(generateRoute, /Create exactly one finished image for this single task/);
  assert.match(generateRoute, /slotType/);
  assert.match(generateRoute, /a-plus-mobile/);
  assert.match(generateRoute, /Main and secondary image ratio/);
  assert.match(generateRoute, /\[BRAND GENE\]/);
  assert.match(generateRoute, /\[GENERATION SETTINGS\]/);
  assert.match(generateRoute, /context\.mainImageRatio === "3:4"/);
  assert.match(generateRoute, /"1024x1536"/);
  assert.match(generateRoute, /Gulf Cooperation Council \/ Middle East/);
  assert.match(generateRoute, /Portuguese/);
  assert.match(generateRoute, /never as "one-touch operation"/);
  assert.match(generateRoute, /Always return non-empty numeric salePrice/);
  assert.match(generateRoute, /process\.env\.DOLA_API_KEY/);
  assert.doesNotMatch(generateRoute, /DOLA_API_KEY\s*=\s*["'][^"']+["']/);
  assert.match(generateRoute, /process\.env\.TASK_BACKEND_URL/);
  assert.match(generateRoute, /process\.env\.TASK_BACKEND_TOKEN/);
  assert.match(generateRoute, /imageTaskId/);
  assert.match(taskBackend, /status: "queued"/);
  assert.match(taskBackend, /status = "running"/);
  assert.match(taskBackend, /status = "succeeded"/);
  assert.match(taskBackend, /status = "failed"/);
  assert.match(taskBackend, /TASK_CONCURRENCY/);
});

test("accepts common direct and nested image response shapes", () => {
  assert.equal(imageOutputUrl({ data: [{ url: "https://example.com/a.png" }] }), "https://example.com/a.png");
  assert.equal(imageOutputUrl({ output: { images: [{ b64_json: "abc" }] } }), "data:image/png;base64,abc");
  assert.equal(imageOutputUrl({ result: { image_url: "https://example.com/b.png" } }), "https://example.com/b.png");
  assert.equal(imageOutputUrl({ data: [] }), undefined);
});

test("uses the requested image count for real tasks and placeholders", () => {
  assert.equal(imageTaskCount("images", "生成跨境电商商品营销套图"), 6);
  assert.equal(imageTaskCount("images", "只生成一张户外使用场景图"), 1);
  assert.equal(imageTaskCount("images", "请生成 3 张商品图"), 3);
  assert.equal(imageTaskCount("seeding", "生成一组种草图"), 4);
  assert.equal(imageTaskCount("single", "生成八张图片"), 1);
});
