"use client";

import {
  ArrowRight,
  Browser,
  Check,
  DownloadSimple,
  GlobeHemisphereEast,
  ImageSquare,
  MagicWand,
  PencilSimple,
  Play,
  Sparkle,
  VideoCamera,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import type { LandingContent } from "./lib/landing-copy";

type ResultMode = "listing" | "image" | "video";

const modeOptions: Array<{
  id: ResultMode;
  label: string;
  detail: string;
}> = [
  { id: "listing", label: "Listing", detail: "文案、图片与 A+" },
  { id: "image", label: "图片", detail: "主副图与营销套图" },
  { id: "video", label: "视频", detail: "复刻与带货口播" },
];

const skillGroups = [
  {
    label: "Listing 生成",
    items: ["亚马逊 Listing", "链接复刻"],
  },
  {
    label: "图片生成",
    items: ["商品套图", "商品白底图", "人物场景图", "种草组图"],
  },
  {
    label: "视频生成",
    items: ["视频复刻", "带货口播"],
  },
];

function ProductResult({ mode }: { mode: ResultMode }) {
  if (mode === "video") {
    return (
      <div className="landing-result-video">
        <video
          src="/product-demo.mp4"
          controls
          playsInline
          preload="metadata"
          poster="/product-lifestyle.png"
          aria-label="商品视频生成示例"
        />
        <div>
          <VideoCamera weight="duotone" aria-hidden="true" />
          <span>15 秒商品视频</span>
          <strong>参考视频 + 商品素材</strong>
        </div>
      </div>
    );
  }

  if (mode === "image") {
    return (
      <div className="landing-result-images">
        {[
          ["/product-main.png", "商品主图"],
          ["/product-lifestyle.png", "生活方式图"],
          ["/product-outdoor.png", "场景图"],
        ].map(([src, label], index) => (
          <figure key={src} style={{ "--image-index": index } as React.CSSProperties}>
            <img src={src} alt={label} />
            <figcaption>{label}</figcaption>
          </figure>
        ))}
      </div>
    );
  }

  return (
    <article className="landing-listing-result">
      <img src="/product-main.png" alt="便携咖啡机商品主图" />
      <div>
        <span>Amazon Listing</span>
        <h3>Portable Espresso Maker for Travel and Everyday Coffee</h3>
        <ul>
          <li><Check weight="bold" />完整标题与五点卖点</li>
          <li><Check weight="bold" />主副图与 A+ 品牌内容</li>
          <li><Check weight="bold" />在线编辑并下载 JSON</li>
        </ul>
      </div>
    </article>
  );
}

export default function LandingPage({ content }: { content: LandingContent }) {
  const [resultMode, setResultMode] = useState<ResultMode>("listing");
  const [featuredPoint, skillPoint, brandPoint, taskPoint, deliveryPoint] =
    content.sellingPoints;
  const heroTitleParts = content.heroTitle.split("，");

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link href="/" className="landing-brand" aria-label="Mercato 首页">
          <span aria-hidden="true">♥</span>
          <strong>MERCATO</strong>
        </Link>
        <nav aria-label="落地页导航">
          <a href="#results">生成结果</a>
          <a href="#skills">Skills</a>
          <a href="#workflow">工作流</a>
        </nav>
        <Link href="/studio" className="landing-login">
          进入工作台 <ArrowRight weight="bold" />
        </Link>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">
            <Sparkle weight="fill" />跨境电商内容工作台
          </span>
          <h1 id="landing-title">
            {heroTitleParts.length > 1 ? (
              <>
                <span>{heroTitleParts[0]}，</span>
                <span>{heroTitleParts.slice(1).join("，")}</span>
              </>
            ) : content.heroTitle}
          </h1>
          <p>{content.heroSubtitle}</p>
          <div className="landing-hero-actions">
            <Link href="/studio" className="landing-primary-cta">
              {content.primaryCta}<ArrowRight weight="bold" />
            </Link>
            <a href="#results" className="landing-secondary-cta">
              {content.secondaryCta}
            </a>
          </div>
          <div className="landing-hero-note">
            <span><Check weight="bold" />自己的 API Key</span>
            <span><Check weight="bold" />生成记录可追溯</span>
          </div>
        </div>
        <figure className="landing-hero-visual">
          <img
            src="/landing-hero.webp"
            alt="同一件商品生成白底图、生活方式图和品牌故事图"
          />
          <figcaption>
            <span>同一件商品</span>
            <strong>从素材到可上架内容</strong>
          </figcaption>
        </figure>
      </section>

      <section className="landing-results" id="results">
        <header className="landing-section-head">
          <div>
            <span>01 / 结果</span>
            <h2>{content.resultsTitle}</h2>
          </div>
          <p>{content.resultsBody}</p>
        </header>
        <div className="landing-results-stage">
          <div className="landing-mode-rail" role="tablist" aria-label="生成结果类型">
            {modeOptions.map((option) => (
              <button
                type="button"
                role="tab"
                aria-selected={resultMode === option.id}
                className={resultMode === option.id ? "active" : ""}
                onClick={() => setResultMode(option.id)}
                key={option.id}
              >
                <span>
                  {option.id === "listing" ? <Browser weight="duotone" /> : null}
                  {option.id === "image" ? <ImageSquare weight="duotone" /> : null}
                  {option.id === "video" ? <Play weight="duotone" /> : null}
                </span>
                <strong>{option.label}</strong>
                <small>{option.detail}</small>
              </button>
            ))}
          </div>
          <div className="landing-result-panel" role="tabpanel">
            <ProductResult mode={resultMode} />
          </div>
        </div>
      </section>

      {featuredPoint ? (
        <section className="landing-featured-point">
          <div>
            <span>Listing First</span>
            <h2>{featuredPoint.title}</h2>
            <p>{featuredPoint.body}</p>
            <Link href="/studio">
              生成第一条 Listing <ArrowRight weight="bold" />
            </Link>
          </div>
          <div className="landing-featured-art">
            <div className="landing-copy-sheet">
              <span>Listing copy</span>
              <i />
              <i />
              <i />
              <i />
            </div>
            <img src="/product-main.png" alt="Listing 商品主图示例" />
            <div className="landing-a-plus-strip">
              <img src="/product-lifestyle.png" alt="" />
              <span>A+ 品牌内容</span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="landing-skills" id="skills">
        <header>
          <span>02 / Skills</span>
          <h2>{skillPoint?.title || "每种任务，都有专门的 Skill"}</h2>
          <p>
            {skillPoint?.body ||
              "不同任务使用不同输入、设置和输出结构。"}
          </p>
        </header>
        <div className="landing-skill-groups">
          {skillGroups.map((group, groupIndex) => (
            <section key={group.label}>
              <span>0{groupIndex + 1}</span>
              <h3>{group.label}</h3>
              <div>
                {group.items.map((item) => (
                  <b key={item}>{item}</b>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="landing-brand-context">
        <div className="landing-context-visual" aria-label="生成上下文示例">
          <div>
            <span>销售地区</span>
            <strong>🇺🇸 US 美国</strong>
          </div>
          <div>
            <span>生成语言</span>
            <strong>English</strong>
          </div>
          <div>
            <span>品牌主色</span>
            <strong><i />智能品牌色</strong>
          </div>
          <div>
            <span>发布平台</span>
            <strong>Amazon</strong>
          </div>
        </div>
        <div>
          <GlobeHemisphereEast weight="duotone" aria-hidden="true" />
          <h2>{brandPoint?.title || "品牌和市场，从输入开始"}</h2>
          <p>
            {brandPoint?.body ||
              "品牌与市场设置会进入正式生成链路。"}
          </p>
        </div>
      </section>

      <section className="landing-task-story">
        <header>
          <span>03 / Tasks</span>
          <h2>{taskPoint?.title || "每张图片，都是独立任务"}</h2>
          <p>
            {taskPoint?.body ||
              "每个 Prompt 单独生成、单独展示、单独重试。"}
          </p>
        </header>
        <div className="landing-task-grid">
          {[
            ["/product-main.png", "主图", "1:1"],
            ["/product-lifestyle.png", "生活方式图", "1:1"],
            ["/product-outdoor.png", "场景图", "1:1"],
            ["/landing-hero.webp", "A+ 品牌图", "宽幅"],
          ].map(([src, label, ratio], index) => (
            <figure key={label} style={{ "--task-index": index } as React.CSSProperties}>
              <img src={src} alt={label} />
              <figcaption><span>{label}</span><small>{ratio}</small></figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="landing-workflow" id="workflow">
        <header>
          <span>04 / Workflow</span>
          <h2>{deliveryPoint?.title || "从生成到交付，都在同一处"}</h2>
          <p>
            {deliveryPoint?.body ||
              "编辑、重试、下载和资产历史都在一个工作区。"}
          </p>
        </header>
        <ol>
          <li><span><MagicWand weight="duotone" /></span><strong>生成</strong><small>按 Skill 创建任务</small></li>
          <li><span><PencilSimple weight="duotone" /></span><strong>编辑</strong><small>继续对话或在线修改</small></li>
          <li><span><DownloadSimple weight="duotone" /></span><strong>交付</strong><small>下载图片、视频和 JSON</small></li>
        </ol>
      </section>

      <section className="landing-final-cta">
        <div>
          <h2>{content.closingTitle}</h2>
          <p>{content.closingBody}</p>
        </div>
        <Link href="/studio" className="landing-primary-cta">
          {content.primaryCta}<ArrowRight weight="bold" />
        </Link>
      </section>

      <footer className="landing-footer">
        <Link href="/" className="landing-brand">
          <span aria-hidden="true">♥</span><strong>MERCATO</strong>
        </Link>
        <p>AI commerce content studio</p>
        <Link href="/studio">进入工作台</Link>
      </footer>
    </main>
  );
}
