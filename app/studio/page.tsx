"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp,
  ArrowRight,
  CaretDown,
  CaretUp,
  ChatCircle,
  House,
  Images,
  LinkSimple,
  Play,
  Plus,
  X,
} from "@phosphor-icons/react";
import AccountPanel, { type ClientSession } from "../account-panel";
import { imageOutputSpec } from "../image-output-spec.mjs";
import { imageTaskCount } from "../image-task-count.mjs";

type Option = {
  id: string;
  label: string;
  description?: string;
};

type Upload = {
  id: string;
  name: string;
  url: string;
  owned?: boolean;
  file?: File;
};

type GenerationMode = "image" | "video" | "listing";
type SkillKind = "listing" | "images" | "single" | "seeding" | "video";

type SkillOption = Option & {
  mode: GenerationMode;
  kind: SkillKind;
  starter: string;
};

type BrandSettings = {
  primaryColor: string;
  fontStyle: string;
  platform: string;
};

type SuiteSettings = {
  aPlusType: string;
  aPlusCount: number;
  mainImageCount: number;
  mainImageRatio: "1:1" | "3:4";
};

type GalleryItem = {
  id: string;
  group: string;
  title: string;
  image: string;
  wide?: boolean;
  portrait?: boolean;
  crop?: string;
};

type ListingData = {
  title: string;
  brand?: string;
  category?: string;
  salePrice?: string;
  listPrice?: string;
  bullets: string[];
  description: string;
  aPlusHeadline?: string;
  specifications?: Record<string, string>;
  productUrlSlug?: string;
};

type Turn = {
  id: string;
  conversationId: string;
  createdAt: string;
  title: string;
  prompt: string;
  mode: GenerationMode;
  skill: string;
  kind: SkillKind;
  region: string;
  language: string;
  brand: BrandSettings;
  suite: SuiteSettings;
  productImage: string;
  productImages?: string[];
  referenceVideo?: string;
  referenceVideoName?: string;
  completed: number;
  running: boolean;
  phase: string;
  error?: string;
  agentText?: string;
  listing?: ListingData;
  images?: string[];
  imageTaskCount?: number;
  failedImageSlots?: number[];
  videoUrl?: string;
};

const MAX_UPLOADS = 9;
const MAX_REFERENCE_VIDEO_BYTES = 100 * 1024 * 1024;

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
};

type PreviewState = GalleryItem & {
  turnId: string;
  slot: number;
};

type AssetRecord = {
  id: string;
  type: "image" | "video";
  title: string;
  prompt: string;
  url: string;
  downloadUrl?: string;
  conversationId: string;
  turnId: string;
  role?: "input" | "output";
  slot?: number;
  createdAt: string;
};

type InspirationCase = {
  id: string;
  tab: "featured" | "image" | "video";
  mode: GenerationMode;
  skill: string;
  title: string;
  description: string;
  prompt: string;
  images: string[];
  layout: "suite" | "portrait" | "landscape";
  suite?: Partial<SuiteSettings>;
};

function assetDownloadUrl(url: string, format: "png" | "jpg" = "png") {
  if (!url.startsWith("/api/assets/")) return url;
  return `${url.split("?")[0]}?download=1&format=${format}`;
}

type GenerationSummary = {
  status: "complete" | "partial" | "failed";
  completed: number;
  expected: number;
  failed: number;
};

function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const modes: Option[] = [
  { id: "listing", label: "Listing 生成", description: "生成亚马逊商品链接内容" },
  { id: "image", label: "图片生成", description: "生成商品图、场景图与电商套图" },
  { id: "video", label: "视频生成", description: "生成商品视频与带货口播" },
];

const skills: SkillOption[] = [
  {
    id: "amazon-image-set",
    mode: "image",
    kind: "images",
    label: "商品套图",
    description: "生成主副图、A+ 图与可选手机 A+ 图",
    starter: "生成完整 Amazon 商品套图",
  },
  {
    id: "ecommerce-image-set",
    mode: "image",
    kind: "images",
    label: "跨境电商套图",
    description: "适配 Amazon、TikTok、Shopee 的营销套图",
    starter: "生成跨境电商商品营销套图",
  },
  {
    id: "amazon-scene-image",
    mode: "image",
    kind: "single",
    label: "人物场景图",
    description: "生成真人使用或操作商品的生活方式图",
    starter: "生成一张 Amazon 人物使用场景图",
  },
  {
    id: "china-ecommerce-main-image",
    mode: "image",
    kind: "single",
    label: "国内电商主图",
    description: "生成淘宝、天猫、京东等中文商品主图",
    starter: "生成一张国内中文电商商品主图",
  },
  {
    id: "china-seeding-image",
    mode: "image",
    kind: "seeding",
    label: "种草组图",
    description: "生成好物分享、安利与合集种草图片",
    starter: "生成一组 3:4 商品种草图",
  },
  {
    id: "white-background-image",
    mode: "image",
    kind: "single",
    label: "商品白底图",
    description: "抠图换纯白背景并精修商品质感",
    starter: "生成一张平台规范的商品白底图",
  },
  {
    id: "video-replica",
    mode: "video",
    kind: "video",
    label: "视频复刻",
    description: "参考描述复刻节奏、镜头与商品展示方式",
    starter: "复刻一支 15 秒商品展示视频",
  },
  {
    id: "talking-product-video",
    mode: "video",
    kind: "video",
    label: "带货口播",
    description: "生成带货口播结构与商品演示画面",
    starter: "生成一支 15 秒商品带货口播视频",
  },
  {
    id: "amazon-listing",
    mode: "listing",
    kind: "listing",
    label: "亚马逊 Listing",
    description: "生成标题、卖点、描述、主副图与 A+ 内容",
    starter: "生成完整亚马逊商品 Listing",
  },
  {
    id: "listing-replica",
    mode: "listing",
    kind: "listing",
    label: "链接复刻",
    description: "参考用户提供的链接结构生成同类 Listing",
    starter: "参考我提供的商品链接结构生成 Listing",
  },
];

const skillsByMode = (mode: GenerationMode) =>
  skills.filter((item) => item.mode === mode);

const quickCapabilities: Array<{
  id: string;
  mode: GenerationMode;
  skill: string;
  title: string;
  body: string;
  image: string;
}> = [
  {
    id: "quick-link-replica",
    mode: "listing",
    skill: "listing-replica",
    title: "链接复刻",
    body: "粘贴商品链接，复刻结构与内容",
    image: "/product-lifestyle.png",
  },
  {
    id: "quick-listing",
    mode: "listing",
    skill: "amazon-listing",
    title: "Listing 生成",
    body: "文案、套图与商品详情同步生成",
    image: "/landing-hero.webp",
  },
  {
    id: "quick-video-replica",
    mode: "video",
    skill: "video-replica",
    title: "视频复刻",
    body: "参考一条视频，替换成你的商品",
    image: "/product-outdoor.png",
  },
  {
    id: "quick-image-suite",
    mode: "image",
    skill: "amazon-image-set",
    title: "套图生成",
    body: "主副图与 A+ 图一次生成",
    image: "/product-main.png",
  },
  {
    id: "quick-talking-video",
    mode: "video",
    skill: "talking-product-video",
    title: "带货口播",
    body: "生成 15 秒商品口播与演示",
    image: "/product-lifestyle.png",
  },
];

const inspirationTabs: Option[] = [
  { id: "featured", label: "精选" },
  { id: "image", label: "商品图片" },
  { id: "video", label: "商品视频" },
];

const inspirationCases: InspirationCase[] = [
  {
    id: "case-portable-listing",
    tab: "featured",
    mode: "listing",
    skill: "amazon-listing",
    title: "便携咖啡机完整 Listing",
    description: "主副图、A+ 内容与 Listing 文案",
    prompt: "为这款便携咖啡机生成完整亚马逊 Listing，突出便携、自加热与户外使用场景",
    images: ["/product-main.png", "/product-lifestyle.png", "/product-outdoor.png"],
    layout: "suite",
    suite: { aPlusType: "advanced", aPlusCount: 5, mainImageCount: 5, mainImageRatio: "1:1" },
  },
  {
    id: "case-travel-suite",
    tab: "image",
    mode: "image",
    skill: "amazon-image-set",
    title: "旅行场景商品套图",
    description: "一张主图加多张场景与卖点图",
    prompt: "生成一套适合 Amazon 的商品套图，强调旅行便携、户外使用和快速出杯",
    images: ["/product-outdoor.png", "/product-main.png", "/product-lifestyle.png"],
    layout: "suite",
    suite: { aPlusType: "advanced", aPlusCount: 4, mainImageCount: 4, mainImageRatio: "1:1" },
  },
  {
    id: "case-kitchen-scene",
    tab: "image",
    mode: "image",
    skill: "amazon-scene-image",
    title: "明亮厨房使用场景",
    description: "自然光下的真实商品使用画面",
    prompt: "生成一张明亮现代厨房中的真实商品使用场景图，画面自然、有生活感",
    images: ["/product-lifestyle.png"],
    layout: "portrait",
  },
  {
    id: "case-link-structure",
    tab: "featured",
    mode: "listing",
    skill: "listing-replica",
    title: "同类商品链接复刻",
    description: "保留参考结构，替换为你的商品内容",
    prompt: "https://www.amazon.com/dp/example",
    images: ["/product-main.png", "/product-lifestyle.png"],
    layout: "landscape",
  },
  {
    id: "case-outdoor-video",
    tab: "video",
    mode: "video",
    skill: "talking-product-video",
    title: "15 秒户外带货口播",
    description: "开场吸引、卖点演示、行动引导",
    prompt: "生成一支 15 秒户外场景带货口播视频，前三秒突出便携卖点",
    images: ["/product-outdoor.png"],
    layout: "portrait",
  },
  {
    id: "case-clean-main-image",
    tab: "image",
    mode: "image",
    skill: "white-background-image",
    title: "平台规范白底精修",
    description: "保留商品结构，提升材质和边缘质量",
    prompt: "生成一张平台规范的纯白背景商品图，保持产品结构准确并提升材质细节",
    images: ["/product-main.png"],
    layout: "landscape",
  },
];

const regions: Option[] = [
  { id: "us", label: "🇺🇸 US（美国）" },
  { id: "cn", label: "🇨🇳 CN（中国）" },
  { id: "eu", label: "🇪🇺 EU（欧洲）" },
  { id: "jp", label: "🇯🇵 JP（日本）" },
  { id: "br", label: "🇧🇷 BR（巴西）" },
  { id: "kr", label: "🇰🇷 KR（韩国）" },
  { id: "tha", label: "🇹🇭 THA（泰国）" },
  { id: "ru", label: "🇷🇺 RU（俄罗斯）" },
  { id: "uk", label: "🇬🇧 UK（英国）" },
  { id: "in", label: "🇮🇳 IN（印度）" },
  { id: "phl", label: "🇵🇭 PHL（菲律宾）" },
  { id: "id", label: "🇮🇩 ID（印尼）" },
  { id: "mys", label: "🇲🇾 MYS（马来西亚）" },
  { id: "vnm", label: "🇻🇳 VNM（越南）" },
  { id: "mx", label: "🇲🇽 MX（墨西哥）" },
  { id: "latam", label: "🌎 LATAM（拉美）" },
  { id: "gcc", label: "🌍 GCC（中东）" },
  { id: "other", label: "🌐 其他地区" },
];

const languages: Option[] = [
  { id: "en", label: "英语" },
  { id: "zh", label: "中文" },
  { id: "ja", label: "日语" },
  { id: "ru", label: "俄语" },
  { id: "it", label: "意大利语" },
  { id: "fr", label: "法语" },
  { id: "es", label: "西班牙语" },
  { id: "de", label: "德语" },
  { id: "ko", label: "韩语" },
  { id: "th", label: "泰语" },
  { id: "pt", label: "葡萄牙语" },
  { id: "ms", label: "马来语" },
  { id: "nl", label: "荷兰语" },
  { id: "pl", label: "波兰语" },
  { id: "sv", label: "瑞典语" },
  { id: "tr", label: "土耳其语" },
  { id: "other", label: "其他语言" },
];

const platforms: Option[] = [
  { id: "amazon", label: "亚马逊" },
  { id: "tiktok-shop", label: "TikTok Shop" },
  { id: "shopee", label: "Shopee" },
  { id: "temu", label: "Temu" },
];

const fontStyles: Option[] = [
  { id: "auto", label: "智能字体风格", description: "根据商品智能设定" },
  { id: "geometric", label: "几何无衬线体", description: "科技产品、现代家居等" },
  { id: "neo-grotesk", label: "硬朗无衬线体", description: "五金工具、户外用品等" },
  { id: "elegant", label: "优雅衬线体", description: "化妆品、复古、高奢等" },
  { id: "rounded", label: "圆润童趣字体", description: "母婴玩具、休闲零食等" },
  { id: "handwritten", label: "俏皮手写风格", description: "文创手作、节日礼品等" },
];

const aPlusTypes: Option[] = [
  { id: "advanced", label: "高级 A+" },
  { id: "standard", label: "普通 A+" },
  { id: "advanced-mobile", label: "高级 + 手机 A+" },
];

const aPlusCounts: Option[] = Array.from({ length: 9 }, (_, count) => ({
  id: String(count),
  label: `${count} 张`,
}));

const mainImageCounts: Option[] = Array.from({ length: 9 }, (_, count) => ({
  id: String(count),
  label: `${count} 张`,
}));

const mainImageRatios: Option[] = [
  { id: "1:1", label: "1:1" },
  { id: "3:4", label: "3:4" },
];

const defaultBrandSettings: BrandSettings = {
  primaryColor: "",
  fontStyle: "auto",
  platform: "amazon",
};

const defaultSuiteSettings: SuiteSettings = {
  aPlusType: "advanced",
  aPlusCount: 5,
  mainImageCount: 5,
  mainImageRatio: "1:1",
};

function isImageSuiteSkill(skillId: string) {
  return ["amazon-image-set", "ecommerce-image-set"].includes(skillId);
}

function hasSuiteSettings(skillId: string) {
  return isImageSuiteSkill(skillId) || skillId === "amazon-listing";
}

function explicitImageCount(prompt: string) {
  const chineseNumbers: Record<string, number> = {
    一: 1,
    两: 2,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
  };
  const match =
    prompt.match(/([1-8一两二三四五六七八])\s*(?:张|幅)(?:图|图片)?/) ??
    prompt.match(/\b([1-8])\s*(?:images?|pictures?)\b/i);
  return match ? Number(match[1]) || chineseNumbers[match[1]] : undefined;
}

function suiteTaskCount(skillId: string, suite: SuiteSettings, prompt: string) {
  const explicit = explicitImageCount(prompt);
  if (explicit) return explicit;
  if (!hasSuiteSettings(skillId)) return 0;
  const mobileCount = suite.aPlusType === "advanced-mobile" ? suite.aPlusCount : 0;
  return suite.mainImageCount + suite.aPlusCount + mobileCount;
}

function suiteSlot(
  suite: SuiteSettings,
  slot: number,
): { type: "main" | "a-plus" | "a-plus-mobile"; index: number } {
  if (slot < suite.mainImageCount) return { type: "main", index: slot };
  if (slot < suite.mainImageCount + suite.aPlusCount) {
    return { type: "a-plus", index: slot - suite.mainImageCount };
  }
  return {
    type: "a-plus-mobile",
    index: slot - suite.mainImageCount - suite.aPlusCount,
  };
}

function suiteOutputDimensions(suite: SuiteSettings, slot: number) {
  const slotConfig = suiteSlot(suite, slot);
  const spec = imageOutputSpec({
    slotType: slotConfig.type,
    slotIndex: slotConfig.index,
    aPlusType: suite.aPlusType,
    mainImageRatio: suite.mainImageRatio,
  });
  return {
    width: spec.outputWidth,
    height: spec.outputHeight,
  };
}

const gallery: GalleryItem[] = [
  {
    id: "main",
    group: "主图 1:1",
    title: "纯白商品主图",
    image: "/product-main.png",
  },
  {
    id: "feature",
    group: "副图 1:1",
    title: "轻巧便携",
    image: "/product-main.png",
    crop: "crop-detail",
  },
  {
    id: "travel",
    group: "副图 1:1",
    title: "旅居咖啡场景",
    image: "/product-lifestyle.png",
  },
  {
    id: "outdoor",
    group: "副图 1:1",
    title: "户外清晨",
    image: "/product-outdoor.png",
  },
  {
    id: "a-plus-one",
    group: "A+ 1464 × 600",
    title: "随时享用新鲜意式咖啡",
    image: "/product-lifestyle.png",
    wide: true,
  },
  {
    id: "a-plus-two",
    group: "A+ 1464 × 600",
    title: "从办公室到露营地",
    image: "/product-outdoor.png",
    wide: true,
  },
];

const seedingGallery: GalleryItem[] = [
  {
    id: "seeding-cover",
    group: "种草图 01 · 3:4",
    title: "今天的随身咖啡搭子",
    image: "/product-lifestyle.png",
  },
  {
    id: "seeding-detail",
    group: "种草图 02 · 3:4",
    title: "小机身，也有浓郁油脂",
    image: "/product-main.png",
    crop: "crop-detail",
  },
  {
    id: "seeding-outdoor",
    group: "种草图 03 · 3:4",
    title: "露营也能喝到现萃",
    image: "/product-outdoor.png",
  },
  {
    id: "seeding-routine",
    group: "种草图 04 · 3:4",
    title: "三分钟完成咖啡仪式",
    image: "/product-lifestyle.png",
  },
];

function suiteItems(
  skillId: string,
  count: number,
  suite: SuiteSettings = defaultSuiteSettings,
) {
  if (hasSuiteSettings(skillId)) {
    return Array.from({ length: count }, (_, index) => {
      const slot = suiteSlot(suite, index);
      const isAPlus = slot.type === "a-plus";
      const isMobile = slot.type === "a-plus-mobile";
      return {
        id: `${skillId}-${slot.type}-${slot.index}`,
        group: isMobile
          ? `手机 A+ ${slot.index + 1} · 2:3`
          : isAPlus
            ? `A+ 图 ${slot.index + 1} · 3:2`
            : `主副图 ${slot.index + 1} · ${suite.mainImageRatio}`,
        title: isMobile
          ? `手机 A+ 图 ${slot.index + 1}`
          : isAPlus
            ? `A+ 图 ${slot.index + 1}`
            : slot.index === 0
              ? "商品主图"
              : `商品副图 ${slot.index}`,
        image: index < gallery.length ? gallery[index].image : "/product-main.png",
        wide: isAPlus,
        portrait: slot.type === "main" && suite.mainImageRatio === "3:4",
      };
    });
  }
  const presets = skillId === "china-seeding-image" ? seedingGallery : gallery;
  if (count === presets.length) return presets;
  return Array.from({ length: count }, (_, index) => ({
    id: `${skillId}-${index}`,
    group: `图片 ${index + 1}`,
    title: `生成结果 ${index + 1}`,
    image: "/product-main.png",
  }));
}

function progressTotal(turn: Turn) {
  if (turn.kind === "listing" && turn.imageTaskCount) {
    return turn.imageTaskCount + 1;
  }
  return turn.imageTaskCount ?? generationCopy[turn.kind].phases.length;
}

const generationCopy: Record<
  SkillKind,
  { title: string; count: string; phases: string[] }
> = {
  listing: {
    title: "Amazon Listing",
    count: "1 个商品链接",
    phases: ["识别商品信息", "生成标题与卖点", "生成商品详情", "排版 A+ 页面"],
  },
  images: {
    title: "商品套图",
    count: "6 张图片",
    phases: ["抠出商品主体", "生成纯白主图", "生成卖点副图", "生成场景副图", "排版 A+ 图片", "完成质量检查"],
  },
  single: {
    title: "商品图片",
    count: "1 张图片",
    phases: ["识别商品主体", "匹配视觉规范", "生成商品图片", "完成质量检查"],
  },
  seeding: {
    title: "种草组图",
    count: "4 张图片",
    phases: ["识别商品与受众", "生成种草封面", "生成细节与场景图", "统一组图风格"],
  },
  video: {
    title: "商品视频",
    count: "1 条视频",
    phases: ["分析商品卖点", "生成镜头脚本", "合成商品画面", "完成视频"],
  },
};

const listingCopy = {
  en: {
    title:
      "BrewGo Portable Espresso Maker, Self-Heating Travel Coffee Machine with USB-C Charging, 20 Bar Pressure, Compatible with Ground Coffee and Capsules",
    about: "About this item",
    bullets: [
      "Rich espresso anywhere: 20 bar pressure delivers a smooth, full-bodied shot in about 3 minutes.",
      "Self-heating design: heats room-temperature water without a kettle, ideal for travel, work and camping.",
      "Ground coffee or capsules: the modular brew chamber lets you use your favorite coffee your way.",
      "Compact and rechargeable: a leak-resistant body fits easily in a backpack or car cup holder.",
      "Easy to clean: detachable food-grade components rinse clean in seconds.",
    ],
    description:
      "Your café ritual, made portable. BrewGo combines precise pressure, fast self-heating and a travel-ready form so fresh espresso is never tied to a countertop.",
  },
  de: {
    title:
      "BrewGo Tragbare Espressomaschine, selbstheizende Reisekaffeemaschine mit USB-C, 20 Bar, für Kaffeepulver und Kapseln",
    about: "Info zu diesem Artikel",
    bullets: [
      "Kräftiger Espresso überall: 20 Bar Druck für eine aromatische Tasse in etwa 3 Minuten.",
      "Selbstheizend: erwärmt Wasser ohne Wasserkocher, ideal für Reise, Büro und Camping.",
      "Flexibel: geeignet für Kaffeepulver und gängige Kapseln.",
      "Kompakt und aufladbar: auslaufsicher und passend für Rucksack oder Getränkehalter.",
      "Leicht zu reinigen: abnehmbare Teile lassen sich in Sekunden ausspülen.",
    ],
    description:
      "Ihr Café-Ritual für unterwegs. BrewGo verbindet präzisen Druck, schnelles Aufheizen und ein kompaktes Design für frischen Espresso an jedem Ort.",
  },
  ja: {
    title:
      "BrewGo ポータブルエスプレッソメーカー 自動加熱 USB-C充電 20気圧 コーヒー粉・カプセル対応 旅行・オフィス・キャンプ用",
    about: "この商品について",
    bullets: [
      "20気圧の高圧抽出で、約3分で香り豊かなエスプレッソを楽しめます。",
      "自動加熱機能により、ケトルなしで常温水から抽出できます。",
      "コーヒー粉とカプセルの両方に対応したモジュール設計です。",
      "持ち運びやすい充電式で、バッグや車のドリンクホルダーにも収まります。",
      "食品グレードのパーツは取り外して簡単に洗浄できます。",
    ],
    description:
      "いつものカフェ時間を、どこへでも。BrewGoなら、正確な圧力とスピーディーな加熱で、外出先でも淹れたての一杯を楽しめます。",
  },
  zh: {
    title:
      "BrewGo 便携式浓缩咖啡机，自加热旅行咖啡机，USB-C 充电，20 Bar 压力，兼容咖啡粉和胶囊",
    about: "关于此商品",
    bullets: [
      "20 Bar 高压萃取，约 3 分钟即可获得醇厚顺滑的浓缩咖啡。",
      "内置自加热系统，无需热水壶，旅行、办公和露营都能轻松使用。",
      "模块化粉仓兼容咖啡粉与胶囊，适配不同口味偏好。",
      "小巧可充电，防漏机身可轻松放入背包或汽车杯架。",
      "食品级可拆卸组件，使用后冲洗即可完成清洁。",
    ],
    description:
      "把熟悉的咖啡仪式带到任何地方。BrewGo 将稳定压力、快速加热和便携机身融为一体，让新鲜浓缩咖啡不再受限于厨房。",
  },
};

const currencySymbols: Record<string, string> = {
  us: "$",
  uk: "£",
  de: "€",
  jp: "¥",
  sea: "$",
};

const conversationTitle = "便携咖啡机创作";
const promptIdeasByMode: Record<GenerationMode, string[]> = {
  image: ["一套商品主副图", "A+ 卖点套图", "一张商品白底图"],
  video: ["15 秒商品视频", "一支带货口播视频"],
  listing: ["亚马逊商品链接", "同类商品链接结构"],
};

function OptionMenu({
  label,
  options,
  value,
  open,
  onOpen,
  onDismiss,
  onChange,
  prefix,
  rich = false,
  accent = false,
  testId,
}: {
  label: string;
  options: Option[];
  value: string;
  open: boolean;
  onOpen: () => void;
  onDismiss?: () => void;
  onChange: (value: string) => void;
  prefix?: string;
  rich?: boolean;
  accent?: boolean;
  testId: string;
}) {
  const selected = options.find((option) => option.id === value) ?? options[0];
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !onDismiss) return;

    const dismissOnOutsidePress = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onDismiss();
    };
    const dismissOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };

    document.addEventListener("pointerdown", dismissOnOutsidePress);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnOutsidePress);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [onDismiss, open]);

  return (
    <div
      className={`option-menu ${rich ? "option-menu-rich" : ""} ${accent ? "option-menu-accent" : ""}`}
      ref={menuRef}
    >
      <button
        type="button"
        className="option-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid={testId}
        onClick={onOpen}
      >
        <span>{prefix ? <b className="option-prefix">{prefix}：</b> : null}{selected.label}</span>
        <span className="chevron" aria-hidden="true">
          {open ? <CaretUp weight="bold" /> : <CaretDown weight="bold" />}
        </span>
      </button>
      {open ? (
        <div className="option-popover" role="listbox" aria-label={label}>
          <div className="popover-label">{label}</div>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.id === value}
              className="option-row"
              data-testid={`${testId}-option-${option.id}`}
              key={option.id}
              onClick={() => onChange(option.id)}
            >
              <span className="option-copy">
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
              {option.id === value ? <span className="selected-mark">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type HsvColor = {
  h: number;
  s: number;
  v: number;
};

function normaliseHex(value: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return null;
}

function hexToHsv(value: string): HsvColor {
  const hex = normaliseHex(value) ?? "#111111";
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: max ? delta / max : 0,
    v: max,
  };
}

function hsvToHex({ h, s, v }: HsvColor) {
  const chroma = v * s;
  const segment = h / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const offset = v - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment < 1) [red, green] = [chroma, x];
  else if (segment < 2) [red, green] = [x, chroma];
  else if (segment < 3) [green, blue] = [chroma, x];
  else if (segment < 4) [green, blue] = [x, chroma];
  else if (segment < 5) [red, blue] = [x, chroma];
  else [red, blue] = [chroma, x];

  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function BrandColorPicker({
  value,
  open,
  onOpen,
  onChange,
  onReset,
}: {
  value: string;
  open: boolean;
  onOpen: () => void;
  onChange: (value: string) => void;
  onReset: () => void;
}) {
  const [color, setColor] = useState<HsvColor>(() => hexToHsv(value));
  const [hexDraft, setHexDraft] = useState(() => (value || "#111111").toUpperCase());

  const commitColor = (next: HsvColor) => {
    const hex = hsvToHex(next);
    setColor(next);
    setHexDraft(hex.toUpperCase());
    onChange(hex);
  };

  const chooseSaturationValue = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const saturation = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const brightness = 1 - Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    commitColor({ ...color, s: saturation, v: brightness });
  };

  const startChoosingSaturationValue = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    chooseSaturationValue(event);
  };

  return (
    <div className="brand-color-control">
      <div className={`brand-color-trigger ${value ? "has-color" : "is-auto"}`}>
        <button
          type="button"
          className="brand-color-trigger-main"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-testid="brand-color-picker"
          onClick={onOpen}
        >
          <span
            className={value ? "brand-color-swatch" : "brand-color-swatch brand-color-swatch-auto"}
            style={value ? { backgroundColor: value } : undefined}
            aria-hidden="true"
          />
          <strong>{value ? value.toUpperCase() : "智能品牌色"}</strong>
        </button>
        {value ? (
          <button
            type="button"
            className="brand-color-clear"
            aria-label="清除品牌主色，恢复智能品牌色"
            data-testid="brand-color-clear"
            onClick={() => {
              setColor(hexToHsv("#111111"));
              setHexDraft("#111111");
              onReset();
            }}
          >
            <X aria-hidden="true" weight="bold" />
          </button>
        ) : (
          <button
            type="button"
            className="brand-color-caret"
            aria-label="打开品牌色选择器"
            tabIndex={-1}
            onClick={onOpen}
          >
            {open ? <CaretUp aria-hidden="true" weight="bold" /> : <CaretDown aria-hidden="true" weight="bold" />}
          </button>
        )}
      </div>

      {open ? (
        <div
          className="brand-color-popover"
          role="dialog"
          aria-label="选择品牌主色"
          data-testid="brand-color-popover"
        >
          <div
            className="brand-color-canvas"
            style={{ backgroundColor: `hsl(${color.h} 100% 50%)` }}
            onPointerDown={startChoosingSaturationValue}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                chooseSaturationValue(event);
              }
            }}
          >
            <span
              className="brand-color-handle"
              style={{ left: `${color.s * 100}%`, top: `${(1 - color.v) * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="brand-color-hue-row">
            <input
              className="brand-color-hue"
              type="range"
              min="0"
              max="359"
              value={Math.round(color.h)}
              aria-label="品牌色相"
              onChange={(event) => commitColor({ ...color, h: Number(event.target.value) })}
            />
            <span className="brand-color-preview" style={{ backgroundColor: hsvToHex(color) }} />
          </div>
          <label className="brand-color-hex">
            <span>HEX</span>
            <input
              type="text"
              value={hexDraft}
              aria-label="品牌主色十六进制"
              data-testid="brand-color-text"
              maxLength={7}
              onChange={(event) => {
                const next = event.target.value.toUpperCase();
                setHexDraft(next);
                const hex = normaliseHex(next);
                if (hex) {
                  setColor(hexToHsv(hex));
                  onChange(hex);
                }
              }}
              onBlur={() => setHexDraft((value || "#111111").toUpperCase())}
            />
          </label>
          <div className="brand-color-smart-note">
            <span className="brand-color-swatch brand-color-swatch-auto" aria-hidden="true" />
            <p>
              <strong>智能品牌色</strong>
              <small>清除固定颜色后，将根据商品与品牌素材自动提取。</small>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UploadPreviewModal({
  upload,
  onClose,
}: {
  upload: Upload;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="upload-preview-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`预览 ${upload.name}`}
      data-testid="upload-preview-modal"
      onClick={onClose}
    >
      <button
        type="button"
        className="upload-preview-close"
        aria-label="关闭图片预览"
        onClick={onClose}
      >
        <X aria-hidden="true" weight="bold" />
      </button>
      <figure
        className="upload-preview-content"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={upload.url} alt={upload.name} />
        <figcaption>
          <span>参考图片</span>
          <strong>{upload.name}</strong>
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}

function UploadDeck({
  uploads,
  compact,
  emptyLabel,
  onFiles,
  onRemove,
  onPreview,
}: {
  uploads: Upload[];
  compact?: boolean;
  emptyLabel?: string;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onPreview: (upload: Upload) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const atLimit = uploads.length >= MAX_UPLOADS;

  const openFilePicker = () => {
    if (!atLimit) inputRef.current?.click();
  };

  return (
    <div
      className={`upload-deck ${compact ? "upload-deck-compact" : ""} ${
        uploads.length ? "has-uploads" : "is-empty"
      } ${expanded ? "is-expanded" : ""}`}
      role="group"
      aria-label={`参考图片 ${uploads.length} / ${MAX_UPLOADS}`}
      data-testid="upload-deck"
      onPointerLeave={() => setExpanded(false)}
      style={
        {
          "--deck-spread": "84px",
        } as CSSProperties
      }
    >
      <input
        ref={inputRef}
        className="upload-deck-input"
        type="file"
        accept="image/*"
        multiple
        disabled={atLimit}
        aria-hidden="true"
        tabIndex={-1}
        data-testid="file-input"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <span className="sr-only" aria-live="polite">
        已添加 {uploads.length} 张参考图片，最多 {MAX_UPLOADS} 张
      </span>

      {!uploads.length ? (
        <button
          type="button"
          className="upload-deck-empty"
          aria-label="上传图片"
          onClick={openFilePicker}
        >
          <Plus aria-hidden="true" weight="bold" />
          {emptyLabel ? <span>{emptyLabel}</span> : null}
        </button>
      ) : (
        <>
          <div className="upload-deck-cards">
            {uploads.map((upload, index) => (
              <figure
                className="upload-deck-card"
                key={upload.id}
                onPointerEnter={() => setExpanded(true)}
                style={
                  {
                    "--deck-index": index,
                    "--deck-stack-index": Math.min(index, 3),
                    "--deck-rotation": `${[-5, 2, 7, -2][index % 4]}deg`,
                    zIndex: uploads.length - index + 3,
                  } as CSSProperties
                }
              >
                <button
                  type="button"
                  className="upload-deck-preview"
                  aria-label={`预览 ${upload.name}`}
                  title={upload.name}
                  onClick={() => onPreview(upload)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={upload.url}
                    alt={index === 0 ? `商品主体：${upload.name}` : `参考图：${upload.name}`}
                  />
                </button>
                <button
                  type="button"
                  className="upload-deck-remove"
                  aria-label={`移除 ${upload.name}`}
                  onClick={() => onRemove(upload.id)}
                >
                  <X aria-hidden="true" weight="bold" />
                </button>
              </figure>
            ))}
          </div>

          {!atLimit ? (
            <button
              type="button"
              className={`upload-deck-add ${
                uploads.length === 1 ? "upload-deck-add-circle" : "upload-deck-add-card"
              }`}
              style={
                {
                  "--deck-index": uploads.length,
                  "--deck-stack-index": Math.min(uploads.length, 3),
                } as CSSProperties
              }
              aria-label={`继续上传图片，当前 ${uploads.length} 张`}
              onClick={openFilePicker}
            >
              <Plus aria-hidden="true" weight="bold" />
            </button>
          ) : null}

          {uploads.length > 3 ? (
            <span className="upload-deck-count" aria-hidden="true">
              +{uploads.length - 3}
            </span>
          ) : null}

          <span className="upload-deck-name" aria-hidden="true">
            {uploads.length === 1 ? uploads[0].name : `${uploads.length} 张参考图片`}
          </span>
        </>
      )}
    </div>
  );
}

function ReferenceVideoInput({
  upload,
  compact,
  onFile,
  onRemove,
}: {
  upload: Upload | null;
  compact?: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`reference-video-input ${compact ? "is-compact" : ""} ${
        upload ? "has-video" : "is-empty"
      }`}
      data-testid="reference-video-input"
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="upload-deck-input"
        aria-hidden="true"
        tabIndex={-1}
        data-testid="reference-video-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="reference-video-card"
        aria-label={upload ? "更换参考视频" : "上传参考视频"}
        onClick={() => inputRef.current?.click()}
      >
        {upload ? (
          <>
            <video src={upload.url} muted playsInline preload="metadata" aria-hidden="true" />
            <span className="reference-video-play" aria-hidden="true">
              <Play weight="fill" />
            </span>
          </>
        ) : (
          <>
            <Plus aria-hidden="true" weight="bold" />
            <span>参考视频</span>
          </>
        )}
      </button>
      {upload ? (
        <>
          <button
            type="button"
            className="reference-video-remove"
            aria-label={`移除参考视频 ${upload.name}`}
            onClick={onRemove}
          >
            <X aria-hidden="true" weight="bold" />
          </button>
          <span className="reference-video-name">{upload.name}</span>
        </>
      ) : null}
    </div>
  );
}

function VideoReplicaMaterials({
  referenceVideo,
  uploads,
  compact,
  onReferenceVideo,
  onRemoveReferenceVideo,
  onFiles,
  onRemove,
  onPreview,
}: {
  referenceVideo: Upload | null;
  uploads: Upload[];
  compact?: boolean;
  onReferenceVideo: (file: File) => void;
  onRemoveReferenceVideo: () => void;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onPreview: (upload: Upload) => void;
}) {
  return (
    <div
      className={`video-replica-materials ${compact ? "is-compact" : ""}`}
      data-testid="video-replica-materials"
      aria-label="视频复刻素材：参考视频加商品图片"
    >
      <ReferenceVideoInput
        upload={referenceVideo}
        compact={compact}
        onFile={onReferenceVideo}
        onRemove={onRemoveReferenceVideo}
      />
      <span className="video-replica-plus" aria-hidden="true">
        <Plus weight="bold" />
      </span>
      <div className="video-product-material">
        <UploadDeck
          uploads={uploads}
          compact={compact}
          emptyLabel="商品"
          onFiles={onFiles}
          onRemove={onRemove}
          onPreview={onPreview}
        />
      </div>
    </div>
  );
}

function Composer({
  compact = false,
  minimized = false,
  prompt,
  uploads,
  referenceVideo,
  mode,
  skill,
  region,
  language,
  brand,
  suite,
  disabled,
  onPrompt,
  onFiles,
  onReferenceVideo,
  onRemoveReferenceVideo,
  onRemove,
  onSend,
  onMode,
  onSkill,
  onRegion,
  onLanguage,
  onBrand,
  onSuite,
  onExpand,
}: {
  compact?: boolean;
  minimized?: boolean;
  prompt: string;
  uploads: Upload[];
  referenceVideo: Upload | null;
  mode: GenerationMode;
  skill: string;
  region: string;
  language: string;
  brand: BrandSettings;
  suite: SuiteSettings;
  disabled: boolean;
  onPrompt: (value: string) => void;
  onFiles: (files: File[]) => void;
  onReferenceVideo: (file: File) => void;
  onRemoveReferenceVideo: () => void;
  onRemove: (id: string) => void;
  onSend: () => void;
  onMode: (value: GenerationMode) => void;
  onSkill: (value: string) => void;
  onRegion: (value: string) => void;
  onLanguage: (value: string) => void;
  onBrand: (value: BrandSettings) => void;
  onSuite: (value: SuiteSettings) => void;
  onExpand?: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openBrandMenu, setOpenBrandMenu] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<Upload | null>(null);
  const [promptIdea, setPromptIdea] = useState(0);
  const [promptIdeaText, setPromptIdeaText] = useState(promptIdeasByMode[mode][0]);
  const [deletingPromptIdea, setDeletingPromptIdea] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const brandGeneTriggerRef = useRef<HTMLDivElement>(null);
  const brandGenePanelRef = useRef<HTMLElement>(null);
  const dragDepthRef = useRef(0);
  const modeSkills = skillsByMode(mode);
  const suiteSelectionEmpty =
    hasSuiteSettings(skill) &&
    suite.aPlusCount === 0 &&
    suite.mainImageCount === 0;
  const isLinkReplica = skill === "listing-replica";
  const sendDisabled = disabled || suiteSelectionEmpty || (isLinkReplica && !isHttpUrl(prompt));
  const isVideoReplica = skill === "video-replica";

  useEffect(() => {
    if (openMenu !== "brand-gene") return;

    const dismissBrandGene = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        brandGeneTriggerRef.current?.contains(target) ||
        brandGenePanelRef.current?.contains(target)
      ) return;
      setOpenMenu(null);
      setOpenBrandMenu(null);
    };
    const dismissBrandGeneOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setOpenBrandMenu(null);
      }
    };

    document.addEventListener("pointerdown", dismissBrandGene);
    document.addEventListener("keydown", dismissBrandGeneOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissBrandGene);
      document.removeEventListener("keydown", dismissBrandGeneOnEscape);
    };
  }, [openMenu]);

  useEffect(() => {
    if (compact || prompt) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const promptIdeas = promptIdeasByMode[mode];
    const fullIdea = promptIdeas[promptIdea];
    const delay = deletingPromptIdea
      ? promptIdeaText.length
        ? 48
        : 260
      : promptIdeaText === fullIdea
        ? 1200
        : 82;
    const timer = window.setTimeout(() => {
      if (deletingPromptIdea) {
        if (promptIdeaText.length) {
          setPromptIdeaText((current) => current.slice(0, -1));
        } else {
          setDeletingPromptIdea(false);
          setPromptIdea((current) => (current + 1) % promptIdeas.length);
        }
      } else if (promptIdeaText === fullIdea) {
        setDeletingPromptIdea(true);
      } else {
        setPromptIdeaText(fullIdea.slice(0, promptIdeaText.length + 1));
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [compact, deletingPromptIdea, mode, prompt, promptIdea, promptIdeaText]);

  const submitOnShortcut = (
    event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !sendDisabled) {
      event.preventDefault();
      onSend();
    }
  };

  const isFileDrag = (event: DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const beginFileDrag = (event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDraggingFiles(true);
  };

  const continueFileDrag = (event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect =
      uploads.length >= MAX_UPLOADS && (!isVideoReplica || referenceVideo)
        ? "none"
        : "copy";
    if (!draggingFiles) setDraggingFiles(true);
  };

  const endFileDrag = (event: DragEvent<HTMLElement>) => {
    if (!draggingFiles) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (!dragDepthRef.current) setDraggingFiles(false);
  };

  const dropFiles = (event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setDraggingFiles(false);
    const files = Array.from(event.dataTransfer.files);
    if (isVideoReplica) {
      const reference = files.find((file) => file.type.startsWith("video/"));
      const images = files.filter((file) => file.type.startsWith("image/"));
      if (reference) onReferenceVideo(reference);
      if (images.length) onFiles(images);
      return;
    }
    onFiles(files);
  };

  const uploadDeck = (
    <UploadDeck
      uploads={uploads}
      compact={compact || minimized}
      onFiles={onFiles}
      onRemove={(id) => {
        if (uploadPreview?.id === id) setUploadPreview(null);
        onRemove(id);
      }}
      onPreview={setUploadPreview}
    />
  );
  const materialInput = isVideoReplica ? (
    <VideoReplicaMaterials
      referenceVideo={referenceVideo}
      uploads={uploads}
      compact={compact || minimized}
      onReferenceVideo={onReferenceVideo}
      onRemoveReferenceVideo={onRemoveReferenceVideo}
      onFiles={onFiles}
      onRemove={(id) => {
        if (uploadPreview?.id === id) setUploadPreview(null);
        onRemove(id);
      }}
      onPreview={setUploadPreview}
    />
  ) : uploadDeck;

  if (minimized) {
    return (
      <>
        <section
          className="composer composer-compact composer-minimized"
          data-testid="minimized-composer"
          onDragEnter={beginFileDrag}
          onDragOver={continueFileDrag}
          onDragLeave={endFileDrag}
          onDrop={dropFiles}
        >
          {materialInput}
          {isLinkReplica ? (
            <label className="link-replica-field is-minimized">
              <LinkSimple weight="bold" aria-hidden="true" />
              <input
                id="conversation-prompt"
                data-testid="conversation-input-minimized"
                type="url"
                inputMode="url"
                value={prompt}
                aria-label="复刻对象链接"
                placeholder="粘贴要复刻的商品链接"
                onFocus={onExpand}
                onClick={onExpand}
                onChange={(event) => onPrompt(event.target.value)}
                onKeyDown={submitOnShortcut}
              />
            </label>
          ) : (
            <textarea
              id="conversation-prompt"
              data-testid="conversation-input-minimized"
              value={prompt}
              rows={1}
              aria-label="继续发送新任务"
              placeholder="继续描述你想生成或修改的内容"
              onFocus={onExpand}
              onClick={onExpand}
              onChange={(event) => onPrompt(event.target.value)}
              onKeyDown={submitOnShortcut}
            />
          )}
          <button
            type="button"
            className="send-button"
            aria-label="发送新任务"
            data-testid="conversation-send-minimized"
            disabled={sendDisabled}
            title={
              suiteSelectionEmpty
                ? "请至少选择 1 张主副图或 A+ 图"
                : isLinkReplica && !isHttpUrl(prompt)
                  ? "请先输入有效的商品链接"
                  : undefined
            }
            onClick={onSend}
          >
            <ArrowUp aria-hidden="true" weight="bold" />
          </button>
        </section>
        {uploadPreview ? (
          <UploadPreviewModal upload={uploadPreview} onClose={() => setUploadPreview(null)} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <section
        className={`composer ${compact ? "composer-compact" : ""} ${draggingFiles ? "composer-dragging" : ""}`}
        data-testid={compact ? "compact-composer-drop-zone" : "composer-drop-zone"}
        onDragEnter={beginFileDrag}
        onDragOver={continueFileDrag}
        onDragLeave={endFileDrag}
        onDrop={dropFiles}
      >
        {draggingFiles ? (
          <div className="composer-drop-hint" role="status" aria-live="polite">
            <span className="composer-drop-icon" aria-hidden="true">
              <Images weight="regular" />
            </span>
            <strong>
              {isVideoReplica
                ? "松开即可添加参考视频或商品图片"
                : uploads.length >= MAX_UPLOADS
                  ? "已达到 9 张上限"
                  : "松开即可上传图片"}
            </strong>
            <small>
              {isVideoReplica
                ? "视频限 1 个，商品图片最多 9 张"
                : uploads.length >= MAX_UPLOADS
                ? "移除一张图片后可以继续添加"
                : `还可以添加 ${MAX_UPLOADS - uploads.length} 张图片`}
            </small>
          </div>
        ) : null}
        <div className="composer-body">
          <div className={`composer-input-row ${isVideoReplica ? "is-video-replica" : ""}`}>
            {materialInput}
            <div className="composer-prompt-column">
              <label className="prompt-label" htmlFor={compact ? "conversation-prompt" : "main-prompt"}>
                {isLinkReplica ? "复刻对象链接" : compact ? "继续发送新任务" : "描述你希望生成的内容"}
              </label>
              {isLinkReplica ? (
                <div className={`link-replica-field ${prompt && !isHttpUrl(prompt) ? "is-invalid" : ""}`}>
                  <LinkSimple weight="bold" aria-hidden="true" />
                  <input
                    id={compact ? "conversation-prompt" : "main-prompt"}
                    data-testid={compact ? "conversation-input" : "prompt-input"}
                    type="url"
                    inputMode="url"
                    value={prompt}
                    placeholder="https://www.amazon.com/dp/..."
                    onChange={(event) => onPrompt(event.target.value)}
                    onKeyDown={submitOnShortcut}
                    aria-describedby="link-replica-help"
                  />
                </div>
              ) : (
                <textarea
                  id={compact ? "conversation-prompt" : "main-prompt"}
                  data-testid={compact ? "conversation-input" : "prompt-input"}
                  value={prompt}
                  rows={compact ? 2 : 4}
                  placeholder={
                    compact
                      ? "例如：再生成一套商品图，突出便携和自加热"
                      : `让 Mercato 帮我生成${promptIdeaText}`
                  }
                  onChange={(event) => onPrompt(event.target.value)}
                  onKeyDown={submitOnShortcut}
                />
              )}
              {isLinkReplica ? (
                <small id="link-replica-help" className={prompt && !isHttpUrl(prompt) ? "link-replica-error" : "link-replica-help"}>
                  {prompt && !isHttpUrl(prompt)
                    ? "请输入以 http:// 或 https:// 开头的有效链接"
                    : "粘贴 Amazon 或其他商品详情页链接，Mercato 会参考它的结构与内容。"}
                </small>
              ) : null}
            </div>
          </div>
        </div>

        <div className="composer-toolbar">
          <div className="settings-cluster">
          <OptionMenu
            label="选择生成模式"
            options={modes}
            value={mode}
            open={openMenu === "mode"}
            onOpen={() => setOpenMenu(openMenu === "mode" ? null : "mode")}
            onDismiss={() => setOpenMenu(null)}
            onChange={(value) => {
              onMode(value as GenerationMode);
              setOpenMenu(null);
            }}
            accent
            testId="mode-trigger"
          />
          <div className="brand-gene-control" ref={brandGeneTriggerRef}>
            <button
              type="button"
              className="option-trigger brand-gene-trigger"
              aria-expanded={openMenu === "brand-gene"}
              aria-controls={compact ? "compact-brand-gene-panel" : "brand-gene-panel"}
              data-testid="brand-gene-trigger"
              onClick={() => {
                setOpenBrandMenu(null);
                setOpenMenu(openMenu === "brand-gene" ? null : "brand-gene");
              }}
            >
              <span>品牌基因</span>
              <span className="chevron" aria-hidden="true">
                {openMenu === "brand-gene"
                  ? <CaretUp weight="bold" />
                  : <CaretDown weight="bold" />}
              </span>
            </button>
          </div>
          <OptionMenu
            label={`${modes.find((item) => item.id === mode)?.label ?? "生成"} Skill`}
            options={modeSkills}
            value={skill}
            open={openMenu === "skill"}
            onOpen={() => setOpenMenu(openMenu === "skill" ? null : "skill")}
            onDismiss={() => setOpenMenu(null)}
            onChange={(value) => {
              onSkill(value);
              setOpenMenu(null);
            }}
            prefix="技能"
            rich
            testId="skill-trigger"
          />
          {hasSuiteSettings(skill) ? (
            <>
              <OptionMenu
                label="A+ 类型"
                options={aPlusTypes}
                value={suite.aPlusType}
                open={openMenu === "a-plus-type"}
                onOpen={() => setOpenMenu(openMenu === "a-plus-type" ? null : "a-plus-type")}
                onDismiss={() => setOpenMenu(null)}
                onChange={(value) => {
                  onSuite({ ...suite, aPlusType: value });
                  setOpenMenu(null);
                }}
                prefix="A+ 类型"
                testId="a-plus-type-trigger"
              />
              <OptionMenu
                label="A+ 图数量"
                options={aPlusCounts}
                value={String(suite.aPlusCount)}
                open={openMenu === "a-plus-count"}
                onOpen={() => setOpenMenu(openMenu === "a-plus-count" ? null : "a-plus-count")}
                onDismiss={() => setOpenMenu(null)}
                onChange={(value) => {
                  onSuite({ ...suite, aPlusCount: Number(value) });
                  setOpenMenu(null);
                }}
                prefix="A+ 图"
                testId="a-plus-count-trigger"
              />
              <OptionMenu
                label="主副图比例"
                options={mainImageRatios}
                value={suite.mainImageRatio}
                open={openMenu === "main-image-ratio"}
                onOpen={() => setOpenMenu(
                  openMenu === "main-image-ratio" ? null : "main-image-ratio",
                )}
                onDismiss={() => setOpenMenu(null)}
                onChange={(value) => {
                  onSuite({ ...suite, mainImageRatio: value as "1:1" | "3:4" });
                  setOpenMenu(null);
                }}
                prefix="主副图比例"
                testId="main-image-ratio-trigger"
              />
              <OptionMenu
                label="主副图数量"
                options={mainImageCounts}
                value={String(suite.mainImageCount)}
                open={openMenu === "main-image-count"}
                onOpen={() => setOpenMenu(openMenu === "main-image-count" ? null : "main-image-count")}
                onDismiss={() => setOpenMenu(null)}
                onChange={(value) => {
                  onSuite({ ...suite, mainImageCount: Number(value) });
                  setOpenMenu(null);
                }}
                prefix="主副图"
                testId="main-image-count-trigger"
              />
            </>
          ) : null}
        </div>

        <div className="composer-actions">
          <button
            type="button"
            className="send-button"
            aria-label={compact ? "发送新任务" : "开始生成"}
            data-testid={compact ? "conversation-send" : "send"}
            disabled={sendDisabled}
            title={
              suiteSelectionEmpty
                ? "请至少选择 1 张主副图或 A+ 图"
                : isLinkReplica && !isHttpUrl(prompt)
                  ? "请先输入有效的商品链接"
                  : undefined
            }
            onClick={onSend}
          >
            <ArrowUp aria-hidden="true" weight="bold" />
          </button>
        </div>
      </div>

        {openMenu === "brand-gene" ? (
        <section
          className="brand-gene-panel"
          id={compact ? "compact-brand-gene-panel" : "brand-gene-panel"}
          data-testid="brand-gene-panel"
          aria-label="品牌基因设置"
          ref={brandGenePanelRef}
        >
          <div className="brand-field color-field">
            <span>品牌主色</span>
            <BrandColorPicker
              value={brand.primaryColor}
              open={openBrandMenu === "brand-color"}
              onOpen={() => setOpenBrandMenu(
                openBrandMenu === "brand-color" ? null : "brand-color",
              )}
              onChange={(value) => onBrand({ ...brand, primaryColor: value })}
              onReset={() => {
                onBrand({ ...brand, primaryColor: "" });
                setOpenBrandMenu(null);
              }}
            />
          </div>
          <div className="brand-field">
            <span>字体风格</span>
            <OptionMenu
              label="字体风格"
              options={fontStyles}
              value={brand.fontStyle}
              open={openBrandMenu === "font-style"}
              onOpen={() => setOpenBrandMenu(
                openBrandMenu === "font-style" ? null : "font-style",
              )}
              onDismiss={() => setOpenBrandMenu(null)}
              onChange={(value) => {
                onBrand({ ...brand, fontStyle: value });
                setOpenBrandMenu(null);
              }}
              testId="font-style-select"
            />
          </div>
          <div className="brand-field">
            <span>销售国家/地区</span>
            <OptionMenu
              label="销售国家/地区"
              options={regions}
              value={region}
              open={openBrandMenu === "region"}
              onOpen={() => setOpenBrandMenu(openBrandMenu === "region" ? null : "region")}
              onDismiss={() => setOpenBrandMenu(null)}
              onChange={(value) => {
                onRegion(value);
                setOpenBrandMenu(null);
              }}
              testId="region-trigger"
            />
          </div>
          <div className="brand-field">
            <span>生成内容语言</span>
            <OptionMenu
              label="生成内容语言"
              options={languages}
              value={language}
              open={openBrandMenu === "language"}
              onOpen={() => setOpenBrandMenu(
                openBrandMenu === "language" ? null : "language",
              )}
              onDismiss={() => setOpenBrandMenu(null)}
              onChange={(value) => {
                onLanguage(value);
                setOpenBrandMenu(null);
              }}
              testId="language-trigger"
            />
          </div>
          <div className="brand-field">
            <span>发布平台</span>
            <OptionMenu
              label="发布平台"
              options={platforms}
              value={brand.platform}
              open={openBrandMenu === "platform"}
              onOpen={() => setOpenBrandMenu(
                openBrandMenu === "platform" ? null : "platform",
              )}
              onDismiss={() => setOpenBrandMenu(null)}
              onChange={(value) => {
                onBrand({ ...brand, platform: value });
                setOpenBrandMenu(null);
              }}
              testId="platform-select"
            />
          </div>
          <p className="brand-gene-summary">
            {platforms.find((item) => item.id === brand.platform)?.label} ·{" "}
            {regions.find((item) => item.id === region)?.label} ·{" "}
            {languages.find((item) => item.id === language)?.label}
          </p>
        </section>
        ) : null}
      </section>
      {uploadPreview ? (
        <UploadPreviewModal upload={uploadPreview} onClose={() => setUploadPreview(null)} />
      ) : null}
    </>
  );
}

function ListingResult({
  turnId,
  productImage,
  language,
  region,
  data,
  generatedImages = [],
  suite,
  ready,
  onNotice,
  onListingChange,
}: {
  turnId: string;
  productImage: string;
  language: string;
  region: string;
  data?: ListingData;
  generatedImages?: string[];
  suite: SuiteSettings;
  ready: boolean;
  onNotice: (text: string) => void;
  onListingChange: (listing: ListingData) => void;
}) {
  const copy = listingCopy[language as keyof typeof listingCopy] ?? listingCopy.en;
  const currencySymbol = currencySymbols[region] ?? "$";
  const [galleryImage, setGalleryImage] = useState("");
  const [title, setTitle] = useState(
    plainListingText(data?.title, "商品标题待生成"),
  );
  const [salePrice, setSalePrice] = useState(data?.salePrice?.trim() || "");
  const [listPrice, setListPrice] = useState(data?.listPrice?.trim() || "");
  const [bullets, setBullets] = useState(
    data?.bullets?.length ? data.bullets : ["", "", "", "", ""],
  );
  const [description, setDescription] = useState(
    plainListingText(data?.description, ""),
  );
  const [aPlusHeadline, setAPlusHeadline] = useState(
    plainListingText(data?.aPlusHeadline, ""),
  );
  const [specs, setSpecs] = useState(
    Object.entries(data?.specifications ?? {
      Brand: data?.brand ?? "Generic",
      "Product type": "To be confirmed",
      "Recommended use": "To be confirmed",
    }).filter(([, value]) => !/^not confirmed$/i.test(value.trim())),
  );
  const brand = data?.brand ?? "Generic";
  const category = data?.category ?? "Marketplace › Generated product";
  const color = specs.find(([label]) => label.toLowerCase() === "color")?.[1];
  const featureStats = specs.slice(0, 3);
  const generatedMainImages = generatedImages
    .slice(0, suite.mainImageCount)
    .filter(Boolean);
  const generatedAPlusImages = generatedImages
    .slice(suite.mainImageCount, suite.mainImageCount + suite.aPlusCount)
    .filter(Boolean);
  const generatedMobileAPlusImages = generatedImages
    .slice(suite.mainImageCount + suite.aPlusCount)
    .filter(Boolean);
  const listingImages = generatedMainImages.length
    ? generatedMainImages
    : [productImage];
  const shownGalleryImage = galleryImage || listingImages[0];
  const productSlug = data?.productUrlSlug ?? "MERCATO-GENERATED";
  const numericSalePrice = Number.parseFloat(salePrice.replaceAll(",", ""));
  const numericListPrice = Number.parseFloat(listPrice.replaceAll(",", ""));
  const discount =
    Number.isFinite(numericSalePrice) &&
    Number.isFinite(numericListPrice) &&
    numericListPrice > numericSalePrice
      ? Math.round((1 - numericSalePrice / numericListPrice) * 100)
      : null;

  if (!ready) {
    return (
      <div className="listing-shell listing-loading" data-testid="listing-result">
        <div className="listing-loader-head" />
        <div className="listing-loader-grid">
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  }

  const copyLink = async () => {
    await navigator.clipboard?.writeText(
      `https://marketplace.example/dp/${productSlug}`,
    );
    onNotice("商品链接已复制");
  };

  const listingDraft = (
    changes: Partial<ListingData> = {},
  ): ListingData => ({
    ...data,
    title,
    salePrice,
    listPrice,
    bullets,
    description,
    aPlusHeadline,
    specifications: Object.fromEntries(specs),
    ...changes,
  });

  const updateBullet = (index: number, value: string) => {
    setBullets((current) => {
      const next = current.map(
        (bullet, bulletIndex) => bulletIndex === index ? value : bullet,
      );
      onListingChange(listingDraft({ bullets: next }));
      return next;
    });
  };

  const updateSpec = (index: number, value: string) => {
    setSpecs((current) => {
      const next = current.map(
        (spec, specIndex) => specIndex === index ? [spec[0], value] : spec,
      );
      onListingChange(
        listingDraft({ specifications: Object.fromEntries(next) }),
      );
      return next;
    });
  };

  const listingJson = JSON.stringify({
    schemaVersion: 1,
    marketplace: regions.find((item) => item.id === region)?.label,
    language: languages.find((item) => item.id === language)?.label,
    productUrl: `https://marketplace.example/dp/${productSlug}`,
    title,
    pricing: {
      type: salePrice || listPrice ? "merchant supplied" : "not confirmed",
      currency: currencySymbol,
      salePrice,
      listPrice,
    },
    bullets,
    description,
    aPlus: {
      headline: aPlusHeadline,
      featureStats,
      images: generatedAPlusImages,
      mobileImages: generatedMobileAPlusImages,
    },
    specifications: Object.fromEntries(specs),
    images: listingImages,
    generatedBy: "Mercato AI",
  }, null, 2);
  const downloadHref = `data:application/json;charset=utf-8,${encodeURIComponent(listingJson)}`;

  return (
    <article className="listing-shell" data-testid="listing-result">
      <div className="market-nav">
        <strong className="market-logo">market</strong>
        <span className="market-deliver">配送至 · {regions.find((item) => item.id === region)?.label}</span>
        <div className="market-search">
          <span>全部</span>
          <b>Search Marketplace</b>
          <button type="button" aria-label="搜索">
            ⌕
          </button>
        </div>
        <span className="market-account">您好，Mercato<br /><b>账户与列表</b></span>
        <span className="market-cart">购物车 0</span>
      </div>
      <div className="market-subnav">
        <span>全部</span><span>今日特价</span><span>家居与厨房</span><span>户外用品</span><span>新品</span>
      </div>

      <div className="listing-toolbar">
        <div>
          <span className="live-dot" />
          已生成 Listing
          <span className="listing-url">marketplace.example/dp/{productSlug}</span>
        </div>
        <span className="listing-edit-hint">虚线区域可直接编辑</span>
        <div className="listing-actions">
          <button
            type="button"
            onClick={copyLink}
            data-testid="copy-listing-link"
            data-analytics-event="listing_link_copied"
            data-turn-id={turnId}
          >
            复制链接
          </button>
          <a
            href={downloadHref}
            download={`brewgo-listing-${region}-${language}.json`}
            onClick={() => onNotice("Listing JSON 已下载")}
            data-testid="download-listing"
            data-analytics-event="listing_json_downloaded"
            data-turn-id={turnId}
          >
            下载 JSON
          </a>
        </div>
      </div>

      <div className="market-breadcrumb">
        {category}
      </div>

      <div className="market-product">
        <div className="market-gallery">
          <div className="thumbnail-rail" aria-label="商品图片">
            {listingImages.map(
              (image, index) => (
                <button
                  type="button"
                  className={shownGalleryImage === image ? "selected" : ""}
                  onClick={() => setGalleryImage(image)}
                  aria-label={`查看商品图 ${index + 1}`}
                  key={`${image}-${index}`}
                  data-testid={`listing-thumb-${index}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="" />
                </button>
              ),
            )}
          </div>
          <div className="market-main-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shownGalleryImage} alt={title} />
            <span>移动鼠标放大图片</span>
          </div>
        </div>

        <section className="market-info">
          <textarea
            className="editable-field listing-title-input"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              onListingChange(listingDraft({ title: event.target.value }));
            }}
            aria-label="编辑商品标题"
            data-testid="listing-title-input"
            rows={4}
          />
          <a href="#brand">Visit the {brand} Store</a>
          <div className="rating-row">
            <b>AI-generated draft</b>
            <span>Review all claims before publishing</span>
          </div>
          <div className="badge-row">
            <b>Listing preview</b>
            <span>AI 草稿 · 发布前请核对商品事实与交易信息</span>
          </div>
          <hr />
          <div className="price-line">
            {discount ? <span className="discount">-{discount}%</span> : null}
            <span className="price">
              <sup>{currencySymbol}</sup>
              <input
                className="editable-field price-input"
                value={salePrice}
                placeholder="待确认"
                onChange={(event) => {
                  setSalePrice(event.target.value);
                  onListingChange(listingDraft({ salePrice: event.target.value }));
                }}
                aria-label="编辑销售价格"
                data-testid="listing-price-input"
              />
            </span>
          </div>
          <label className="list-price">
            List Price: {currencySymbol}
            <input
              className="editable-field list-price-input"
              value={listPrice}
              placeholder="待确认"
              onChange={(event) => {
                setListPrice(event.target.value);
                onListingChange(listingDraft({ listPrice: event.target.value }));
              }}
              aria-label="编辑原价"
            />
          </label>
          <p className="tax-note">价格、优惠、税费与物流信息待发布前确认</p>
          {color ? (
            <>
              <div className="variation-row"><b>Color:</b> {color}</div>
              <div className="color-swatch">
                <button type="button" aria-label={color}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={listingImages[0]} alt="" />
                </button>
              </div>
            </>
          ) : null}
          <h3>{copy.about}</h3>
          <ul>
            {bullets.map((bullet, index) => (
              <li key={index}>
                <textarea
                  className="editable-field bullet-input"
                  value={bullet}
                  onChange={(event) => updateBullet(index, event.target.value)}
                  aria-label={`编辑卖点 ${index + 1}`}
                  data-testid={`listing-bullet-${index}`}
                  rows={2}
                />
              </li>
            ))}
          </ul>
        </section>

        <aside className="buy-box">
          <div className="buy-price">
            {salePrice ? (
              <><sup>{currencySymbol}</sup>{salePrice}</>
            ) : (
              <span className="price-pending">价格待确认</span>
            )}
          </div>
          <p><a href="#delivery">Delivery options</a> configured after publishing</p>
          <p>Taxes, returns and fulfillment are not connected in this preview.</p>
          <strong className="stock">Inventory not connected</strong>
          <label>
            Quantity:
            <select defaultValue="1" aria-label="Quantity">
              <option>1</option><option>2</option><option>3</option>
            </select>
          </label>
          <button type="button" className="add-cart" onClick={() => onNotice("已加入演示购物车")}>
            Add to Cart
          </button>
          <button type="button" className="buy-now" onClick={() => onNotice("这是演示页面，未发起购买")}>
            Buy Now
          </button>
          <dl>
            <dt>Ships from</dt><dd>Marketplace</dd>
            <dt>Sold by</dt><dd>{brand}</dd>
            <dt>Returns</dt><dd>Configure in Seller Central</dd>
            <dt>Payment</dt><dd>Secure transaction</dd>
          </dl>
          <button type="button" className="add-list" onClick={() => onNotice("已加入演示心愿单")}>
            Add to List
          </button>
        </aside>
      </div>

      <section className="product-details">
        <h2>Product information</h2>
        <div className="details-grid">
          <table>
            <tbody>
              {specs.slice(0, 4).map(([label, value], index) => (
                <tr key={label}>
                  <th>{label}</th>
                  <td>
                    <input
                      className="editable-field spec-input"
                      value={value}
                      onChange={(event) => updateSpec(index, event.target.value)}
                      aria-label={`编辑规格 ${label}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <tbody>
              {specs.slice(4).map(([label, value], index) => (
                <tr key={label}>
                  <th>{label}</th>
                  <td>
                    <input
                      className="editable-field spec-input"
                      value={value}
                      onChange={(event) => updateSpec(index + 4, event.target.value)}
                      aria-label={`编辑规格 ${label}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="a-plus">
        <p className="a-plus-label">From the brand</p>
        <div className="a-plus-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={generatedAPlusImages[0] ?? productImage}
            alt={`${brand} 品牌场景`}
          />
          <div>
            <span>{brand.toUpperCase()}</span>
            <textarea
              className="editable-field a-plus-title-input"
              value={aPlusHeadline}
              onChange={(event) => {
                setAPlusHeadline(event.target.value);
                onListingChange(
                  listingDraft({ aPlusHeadline: event.target.value }),
                );
              }}
              aria-label="编辑 A+ 标题"
              rows={2}
            />
            <textarea
              className="editable-field description-input"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                onListingChange(
                  listingDraft({ description: event.target.value }),
                );
              }}
              aria-label="编辑商品描述"
              data-testid="listing-description-input"
              rows={5}
            />
          </div>
        </div>
        {featureStats.length ? (
          <div className="a-plus-features">
            {featureStats.map(([label, value]) => (
              <div key={label}><b>{label}</b><span>{value}</span></div>
            ))}
          </div>
        ) : null}
        {generatedAPlusImages.length > 1 ? (
          <div className="listing-a-plus-gallery" aria-label="生成的 A+ 图片">
            {generatedAPlusImages.slice(1).map((image, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={`A+ 图片 ${index + 2}`} key={`${image}-${index}`} />
            ))}
          </div>
        ) : null}
        {generatedMobileAPlusImages.length ? (
          <div className="listing-mobile-a-plus" aria-label="生成的手机 A+ 图片">
            {generatedMobileAPlusImages.map((image, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={`手机 A+ 图片 ${index + 1}`} key={`${image}-${index}`} />
            ))}
          </div>
        ) : null}
      </section>
    </article>
  );
}

function ImageSuite({
  turnId,
  skillId,
  taskCount,
  suite,
  generatedImages = [],
  failedSlots = [],
  onPreview,
  onRegenerate,
  regenerating,
}: {
  turnId: string;
  skillId: string;
  taskCount: number;
  suite?: SuiteSettings;
  generatedImages?: string[];
  failedSlots?: number[];
  onPreview: (item: GalleryItem, slot: number) => void;
  onRegenerate: (item: GalleryItem) => void;
  regenerating: string | null;
}) {
  const isSeeding = skillId === "china-seeding-image";
  const items = suiteItems(skillId, taskCount, suite).map((item, index) => ({
    ...item,
    image: generatedImages[index] ?? item.image,
  }));
  const title = skills.find((item) => item.id === skillId)?.label ?? "商品套图";

  return (
    <section className={`image-suite ${isSeeding ? "seeding-suite" : ""}`} data-testid="image-result">
      <header className="result-section-head">
        <div>
          <span>{isSeeding ? "SEEDING COLLECTION" : "IMAGE COLLECTION"}</span>
          <h2>{title}</h2>
        </div>
        <p>{taskCount} 张图片</p>
      </header>
      <div className="asset-grid" aria-live="polite">
        {items.map((item, index) => {
          const ready = Boolean(generatedImages[index]) && regenerating !== item.id;
          return (
            <article
              className={`asset-card ${item.wide ? "asset-wide" : ""} ${
                item.portrait ? "asset-portrait" : ""
              }`}
              key={item.id}
              data-testid={`image-card-${index}`}
            >
              {ready ? (
                <>
                  <button
                    type="button"
                    className="asset-visual"
                    onClick={() => onPreview(item, index)}
                    aria-label={`预览 ${item.title}`}
                    data-testid={`preview-image-${index}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image} alt={item.title} className={item.crop ?? ""} />
                  </button>
                  <footer>
                    <div><span>{item.group}</span><strong>{item.title}</strong></div>
                    <div>
                      <a
                        href={assetDownloadUrl(item.image)}
                        download
                        data-analytics-event="asset_downloaded"
                        data-turn-id={turnId}
                      >
                        下载
                      </a>
                      <button type="button" onClick={() => onRegenerate(item)}>重做</button>
                    </div>
                  </footer>
                </>
              ) : (
                <div className={`asset-skeleton ${failedSlots.includes(index) ? "asset-failed" : ""}`}>
                  <span>
                    {regenerating === item.id
                      ? "正在重做"
                      : failedSlots.includes(index)
                        ? "本张生成失败"
                        : `第 ${index + 1} 张 · 正在生成`}
                  </span>
                  {failedSlots.includes(index) ? (
                    <button type="button" onClick={() => onRegenerate(item)}>重试本张</button>
                  ) : null}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

const singleImageOutputs: Record<string, GalleryItem> = {
  "amazon-scene-image": {
    id: "amazon-scene-output",
    group: "Amazon 场景图 · 1:1",
    title: "清晨露营咖啡时刻",
    image: "/product-outdoor.png",
  },
  "china-ecommerce-main-image": {
    id: "china-main-output",
    group: "国内电商主图 · 1:1",
    title: "随时随地，一键现萃",
    image: "/product-lifestyle.png",
  },
  "white-background-image": {
    id: "white-background-output",
    group: "平台白底图 · 1:1",
    title: "纯白背景商品精修",
    image: "/product-main.png",
  },
};

function SingleImageResult({
  turnId,
  skillId,
  generatedImage,
  ready,
  onPreview,
  onRegenerate,
  regenerating,
}: {
  turnId: string;
  skillId: string;
  generatedImage?: string;
  ready: boolean;
  onPreview: (item: GalleryItem, slot: number) => void;
  onRegenerate: (item: GalleryItem) => void;
  regenerating: string | null;
}) {
  const preset = singleImageOutputs[skillId] ?? singleImageOutputs["amazon-scene-image"];
  const item = { ...preset, image: generatedImage ?? preset.image };
  const skillLabel = skills.find((skillItem) => skillItem.id === skillId)?.label ?? "商品图片";
  const showImage = ready && regenerating !== item.id;

  return (
    <section className="single-image-result" data-testid="single-image-result">
      <header className="result-section-head">
        <div>
          <span>SINGLE IMAGE</span>
          <h2>{skillLabel}</h2>
        </div>
        <p>{item.group}</p>
      </header>
      <article className="single-asset-card">
        {showImage ? (
          <>
            <button
              type="button"
              className="single-asset-visual"
              onClick={() => onPreview(item, 0)}
              aria-label={`预览 ${item.title}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt={item.title} />
            </button>
            <footer>
              <div><span>{item.group}</span><strong>{item.title}</strong></div>
              <div>
                <a
                  href={assetDownloadUrl(item.image)}
                  download
                  data-analytics-event="asset_downloaded"
                  data-turn-id={turnId}
                >
                  下载原图
                </a>
                <button type="button" onClick={() => onRegenerate(item)}>重新生成</button>
              </div>
            </footer>
          </>
        ) : (
          <div className="single-asset-skeleton">
            <span>{regenerating === item.id ? "正在重新生成" : "正在生成图片"}</span>
          </div>
        )}
      </article>
    </section>
  );
}

function VideoResult({
  turnId,
  ready,
  productImage,
  videoUrl,
  onNotice,
}: {
  turnId: string;
  ready: boolean;
  productImage: string;
  videoUrl?: string;
  onNotice: (text: string) => void;
}) {
  if (!ready) {
    return (
      <section className="video-result video-loading" data-testid="video-result">
        <div /><i /><i />
      </section>
    );
  }

  return (
    <section className="video-result" data-testid="video-result">
      <header className="result-section-head">
        <div>
          <span>PRODUCT VIDEO · 9:16</span>
          <h2>一杯咖啡，去任何地方</h2>
        </div>
        <a
          href={videoUrl ?? "/product-demo.mp4"}
          download
          onClick={() => onNotice("视频文件已准备下载")}
          data-analytics-event="asset_downloaded"
          data-turn-id={turnId}
        >
          下载视频
        </a>
      </header>
      <div className="video-layout">
        <div className="video-stage">
          <video
            controls
            playsInline
            poster={productImage}
            aria-label="BrewGo 商品视频"
            data-testid="generated-video"
          >
            <source src={videoUrl ?? "/api/demo-video"} type="video/mp4" />
          </video>
        </div>
        <aside className="storyboard">
          <span className="storyboard-label">镜头脚本</span>
          {[
            ["00:00", "旅途清晨", "露营桌上出现便携咖啡机"],
            ["00:03", "一键加热", "特写展示注水与启动"],
            ["00:07", "20 Bar 萃取", "浓缩咖啡缓慢流入杯中"],
            ["00:11", "即刻享用", "人物在山景前端起咖啡"],
          ].map(([time, title, detail], index) => (
            <div className="shot" key={time}>
              <span>{time}</span>
              <i style={{ backgroundImage: `url(${index % 2 ? "/product-main.png" : "/product-outdoor.png"})` }} />
              <div><b>{title}</b><p>{detail}</p></div>
            </div>
          ))}
          <div className="video-meta">
            <div><span>时长</span><b>15 秒</b></div>
            <div><span>比例</span><b>9:16</b></div>
            <div><span>语言</span><b>无字幕</b></div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function AppSidebar({
  screen,
  conversations,
  turns,
  activeConversationId,
  onHome,
  onConversation,
  onAssets,
  onNewConversation,
  onRename,
  onDelete,
  session,
  sessionReady,
  onAccount,
}: {
  screen: "home" | "studio" | "assets";
  conversations: Conversation[];
  turns: Turn[];
  activeConversationId: string | null;
  onHome: () => void;
  onConversation: (conversationId?: string) => void;
  onAssets: () => void;
  onNewConversation: () => void;
  onRename: (conversationId: string, title: string) => void;
  onDelete: (conversationId: string) => void;
  session: ClientSession;
  sessionReady: boolean;
  onAccount: () => void;
}) {
  const latestConversation = conversations[conversations.length - 1];
  const [contextMenu, setContextMenu] = useState<{
    conversationId: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  return (
    <aside className="studio-sidebar">
      <button
        className="brand brand-button"
        type="button"
        onClick={onHome}
        aria-label="Mercato 首页"
      >
        <span className="brand-mark" aria-hidden="true">♥</span>
        <span>MERCATO</span>
      </button>
      <nav className="workspace-links" aria-label="工作区导航">
        <button type="button" className={screen === "home" ? "active" : ""} onClick={onHome}>
          <House aria-hidden="true" weight="bold" />首页
        </button>
        <button
          type="button"
          className={screen === "studio" ? "active" : ""}
          disabled={!conversations.length}
          onClick={() => onConversation(activeConversationId ?? latestConversation?.id)}
        >
          <ChatCircle aria-hidden="true" weight="fill" />当前对话
        </button>
        <button type="button" className={screen === "assets" ? "active" : ""} onClick={onAssets}>
          <Images aria-hidden="true" weight="bold" />最近结果
        </button>
      </nav>
      {screen !== "home" ? (
        <button className="new-chat" type="button" onClick={onNewConversation}>
          <Plus aria-hidden="true" weight="bold" />添加新对话
        </button>
      ) : null}
      <nav className="conversation-list" aria-label="全部对话">
        <span className="nav-caption">
          {conversations.length ? `全部对话 · ${conversations.length}` : "还没有生成记录"}
        </span>
        {conversations.map((conversation) => {
          const conversationTurns = turns.filter(
            (turn) => turn.conversationId === conversation.id,
          );
          const runningCount = conversationTurns.filter((turn) => turn.running).length;
          return (
            <button
              type="button"
              className={
                screen === "studio" && conversation.id === activeConversationId
                  ? "conversation-active"
                  : ""
              }
              onClick={() => onConversation(conversation.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                setContextMenu({
                  conversationId: conversation.id,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
              key={conversation.id}
            >
              <strong>{conversation.title}</strong>
              <small>
                {runningCount
                  ? `${runningCount} 个任务生成中`
                  : `${conversationTurns.length} 个任务`}
              </small>
            </button>
          );
        })}
      </nav>
      {contextMenu ? (
        <div
          className="conversation-menu"
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          data-testid="conversation-context-menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const conversation = conversations.find(
                (item) => item.id === contextMenu.conversationId,
              );
              const title = window.prompt("重命名对话", conversation?.title ?? "");
              if (title?.trim()) {
                onRename(contextMenu.conversationId, title.trim());
              }
            }}
          >
            重命名
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              const conversation = conversations.find(
                (item) => item.id === contextMenu.conversationId,
              );
              if (window.confirm(`确定删除「${conversation?.title ?? "这个对话"}」吗？`)) {
                onDelete(contextMenu.conversationId);
              }
            }}
          >
            删除
          </button>
        </div>
      ) : null}
      <div className="sidebar-account">
        <button
          type="button"
          className="sidebar-user"
          aria-label="个人账户"
          aria-haspopup="dialog"
          onClick={onAccount}
          disabled={!sessionReady}
          data-testid="account-trigger"
        >
          {session?.user.pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="avatar account-avatar-image"
              src={session.user.pictureUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="avatar" aria-hidden="true">
              {session?.user.name.slice(0, 1).toUpperCase() ?? "Y"}
            </span>
          )}
          <span>
            <strong>
              {sessionReady ? session?.user.name ?? "我的账户" : "正在载入账号"}
            </strong>
            <small>
              {!sessionReady
                ? "正在同步登录状态"
                : session
                ? session.hasApiKey
                  ? "API Key 已配置"
                  : "请配置 API Key"
                : "使用 Google 登录"}
            </small>
          </span>
        </button>
      </div>
    </aside>
  );
}

function assetDateLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
  if (sameDay(date, today)) return "今天";
  if (sameDay(date, yesterday)) return "昨天";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  }).format(date);
}

function AssetLibrary({
  assets,
  onPreview,
}: {
  assets: AssetRecord[];
  onPreview: (asset: AssetRecord) => void;
}) {
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const visibleAssets =
    filter === "all" ? assets : assets.filter((asset) => asset.type === filter);
  const groups = visibleAssets.reduce<Record<string, AssetRecord[]>>(
    (result, asset) => {
      const label = assetDateLabel(asset.createdAt);
      result[label] ??= [];
      result[label].push(asset);
      return result;
    },
    {},
  );

  return (
    <section className="asset-library" data-testid="asset-library">
      <header className="asset-library-head">
        <div>
          <h1>最近结果</h1>
          <p>所有生成结果会自动保存，并按日期整理。</p>
        </div>
        <span>{assets.length} 个资产</span>
      </header>
      <div className="asset-filterbar" aria-label="资产类型">
        <button
          type="button"
          className={filter === "all" ? "active" : undefined}
          onClick={() => setFilter("all")}
        >
          全部
        </button>
        <button
          type="button"
          className={filter === "image" ? "active" : undefined}
          onClick={() => setFilter("image")}
        >
          图片
        </button>
        <button
          type="button"
          className={filter === "video" ? "active" : undefined}
          onClick={() => setFilter("video")}
        >
          视频
        </button>
      </div>
      {visibleAssets.length ? (
        Object.entries(groups).map(([label, group]) => (
          <section className="asset-date-group" key={label}>
            <h2>{label}</h2>
            <div className="asset-library-grid">
              {group.map((asset) => (
                <article className="library-card" key={asset.id}>
                  {asset.type === "video" ? (
                    <video
                      src={asset.url}
                      muted
                      playsInline
                      controls
                      aria-label={asset.title}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onPreview(asset)}
                      aria-label={`预览 ${asset.title}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.url} alt={asset.title} />
                    </button>
                  )}
                  <footer>
                    <strong>{asset.title}</strong>
                    <span>{asset.type === "video" ? "视频" : "图片"}</span>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="asset-empty">
          <Images aria-hidden="true" weight="duotone" />
          <h2>{assets.length ? "没有这个类型的资产" : "还没有生成资产"}</h2>
          <p>
            {assets.length
              ? "切换其他类型，或继续生成新的内容。"
              : "完成第一张图片或视频后，会自动出现在这里。"}
          </p>
        </div>
      )}
    </section>
  );
}

function QuickCapabilities({
  onSelect,
}: {
  onSelect: (mode: GenerationMode, skill: string) => void;
}) {
  return (
    <nav className="quick-capabilities" aria-label="快捷创作能力">
      {quickCapabilities.map((item) => (
        <button
          type="button"
          key={item.id}
          data-testid={item.id}
          onClick={() => onSelect(item.mode, item.skill)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt="" />
          <span><strong>{item.title}</strong><small>{item.body}</small></span>
          <ArrowRight weight="bold" aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}

function InspirationGallery({
  onOpen,
}: {
  onOpen: (item: InspirationCase) => void;
}) {
  const [activeTab, setActiveTab] = useState("featured");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const galleryEndRef = useRef<HTMLDivElement>(null);
  const visibleCases =
    activeTab === "featured"
      ? inspirationCases
      : inspirationCases.filter((item) => item.tab === activeTab);

  useEffect(() => {
    const target = galleryEndRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowScrollTop(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [activeTab]);

  return (
    <section className="inspiration-gallery" aria-labelledby="inspiration-title">
      <header className="inspiration-toolbar">
        <h2 id="inspiration-title">优秀案例</h2>
        <div className="inspiration-tabs" role="tablist" aria-label="优秀案例分类">
          {inspirationTabs.map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "active" : undefined}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="inspiration-grid" data-testid="inspiration-grid">
        {visibleCases.map((item) => (
          <button
            type="button"
            className={`inspiration-card inspiration-card-${item.layout}`}
            key={item.id}
            data-testid={item.id}
            aria-label={`预览${item.title}`}
            onClick={() => onOpen(item)}
          >
            <span className="inspiration-card-media" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.images[0]} alt="" />
            </span>
          </button>
        ))}
      </div>
      <div ref={galleryEndRef} className="inspiration-end-marker" aria-hidden="true" />
      {showScrollTop ? (
        <button
          type="button"
          className="inspiration-scroll-top"
          aria-label="回到顶部"
          onClick={() => document.getElementById("create")?.scrollIntoView({ behavior: "smooth" })}
        >
          <CaretUp weight="bold" aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}

function InspirationTemplatePreview({
  item,
  onClose,
  onUse,
}: {
  item: InspirationCase;
  onClose: () => void;
  onUse: (item: InspirationCase) => void;
}) {
  const modeLabel = item.mode === "video" ? "视频生成" : item.mode === "listing" ? "Listing 生成" : "图片生成";
  const skillLabel = skills.find((skillItem) => skillItem.id === item.skill)?.label ?? item.title;

  return (
    <section className="template-preview-page" data-testid="template-preview-page">
      <div className="template-preview-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.images[0]} alt={item.title} />
      </div>
      <aside className="template-preview-details">
        <button type="button" className="template-preview-close" aria-label="返回优秀案例" onClick={onClose}>
          <X weight="bold" aria-hidden="true" />
        </button>
        <div className="template-preview-heading">
          <span>{modeLabel}</span>
          <h1>{item.title}</h1>
          <p>{item.description}</p>
        </div>
        <div className="template-preview-prompt">
          <h2>生成内容</h2>
          <p>{item.prompt}</p>
        </div>
        <dl className="template-preview-settings">
          <div><dt>技能</dt><dd>{skillLabel}</dd></div>
          {item.suite ? (
            <>
              <div><dt>A+ 图</dt><dd>{item.suite.aPlusCount ?? 0} 张</dd></div>
              <div><dt>主副图</dt><dd>{item.suite.mainImageCount ?? 0} 张</dd></div>
              <div><dt>图片比例</dt><dd>{item.suite.mainImageRatio ?? "1:1"}</dd></div>
            </>
          ) : null}
        </dl>
        <button type="button" className="template-preview-use" onClick={() => onUse(item)}>
          做同款 <ArrowRight weight="bold" aria-hidden="true" />
        </button>
      </aside>
    </section>
  );
}

function PreviewModal({
  preview,
  prompt,
  generating,
  onPrompt,
  onSubmit,
  onClose,
}: {
  preview: PreviewState;
  prompt: string;
  generating: boolean;
  onPrompt: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="preview-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`预览 ${preview.title}`}
      data-testid="preview-modal"
      onClick={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <button type="button" className="preview-close" onClick={onClose} aria-label="关闭预览">
        <X aria-hidden="true" weight="bold" />
      </button>
      <div className="preview-content">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.image} alt={preview.title} />
        <footer>
          <div><span>{preview.group}</span><strong>{preview.title}</strong></div>
          <div className="preview-downloads">
            <a
              href={assetDownloadUrl(preview.image, "png")}
              download
              data-analytics-event="asset_downloaded"
              data-turn-id={preview.turnId}
            >
              下载 PNG
            </a>
            <a
              href={assetDownloadUrl(preview.image, "jpg")}
              download
              data-analytics-event="asset_downloaded"
              data-turn-id={preview.turnId}
            >
              下载 JPG
            </a>
          </div>
        </footer>
        <form
          className="preview-composer"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <textarea
            value={prompt}
            onChange={(event) => onPrompt(event.target.value)}
            placeholder="描述你希望如何修改这张图，例如：背景改成户外露营场景，保留商品外观"
            aria-label="继续修改图片"
            rows={2}
          />
          <button
            type="submit"
            disabled={!prompt.trim() || generating}
            aria-label="生成修改后的图片"
          >
            <ArrowUp aria-hidden="true" weight="bold" />
          </button>
        </form>
      </div>
    </div>
  );
}

async function uploadAsFile(upload: Upload) {
  const source = upload.file ?? new File(
    [await fetch(upload.url).then((response) => response.blob())],
    upload.name || "product.png",
  );
  if (source.size <= 700_000) return source;

  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("商品图压缩失败")),
      "image/jpeg",
      0.8,
    );
  });
  return new File([blob], `${source.name.replace(/\.[^.]+$/, "")}.jpg`, {
    type: blob.type || "image/png",
  });
}

async function fileDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("无法读取上传图片"));
    reader.readAsDataURL(file);
  });
}

async function uploadSource(upload: Upload) {
  return fileDataUrl(await uploadAsFile(upload));
}

async function uploadOriginalFile(upload: Upload) {
  if (upload.file) return upload.file;
  const response = await fetch(upload.url);
  if (!response.ok) throw new Error("无法读取参考视频");
  const blob = await response.blob();
  return new File([blob], upload.name || "reference-video.mp4", {
    type: blob.type || "video/mp4",
  });
}

async function uploadOriginalSource(upload: Upload) {
  return fileDataUrl(await uploadOriginalFile(upload));
}

async function responseError(response: Response) {
  const payload = await response.json().catch(() => null);
  return payload?.error ?? `生成请求失败 (${response.status})`;
}

function parseListingJson(text: string): ListingData {
  const cleaned = visibleAgentText(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Agent 没有返回有效的 Listing JSON");
  const value = JSON.parse(cleaned.slice(start, end + 1)) as ListingData;
  if (!value.title || !Array.isArray(value.bullets) || !value.description) {
    throw new Error("Agent 返回的 Listing 字段不完整");
  }
  return value;
}

function visibleAgentText(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trimStart();
}

function plainListingText(value: string | undefined, fallback: string) {
  return (value?.trim() || fallback)
    .replace(/^\*{1,2}\s*/, "")
    .replace(/\s*\*{1,2}$/, "");
}

function deepFind(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (keys.includes(key) && typeof child === "string") return child;
    const nested = deepFind(child, keys);
    if (nested) return nested;
  }
}

export default function Home() {
  const [screen, setScreen] = useState<"home" | "studio" | "assets">("home");
  const [prompt, setPrompt] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [referenceVideo, setReferenceVideo] = useState<Upload | null>(null);
  const [mode, setMode] = useState<GenerationMode>("listing");
  const [skill, setSkill] = useState("amazon-listing");
  const [region, setRegion] = useState("us");
  const [language, setLanguage] = useState("en");
  const [brand, setBrand] = useState<BrandSettings>(defaultBrandSettings);
  const [suite, setSuite] = useState<SuiteSettings>(defaultSuiteSettings);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState("");
  const [previewGenerating, setPreviewGenerating] = useState(false);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [session, setSession] = useState<ClientSession>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [studioComposerMinimized, setStudioComposerMinimized] = useState(false);
  const [homeComposerMinimized, setHomeComposerMinimized] = useState(false);
  const [selectedInspiration, setSelectedInspiration] = useState<InspirationCase | null>(null);
  const controllers = useRef<Map<string, AbortController>>(new Map());
  const persistenceTimers = useRef<Map<string, number>>(new Map());
  const turnsRef = useRef<Turn[]>([]);
  const uploadsRef = useRef<Upload[]>([]);
  const referenceVideoRef = useRef<Upload | null>(null);
  const sessionTracked = useRef(false);

  const modeSkills = skillsByMode(mode);
  const selectedSkill =
    modeSkills.find((item) => item.id === skill) ?? modeSkills[0];
  const selectedKind = selectedSkill.kind;
  const productImage = uploads[0]?.url ?? "/product-main.png";
  const activeConversation =
    conversations.find((item) => item.id === activeConversationId) ??
    conversations[conversations.length - 1];
  const activeTurns = turns.filter(
    (turn) => turn.conversationId === activeConversation?.id,
  );

  useEffect(() => () => {
    controllers.current.forEach((controller) => controller.abort());
    controllers.current.clear();
    persistenceTimers.current.forEach((timer) => window.clearTimeout(timer));
    persistenceTimers.current.clear();
    uploadsRef.current.forEach((upload) => {
      if (upload.owned) URL.revokeObjectURL(upload.url);
    });
    if (referenceVideoRef.current?.owned) {
      URL.revokeObjectURL(referenceVideoRef.current.url);
    }
  }, []);

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  useEffect(() => {
    referenceVideoRef.current = referenceVideo;
  }, [referenceVideo]);

  useEffect(() => {
    if (screen !== "studio") return;
    const minimizeComposer = () => setStudioComposerMinimized(true);
    window.addEventListener("wheel", minimizeComposer, { passive: true });
    window.addEventListener("touchmove", minimizeComposer, { passive: true });
    return () => {
      window.removeEventListener("wheel", minimizeComposer);
      window.removeEventListener("touchmove", minimizeComposer);
    };
  }, [screen]);

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { user: null })
      .then((payload) => {
        setSession(payload.user ? payload : null);
        setSessionReady(true);
      })
      .catch(() => setSessionReady(true));
  }, []);

  useEffect(() => {
    if (!session) return;
    void Promise.all([
      fetch("/api/assets", { cache: "no-store" })
        .then((response) => response.ok ? response.json() : { assets: [] }),
      fetch("/api/history", { cache: "no-store" })
        .then((response) => response.ok
          ? response.json()
          : { conversations: [], turns: [] }),
    ]).then(([assetPayload, historyPayload]) => {
      const restoredConversations = historyPayload.conversations ?? [];
      const restoredTurns = historyPayload.turns ?? [];
      setAssets(assetPayload.assets ?? []);
      setConversations(restoredConversations);
      turnsRef.current = restoredTurns;
      setTurns(restoredTurns);
      setActiveConversationId((current) =>
        current ?? restoredConversations[restoredConversations.length - 1]?.id ?? null,
      );
    }).catch(() => undefined);

    if (!sessionTracked.current) {
      sessionTracked.current = true;
      void fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "session_started" }),
        keepalive: true,
      }).catch(() => undefined);
    }
  }, [session]);

  const updateSession = (nextSession: ClientSession) => {
    setSession(nextSession);
    if (!nextSession) {
      setAssets([]);
      setConversations([]);
      turnsRef.current = [];
      setTurns([]);
      setActiveConversationId(null);
      sessionTracked.current = false;
    }
  };

  const showNotice = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const persistConversation = async (conversation: Conversation) => {
    const response = await fetch("/api/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "upsert-conversation",
        conversation,
      }),
      keepalive: true,
    });
    if (!response.ok) throw new Error(await responseError(response));
  };

  const persistTurn = async (turn: Turn) => {
    const response = await fetch("/api/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "upsert-turn", turn }),
      keepalive: true,
    });
    if (!response.ok) throw new Error(await responseError(response));
  };

  const scheduleTurnPersistence = (turn: Turn, immediate = false) => {
    const existing = persistenceTimers.current.get(turn.id);
    if (existing) window.clearTimeout(existing);
    if (immediate) {
      persistenceTimers.current.delete(turn.id);
      void persistTurn(turn).catch(() => showNotice("任务进度暂未保存，请检查网络"));
      return;
    }
    const timer = window.setTimeout(() => {
      persistenceTimers.current.delete(turn.id);
      void persistTurn(turn).catch(() => undefined);
    }, 900);
    persistenceTimers.current.set(turn.id, timer);
  };

  const trackEvent = (
    event: string,
    turn?: Turn,
    metadata: Record<string, unknown> = {},
  ) => {
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event,
        mode: turn?.mode,
        skill: turn?.skill,
        conversationId: turn?.conversationId,
        turnId: turn?.id,
        metadata,
      }),
      keepalive: true,
    }).catch(() => undefined);
  };

  useEffect(() => {
    const handleTrackedAction = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-analytics-event]",
      );
      if (!target) return;
      const turnId = target.dataset.turnId;
      const turn = turnsRef.current.find((item) => item.id === turnId);
      trackEvent(target.dataset.analyticsEvent || "asset_downloaded", turn);
    };
    document.addEventListener("click", handleTrackedAction);
    return () => document.removeEventListener("click", handleTrackedAction);
  }, []);

  const storeAsset = async (
    turn: Turn,
    sourceUrl: string,
    type: "image" | "video",
    title: string,
    slot = 0,
    role: "input" | "output" = "output",
    dimensions?: { width: number; height: number },
  ) => {
    const temporaryId = `local-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const optimistic: AssetRecord = {
      id: temporaryId,
      type,
      title,
      prompt: turn.prompt,
      url: sourceUrl,
      conversationId: turn.conversationId,
      turnId: turn.id,
      role,
      slot,
      createdAt,
    };
    if (role === "output") {
      setAssets((current) => [optimistic, ...current]);
    }
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceUrl,
          type,
          title,
          prompt: turn.prompt,
          conversationId: turn.conversationId,
          turnId: turn.id,
          role,
          slot,
          createdAt,
          outputWidth: dimensions?.width,
          outputHeight: dimensions?.height,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = await response.json();
      if (role === "output") {
        setAssets((current) =>
          current.map((asset) => asset.id === temporaryId ? payload.asset : asset),
        );
      }
      return payload.asset as AssetRecord;
    } catch (error) {
      if (role === "output") {
        setAssets((current) =>
          current.filter((asset) => asset.id !== temporaryId),
        );
      }
      showNotice(
        error instanceof Error
          ? `生成成功，但资产保存失败：${error.message}`
          : "生成成功，但资产保存失败",
      );
      return null;
    }
  };

  const openPreview = (turn: Turn, item: GalleryItem, slot: number) => {
    setPreview({ ...item, turnId: turn.id, slot });
    setPreviewPrompt("");
  };

  const addSample = () => {
    uploadsRef.current.forEach((upload) => {
      if (upload.owned) URL.revokeObjectURL(upload.url);
    });
    const nextUploads = [
      { id: "sample", name: "便携咖啡机示例图", url: "/product-main.png" },
    ];
    uploadsRef.current = nextUploads;
    setUploads(nextUploads);
    setPrompt(selectedSkill.starter);
  };

  const changeMode = (nextMode: GenerationMode) => {
    const nextSkill = skillsByMode(nextMode)[0];
    setMode(nextMode);
    setSkill(nextSkill.id);
    setPrompt("");
    if (nextMode === "video") {
      setBrand((current) => ({ ...current, platform: "tiktok-shop" }));
    }
    if (nextMode === "listing") {
      setBrand((current) => ({ ...current, platform: "amazon" }));
    }
  };

  const selectCapability = (nextMode: GenerationMode, nextSkill: string) => {
    setMode(nextMode);
    setSkill(nextSkill);
    setPrompt("");
    if (nextMode === "video") {
      setBrand((current) => ({ ...current, platform: "tiktok-shop" }));
    } else if (nextMode === "listing") {
      setBrand((current) => ({ ...current, platform: "amazon" }));
    }
    window.requestAnimationFrame(() => {
      setHomeComposerMinimized(false);
      window.requestAnimationFrame(() => {
        document.getElementById("main-prompt")?.focus();
      });
    });
  };

  const applyInspirationCase = (item: InspirationCase) => {
    uploadsRef.current.forEach((upload) => {
      if (upload.owned) URL.revokeObjectURL(upload.url);
    });
    const templateUploads = item.images.slice(0, MAX_UPLOADS).map((url, index) => ({
      id: `${item.id}-reference-${index}`,
      name: `${item.title}-参考图-${index + 1}.png`,
      url,
    }));
    uploadsRef.current = templateUploads;
    setUploads(templateUploads);
    setReferenceVideo(null);
    setMode(item.mode);
    setSkill(item.skill);
    setPrompt(item.prompt);
    if (item.suite) {
      setSuite((current) => ({ ...current, ...item.suite }));
    }
    if (item.mode === "video") {
      setBrand((current) => ({ ...current, platform: "tiktok-shop" }));
    } else if (item.mode === "listing") {
      setBrand((current) => ({ ...current, platform: "amazon" }));
    }
    setHomeComposerMinimized(false);
    showNotice(`已应用「${item.title}」，替换成你的商品图后即可生成`);
    window.requestAnimationFrame(() => {
      document.getElementById("main-prompt")?.focus();
    });
  };

  const changeSkill = (nextSkill: string) => {
    setSkill(nextSkill);
    if (nextSkill === "listing-replica") setPrompt("");
  };

  const handleFiles = (files: File[]) => {
    const selected = files.filter((file) => file.type.startsWith("image/"));
    if (!selected.length) {
      if (files.length) showNotice("仅支持上传图片文件");
      return;
    }
    const currentUploads = uploadsRef.current;
    const remaining = Math.max(0, MAX_UPLOADS - currentUploads.length);
    if (!remaining) {
      showNotice("最多上传 9 张图片");
      return;
    }
    const known = new Set(currentUploads.map((upload) => upload.id));
    const additions: Upload[] = [];
    for (const file of selected) {
      const id = `${file.name}-${file.lastModified}-${file.size}`;
      if (known.has(id)) continue;
      known.add(id);
      additions.push({
        id,
        name: file.name,
        url: URL.createObjectURL(file),
        owned: true,
        file,
      });
      if (additions.length === remaining) break;
    }
    const nextUploads = [...currentUploads, ...additions].slice(0, MAX_UPLOADS);
    uploadsRef.current = nextUploads;
    setUploads(nextUploads);
    if (selected.length > additions.length) {
      showNotice(`最多上传 9 张图片，本次已添加 ${additions.length} 张`);
    }
  };

  const handleReferenceVideo = (file: File) => {
    if (!file.type.startsWith("video/")) {
      showNotice("参考视频仅支持视频文件");
      return;
    }
    if (file.size > MAX_REFERENCE_VIDEO_BYTES) {
      showNotice("参考视频不能超过 100 MB");
      return;
    }
    if (referenceVideoRef.current?.owned) {
      URL.revokeObjectURL(referenceVideoRef.current.url);
    }
    const nextVideo: Upload = {
      id: `${file.name}-${file.lastModified}-${file.size}`,
      name: file.name,
      url: URL.createObjectURL(file),
      owned: true,
      file,
    };
    referenceVideoRef.current = nextVideo;
    setReferenceVideo(nextVideo);
  };

  const removeReferenceVideo = () => {
    if (referenceVideoRef.current?.owned) {
      URL.revokeObjectURL(referenceVideoRef.current.url);
    }
    referenceVideoRef.current = null;
    setReferenceVideo(null);
  };

  const removeUpload = (id: string) => {
    const removed = uploadsRef.current.find((upload) => upload.id === id);
    if (removed?.owned) URL.revokeObjectURL(removed.url);
    const nextUploads = uploadsRef.current.filter((upload) => upload.id !== id);
    uploadsRef.current = nextUploads;
    setUploads(nextUploads);
  };

  const patchTurn = (turnId: string, patch: Partial<Turn>) => {
    let updated: Turn | undefined;
    const nextTurns = turnsRef.current.map((turn) => {
      if (turn.id !== turnId) return turn;
      updated = { ...turn, ...patch };
      return updated;
    });
    turnsRef.current = nextTurns;
    setTurns(nextTurns);
    if (updated) {
      scheduleTurnPersistence(
        updated,
        patch.running === false || Boolean(patch.error),
      );
    }
  };

  const generationForm = async (
    turn: Turn,
    uploadsForTurn: Upload[],
    action: "listing" | "image" | "video",
    slot?: number,
    referenceVideoForTurn?: Upload,
  ) => {
    const form = new FormData();
    form.set("action", action);
    form.set("mode", turn.mode);
    form.set("skill", turn.skill);
    form.set("region", turn.region);
    form.set("language", turn.language);
    form.set("platform", turn.brand.platform);
    const brandColor = turn.brand.primaryColor || "auto";
    form.set("brandColor", brandColor);
    form.set("fontStyle", turn.brand.fontStyle);
    form.set("aPlusType", turn.suite.aPlusType);
    form.set("aPlusCount", String(turn.suite.aPlusCount));
    form.set("mainImageCount", String(turn.suite.mainImageCount));
    form.set("mainImageRatio", turn.suite.mainImageRatio);
    form.set("brandContext", JSON.stringify({
      primaryColor: brandColor,
      fontStyle: turn.brand.fontStyle,
      market: regions.find((item) => item.id === turn.region)?.label ?? turn.region,
      language: languages.find((item) => item.id === turn.language)?.label ?? turn.language,
      platform: platforms.find((item) => item.id === turn.brand.platform)?.label
        ?? turn.brand.platform,
    }));
    form.set("prompt", turn.prompt);
    if (slot !== undefined) {
      form.set("slot", String(slot));
      if (hasSuiteSettings(turn.skill)) {
        const slotConfig = suiteSlot(turn.suite, slot);
        form.set("slotType", slotConfig.type);
        form.set("slotIndex", String(slotConfig.index));
      }
    }
    const files = await Promise.all(
      uploadsForTurn.slice(0, MAX_UPLOADS).map(uploadAsFile),
    );
    files.forEach((file) => form.append("image", file, file.name));
    if (action === "video" && referenceVideoForTurn) {
      const file = await uploadOriginalFile(referenceVideoForTurn);
      form.append("referenceVideo", file, file.name);
    }
    return form;
  };

  const runImageTask = async (form: FormData, signal?: AbortSignal) => {
    const response = await fetch("/api/generate", {
      method: "POST",
      body: form,
      signal,
    });
    if (!response.ok) throw new Error(await responseError(response));
    const created = await response.json();
    const taskId = deepFind(created, ["id", "task_id"]);
    if (!taskId) throw new Error("图片任务后台没有返回任务 ID");

    for (let attempt = 0; attempt < 240; attempt += 1) {
      if (attempt) await new Promise((resolve) => window.setTimeout(resolve, 3000));
      if (signal?.aborted) throw new DOMException("已停止", "AbortError");
      const poll = await fetch(
        `/api/generate?imageTaskId=${encodeURIComponent(taskId)}`,
        { signal, cache: "no-store" },
      );
      if (!poll.ok) throw new Error(await responseError(poll));
      const payload = await poll.json();
      const status = deepFind(payload, ["status", "state"])?.toLowerCase();
      const url = deepFind(payload, ["url", "image_url", "imageUrl"]);
      if (url && ["succeeded", "success", "completed", "done"].includes(status ?? "succeeded")) {
        return url;
      }
      if (["failed", "error", "cancelled", "canceled"].includes(status ?? "")) {
        throw new Error(deepFind(payload, ["error", "message"]) ?? "图片生成失败");
      }
    }
    throw new Error("图片生成超时，请稍后重试");
  };

  const runListing = async (
    turn: Turn,
    uploadsForTurn: Upload[],
    signal: AbortSignal,
  ): Promise<GenerationSummary> => {
    const suiteImageCount = turn.skill === "amazon-listing"
      ? turn.imageTaskCount ?? 0
      : 0;
    patchTurn(turn.id, {
      phase: "正在理解商品图片",
      completed: suiteImageCount ? 0 : 1,
      images: suiteImageCount ? [] : turn.images,
      failedImageSlots: suiteImageCount ? [] : turn.failedImageSlots,
    });
    const response = await fetch("/api/generate", {
      method: "POST",
      body: await generationForm(turn, uploadsForTurn, "listing"),
      signal,
    });
    if (!response.ok || !response.body) throw new Error(await responseError(response));

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let generated = "";
    patchTurn(turn.id, {
      phase: "正在流式生成 Listing",
      completed: suiteImageCount ? 0 : 2,
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        const event = JSON.parse(data);
        generated += event.choices?.[0]?.delta?.content ?? "";
      }
      patchTurn(turn.id, { agentText: visibleAgentText(generated) });
    }

    const listing = parseListingJson(generated);
    if (!suiteImageCount) {
      patchTurn(turn.id, {
        listing,
        agentText: visibleAgentText(generated),
        phase: "生成完成",
        completed: generationCopy.listing.phases.length,
        running: false,
      });
      return { status: "complete", completed: 1, expected: 1, failed: 0 };
    }

    patchTurn(turn.id, {
      listing,
      agentText: visibleAgentText(generated),
      phase: `Listing 已完成，正在生成 0 / ${suiteImageCount} 张套图`,
      completed: 1,
    });

    const results = new Array<string>(suiteImageCount);
    const failedSlots: number[] = [];
    let nextSlot = 0;
    let firstError = "";

    const worker = async () => {
      while (nextSlot < suiteImageCount) {
        const slot = nextSlot++;
        try {
          const generatedUrl = await runImageTask(
            await generationForm(turn, uploadsForTurn, "image", slot),
            signal,
          );
          const stored = await storeAsset(
            turn,
            generatedUrl,
            "image",
            suiteItems(turn.skill, suiteImageCount, turn.suite)[slot]?.title ??
              `Listing 图片 ${slot + 1}`,
            slot,
            "output",
            suiteOutputDimensions(turn.suite, slot),
          );
          if (!stored) throw new Error("图片已生成，但没有保存到资产库");
          results[slot] = stored.url;
        } catch (error) {
          if ((error as Error).name === "AbortError") throw error;
          failedSlots.push(slot);
          firstError ||= error instanceof Error ? error.message : "图片生成失败";
        }
        const done = results.filter(Boolean).length;
        patchTurn(turn.id, {
          images: [...results],
          failedImageSlots: [...failedSlots],
          completed: 1 + done,
          phase: failedSlots.length
            ? `Listing 已完成 · 套图 ${done} / ${suiteImageCount} 张 · ${failedSlots.length} 张失败`
            : `Listing 已完成 · 套图 ${done} / ${suiteImageCount} 张`,
        });
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(2, suiteImageCount) }, worker),
    );
    const done = results.filter(Boolean).length;
    if (!done) throw new Error(firstError || "Listing 文案已完成，但套图生成失败");
    patchTurn(turn.id, {
      images: results,
      failedImageSlots: failedSlots,
      phase: failedSlots.length
        ? `Listing 与 ${done} / ${suiteImageCount} 张套图已完成`
        : "生成完成",
      completed: 1 + done,
      running: false,
    });
    return {
      status: failedSlots.length ? "partial" : "complete",
      completed: done,
      expected: suiteImageCount,
      failed: failedSlots.length,
    };
  };

  const runImages = async (
    turn: Turn,
    uploadsForTurn: Upload[],
    signal: AbortSignal,
  ): Promise<GenerationSummary> => {
    const count = turn.imageTaskCount ?? imageTaskCount(turn.kind, turn.prompt);
    patchTurn(turn.id, {
      phase: "正在生成商品图片",
      completed: 0,
      images: [],
      failedImageSlots: [],
    });
    const results = new Array<string>(count);
    const failedSlots: number[] = [];
    let nextSlot = 0;
    let firstError = "";

    const worker = async () => {
      while (nextSlot < count) {
        const slot = nextSlot++;
        try {
          const generatedUrl = await runImageTask(
            await generationForm(turn, uploadsForTurn, "image", slot),
            signal,
          );
          const stored = await storeAsset(
            turn,
            generatedUrl,
            "image",
            (turn.kind === "single"
              ? singleImageOutputs[turn.skill]?.title
              : suiteItems(turn.skill, count, turn.suite)[slot]?.title) ??
              `生成图片 ${slot + 1}`,
            slot,
            "output",
            hasSuiteSettings(turn.skill)
              ? suiteOutputDimensions(turn.suite, slot)
              : undefined,
          );
          if (!stored) throw new Error("图片已生成，但没有保存到资产库");
          results[slot] = stored.url;
        } catch (error) {
          if ((error as Error).name === "AbortError") throw error;
          failedSlots.push(slot);
          firstError ||= error instanceof Error ? error.message : "图片生成失败";
        }
        const done = results.filter(Boolean).length;
        patchTurn(turn.id, {
          images: [...results],
          failedImageSlots: [...failedSlots],
          completed: done,
          phase: failedSlots.length
            ? `已完成 ${done} / ${count} 张 · ${failedSlots.length} 张失败`
            : `已完成 ${done} / ${count} 张`,
        });
      }
    };

    await Promise.all(Array.from({ length: Math.min(2, count) }, worker));
    const done = results.filter(Boolean).length;
    if (!done) throw new Error(firstError || "图片生成失败");
    patchTurn(turn.id, {
      images: results,
      failedImageSlots: failedSlots,
      phase: failedSlots.length
        ? `已生成 ${done} / ${count} 张，可单独重试失败图片`
        : "生成完成",
      completed: done,
      running: false,
    });
    return {
      status: failedSlots.length ? "partial" : "complete",
      completed: done,
      expected: count,
      failed: failedSlots.length,
    };
  };

  const runVideo = async (
    turn: Turn,
    uploadsForTurn: Upload[],
    signal: AbortSignal,
    referenceVideoForTurn?: Upload,
  ): Promise<GenerationSummary> => {
    patchTurn(turn.id, { phase: "正在提交视频任务", completed: 1 });
    const response = await fetch("/api/generate", {
      method: "POST",
      body: await generationForm(
        turn,
        uploadsForTurn,
        "video",
        undefined,
        referenceVideoForTurn,
      ),
      signal,
    });
    if (!response.ok) throw new Error(await responseError(response));
    const created = await response.json();
    const taskId = deepFind(created, ["id", "task_id"]);
    if (!taskId) throw new Error("视频接口没有返回任务 ID");
    patchTurn(turn.id, { phase: "视频正在生成，预计需要几分钟", completed: 2 });

    for (let attempt = 0; attempt < 150; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 4000));
      if (signal.aborted) throw new DOMException("已停止", "AbortError");
      const poll = await fetch(`/api/generate?taskId=${encodeURIComponent(taskId)}`, { signal });
      if (!poll.ok) throw new Error(await responseError(poll));
      const payload = await poll.json();
      const videoUrl = deepFind(payload, ["video_url", "videoUrl", "url"]);
      const status = deepFind(payload, ["status", "state"])?.toLowerCase();
      if (videoUrl && ["succeeded", "success", "completed", "done"].includes(status ?? "completed")) {
        const stored = await storeAsset(turn, videoUrl, "video", turn.title, 0);
        if (!stored) throw new Error("视频已生成，但没有保存到资产库");
        patchTurn(turn.id, {
          videoUrl: stored.url,
          phase: "生成完成",
          completed: generationCopy.video.phases.length,
          running: false,
        });
        return { status: "complete", completed: 1, expected: 1, failed: 0 };
      }
      if (["failed", "error", "cancelled", "canceled"].includes(status ?? "")) {
        throw new Error(deepFind(payload, ["message", "error"]) ?? "视频生成失败");
      }
      patchTurn(turn.id, {
        phase: status ? `视频生成中 · ${status}` : "视频生成中",
        completed: 3,
      });
    }
    throw new Error("视频生成超时，请稍后重试");
  };

  const runGeneration = async (
    turn: Turn,
    uploadsForTurn: Upload[],
    referenceVideoForTurn?: Upload,
  ) => {
    const controller = new AbortController();
    controllers.current.set(turn.id, controller);
    patchTurn(turn.id, { running: true, error: undefined });
    try {
      const summary = turn.kind === "listing"
        ? await runListing(turn, uploadsForTurn, controller.signal)
        : turn.kind === "video"
          ? await runVideo(
              turn,
              uploadsForTurn,
              controller.signal,
              referenceVideoForTurn,
            )
          : await runImages(turn, uploadsForTurn, controller.signal);
      trackEvent("generation_completed", turn, summary);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        trackEvent("generation_completed", turn, {
          status: "failed",
          reason: "cancelled",
        });
        return;
      }
      patchTurn(turn.id, {
        running: false,
        error: error instanceof Error ? error.message : "生成失败",
        phase: "生成失败",
      });
      trackEvent("generation_completed", turn, {
        status: "failed",
        reason: error instanceof Error ? error.message : "生成失败",
      });
    } finally {
      controllers.current.delete(turn.id);
    }
  };

  const startGeneration = async () => {
    if (selectedSkill.id === "listing-replica" && !isHttpUrl(prompt)) {
      showNotice("请先输入有效的商品详情页链接");
      return;
    }
    if (selectedSkill.id !== "listing-replica" && !uploads.length) {
      showNotice("请至少上传 1 张商品图片");
      return;
    }
    if (selectedSkill.id === "video-replica" && !referenceVideo) {
      showNotice("请先上传 1 个参考视频");
      return;
    }
    if (
      hasSuiteSettings(selectedSkill.id) &&
      suite.aPlusCount === 0 &&
      suite.mainImageCount === 0
    ) {
      showNotice("请至少选择 1 张主副图或 A+ 图");
      return;
    }
    if (!sessionReady || !session) {
      setAccountOpen(true);
      showNotice("请先登录");
      return;
    }
    if (!session.hasApiKey) {
      setAccountOpen(true);
      showNotice("请先在账号管理中配置 API Key");
      return;
    }
    const id = `turn-${crypto.randomUUID()}`;
    const taskPrompt = prompt.trim() || selectedSkill.starter;
    const conversationId =
      activeConversationId ??
      `conversation-${crypto.randomUUID()}`;
    let conversationToPersist: Conversation | undefined;
    if (!activeConversationId) {
      conversationToPersist = {
        id: conversationId,
        title: taskPrompt.slice(0, 22),
        createdAt: new Date().toISOString(),
      };
      setConversations((current) => [...current, conversationToPersist!]);
      setActiveConversationId(conversationId);
    } else {
      const currentConversation = conversations.find(
        (conversation) => conversation.id === conversationId,
      );
      if (currentConversation?.title === "新对话") {
        conversationToPersist = {
          ...currentConversation,
          title: taskPrompt.slice(0, 22),
        };
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? conversationToPersist!
              : conversation,
          ),
        );
      }
    }
    const configuredImageCount = hasSuiteSettings(selectedSkill.id)
      ? suiteTaskCount(selectedSkill.id, suite, taskPrompt)
      : imageTaskCount(selectedKind, taskPrompt);
    const turnUploads = uploads.slice(0, MAX_UPLOADS);
    const turnReferenceVideo = referenceVideo ?? undefined;
    const turn: Turn = {
      id,
      conversationId,
      createdAt: new Date().toISOString(),
      title: taskPrompt.slice(0, 22),
      prompt: taskPrompt,
      mode,
      skill: selectedSkill.id,
      kind: selectedKind,
      region,
      language,
      brand: { ...brand },
      suite: { ...suite },
      productImage,
      productImages: turnUploads.map((upload) => upload.url),
      referenceVideo: turnReferenceVideo?.url,
      referenceVideoName: turnReferenceVideo?.name,
      completed: 0,
      running: true,
      phase: generationCopy[selectedKind].phases[0],
      imageTaskCount: configuredImageCount || undefined,
    };
    const nextTurns = [...turnsRef.current, turn];
    turnsRef.current = nextTurns;
    setTurns(nextTurns);
    setStudioComposerMinimized(false);
    setScreen("studio");
    setPrompt("");
    try {
      const persistedConversation = conversationToPersist ??
        conversations.find((conversation) => conversation.id === conversationId);
      if (persistedConversation) await persistConversation(persistedConversation);
      await persistTurn(turn);
      trackEvent("generation_requested", turn, {
        expectedOutputs: configuredImageCount || 1,
        requestedImageCount: configuredImageCount || 0,
        aPlusCount: suite.aPlusCount,
        mainImageCount: suite.mainImageCount,
      });
      const storedInputs = await Promise.all(
        turnUploads.map(async (upload, slot) => {
          const sourceUrl = await uploadSource(upload);
          return storeAsset(
            turn,
            sourceUrl,
            "image",
            upload.name || `输入图片 ${slot + 1}`,
            slot,
            "input",
          );
        }),
      );
      if (storedInputs.some((asset) => !asset)) {
        throw new Error("输入图片没有完整保存，请检查网络后重试");
      }
      if (turnReferenceVideo) {
        const storedReference = await storeAsset(
          turn,
          await uploadOriginalSource(turnReferenceVideo),
          "video",
          turnReferenceVideo.name || "参考视频",
          0,
          "input",
        );
        if (!storedReference) {
          throw new Error("参考视频没有保存，请检查网络后重试");
        }
        turn.referenceVideo = storedReference.url;
        turn.referenceVideoName = turnReferenceVideo.name;
        await persistTurn(turn);
      }
    } catch (error) {
      patchTurn(turn.id, {
        running: false,
        phase: "任务保存失败",
        error: error instanceof Error ? error.message : "无法保存任务",
      });
      return;
    }
    window.setTimeout(() => {
      void runGeneration(turn, turnUploads, turnReferenceVideo);
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const stopGeneration = (turnId: string) => {
    controllers.current.get(turnId)?.abort();
    controllers.current.delete(turnId);
    patchTurn(turnId, { running: false, phase: "已停止" });
    showNotice("已停止未完成的生成");
  };

  const regenerate = async (turn: Turn, item: GalleryItem) => {
    setRegenerating(item.id);
    showNotice(`正在重新生成「${item.title}」`);
    const presets = turn.kind === "seeding"
      ? suiteItems(turn.skill, turn.imageTaskCount ?? 4, turn.suite)
      : turn.kind === "single"
        ? [singleImageOutputs[turn.skill] ?? singleImageOutputs["amazon-scene-image"]]
        : suiteItems(turn.skill, turn.imageTaskCount ?? 6, turn.suite);
    const slot = Math.max(0, presets.findIndex((preset) => preset.id === item.id));
    try {
      const url = await runImageTask(
        await generationForm(
          turn,
          (turn.productImages?.length ? turn.productImages : [turn.productImage])
            .map((url, index) => ({
              id: `${turn.id}-regenerate-${index}`,
              name: `reference-${index + 1}.png`,
              url,
            })),
          "image",
          slot,
        ),
      );
      const stored = await storeAsset(
        turn,
        url,
        "image",
        item.title,
        slot,
        "output",
        hasSuiteSettings(turn.skill)
          ? suiteOutputDimensions(turn.suite, slot)
          : undefined,
      );
      if (!stored) throw new Error("图片已生成，但没有保存到资产库");
      const nextTurns = turnsRef.current.map((currentTurn) => {
        if (currentTurn.id !== turn.id) return currentTurn;
        const images = [...(currentTurn.images ?? [])];
        images[slot] = stored.url;
        const failedImageSlots = (currentTurn.failedImageSlots ?? [])
          .filter((failedSlot) => failedSlot !== slot);
        const done = images.filter(Boolean).length;
        const total = currentTurn.imageTaskCount ?? 1;
        return {
          ...currentTurn,
          images,
          failedImageSlots,
          completed: done,
          phase: done === total ? "生成完成" : `已生成 ${done} / ${total} 张`,
          error: undefined,
        };
      });
      turnsRef.current = nextTurns;
      setTurns(nextTurns);
      const updatedTurn = nextTurns.find((currentTurn) => currentTurn.id === turn.id);
      if (updatedTurn) scheduleTurnPersistence(updatedTurn, true);
      setRegenerating(null);
      showNotice(`「${item.title}」已更新`);
    } catch (error) {
      setRegenerating(null);
      showNotice(error instanceof Error ? error.message : "重新生成失败");
    }
  };

  const editPreviewImage = async () => {
    if (!preview || !previewPrompt.trim() || previewGenerating) return;
    const existingTurn = turns.find((item) => item.id === preview.turnId);
    const fallbackConversationId =
      activeConversationId ??
      conversations[conversations.length - 1]?.id ??
      `conversation-${crypto.randomUUID()}`;
    const turn: Turn = existingTurn ?? {
      id: `edit-${crypto.randomUUID()}`,
      conversationId: fallbackConversationId,
      createdAt: new Date().toISOString(),
      title: preview.title,
      prompt: previewPrompt.trim(),
      mode: "image",
      skill: selectedSkill.mode === "image" ? selectedSkill.id : "amazon-image-set",
      kind: selectedSkill.mode === "image" ? selectedSkill.kind : "images",
      region,
      language,
      brand: { ...brand },
      suite: { ...suite },
      productImage: preview.image,
      productImages: [preview.image],
      completed: 1,
      running: false,
      phase: "生成完成",
      imageTaskCount: 1,
      images: [preview.image],
    };
    setPreviewGenerating(true);
    try {
      const editedTurn = { ...turn, prompt: previewPrompt.trim() };
      const url = await runImageTask(
        await generationForm(
          editedTurn,
          [{
            id: `${preview.id}-edit`,
            name: "reference-image.png",
            url: preview.image,
          }],
          "image",
          preview.slot,
        ),
      );
      const stored = await storeAsset(
        editedTurn,
        url,
        "image",
        `${preview.title} · 改图`,
        preview.slot,
        "output",
        hasSuiteSettings(editedTurn.skill)
          ? suiteOutputDimensions(editedTurn.suite, preview.slot)
          : undefined,
      );
      if (!stored) throw new Error("图片已生成，但没有保存到资产库");
      if (existingTurn) {
        const nextTurns = turnsRef.current.map((currentTurn) => {
          if (currentTurn.id !== turn.id) return currentTurn;
          const images = [...(currentTurn.images ?? [])];
          images[preview.slot] = stored.url;
          return { ...currentTurn, images };
        });
        turnsRef.current = nextTurns;
        setTurns(nextTurns);
        const updatedTurn = nextTurns.find(
          (currentTurn) => currentTurn.id === turn.id,
        );
        if (updatedTurn) scheduleTurnPersistence(updatedTurn, true);
      }
      setPreview((current) => current ? { ...current, image: stored.url } : current);
      setPreviewPrompt("");
      showNotice("图片已按新要求更新");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "改图失败");
    } finally {
      setPreviewGenerating(false);
    }
  };

  const openConversation = (conversationId?: string) => {
    if (!conversations.length) return;
    const targetConversationId =
      conversationId ?? conversations[conversations.length - 1].id;
    setActiveConversationId(targetConversationId);
    setStudioComposerMinimized(false);
    setScreen("studio");
    window.setTimeout(() => {
      document.getElementById("conversation-top")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const renameConversation = (conversationId: string, title: string) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, title }
          : conversation,
      ),
    );
    void fetch("/api/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "rename-conversation",
        conversationId,
        title,
      }),
      keepalive: true,
    }).then(async (response) => {
      if (!response.ok) throw new Error(await responseError(response));
    }).catch(() => showNotice("重命名暂未同步，请重试"));
    showNotice("对话已重命名");
  };

  const deleteConversation = (conversationId: string) => {
    turns
      .filter((turn) => turn.conversationId === conversationId)
      .forEach((turn) => {
        controllers.current.get(turn.id)?.abort();
        controllers.current.delete(turn.id);
      });
    const remainingConversations = conversations.filter(
      (conversation) => conversation.id !== conversationId,
    );
    setConversations(remainingConversations);
    const nextTurns = turnsRef.current.filter(
      (turn) => turn.conversationId !== conversationId,
    );
    turnsRef.current = nextTurns;
    setTurns(nextTurns);
    if (!remainingConversations.length) {
      setActiveConversationId(null);
      setScreen("home");
    } else if (activeConversationId === conversationId) {
      setActiveConversationId(
        remainingConversations[remainingConversations.length - 1].id,
      );
    }
    void fetch("/api/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "delete-conversation",
        conversationId,
      }),
      keepalive: true,
    }).then(async (response) => {
      if (!response.ok) throw new Error(await responseError(response));
    }).catch(() => showNotice("删除暂未同步，请重试"));
    showNotice("对话已删除");
  };

  const openNewConversation = () => {
    const id = `conversation-${crypto.randomUUID()}`;
    const conversation = {
      id,
      title: "新对话",
      createdAt: new Date().toISOString(),
    };
    setConversations((current) => [
      ...current,
      conversation,
    ]);
    void persistConversation(conversation).catch(() =>
      showNotice("新对话暂未保存，请检查网络"),
    );
    setActiveConversationId(id);
    setScreen("home");
    window.setTimeout(() => document.getElementById("main-prompt")?.focus(), 0);
  };

  if (screen === "studio") {
    return (
      <main className="studio" data-testid="studio">
        <AppSidebar
          screen={screen}
          conversations={conversations}
          turns={turns}
          activeConversationId={activeConversationId}
          onHome={() => setScreen("home")}
          onConversation={openConversation}
          onAssets={() => setScreen("assets")}
          onNewConversation={openNewConversation}
          onRename={renameConversation}
          onDelete={deleteConversation}
          session={session}
          sessionReady={sessionReady}
          onAccount={() => setAccountOpen(true)}
        />

        <section className="studio-main conversation-main">
          <header className="studio-header" id="conversation-top">
            <h1>{activeConversation?.title ?? conversationTitle}</h1>
            <span className="output-type">{activeTurns.length} 个任务</span>
          </header>

          <section className="conversation-stream" aria-label="创作对话">
            {activeTurns.map((turn, index) => {
              const generation = generationCopy[turn.kind];
              const total = progressTotal(turn);
              const ready = turn.kind === "listing"
                ? Boolean(turn.listing)
                : turn.completed === total && !turn.running;
              return (
                <article className="conversation-turn" id={turn.id} key={turn.id} data-testid={`conversation-turn-${index}`}>
                  <div className="user-message">
                    <div className="message-avatar">Y</div>
                    <div className="message-bubble">
                      <div className="message-materials">
                        {turn.referenceVideo ? (
                          <div className="message-reference-video">
                            <video
                              src={turn.referenceVideo}
                              muted
                              playsInline
                              preload="metadata"
                              aria-label="用户上传的参考视频"
                            />
                            <span aria-hidden="true">
                              <Play weight="fill" />
                            </span>
                            <small>参考视频</small>
                          </div>
                        ) : null}
                        {turn.referenceVideo ? (
                          <span className="message-material-plus" aria-hidden="true">
                            <Plus weight="bold" />
                          </span>
                        ) : null}
                        <div className="message-products" aria-label="本次任务的商品图片">
                          {(turn.productImages?.length ? turn.productImages : [turn.productImage])
                            .map((image, imageIndex) => (
                              <div className="message-product" key={`${turn.id}-input-${imageIndex}`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={image}
                                  alt={imageIndex === 0 ? "用户上传的商品主体" : `用户上传的商品参考图 ${imageIndex + 1}`}
                                />
                              </div>
                            ))}
                        </div>
                      </div>
                      <div className="message-copy">
                        <p>{turn.prompt}</p>
                        <div className="request-tags">
                          <span>{modes.find((item) => item.id === turn.mode)?.label}</span>
                          <span>{skills.find((item) => item.id === turn.skill)?.label}</span>
                          <span>{regions.find((item) => item.id === turn.region)?.label}</span>
                          <span>{languages.find((item) => item.id === turn.language)?.label}</span>
                          {hasSuiteSettings(turn.skill) ? (
                            <span>
                              主副图 {turn.suite.mainImageCount} · A+ {turn.suite.aPlusCount}
                              {" · "}{turn.suite.mainImageRatio}
                              {turn.suite.aPlusType === "advanced-mobile" ? " · 含手机 A+" : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="assistant-message">
                    <div className="message-avatar ai-avatar">M</div>
                    <div className="assistant-content">
                      <header className="assistant-head">
                        <div>
                          <h2>{skills.find((item) => item.id === turn.skill)?.label ?? generation.title}</h2>
                        </div>
                        <span>
                          {turn.kind === "listing" && turn.imageTaskCount
                            ? `1 个 Listing + ${turn.imageTaskCount} 张图片`
                            : turn.imageTaskCount
                              ? `${total} 张图片`
                              : generation.count}
                        </span>
                      </header>

                      <div className="generation-status">
                        <div>
                          <span className={turn.running ? "pulse-dot" : "done-dot"} />
                          <strong data-testid={`progress-${index}`}>
                            {turn.phase}
                          </strong>
                          <span>{turn.completed} / {total}</span>
                        </div>
                        {turn.running ? (
                          <button type="button" onClick={() => stopGeneration(turn.id)}>停止生成</button>
                        ) : turn.completed < total ? (
                          <button
                            type="button"
                            onClick={() => void runGeneration(
                              turn,
                              (turn.productImages?.length ? turn.productImages : [turn.productImage])
                                .map((url, imageIndex) => ({
                                  id: `${turn.id}-retry-${imageIndex}`,
                                  name: `reference-${imageIndex + 1}.png`,
                                  url,
                                })),
                              turn.referenceVideo
                                ? {
                                    id: `${turn.id}-reference-video`,
                                    name: turn.referenceVideoName || "reference-video.mp4",
                                    url: turn.referenceVideo,
                                  }
                                : undefined,
                            )}
                          >
                            重新生成
                          </button>
                        ) : null}
                      </div>
                      <div className="progress-meter" aria-hidden="true">
                        <span style={{ transform: `scaleX(${turn.completed / total})` }} />
                      </div>

                      <div className={`dynamic-result dynamic-${turn.kind}`}>
                        {turn.error ? (
                          <div className="generation-error" role="alert">
                            <strong>生成失败</strong>
                            <p>{turn.error}</p>
                          </div>
                        ) : null}
                        {turn.kind === "listing" && turn.agentText && !ready ? (
                          <pre className="agent-stream" aria-live="polite">
                            {turn.agentText}
                            <span aria-hidden="true">▋</span>
                          </pre>
                        ) : null}
                        {turn.kind === "listing" ? (
                          <ListingResult
                            key={turn.listing?.productUrlSlug ?? `${turn.id}-loading`}
                            turnId={turn.id}
                            productImage={turn.productImage}
                            language={turn.language}
                            region={turn.region}
                            data={turn.listing}
                            generatedImages={turn.images}
                            suite={turn.suite}
                            ready={ready}
                            onNotice={showNotice}
                            onListingChange={(listing) =>
                              patchTurn(turn.id, { listing })
                            }
                          />
                        ) : null}
                        {turn.kind === "images" ? (
                          <ImageSuite
                            turnId={turn.id}
                            skillId={turn.skill}
                            taskCount={turn.imageTaskCount ?? 6}
                            suite={turn.suite}
                            generatedImages={turn.images}
                            failedSlots={turn.failedImageSlots}
                            onPreview={(item, slot) => openPreview(turn, item, slot)}
                            onRegenerate={(item) => void regenerate(turn, item)}
                            regenerating={regenerating}
                          />
                        ) : null}
                        {turn.kind === "seeding" ? (
                          <ImageSuite
                            turnId={turn.id}
                            skillId={turn.skill}
                            taskCount={turn.imageTaskCount ?? 4}
                            suite={turn.suite}
                            generatedImages={turn.images}
                            failedSlots={turn.failedImageSlots}
                            onPreview={(item, slot) => openPreview(turn, item, slot)}
                            onRegenerate={(item) => void regenerate(turn, item)}
                            regenerating={regenerating}
                          />
                        ) : null}
                        {turn.kind === "single" ? (
                          <SingleImageResult
                            turnId={turn.id}
                            skillId={turn.skill}
                            generatedImage={turn.images?.[0]}
                            ready={ready}
                            onPreview={(item, slot) => openPreview(turn, item, slot)}
                            onRegenerate={(item) => void regenerate(turn, item)}
                            regenerating={regenerating}
                          />
                        ) : null}
                        {turn.kind === "video" ? (
                          <VideoResult
                            turnId={turn.id}
                            ready={ready}
                            productImage={turn.productImage}
                            videoUrl={turn.videoUrl}
                            onNotice={showNotice}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <div className={`studio-composer ${studioComposerMinimized ? "is-minimized" : ""}`}>
            <Composer
              key={`studio-composer-${mode}`}
              compact
              minimized={studioComposerMinimized}
              prompt={prompt}
              uploads={uploads}
              referenceVideo={referenceVideo}
              mode={mode}
              skill={skill}
              region={region}
              language={language}
              brand={brand}
              suite={suite}
              disabled={
                (skill !== "listing-replica" && !uploads.length) ||
                (skill === "video-replica" && !referenceVideo)
              }
              onPrompt={setPrompt}
              onFiles={handleFiles}
              onReferenceVideo={handleReferenceVideo}
              onRemoveReferenceVideo={removeReferenceVideo}
              onRemove={removeUpload}
              onSend={startGeneration}
              onMode={changeMode}
              onSkill={changeSkill}
              onRegion={setRegion}
              onLanguage={setLanguage}
              onBrand={setBrand}
              onSuite={setSuite}
              onExpand={() => {
                setStudioComposerMinimized(false);
                window.requestAnimationFrame(() => {
                  document.getElementById("conversation-prompt")?.focus();
                });
              }}
            />
          </div>
        </section>

        {preview ? (
          <PreviewModal
            preview={preview}
            prompt={previewPrompt}
            generating={previewGenerating}
            onPrompt={setPreviewPrompt}
            onSubmit={() => void editPreviewImage()}
            onClose={() => setPreview(null)}
          />
        ) : null}

        {accountOpen ? (
          <AccountPanel
            session={session}
            onSession={updateSession}
            onClose={() => setAccountOpen(false)}
          />
        ) : null}

        {notice ? <div className="toast" role="status" data-testid="toast">{notice}</div> : null}
      </main>
    );
  }

  if (screen === "assets") {
    return (
      <main className="studio" data-testid="assets-screen">
        <AppSidebar
          screen={screen}
          conversations={conversations}
          turns={turns}
          activeConversationId={activeConversationId}
          onHome={() => setScreen("home")}
          onConversation={openConversation}
          onAssets={() => setScreen("assets")}
          onNewConversation={openNewConversation}
          onRename={renameConversation}
          onDelete={deleteConversation}
          session={session}
          sessionReady={sessionReady}
          onAccount={() => setAccountOpen(true)}
        />
        <section className="studio-main assets-main">
          <AssetLibrary
            assets={assets}
            onPreview={(asset) => {
              setPreview({
                id: asset.id,
                group: "生成资产",
                title: asset.title,
                image: asset.url,
                turnId: "",
                slot: 0,
              });
              setPreviewPrompt("");
            }}
          />
        </section>
        {preview ? (
          <PreviewModal
            preview={preview}
            prompt={previewPrompt}
            generating={previewGenerating}
            onPrompt={setPreviewPrompt}
            onSubmit={() => void editPreviewImage()}
            onClose={() => setPreview(null)}
          />
        ) : null}
        {accountOpen ? (
          <AccountPanel
            session={session}
            onSession={updateSession}
            onClose={() => setAccountOpen(false)}
          />
        ) : null}
        {notice ? <div className="toast" role="status" data-testid="toast">{notice}</div> : null}
      </main>
    );
  }

  return (
    <main className="studio home-shell">
      <AppSidebar
        screen={screen}
        conversations={conversations}
        turns={turns}
        activeConversationId={activeConversationId}
        onHome={() => setScreen("home")}
        onConversation={openConversation}
        onAssets={() => setScreen("assets")}
        onNewConversation={openNewConversation}
        onRename={renameConversation}
        onDelete={deleteConversation}
        session={session}
        sessionReady={sessionReady}
        onAccount={() => setAccountOpen(true)}
      />
      <section className="home-workspace" id="create">
        {selectedInspiration ? (
          <InspirationTemplatePreview
            item={selectedInspiration}
            onClose={() => setSelectedInspiration(null)}
            onUse={(item) => {
              applyInspirationCase(item);
              setSelectedInspiration(null);
            }}
          />
        ) : <>
        <div className="home-stage">
          <header className="home-discovery-head">
            <div className="home-copy">
              <h1>一张商品图，生成亚马逊链接</h1>
            </div>
            <button type="button" className="sample-button" data-testid="sample-product" onClick={() => {
              addSample();
              setHomeComposerMinimized(false);
            }}>使用示例商品</button>
          </header>
          {!homeComposerMinimized ? (
            <div className="home-inline-composer">
              <Composer
                key={`home-inline-composer-${mode}`}
                compact
                prompt={prompt}
                uploads={uploads}
                referenceVideo={referenceVideo}
                mode={mode}
                skill={skill}
                region={region}
                language={language}
                brand={brand}
                suite={suite}
                disabled={
                  (skill !== "listing-replica" && !uploads.length) ||
                  (skill === "video-replica" && !referenceVideo)
                }
                onPrompt={setPrompt}
                onFiles={handleFiles}
                onReferenceVideo={handleReferenceVideo}
                onRemoveReferenceVideo={removeReferenceVideo}
                onRemove={removeUpload}
                onSend={startGeneration}
                onMode={changeMode}
                onSkill={changeSkill}
                onRegion={setRegion}
                onLanguage={setLanguage}
                onBrand={setBrand}
                onSuite={setSuite}
              />
              <button
                type="button"
                className="home-composer-collapse"
                aria-label="收起输入框"
                onClick={() => setHomeComposerMinimized(true)}
              >
                <CaretDown weight="bold" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <QuickCapabilities onSelect={selectCapability} />
          <InspirationGallery onOpen={setSelectedInspiration} />
        </div>
        {homeComposerMinimized ? <div className="home-fixed-composer is-minimized">
          <Composer
            key={`home-composer-${mode}`}
            compact
            minimized
            prompt={prompt}
            uploads={uploads}
            referenceVideo={referenceVideo}
            mode={mode}
            skill={skill}
            region={region}
            language={language}
            brand={brand}
            suite={suite}
            disabled={
              (skill !== "listing-replica" && !uploads.length) ||
              (skill === "video-replica" && !referenceVideo)
            }
            onPrompt={setPrompt}
            onFiles={handleFiles}
            onReferenceVideo={handleReferenceVideo}
            onRemoveReferenceVideo={removeReferenceVideo}
            onRemove={removeUpload}
            onSend={startGeneration}
            onMode={changeMode}
            onSkill={changeSkill}
            onRegion={setRegion}
            onLanguage={setLanguage}
            onBrand={setBrand}
            onSuite={setSuite}
            onExpand={() => setHomeComposerMinimized(false)}
          />
        </div> : null}
        </>}
      </section>
      {accountOpen ? (
        <AccountPanel
          session={session}
          onSession={updateSession}
          onClose={() => setAccountOpen(false)}
        />
      ) : null}
    </main>
  );
}
