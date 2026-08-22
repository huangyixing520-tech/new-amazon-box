import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { imageOutputUrl } from "../task-backend/image-response.mjs";
import { imageTaskCount } from "../app/image-task-count.mjs";
import {
  imageOutputSpec,
  singleImageTaskBoundary,
} from "../app/image-output-spec.mjs";
import { normalizedImageOutputDimensions } from "../app/asset-output-spec.mjs";

test("maps every suite slot to one task and the correct final canvas", () => {
  const advanced = imageOutputSpec({
    slotType: "a-plus",
    slotIndex: 2,
    aPlusType: "advanced",
  });
  const standard = imageOutputSpec({
    slotType: "a-plus",
    slotIndex: 2,
    aPlusType: "standard",
  });
  const mobile = imageOutputSpec({
    slotType: "a-plus-mobile",
    slotIndex: 2,
    aPlusType: "advanced-mobile",
  });
  assert.deepEqual(
    [advanced.outputWidth, advanced.outputHeight],
    [1464, 600],
  );
  assert.deepEqual(
    [standard.outputWidth, standard.outputHeight],
    [970, 600],
  );
  assert.deepEqual(
    [mobile.outputWidth, mobile.outputHeight],
    [600, 450],
  );
  assert.match(advanced.formatInstruction, /1464 x 600/);
  assert.match(standard.formatInstruction, /970 x 600/);
  assert.match(mobile.formatInstruction, /completed Premium A\+ image/);
  assert.match(singleImageTaskBoundary, /one independent image task/i);
  assert.match(singleImageTaskBoundary, /Never create a collage/);
});

test("asset output dimensions accept only supported exact canvases", () => {
  assert.deepEqual(normalizedImageOutputDimensions(1464, 600), {
    width: 1464,
    height: 600,
  });
  assert.deepEqual(normalizedImageOutputDimensions(970, 600), {
    width: 970,
    height: 600,
  });
  assert.deepEqual(normalizedImageOutputDimensions(600, 450), {
    width: 600,
    height: 450,
  });
  assert.equal(normalizedImageOutputDimensions(1536, 1024), null);
});

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
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

test("server-renders the public landing page and protects the creation workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Mercato AI \| 一张图，生成一条 Listing<\/title>/i);
  assert.match(html, /一张图/);
  assert.match(html, /生成一条 Listing/);
  assert.match(html, /一次输入，三种直接可用的结果/);
  assert.match(html, /进入工作台/);
  assert.doesNotMatch(html, /href="\/studio"/);
  assert.match(html, /落地页导航/);
  assert.match(html, /每张图片，都是独立任务/);
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);

  const studioResponse = await render("/studio");
  assert.equal(studioResponse.status, 307);
  assert.equal(new URL(studioResponse.headers.get("location"), "http://localhost").pathname, "/");
});

test("ships the complete generation flow and its assets", async () => {
  const [
    page,
    landingPage,
    landingCopy,
    landingAdminRoute,
    landingAdminMediaRoute,
    landingMediaRoute,
    layout,
    styles,
    packageJson,
    generateRoute,
    assetRoute,
    taskBackend,
    accountPanel,
    authLibrary,
    homePage,
    studioLayout,
    emailLoginRoute,
    emailRegisterRoute,
    assetDetailRoute,
    historyRoute,
    eventsRoute,
    adminRoute,
    adminGenerationsRoute,
    adminUserResultsRoute,
    adminAssetRoute,
    adminPage,
    inspirationAdminRoute,
    envExample,
  ] = await Promise.all([
    readFile(new URL("../app/studio/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/landing-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/landing-copy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/landing/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/landing/media/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/landing/media/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/generate/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/assets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../task-backend/server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/account-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/studio/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/email/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/email/register/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/assets/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/history/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/metrics/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/generations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/[id]/results/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/assets/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/inspiration/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    access(new URL("../public/product-main.webp", import.meta.url)),
    access(new URL("../public/product-lifestyle.webp", import.meta.url)),
    access(new URL("../public/product-outdoor.webp", import.meta.url)),
    access(new URL("../public/product-demo.mp4", import.meta.url)),
    access(new URL("../public/mercato-demo-assets.zip", import.meta.url)),
    access(new URL("../public/og.webp", import.meta.url)),
  ]);

  assert.match(page, /图片生成/);
  assert.match(page, /function assetDateLabel\(value: string\)/);
  assert.match(page, /assetDateLabel\(turn\.createdAt\)/);
  assert.doesNotMatch(page, /className="generation-status"/);
  assert.doesNotMatch(page, /className="progress-meter"/);
  assert.match(
    styles,
    /\.result-ratio-group\.is-main \.asset-skeleton \{ min-height: 0; aspect-ratio: 1; \}/,
  );
  assert.match(
    styles,
    /\.assistant-content \{ width: min\(100%, 1180px\); min-width: 0; justify-self: center; \}/,
  );
  assert.match(
    styles,
    /\.conversation-main \{ width: min\(100%, 1540px\); padding-inline: clamp\(38px, 4vw, 72px\); \}/,
  );
  assert.match(taskBackend, /模型额度不足，请充值当前 API Key/);
  assert.match(authLibrary, /envValue\("LOCAL_AUTH_BYPASS"\) === "1"/);
  assert.match(authLibrary, /\["localhost", "127\.0\.0\.1", "::1"\]\.includes\(hostname\)/);
  assert.match(authLibrary, /if \(usesLocalAuthBypass\(request\)\) return localBypassUser\(\)/);
  assert.match(envExample, /LOCAL_AUTH_BYPASS=0/);
  assert.match(page, /视频生成/);
  assert.match(page, /Listing 生成/);
  assert.ok(
    page.indexOf('{ id: "listing", label: "Listing 生成"') <
      page.indexOf('{ id: "image", label: "图片生成"'),
  );
  assert.ok(
    page.indexOf('{ id: "image", label: "图片生成"') <
      page.indexOf('{ id: "video", label: "视频生成"'),
  );
  assert.match(page, /useState<GenerationMode>\("listing"\)/);
  assert.match(page, /useState\("amazon-listing"\)/);
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
  assert.match(page, /data-testid="suite-settings-trigger"/);
  assert.match(page, /data-testid="suite-settings-panel"/);
  assert.match(page, /卖点 \{suite\.mainImageCount\} · A\+ \{suite\.aPlusCount\}/);
  assert.match(page, /a-plus-count-trigger/);
  assert.match(page, /main-image-count-trigger/);
  assert.match(
    page,
    /const mainImageCounts:[\s\S]*Array\.from\(\{ length: 9 \}, \(_, count\)[\s\S]*id: String\(count\)/,
  );
  assert.match(page, /suite\.aPlusCount === 0[\s\S]*suite\.mainImageCount === 0/);
  assert.match(page, /main-image-ratio-trigger/);
  assert.match(page, /卖点图比例/);
  assert.match(page, /"1:1"/);
  assert.match(page, /"3:4"/);
  assert.match(page, /brand-gene-panel/);
  assert.match(page, /智能品牌色/);
  assert.match(page, /brand-color-popover/);
  assert.match(page, /清除品牌主色，恢复智能品牌色/);
  assert.match(page, /turn\.brand\.primaryColor \|\| "auto"/);
  assert.doesNotMatch(page, /type="color"/);
  assert.match(page, /font-style-select/);
  assert.match(page, /platform-select/);
  assert.match(page, /dismissOnOutsidePress/);
  assert.match(page, /floatingPopoverLayout/);
  assert.match(page, /data-floating-popover/);
  assert.match(page, /dismissBrandGene/);
  assert.match(page, /openBrandMenu === "font-style"/);
  assert.doesNotMatch(page, /<select[\s\S]*?data-testid="font-style-select"/);
  assert.match(page, /listing-result/);
  assert.match(page, /function isListingReady\(turn: Turn\)/);
  assert.doesNotMatch(page, /generatedImages \+ failedImages >= expectedImages/);
  assert.match(page, /data-testid="listing-loading-skeleton"/);
  assert.match(page, /listing-loader-nav/);
  assert.match(page, /listing-loader-gallery/);
  assert.match(page, /listing-loader-copy/);
  assert.match(page, /listing-loader-buybox/);
  assert.doesNotMatch(page, /listing-loader-grid/);
  assert.match(page, /image-result/);
  assert.match(page, /single-image-result/);
  assert.match(page, /video-result/);
  assert.match(styles, /\.listing-a-plus-gallery\s*\{[^}]*flex-direction:\s*column;/);
  assert.match(styles, /\.listing-a-plus-gallery\.is-advanced\s*\{[^}]*max-width:\s*1464px;/);
  assert.match(styles, /\.listing-a-plus-gallery\.is-standard\s*\{[^}]*max-width:\s*970px;/);
  assert.match(
    styles,
    /\.listing-a-plus-gallery img\s*\{[^}]*height:\s*auto;[^}]*object-fit:\s*contain;/,
  );
  assert.match(styles, /\.listing-loader-product\s*\{[^}]*grid-template-columns:/);
  assert.match(styles, /\.listing-loader-gallery\s*\{[^}]*grid-template-columns:/);
  assert.match(styles, /\.listing-loader-buybox\s*\{[^}]*border:/);
  assert.match(
    styles,
    /\.asset-wide \.asset-visual img\s*\{[^}]*height:\s*auto;[^}]*aspect-ratio:\s*auto;[^}]*object-fit:\s*contain;/,
  );
  assert.match(styles, /\.brand-gene-panel\s*\{[^}]*position:\s*absolute;[^}]*box-shadow:/);
  assert.match(styles, /\.suite-settings-panel\s*\{[^}]*position:\s*absolute;[^}]*grid-template-columns:\s*repeat\(4,/);
  assert.match(styles, /\.single-image-result\s*\{[^}]*width:\s*min\(520px, 100%\)/);
  assert.match(
    styles,
    /\.upload-deck-add-card:hover,[\s\S]*?background:\s*var\(--accent\)/,
  );
  assert.doesNotMatch(
    styles,
    /\.upload-deck\.has-uploads:hover \.upload-deck-add-card/,
  );
  assert.match(styles, /\.upload-deck\.is-expanded \.upload-deck-card/);
  assert.match(
    styles,
    /\.upload-deck\.has-uploads\.is-expanded,[\s\S]*?\.upload-deck\.has-uploads:has\(\.upload-deck-preview:focus-visible\)\s*\{[^}]*width:\s*var\(--deck-expanded-width, 136px\)/,
  );
  assert.match(styles, /rotate\(var\(--deck-rotation\)\)/);
  assert.match(page, /"--deck-spread":\s*"84px"/);
  assert.match(page, /"--deck-expanded-width":\s*`\$\{expandedDeckWidth\}px`/);
  assert.match(page, /onPointerEnter=\{\(\) => setExpanded\(true\)\}/);
  assert.match(page, /onPointerLeave=\{\(\) => setExpanded\(false\)\}/);
  assert.match(page, /data-testid="video-replica-materials"/);
  assert.match(page, /data-testid="reference-video-file-input"/);
  assert.match(page, /accept="video\/\*"/);
  assert.match(page, /form\.append\("referenceVideo"/);
  assert.match(page, /请先上传 1 个参考视频/);
  assert.match(page, /data-testid="inspiration-grid"/);
  assert.match(page, /case-portable-listing/);
  assert.match(page, /case-travel-suite/);
  assert.match(page, /function InspirationGallery/);
  assert.match(page, /function InspirationTemplatePreview/);
  assert.match(page, /data-testid="template-preview-page"/);
  assert.doesNotMatch(page, /className="template-preview-heading"/);
  assert.doesNotMatch(page, /className="template-preview-settings"/);
  assert.doesNotMatch(page, /<h2>输入图片<\/h2>/);
  assert.doesNotMatch(styles, /\.template-preview-prompt\s*\{[^}]*border-top/);
  assert.match(page, /aria-label="回到顶部"/);
  assert.match(page, /做同款/);
  assert.match(page, /商品图片/);
  assert.doesNotMatch(page, /\{ id: "listing", label: "Listing" \}/);
  assert.doesNotMatch(page, /\{ id: "link-replica", label: "链接复刻" \}/);
  assert.match(page, /applyInspirationCase/);
  assert.match(page, /setHomeComposerMinimized\(false\)/);
  assert.doesNotMatch(page, /home-composer-collapse/);
  assert.doesNotMatch(page, /aria-label="收起输入框"/);
  assert.match(page, /已应用「\$\{item\.title\}」/);
  assert.doesNotMatch(page, /选择一个案例，把完整生成设置带回输入框/);
  assert.match(styles, /\.home-stage\s*\{[^}]*padding:\s*72px 28px 190px;/);
  assert.match(styles, /\.inspiration-grid\s*\{[^}]*columns:\s*5;/);
  assert.match(styles, /\.inspiration-grid\s*\{[^}]*column-gap:\s*8px;/);
  assert.match(styles, /\.inspiration-tabs button\s*\{[^}]*border-radius:\s*12px;/);
  assert.match(styles, /\.quick-capabilities > button\s*\{[^}]*border-radius:\s*16px;/);
  assert.match(styles, /\.inspiration-card\s*\{[^}]*border-radius:\s*0;/);
  assert.match(styles, /\.inspiration-card-media > img\s*\{[^}]*height:\s*auto;[^}]*object-fit:\s*contain;/);
  assert.doesNotMatch(styles, /\.inspiration-card-(?:suite|portrait|landscape) \.inspiration-card-media\s*\{[^}]*aspect-ratio:/);
  assert.match(styles, /\.template-preview-page\s*\{[^}]*grid-template-columns:/);
  assert.match(styles, /\.template-preview-use\s*\{[^}]*background:\s*var\(--accent\)/);
  assert.match(styles, /\.inspiration-scroll-top\s*\{[^}]*position:\s*fixed;/);
  assert.match(styles, /\.home-fixed-composer\s*\{[^}]*position:\s*fixed;/);
  assert.match(styles, /\.composer-minimized\s*\{[^}]*min-height:\s*92px;/);
  assert.match(styles, /\.video-replica-materials\s*\{/);
  assert.match(styles, /\.reference-video-card\s*\{/);
  assert.match(page, /\/api\/demo-video/);
  assert.match(page, /销售国家\/地区/);
  assert.match(page, /生成内容语言/);
  assert.match(page, /<details className="message-details">/);
  assert.match(page, /<summary>[\s\S]*?详细信息[\s\S]*?<Info aria-hidden="true"/);
  assert.match(styles, /\.message-details summary\s*\{/);
  assert.match(styles, /\.message-details\[open\] \.request-tags\s*\{/);
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
  assert.match(page, /generatedAPlusImages/);
  assert.match(page, /generatedMobileAPlusImages/);
  assert.match(page, /runGeneration/);
  assert.match(page, /visibleAgentText/);
  assert.match(page, /plainListingText/);
  assert.match(page, /merchant supplied/);
  assert.match(page, /价格、优惠、税费与物流信息待发布前确认/);
  assert.doesNotMatch(page, /Apply 10% coupon/);
  assert.doesNotMatch(page, /No Import Fees Deposit/);
  assert.match(page, /<think>\[\\s\\S\]/);
  assert.match(page, /AI-generated draft/);
  assert.match(page, /Review all claims before publishing/);
  assert.match(page, /generatedAPlusImages\.map/);
  assert.match(page, /suite\.aPlusType === "standard"/);
  assert.doesNotMatch(page, /generatedAPlusImages\.slice\(1\)/);
  assert.match(page, /\^not confirmed\$/i);
  assert.doesNotMatch(page, /<div><b>20 BAR<\/b>/);
  assert.doesNotMatch(page, /1,284 ratings/);
  assert.match(page, /fetch\("\/api\/generate"/);
  assert.doesNotMatch(page, /const streamTurn/);
  assert.match(page, /重新生成/);
  assert.match(page, /preview-modal/);
  assert.match(page, /conversation-send/);
  assert.match(page, /listing-title-input/);
  assert.match(page, /download-listing/);
  assert.match(page, /conversation-turn/);
  assert.match(page, /const conversationTitle = "便携咖啡机创作"/);
  assert.match(page, /<strong>\{conversation\.title\}<\/strong>/);
  assert.match(page, /screen === "studio"/);
  assert.doesNotMatch(page, /持续创作 · 结果不会覆盖|studio-kicker/);
  assert.match(page, /conversation-context-menu/);
  assert.match(page, /重命名对话/);
  assert.match(page, /对话已删除/);
  assert.match(page, /prefix="技能"/);
  assert.match(page, /account-trigger/);
  assert.match(accountPanel, /使用 Google 登录/);
  assert.match(accountPanel, /account-dialog-login/);
  assert.match(accountPanel, /登录后继续创作/);
  assert.match(accountPanel, /服务条款/);
  assert.doesNotMatch(accountPanel, /GitHub/);
  assert.match(accountPanel, /邮箱登录/);
  assert.match(accountPanel, /注册账号/);
  assert.match(accountPanel, /\/api\/auth\/email\/\$\{emailMode\}/);
  assert.match(accountPanel, /添加 API Key|替换 API Key/);
  assert.match(accountPanel, /\/api\/auth\/google/);
  assert.match(accountPanel, /\/api\/account\/api-key/);
  assert.match(page, /让 Mercato 帮我生成/);
  assert.match(page, /promptIdeas/);
  assert.match(page, /setPromptIdeaText/);
  assert.match(page, /current\.slice\(0, -1\)/);
  assert.match(page, /fullIdea\.slice\(0, promptIdeaText\.length \+ 1\)/);
  assert.match(page, /prefers-reduced-motion: reduce/);
  assert.match(page, /composer-drop-zone/);
  assert.match(page, /compact-composer-drop-zone/);
  assert.match(page, /onDragEnter=\{beginFileDrag\}/);
  assert.match(page, /onDragOver=\{continueFileDrag\}/);
  assert.match(page, /onDrop=\{dropFiles\}/);
  assert.match(page, /Array\.from\(event\.dataTransfer\.files\)/);
  assert.match(page, /仅支持上传图片文件/);
  assert.match(page, /<h1>一张商品图，生成亚马逊链接<\/h1>/);
  assert.doesNotMatch(page, /一张商品图，<br \/>生成亚马逊链接/);
  assert.match(page, /<span className="brand-mark" aria-hidden="true">♥<\/span>/);
  assert.match(page, /<ArrowUp aria-hidden="true" weight="bold" \/>/);
  assert.doesNotMatch(page, /添加新对话/);
  assert.match(page, /startGeneration = async \(origin: "home" \| "conversation"\)/);
  assert.match(page, /origin === "home"[\s\S]*pendingHomeConversationId\.current/);
  assert.match(page, /onSend=\{\(\) => startGeneration\("home"\)\}/);
  assert.match(page, /onSend=\{\(\) => startGeneration\("conversation"\)\}/);
  assert.match(page, /const openHome = \(\) => \{[\s\S]*setActiveConversationId\(null\)/);
  assert.match(page, /asset-library/);
  assert.match(page, /assetTimeLabel/);
  assert.match(page, /asset-card-menu/);
  assert.match(page, /确定删除/);
  assert.match(assetDetailRoute, /export async function DELETE/);
  assert.match(assetDetailRoute, /DELETE FROM asset_owners/);
  assert.match(assetDetailRoute, /GENERATED_ASSETS\.delete/);
  assert.match(page, /继续修改图片/);
  assert.doesNotMatch(page, /resume-conversation/);
  assert.match(page, /QuickCapabilities/);
  assert.match(page, /链接复刻/);
  assert.match(page, /视频复刻/);
  assert.match(page, /套图生成/);
  assert.match(page, /Listing 生成/);
  assert.match(page, /带货口播/);
  assert.match(page, /粘贴要复刻的商品链接/);
  assert.match(page, /isHttpUrl/);
  assert.doesNotMatch(page, /添加新任务/);
  assert.doesNotMatch(page, /<span>你<\/span>/);
  assert.doesNotMatch(page, /<span>Mercato AI<\/span>/);
  assert.match(layout, /alternates: \{ canonical: "\/" \}/);
  assert.match(layout, /summary_large_image/);
  assert.match(styles, /--accent: #c9f33e/);
  assert.match(styles, /\.send-button \{[^}]*display: grid;[^}]*place-items: center;/);
  assert.match(styles, /\.option-popover \{ z-index: 100;/);
  assert.match(styles, /\.composer-dragging/);
  assert.match(styles, /\.composer-drop-hint/);
  assert.match(styles, /\.home-workspace::after/);
  assert.match(styles, /background-size: 5px 5px, 7px 7px/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.match(generateRoute, /MiniMax-M3/);
  assert.doesNotMatch(generateRoute, /glm-4\.5v|glm-4\.6v/);
  assert.match(taskBackend, /process\.env\.IMAGE_MODEL \?\? "dolaio\/gpt-image-2"/);
  assert.match(taskBackend, /task\.model \|\| config\.model/);
  assert.match(generateRoute, /selectedImageModel/);
  assert.match(page, /选择图片模型/);
  assert.match(page, /mode === "video" \? videoModels : imageModels/);
  assert.match(taskBackend, /const MAX_IMAGE_RETRIES = 18/);
  assert.match(taskBackend, /const IMAGE_RETRY_INTERVAL_MS = 10_000/);
  assert.match(generateRoute, /selectedVideoModel/);
  assert.match(generateRoute, /model: videoModel/);
  assert.match(generateRoute, /\/chat\/completions/);
  assert.match(taskBackend, /\/images\/edits/);
  assert.match(generateRoute, /\/contents\/generations\/tasks/);
  assert.match(generateRoute, /form\.getAll\("inputAssetId"\)/);
  assert.match(generateRoute, /form\.get\("referenceVideoAssetId"\)/);
  assert.match(generateRoute, /createAssetAccessToken/);
  assert.match(generateRoute, /analyzeReferenceVideo\(referenceVideoUrl/);
  assert.doesNotMatch(generateRoute, /role: "reference_video"/);
  assert.match(generateRoute, /role: "first_frame"/);
  assert.doesNotMatch(generateRoute, /role: "reference_image"/);
  assert.match(generateRoute, /videoTask\(payload\)/);
  assert.match(generateRoute, /videoUrl: taskField/);
  assert.match(generateRoute, /Unknown is better than invented/);
  assert.match(generateRoute, /Do not create a plan/);
  assert.match(generateRoute, /Generate the final listing directly/);
  assert.match(generateRoute, /X-Mercato-Generation-Architecture/);
  assert.match(generateRoute, /validated-listing-json/);
  assert.match(generateRoute, /singleImageTaskBoundary/);
  assert.match(generateRoute, /Final output contract:/);
  assert.match(generateRoute, /one continuous edge-to-edge canvas/);
  assert.match(generateRoute, /do not place separate sub-images/);
  assert.match(page, /imageGenerationIds/);
  assert.match(page, /复制生成 ID/);
  assert.doesNotMatch(page, /<code>\{visibleId\}<\/code>/);
  assert.match(page, /onTaskCreated\?\.\(taskId\)/);
  assert.match(generateRoute, /detectedImageMediaType/);
  assert.match(generateRoute, /supportedImageMediaTypes/);
  assert.match(page, /type: blob\.type \|\| "image\/png"/);
  assert.match(page, /MAX_IMAGE_TASK_CONCURRENCY = 10/);
  assert.match(page, /Math\.min\(MAX_IMAGE_TASK_CONCURRENCY, firstMobileSlot\)/);
  assert.match(taskBackend, /MAX_TASK_CONCURRENCY = 10/);
  assert.match(taskBackend, /process\.env\.TASK_CONCURRENCY \?\? 10/);
  assert.doesNotMatch(generateRoute, /context\.brandText\} \$\{context\.generationText/);
  assert.match(generateRoute, /slotType/);
  assert.match(generateRoute, /outputWidth/);
  assert.match(generateRoute, /outputHeight/);
  assert.match(generateRoute, /a-plus-mobile/);
  assert.match(generateRoute, /Selling-point image ratio/);
  assert.match(generateRoute, /\[BRAND GENE\]/);
  assert.match(generateRoute, /brandColor === "auto"/);
  assert.match(generateRoute, /Auto-detect a coherent primary color/);
  assert.match(generateRoute, /\[GENERATION SETTINGS\]/);
  assert.equal(
    imageOutputSpec({
      slotType: "main",
      mainImageRatio: "3:4",
    }).providerSize,
    "1024x1536",
  );
  assert.match(assetRoute, /normalizedImageOutputDimensions/);
  assert.match(assetRoute, /fit:\s*"fill"/);
  assert.match(assetRoute, /storedBuffer/);
  assert.match(assetRoute, /storedMimeType/);
  assert.match(assetRoute, /\?preview=1/);
  assert.match(assetRoute, /download=1&format=png/);
  assert.match(assetDetailRoute, /await import\("sharp"\)/);
  assert.match(assetDetailRoute, /\.webp\(\{ quality: 88/);
  assert.match(assetDetailRoute, /"content-type": "image\/webp"/);
  assert.match(assetDetailRoute, /format"\) === "jpg"/);
  assert.match(assetDetailRoute, /\.jpeg\(\{ quality: 95/);
  assert.match(assetDetailRoute, /\.png\(\{ compressionLevel: 9/);
  assert.match(page, /suiteOutputDimensions/);
  assert.match(page, /conversation-send-minimized/);
  assert.match(page, /studioComposerMinimized/);
  assert.match(styles, /\.composer-minimized/);
  assert.match(generateRoute, /Gulf Cooperation Council \/ Middle East/);
  assert.match(generateRoute, /Portuguese/);
  assert.match(generateRoute, /Do not invent certifications[\s\S]*operating mechanism, price/);
  assert.match(generateRoute, /"salePrice": "user-supplied numeric string or empty string"/);
  assert.match(generateRoute, /"listPrice": "user-supplied numeric string or empty string"/);
  assert.match(generateRoute, /userApiKey\(request\)/);
  assert.doesNotMatch(generateRoute, /process\.env\.DOLA_API_KEY/);
  assert.doesNotMatch(generateRoute, /DOLA_API_KEY\s*=\s*["'][^"']+["']/);
  assert.match(generateRoute, /process\.env\.TASK_BACKEND_URL/);
  assert.match(generateRoute, /process\.env\.TASK_BACKEND_TOKEN/);
  assert.match(generateRoute, /process\.env\.TASK_BACKEND_REQUEST_TIMEOUT_MS/);
  assert.match(generateRoute, /AbortSignal\.timeout\(timeout\)/);
  assert.match(generateRoute, /图片任务服务连接失败，请稍后重试/);
  assert.match(generateRoute, /imageTaskId/);
  assert.match(assetRoute, /GENERATED_ASSETS/);
  assert.match(assetRoute, /asset_owners/);
  assert.match(
    assetRoute,
    /a\.role = \?[\s\S]*a\.type = \?[\s\S]*a\.slot_index = \?/,
  );
  assert.match(assetRoute, /ORDER BY a\.created_at DESC/);
  assert.match(page, /\/api\/history/);
  assert.match(page, /generation_requested/);
  assert.match(page, /generation_completed/);
  assert.match(page, /data-analytics-event="asset_downloaded"/);
  assert.match(assetRoute, /a\.role = 'output'/);
  assert.match(assetRoute, /slot_index/);
  assert.match(historyRoute, /conversation_turns/);
  assert.match(historyRoute, /role === "input"/);
  assert.match(historyRoute, /missingImageSlots/);
  assert.match(historyRoute, /recordGenerationQueued/);
  assert.match(historyRoute, /attempt:\$\{body\.turn\.id\}:\$\{slot\}/);
  assert.match(page, /继续生成剩余/);
  assert.match(page, /resumeMissingImages/);
  assert.match(page, /IMAGE_TASK_TIMEOUT_MS = 12 \* 60 \* 1000/);
  assert.match(page, /generationAttemptId/);
  assert.match(generateRoute, /recordGenerationQueued/);
  assert.match(generateRoute, /生成超过 12 分钟未完成/);
  assert.match(generateRoute, /retryGenerationId/);
  assert.match(generateRoute, /retryRecord\?\.prompt \|\| computedGenerationPrompt/);
  assert.match(generateRoute, /started_at IS NOT NULL/);
  assert.match(page, /replacementForm\.set\("retryGenerationId"/);
  assert.match(adminGenerationsRoute, /id = \? OR request_id = \?/);
  assert.match(adminPage, /生成 ID \/ Turn ID/);
  assert.match(eventsRoute, /analytics_events/);
  assert.match(adminRoute, /requireAdmin/);
  assert.match(adminRoute, /generationDau/);
  assert.match(adminPage, /Skill 表现/);
  assert.match(adminPage, /用户生成结果/);
  assert.match(adminPage, /落地页配置/);
  assert.match(adminPage, /保存并发布/);
  assert.match(adminPage, /落地页图片/);
  assert.match(adminPage, /首屏主视觉/);
  assert.match(adminPage, /上传替换/);
  assert.match(adminPage, /\/api\/admin\/landing/);
  assert.match(adminPage, /\/api\/admin\/landing\/media/);
  assert.doesNotMatch(adminPage, /案例标题/);
  assert.doesNotMatch(adminPage, /案例说明/);
  assert.doesNotMatch(adminPage, /选择的 Skill/);
  assert.match(inspirationAdminRoute, /title: "优秀案例"/);
  assert.match(inspirationAdminRoute, /defaultsForTabs\(tabs\)/);
  assert.match(landingPage, /heroTitleParts/);
  assert.match(landingPage, /setShowLogin\(true\)/);
  assert.match(landingPage, /<AccountPanel/);
  assert.match(landingPage, /landing-result-panel/);
  assert.match(landingPage, /content\.media\.hero/);
  assert.match(landingPage, /media\.videoPoster/);
  assert.match(landingCopy, /一张图，生成一条 Listing/);
  assert.match(landingCopy, /sellingPoints/);
  assert.match(landingCopy, /LandingMedia/);
  assert.match(landingCopy, /\/landing-hero\.webp/);
  assert.match(landingAdminRoute, /requireAdmin/);
  assert.match(landingAdminRoute, /saveLandingContent/);
  assert.match(landingAdminMediaRoute, /requireAdmin/);
  assert.match(landingAdminMediaRoute, /verifySameOrigin/);
  assert.match(landingAdminMediaRoute, /GENERATED_ASSETS\.put/);
  assert.match(landingAdminMediaRoute, /10 \* 1024 \* 1024/);
  assert.match(landingMediaRoute, /key\.startsWith\("landing\/"\)/);
  assert.match(landingMediaRoute, /GENERATED_ASSETS\.get/);
  assert.match(landingMediaRoute, /immutable/);
  assert.match(adminPage, /\/api\/admin\/users\/\$\{encodeURIComponent\(userId\)\}\/results/);
  assert.match(adminPage, /查看用户输入/);
  assert.match(adminPage, /admin-result-assets/);
  assert.match(adminUserResultsRoute, /requireAdmin/);
  assert.match(adminUserResultsRoute, /a\.role = 'output'/);
  assert.match(adminUserResultsRoute, /\/api\/admin\/assets\//);
  assert.match(adminAssetRoute, /requireAdmin/);
  assert.match(adminAssetRoute, /GENERATED_ASSETS/);
  assert.match(accountPanel, /打开数据后台/);
  assert.match(envExample, /ADMIN_EMAILS=/);
  assert.match(authLibrary, /API_KEY_ENCRYPTION_SECRET/);
  assert.match(authLibrary, /ADMIN_EMAILS/);
  assert.match(authLibrary, /AES-GCM/);
  assert.match(authLibrary, /HttpOnly/);
  assert.match(authLibrary, /email_verified/);
  assert.match(authLibrary, /PBKDF2/);
  assert.match(authLibrary, /PASSWORD_ITERATIONS = 310_000/);
  assert.match(authLibrary, /registerEmailUser/);
  assert.match(authLibrary, /authenticateEmailUser/);
  assert.match(homePage, /if \(await currentUser\(request\)\) redirect\("\/studio"\)/);
  assert.match(studioLayout, /if \(!await currentUser\(request\)\) redirect\("\/"\)/);
  assert.match(emailLoginRoute, /verifySameOrigin/);
  assert.match(emailLoginRoute, /verifyCsrf/);
  assert.match(emailLoginRoute, /createSessionToken/);
  assert.match(emailRegisterRoute, /registerEmailUser/);
  assert.match(emailRegisterRoute, /setSessionCookie/);
  assert.match(taskBackend, /status: "queued"/);
  assert.match(taskBackend, /status = "running"/);
  assert.match(taskBackend, /status = "succeeded"/);
  assert.match(taskBackend, /status = "failed"/);
  assert.match(taskBackend, /TASK_CONCURRENCY/);
  assert.match(taskBackend, /USER_KEY_ENCRYPTION_SECRET/);
  assert.match(taskBackend, /x-mercato-upstream-key/);
});

test("returns the home composer to its inline position at the top", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/studio/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /homeComposerAnchor/);
  assert.match(page, /setHomeComposerMinimized\(!entry\.isIntersecting\)/);
  assert.match(page, /aria-hidden=\{homeComposerMinimized \|\| undefined\}/);
  assert.match(styles, /\.home-inline-composer\.is-docked/);
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

test("uploads input assets as multipart files without losing their slots", async () => {
  const [page, assetRoute] = await Promise.all([
    readFile(new URL("../app/studio/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/assets/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /form\.set\("file", sourceFile\)/);
  assert.match(page, /slot: String\(slot\)/);
  assert.match(assetRoute, /typeof source !== "string"/);
  assert.doesNotMatch(assetRoute, /instanceof File/);
  assert.match(assetRoute, /slot: formNumber\("slot"\)/);
  assert.match(page, /if \(role === "input"\) throw error/);
});

test("persists generated images server-side without relaying Base64 through the browser", async () => {
  const [page, assetRoute, generateRoute] = await Promise.all([
    readFile(new URL("../app/studio/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/assets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/generate/route.ts", import.meta.url), "utf8"),
  ]);
  const runImageTaskSource = page.slice(
    page.indexOf("const runImageTask"),
    page.indexOf("const runListing"),
  );

  assert.match(page, /imageTaskId: generationId/);
  assert.match(
    page,
    /imageTaskId=\$\{encodeURIComponent\(taskId\)\}&summary=1/,
  );
  assert.doesNotMatch(runImageTaskSource, /b64_json|image_url|imageUrl/);
  assert.match(assetRoute, /async function taskResultSource/);
  assert.match(
    assetRoute,
    /SELECT id FROM generation_tasks WHERE id = \? AND user_id = \?/,
  );
  assert.match(
    assetRoute,
    /v1\/image-tasks\/\$\{encodeURIComponent\(taskId\)\}/,
  );
  assert.match(
    generateRoute,
    /const summaryOnly = search\.get\("summary"\) === "1"/,
  );
});

test("protects concurrent asset writes from ENOSPC orphan cleanup", async () => {
  const assetRoute = await readFile(
    new URL("../app/api/assets/route.ts", import.meta.url),
    "utf8",
  );
  const registerIndex = assetRoute.indexOf("INSERT INTO assets");
  const storeIndex = assetRoute.indexOf("await storeAsset()");
  const replaceIndex = assetRoute.indexOf("for (const asset of existing.results ?? [])");
  assert.ok(registerIndex >= 0 && storeIndex >= 0 && registerIndex < storeIndex);
  assert.ok(
    replaceIndex > storeIndex,
    "the old slot must remain readable until its replacement is stored",
  );
  assert.match(assetRoute, /DELETE FROM asset_owners WHERE asset_id = \? AND user_id = \?/);
});

test("keeps partial Listing recovery without showing header progress counts", async () => {
  const page = await readFile(
    new URL("../app/studio/page.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(page, /className="generation-status"/);
  assert.doesNotMatch(page, /generatedImages \+ failedImages >= expectedImages/);
  assert.match(page, /markGeneratedImageUnavailable/);
  assert.match(page, /张资源加载失败/);
  assert.match(page, /Listing 已完成 · \$\{suiteImageCount\} 张套图生成失败，可单独重试/);
  assert.doesNotMatch(page, /if \(!done\) throw new Error\(firstError \|\| "Listing 文案已完成，但套图生成失败"\)/);
});

test("shows a Listing as soon as its JSON arrives while image slots keep streaming", async () => {
  const page = await readFile(
    new URL("../app/studio/page.tsx", import.meta.url),
    "utf8",
  );
  const readySource = page.match(
    /function isListingReady\(turn: Turn\) \{([\s\S]*?)\n\}/,
  )?.[1];

  assert.ok(readySource, "isListingReady source should be present");
  assert.match(readySource, /turn\.listing/);
  assert.doesNotMatch(readySource, /turn\.running/);
  assert.doesNotMatch(
    readySource,
    /expectedImages|generatedImages|failedImages|imageTaskCount/,
  );
  assert.match(page, /ready=\{isListingReady\(turn\)\}/);
  assert.match(page, /if \(!ready\)[\s\S]*listing-loading-skeleton/);
});

test("keeps every configured Listing image slot mounted until its image arrives", async () => {
  const page = await readFile(
    new URL("../app/studio/page.tsx", import.meta.url),
    "utf8",
  );
  const listingResultSource = page.slice(
    page.indexOf("function ListingResult("),
    page.indexOf("function ImageSuite("),
  );

  assert.ok(listingResultSource, "ListingResult source should be present");
  assert.doesNotMatch(
    listingResultSource,
    /generated(?:Main|APlus|MobileAPlus)Images\s*=\s*generatedImages[\s\S]{0,180}?\.filter\(Boolean\)/,
  );
  assert.match(
    listingResultSource,
    /suiteItems\(|Array\.from\(\{\s*length:\s*suite\.(?:mainImageCount|aPlusCount)/,
  );
  assert.match(listingResultSource, /data-testid=\{`listing-thumb-\$\{index\}`\}/);
  assert.match(listingResultSource, /data-testid=\{`listing-a-plus-slot-\$\{index\}`\}/);
  assert.match(listingResultSource, /data-testid=\{`listing-mobile-a-plus-slot-\$\{index\}`\}/);
});

test("keeps a failed Listing image in place and retries only that slot", async () => {
  const page = await readFile(
    new URL("../app/studio/page.tsx", import.meta.url),
    "utf8",
  );
  const listingResultSource = page.slice(
    page.indexOf("function ListingResult("),
    page.indexOf("function ImageSuite("),
  );

  assert.match(listingResultSource, /failedSlots(?:\s*=\s*\[\])?/);
  assert.match(listingResultSource, /onRegenerate/);
  assert.match(listingResultSource, /regenerating/);
  assert.match(listingResultSource, /failedSlots\.includes\(index\)/);
  assert.match(page, /function AssetFailureState/);
  assert.match(page, /源文件不可用，可单独重试/);
  assert.match(page, /重新生成/);
  assert.match(listingResultSource, /onRegenerate\(item\)/);
  assert.match(
    page,
    /<ListingResult[\s\S]*?failedSlots=\{turn\.failedImageSlots \?\? \[\]\}[\s\S]*?onRegenerate=/,
  );
});

test("shows missing downloads inline and turns the slot into a retry state", async () => {
  const page = await readFile(
    new URL("../app/studio/page.tsx", import.meta.url),
    "utf8",
  );
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /response\.status === 404/);
  assert.match(page, /className="preview-download-error"/);
  assert.match(page, /if \(failure\.status === 404\) onUnavailable\?\.\(\)/);
  assert.match(page, /onUnavailable=\{\(\) => markGeneratedImageUnavailable/);
  assert.match(styles, /\.preview-download-error/);
  assert.match(styles, /\.asset-failure-state/);
  assert.match(styles, /\.asset-failure-state\s*\{[^}]*background:\s*#fff1ef;[^}]*color:\s*#9d3b31;/);
});

test("keeps regenerated results loading in place and marks unseen conversations", async () => {
  const [page, history, styles] = await Promise.all([
    readFile(new URL("../app/studio/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/history/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /isRegenerating = regenerating === item\.id/);
  assert.match(page, /markResultReady\(turn\.conversationId\)/);
  assert.match(page, /conversation-unread/);
  assert.match(page, /orderedConversations/);
  assert.match(history, /conversation_read_states/);
  assert.match(history, /ORDER BY c\.created_at DESC/);
  assert.match(history, /"mark-read" \| "mark-unread"/);
  assert.match(styles, /\.conversation-list\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.conversation-unread\s*\{[^}]*background:\s*#e43e35/);
});

test("shows final generation prompts with their input images in admin", async () => {
  const [route, userResultsRoute, generateRoute, page] = await Promise.all([
    readFile(new URL("../app/api/admin/generations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/[id]/results/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/generate/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /a\.turn_id IN/);
  assert.match(route, /inputImages:/);
  assert.match(route, /\?preview=1/);
  assert.match(page, /最终 Prompt/);
  assert.match(page, /admin-generation-inputs/);
  assert.match(generateRoute, /request\.set\("prompt", generationPrompt\)/);
  assert.match(generateRoute, /prompt: generationPrompt/);
  assert.match(userResultsRoute, /NULLIF\(g\.prompt, ''\) AS prompt/);
  assert.doesNotMatch(userResultsRoute, /COALESCE\(NULLIF\(g\.prompt/);
  assert.match(page, /查看最终生图 Prompt/);
  assert.match(page, /\{asset\.prompt\}/);
});

test("preloads Google sign-in and serves WebP previews with PNG and JPG downloads", async () => {
  const [account, landing, asset, landingMedia, inspirationMedia] = await Promise.all([
    readFile(new URL("../app/account-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/landing-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/assets/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/landing/media/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/inspiration/media/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(account, /export function preloadGoogleSignIn/);
  assert.match(landing, /preloadGoogleSignIn\(\)/);
  assert.match(asset, /"content-type": "image\/webp"/);
  assert.match(asset, /downloadFormat === "jpg"/);
  assert.match(asset, /\.png\(\{ compressionLevel: 9/);
  assert.match(landingMedia, /\.webp\(\{ quality: 88/);
  assert.match(inspirationMedia, /\.webp\(\{ quality: 88/);
});

test("supports pasted images, remembered settings, grouped galleries, and reliable batch downloads", async () => {
  const [page, styles, packageJson] = await Promise.all([
    readFile(new URL("../app/studio/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /event\.clipboardData\.items/);
  assert.match(page, /onPaste=\{pasteImages\}/);
  assert.match(page, /mercato-studio-settings-v1/);
  assert.match(page, /localStorage\.setItem\(STUDIO_SETTINGS_KEY/);
  assert.match(page, /主副图/);
  assert.match(page, /手机 A\+ 图/);
  assert.match(page, /高级.*A\+ 图/);
  assert.match(page, /重新编辑/);
  assert.match(page, /再次生成/);
  assert.match(page, /全部下载/);
  assert.match(page, /fetchImageBlob/);
  assert.match(page, /zipSync\(/);
  assert.match(page, /URL\.createObjectURL\(blob\)/);
  assert.match(styles, /asset-hover-download/);
  assert.equal(JSON.parse(packageJson).dependencies.fflate, "0.7.5");
});
