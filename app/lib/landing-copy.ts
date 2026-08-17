export type LandingSellingPoint = {
  title: string;
  body: string;
};

export type LandingMedia = {
  hero: string;
  listing: string;
  lifestyle: string;
  scene: string;
  videoPoster: string;
};

export type LandingContent = {
  heroTitle: string;
  heroSubtitle: string;
  primaryCta: string;
  secondaryCta: string;
  resultsTitle: string;
  resultsBody: string;
  sellingPoints: LandingSellingPoint[];
  closingTitle: string;
  closingBody: string;
  media: LandingMedia;
};

export const DEFAULT_LANDING_CONTENT: LandingContent = {
  heroTitle: "一张图，生成一条 Listing",
  heroSubtitle: "上传商品素材，生成可编辑的 Amazon Listing、商品套图和视频。",
  primaryCta: "开始创作",
  secondaryCta: "查看生成示例",
  resultsTitle: "一次输入，三种直接可用的结果",
  resultsBody: "从商品页到广告素材，按任务选择生成模式。",
  sellingPoints: [
    {
      title: "完整 Listing，不止几段文案",
      body: "标题、五点卖点、商品信息、主副图和 A+ 内容在同一个结果页中交付。",
    },
    {
      title: "每种任务，都有专门的 Skill",
      body: "白底图、场景图、商品套图、链接复刻和视频复刻使用不同输入与生成设置。",
    },
    {
      title: "品牌和市场，从输入开始",
      body: "销售地区、语言、品牌色、字体与发布平台会进入正式生成链路。",
    },
    {
      title: "每张图片，都是独立任务",
      body: "多个 Prompt 分别生成、分别展示、分别下载，不把整套需求拼在一张图里。",
    },
    {
      title: "从生成到交付，都在同一处",
      body: "继续对话、在线编辑、重试、下载和资产历史全部保留。",
    },
  ],
  closingTitle: "现在，把商品变成能上架的内容",
  closingBody: "使用自己的模型 API Key 开始创作，生成记录只属于当前账号。",
  media: {
    hero: "/landing-hero.webp",
    listing: "/product-main.webp",
    lifestyle: "/product-lifestyle.webp",
    scene: "/product-outdoor.webp",
    videoPoster: "/product-lifestyle.webp",
  },
};

const LEGACY_PRICE_SUGGESTION_COPY =
  "标题、五点卖点、价格建议、主副图和 A+ 内容在同一个结果页中交付。";

function text(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || fallback;
}

function mediaUrl(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().slice(0, 800);
  if (
    (normalized.startsWith("/") && !normalized.startsWith("//")) ||
    normalized.startsWith("https://")
  ) {
    return normalized;
  }
  return fallback;
}

export function normalizeLandingContent(value: unknown): LandingContent {
  const source = value && typeof value === "object"
    ? value as Partial<LandingContent>
    : {};
  const media = source.media && typeof source.media === "object"
    ? source.media as Partial<LandingMedia>
    : {};
  const points = Array.isArray(source.sellingPoints)
    ? source.sellingPoints
      .filter((point): point is LandingSellingPoint =>
        Boolean(point) && typeof point === "object"
      )
      .slice(0, 8)
      .map((point, index) => {
        const body = text(
          point.body,
          DEFAULT_LANDING_CONTENT.sellingPoints[index]?.body || "请补充卖点说明。",
          160,
        );
        return {
          title: text(
            point.title,
            DEFAULT_LANDING_CONTENT.sellingPoints[index]?.title || "新卖点",
            48,
          ),
          body: body === LEGACY_PRICE_SUGGESTION_COPY
            ? DEFAULT_LANDING_CONTENT.sellingPoints[0].body
            : body,
        };
      })
    : [];

  return {
    heroTitle: text(source.heroTitle, DEFAULT_LANDING_CONTENT.heroTitle, 44),
    heroSubtitle: text(
      source.heroSubtitle,
      DEFAULT_LANDING_CONTENT.heroSubtitle,
      120,
    ),
    primaryCta: text(source.primaryCta, DEFAULT_LANDING_CONTENT.primaryCta, 16),
    secondaryCta: text(
      source.secondaryCta,
      DEFAULT_LANDING_CONTENT.secondaryCta,
      16,
    ),
    resultsTitle: text(
      source.resultsTitle,
      DEFAULT_LANDING_CONTENT.resultsTitle,
      48,
    ),
    resultsBody: text(
      source.resultsBody,
      DEFAULT_LANDING_CONTENT.resultsBody,
      120,
    ),
    sellingPoints: points.length
      ? points
      : DEFAULT_LANDING_CONTENT.sellingPoints,
    closingTitle: text(
      source.closingTitle,
      DEFAULT_LANDING_CONTENT.closingTitle,
      48,
    ),
    closingBody: text(
      source.closingBody,
      DEFAULT_LANDING_CONTENT.closingBody,
      120,
    ),
    media: {
      hero: mediaUrl(media.hero, DEFAULT_LANDING_CONTENT.media.hero),
      listing: mediaUrl(media.listing, DEFAULT_LANDING_CONTENT.media.listing),
      lifestyle: mediaUrl(
        media.lifestyle,
        DEFAULT_LANDING_CONTENT.media.lifestyle,
      ),
      scene: mediaUrl(media.scene, DEFAULT_LANDING_CONTENT.media.scene),
      videoPoster: mediaUrl(
        media.videoPoster,
        DEFAULT_LANDING_CONTENT.media.videoPoster,
      ),
    },
  };
}
