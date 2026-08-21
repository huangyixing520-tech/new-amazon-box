"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ClipboardEvent,
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
  CopySimple,
  DownloadSimple,
  DotsThree,
  House,
  Images,
  Info,
  LinkSimple,
  Play,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import AccountPanel, { type ClientSession } from "../account-panel";
import {
  CONVERSATION_PERIODS,
  conversationPeriod,
} from "../conversation-period.mjs";
import { floatingPopoverLayout } from "../floating-popover.mjs";
import { parseFirstJsonObject } from "../first-json-object.mjs";
import { openAiResponseLine } from "../openai-content.mjs";
import { imageOutputSpec } from "../image-output-spec.mjs";
import { imageTaskCount } from "../image-task-count.mjs";
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODEL_OPTIONS,
} from "../image-models.mjs";
import {
  DEFAULT_VIDEO_MODEL,
  VIDEO_MODEL_OPTIONS,
} from "../video-models.mjs";
import {
  DEFAULT_VIDEO_DURATION_SECONDS,
  DEFAULT_VIDEO_RATIO,
  VIDEO_DURATION_OPTIONS,
  VIDEO_RATIO_OPTIONS,
} from "../video-settings.mjs";

type Option = {
  id: string;
  label: string;
  description?: string;
};

type Upload = {
  id: string;
  name: string;
  url: string;
  assetId?: string;
  owned?: boolean;
  file?: File;
  mediaType?: "image" | "video";
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
  keywords?: Record<"core" | "highWeight" | "title" | "bullet" | "description" | "backend", string[]>;
};

type Turn = {
  id: string;
  conversationId: string;
  createdAt: string;
  title: string;
  prompt: string;
  mode: GenerationMode;
  generationModel?: string;
  videoRatio?: string;
  videoDuration?: number;
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
  imageGenerationIds?: string[];
  failedImageSlots?: number[];
  videoUrl?: string;
  videoGenerationId?: string;
};

const MAX_UPLOADS = 9;
const MAX_REFERENCE_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_TASK_CONCURRENCY = 10;
const STUDIO_SETTINGS_KEY = "mercato-studio-settings-v1";

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  unread?: boolean;
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
  generationId?: string;
  role?: "input" | "output";
  slot?: number;
  createdAt: string;
};

type InspirationCase = {
  id: string;
  tab?: "featured" | "image" | "video";
  tabs?: Array<"featured" | "image" | "video">;
  mode: GenerationMode;
  skill: string;
  title: string;
  description: string;
  prompt: string;
  images: string[];
  inputImages?: string[];
  layout: "suite" | "portrait" | "landscape";
  orderByTab?: Partial<Record<"featured" | "image" | "video", number>>;
  createdAt?: string;
  suite?: Partial<SuiteSettings>;
};

function ProductionId({
  id,
  onNotice,
}: {
  id?: string;
  onNotice?: (text: string) => void;
}) {
  if (!id) return null;

  return (
    <button
      type="button"
      className="production-id"
      title="复制完整生成 ID"
      onClick={() => {
        void navigator.clipboard.writeText(id)
          .then(() => onNotice?.("生成 ID 已复制"))
          .catch(() => onNotice?.("生成 ID 复制失败"));
      }}
    >
      <span>复制生成 ID</span>
      <CopySimple aria-hidden="true" weight="bold" />
    </button>
  );
}

function assetDownloadUrl(url: string, format: "png" | "jpg" = "png") {
  if (!url.startsWith("/api/assets/")) return url;
  return `${url.split("?")[0]}?download=1&format=${format}`;
}

function assetPreviewUrl(url: string) {
  if (!url.startsWith("/api/assets/")) return url;
  return `${url.split("?")[0]}?preview=1`;
}

function safeDownloadName(value: string) {
  return value.replace(/[\\/:*?"<>|\r\n]+/g, "-").trim() || "mercato-image";
}

function saveDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function fetchImageBlob(url: string, format: "png" | "jpg" = "png") {
  const response = await fetch(assetDownloadUrl(url, format), { credentials: "same-origin" });
  if (!response.ok) throw new Error(await responseError(response));
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("下载文件不是有效图片");
  return blob;
}

async function fetchDownload(url: string, title: string, format: "png" | "jpg" = "png") {
  const blob = await fetchImageBlob(url, format);
  saveDownload(blob, `${safeDownloadName(title)}.${format}`);
}

type GenerationSummary = {
  status: "complete" | "partial" | "failed";
  completed: number;
  expected: number;
  failed: number;
  reason?: string;
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

const videoModels: Option[] = VIDEO_MODEL_OPTIONS;
const imageModels: Option[] = IMAGE_MODEL_OPTIONS;

const skills: SkillOption[] = [
  {
    id: "amazon-image-set",
    mode: "image",
    kind: "images",
    label: "商品套图",
    description: "生成卖点图、A+ 图与可选手机 A+ 图",
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
    description: "生成标题、卖点、描述、卖点图与 A+ 内容",
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
    image: "/product-lifestyle.webp",
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
    image: "/product-outdoor.webp",
  },
  {
    id: "quick-image-suite",
    mode: "image",
    skill: "amazon-image-set",
    title: "套图生成",
    body: "卖点图与 A+ 图一次生成",
    image: "/product-main.webp",
  },
  {
    id: "quick-talking-video",
    mode: "video",
    skill: "talking-product-video",
    title: "带货口播",
    body: "生成 15 秒商品口播与演示",
    image: "/product-lifestyle.webp",
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
    description: "卖点图、A+ 内容与 Listing 文案",
    prompt: "为这款便携咖啡机生成完整亚马逊 Listing，突出便携、自加热与户外使用场景",
    images: ["/product-main.webp", "/product-lifestyle.webp", "/product-outdoor.webp"],
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
    images: ["/product-outdoor.webp", "/product-main.webp", "/product-lifestyle.webp"],
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
    images: ["/product-lifestyle.webp"],
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
    images: ["/product-main.webp", "/product-lifestyle.webp"],
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
    images: ["/product-outdoor.webp"],
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
    images: ["/product-main.webp"],
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
    image: "/product-main.webp",
  },
  {
    id: "feature",
    group: "副图 1:1",
    title: "轻巧便携",
    image: "/product-main.webp",
    crop: "crop-detail",
  },
  {
    id: "travel",
    group: "副图 1:1",
    title: "旅居咖啡场景",
    image: "/product-lifestyle.webp",
  },
  {
    id: "outdoor",
    group: "副图 1:1",
    title: "户外清晨",
    image: "/product-outdoor.webp",
  },
  {
    id: "a-plus-one",
    group: "A+ 1464 × 600",
    title: "随时享用新鲜意式咖啡",
    image: "/product-lifestyle.webp",
    wide: true,
  },
  {
    id: "a-plus-two",
    group: "A+ 1464 × 600",
    title: "从办公室到露营地",
    image: "/product-outdoor.webp",
    wide: true,
  },
];

const seedingGallery: GalleryItem[] = [
  {
    id: "seeding-cover",
    group: "种草图 01 · 3:4",
    title: "今天的随身咖啡搭子",
    image: "/product-lifestyle.webp",
  },
  {
    id: "seeding-detail",
    group: "种草图 02 · 3:4",
    title: "小机身，也有浓郁油脂",
    image: "/product-main.webp",
    crop: "crop-detail",
  },
  {
    id: "seeding-outdoor",
    group: "种草图 03 · 3:4",
    title: "露营也能喝到现萃",
    image: "/product-outdoor.webp",
  },
  {
    id: "seeding-routine",
    group: "种草图 04 · 3:4",
    title: "三分钟完成咖啡仪式",
    image: "/product-lifestyle.webp",
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
      const aPlusSize = suite.aPlusType === "standard" ? "970×600" : "1464×600";
      return {
        id: `${skillId}-${slot.type}-${slot.index}`,
        group: isMobile
          ? `手机 A+ ${slot.index + 1} · 600×450`
          : isAPlus
            ? `A+ 图 ${slot.index + 1} · ${aPlusSize}`
            : `卖点图 ${slot.index + 1} · ${suite.mainImageRatio}`,
        title: isMobile
          ? `手机 A+ 图 ${slot.index + 1}`
          : isAPlus
            ? `A+ 图 ${slot.index + 1}`
            : `商品卖点图 ${slot.index + 1}`,
        image: index < gallery.length ? gallery[index].image : "/product-main.webp",
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
    image: "/product-main.webp",
  }));
}

function progressTotal(turn: Turn) {
  if (turn.kind === "listing" && turn.imageTaskCount) {
    return turn.imageTaskCount + 1;
  }
  return turn.imageTaskCount ?? generationCopy[turn.kind].phases.length;
}

function isListingReady(turn: Turn) {
  return turn.kind === "listing" && Boolean(turn.listing);
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

function useFloatingPopover(open: boolean, minWidth: number) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open) return;

    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const popover = popoverRef.current;
      if (!anchor || !popover) return;

      const layout = floatingPopoverLayout({
        anchor,
        popoverWidth: Math.max(minWidth, anchor.width),
        popoverHeight: popover.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
      setStyle({
        position: "fixed",
        top: layout.top,
        left: layout.left,
        width: layout.width,
        maxHeight: layout.maxHeight,
        visibility: "visible",
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [minWidth, open]);

  return { anchorRef, popoverRef, style };
}

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
  const { anchorRef: menuRef, popoverRef, style } = useFloatingPopover(open, rich ? 340 : 210);

  useEffect(() => {
    if (!open || !onDismiss) return;

    const dismissOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !popoverRef.current?.contains(target)) onDismiss();
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
  }, [menuRef, onDismiss, open, popoverRef]);

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
      {open && typeof document !== "undefined" ? createPortal(
        <div
          className={`option-popover ${rich ? "option-popover-rich" : ""}`}
          ref={popoverRef}
          style={style}
          data-floating-popover
          role="listbox"
          aria-label={label}
        >
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
        </div>,
        document.body,
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
  const { anchorRef, popoverRef, style } = useFloatingPopover(open, 330);

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
    <div className="brand-color-control" ref={anchorRef}>
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

      {open && typeof document !== "undefined" ? createPortal(
        <div
          className="brand-color-popover"
          ref={popoverRef}
          style={style}
          data-floating-popover
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
        </div>,
        document.body,
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
  const isVideo = upload.mediaType === "video";
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
      aria-label={`预览${isVideo ? "视频" : "图片"} ${upload.name}`}
      data-testid="upload-preview-modal"
      onClick={onClose}
    >
      <button
        type="button"
        className="upload-preview-close"
        aria-label={`关闭${isVideo ? "视频" : "图片"}预览`}
        onClick={onClose}
      >
        <X aria-hidden="true" weight="bold" />
      </button>
      <figure
        className="upload-preview-content"
        onClick={(event) => event.stopPropagation()}
      >
        {isVideo ? (
          <video src={upload.url} controls autoPlay playsInline preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={upload.url} alt={upload.name} />
        )}
        <figcaption>
          <span>{isVideo ? "参考视频" : "参考图片"}</span>
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
  const expandedDeckWidth =
    uploads.length > 1
      ? (atLimit
          ? 10 + (uploads.length - 1) * 84 + 74
          : 13 + uploads.length * 84 + 72) + 16
      : 136;

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
          "--deck-expanded-width": `${expandedDeckWidth}px`,
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
  generationModel,
  videoRatio,
  videoDuration,
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
  onGenerationModel,
  onVideoRatio,
  onVideoDuration,
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
  generationModel: string;
  videoRatio: string;
  videoDuration: number;
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
  onGenerationModel: (value: string) => void;
  onVideoRatio: (value: string) => void;
  onVideoDuration: (value: number) => void;
  onSkill: (value: string) => void;
  onRegion: (value: string) => void;
  onLanguage: (value: string) => void;
  onBrand: (value: BrandSettings) => void;
  onSuite: (value: SuiteSettings) => void;
  onExpand?: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openBrandMenu, setOpenBrandMenu] = useState<string | null>(null);
  const [suiteSettingsOpen, setSuiteSettingsOpen] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<Upload | null>(null);
  const [promptIdea, setPromptIdea] = useState(0);
  const [promptIdeaText, setPromptIdeaText] = useState(promptIdeasByMode[mode][0]);
  const [deletingPromptIdea, setDeletingPromptIdea] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const brandGeneTriggerRef = useRef<HTMLDivElement>(null);
  const brandGenePanelRef = useRef<HTMLElement>(null);
  const suiteSettingsTriggerRef = useRef<HTMLDivElement>(null);
  const suiteSettingsPanelRef = useRef<HTMLElement>(null);
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
    if (openMenu !== "brand-gene" && !suiteSettingsOpen) return;

    const dismissBrandGeneAndSuiteSettings = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        brandGeneTriggerRef.current?.contains(target) ||
        brandGenePanelRef.current?.contains(target) ||
        suiteSettingsTriggerRef.current?.contains(target) ||
        suiteSettingsPanelRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-floating-popover]"))
      ) return;
      setOpenMenu(null);
      setOpenBrandMenu(null);
      setSuiteSettingsOpen(false);
    };
    const dismissSettingsOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setOpenBrandMenu(null);
        setSuiteSettingsOpen(false);
      }
    };

    document.addEventListener("pointerdown", dismissBrandGeneAndSuiteSettings);
    document.addEventListener("keydown", dismissSettingsOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissBrandGeneAndSuiteSettings);
      document.removeEventListener("keydown", dismissSettingsOnEscape);
    };
  }, [openMenu, suiteSettingsOpen]);

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

  const pasteImages = (
    event: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const images = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (!images.length) return;
    event.preventDefault();
    onFiles(images.slice(0, Math.max(0, MAX_UPLOADS - uploads.length)));
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
                onPaste={pasteImages}
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
              onPaste={pasteImages}
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
                ? "请至少选择 1 张卖点图或 A+ 图"
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
                    onPaste={pasteImages}
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
                  onPaste={pasteImages}
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
              setSuiteSettingsOpen(false);
            }}
            accent
            testId="mode-trigger"
          />
          <OptionMenu
            label={mode === "video" ? "选择视频模型" : "选择图片模型"}
            options={mode === "video" ? videoModels : imageModels}
            value={generationModel}
            open={openMenu === "model"}
            onOpen={() => setOpenMenu(openMenu === "model" ? null : "model")}
            onDismiss={() => setOpenMenu(null)}
            onChange={(value) => {
              onGenerationModel(value);
              setOpenMenu(null);
            }}
            prefix="模型"
            testId="model-trigger"
          />
          {mode === "video" ? (
            <>
              <OptionMenu
                label="选择视频尺寸"
                options={VIDEO_RATIO_OPTIONS}
                value={videoRatio}
                open={openMenu === "video-ratio"}
                onOpen={() => setOpenMenu(openMenu === "video-ratio" ? null : "video-ratio")}
                onDismiss={() => setOpenMenu(null)}
                onChange={(value) => {
                  onVideoRatio(value);
                  setOpenMenu(null);
                }}
                prefix="尺寸"
                testId="video-ratio-trigger"
              />
              <OptionMenu
                label="选择视频时长"
                options={VIDEO_DURATION_OPTIONS}
                value={String(videoDuration)}
                open={openMenu === "video-duration"}
                onOpen={() => setOpenMenu(openMenu === "video-duration" ? null : "video-duration")}
                onDismiss={() => setOpenMenu(null)}
                onChange={(value) => {
                  onVideoDuration(Number(value));
                  setOpenMenu(null);
                }}
                prefix="时长"
                testId="video-duration-trigger"
              />
            </>
          ) : null}
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
              setSuiteSettingsOpen(false);
            }}
            prefix="技能"
            rich
            testId="skill-trigger"
          />
          {hasSuiteSettings(skill) ? (
            <div className="suite-settings-control" ref={suiteSettingsTriggerRef}>
              <button
                type="button"
                className="option-trigger suite-settings-trigger"
                aria-expanded={suiteSettingsOpen}
                aria-controls={compact ? "compact-suite-settings-panel" : "suite-settings-panel"}
                data-testid="suite-settings-trigger"
                onClick={() => {
                  setOpenMenu(null);
                  setSuiteSettingsOpen((current) => !current);
                }}
              >
                <span>生成设置</span>
                <b className="suite-settings-summary">
                  卖点 {suite.mainImageCount} · A+ {suite.aPlusCount}
                </b>
                <span className="chevron" aria-hidden="true">
                  {suiteSettingsOpen
                    ? <CaretUp weight="bold" />
                    : <CaretDown weight="bold" />}
                </span>
              </button>
            </div>
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
                ? "请至少选择 1 张卖点图或 A+ 图"
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

        {suiteSettingsOpen && hasSuiteSettings(skill) ? (
        <section
          className="suite-settings-panel"
          id={compact ? "compact-suite-settings-panel" : "suite-settings-panel"}
          data-testid="suite-settings-panel"
          aria-label="套图生成设置"
          ref={suiteSettingsPanelRef}
        >
          <header className="suite-settings-head">
            <strong>套图生成设置</strong>
            <small>设置图片类型、数量与比例</small>
          </header>
          <div className="suite-settings-field">
            <span>A+ 类型</span>
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
              testId="a-plus-type-trigger"
            />
          </div>
          <div className="suite-settings-field">
            <span>A+ 图数量</span>
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
              testId="a-plus-count-trigger"
            />
          </div>
          <div className="suite-settings-field">
            <span>卖点图比例</span>
            <OptionMenu
              label="卖点图比例"
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
              testId="main-image-ratio-trigger"
            />
          </div>
          <div className="suite-settings-field">
            <span>卖点图数量</span>
            <OptionMenu
              label="卖点图数量"
              options={mainImageCounts}
              value={String(suite.mainImageCount)}
              open={openMenu === "main-image-count"}
              onOpen={() => setOpenMenu(openMenu === "main-image-count" ? null : "main-image-count")}
              onDismiss={() => setOpenMenu(null)}
              onChange={(value) => {
                onSuite({ ...suite, mainImageCount: Number(value) });
                setOpenMenu(null);
              }}
              testId="main-image-count-trigger"
            />
          </div>
        </section>
        ) : null}

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
  language,
  region,
  data,
  generatedImages = [],
  taskCount,
  generationIds = [],
  failedSlots = [],
  suite,
  ready,
  onNotice,
  onListingChange,
  onGeneratedImageError,
  onRegenerate,
  regenerating,
}: {
  turnId: string;
  language: string;
  region: string;
  data?: ListingData;
  generatedImages?: string[];
  taskCount: number;
  generationIds?: string[];
  failedSlots?: number[];
  suite: SuiteSettings;
  ready: boolean;
  onNotice: (text: string) => void;
  onListingChange: (listing: ListingData) => void;
  onGeneratedImageError: (url: string) => void;
  onRegenerate: (item: GalleryItem) => void;
  regenerating: string | null;
}) {
  const copy = listingCopy[language as keyof typeof listingCopy] ?? listingCopy.en;
  const keywordGroups = data?.keywords
    ? Object.entries(data.keywords).filter(([, values]) => values?.length)
    : [];
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
  const listingSlotItems = suiteItems("amazon-listing", taskCount, suite).map(
    (item, index) => ({
      item,
      index,
      image: generatedImages[index] ?? "",
      productionId: generationIds[index] ?? "",
      failed: failedSlots.includes(index),
    }),
  );
  const listingImages = listingSlotItems.slice(0, suite.mainImageCount);
  const generatedAPlusImages = listingSlotItems.slice(
    suite.mainImageCount,
    suite.mainImageCount + suite.aPlusCount,
  );
  const generatedMobileAPlusImages = listingSlotItems.slice(
    suite.mainImageCount + suite.aPlusCount,
  );
  const completedListingImages = listingImages.flatMap(({ item, image }) => image && regenerating !== item.id ? [image] : []);
  const completedAPlusImages = generatedAPlusImages.flatMap(({ image }) => image ? [image] : []);
  const completedMobileAPlusImages = generatedMobileAPlusImages.flatMap(({ image }) => image ? [image] : []);
  const shownGalleryImage = galleryImage || completedListingImages[0] || "";
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
      <div
        className="listing-shell listing-loading"
        data-testid="listing-loading-skeleton"
        aria-label="正在生成 Amazon Listing"
        aria-busy="true"
      >
        <div className="listing-loader-nav">
          <i className="listing-loader-logo" />
          <i className="listing-loader-delivery" />
          <i className="listing-loader-search" />
          <i className="listing-loader-account" />
          <i className="listing-loader-cart" />
        </div>
        <div className="listing-loader-subnav">
          <i /><i /><i /><i /><i />
        </div>
        <div className="listing-loader-toolbar">
          <i /><i />
        </div>
        <div className="listing-loader-breadcrumb"><i /></div>
        <div className="listing-loader-product">
          <div className="listing-loader-gallery">
            <div className="listing-loader-thumbs"><i /><i /><i /><i /></div>
            <i className="listing-loader-image" />
          </div>
          <div className="listing-loader-copy">
            <i className="loader-line loader-line-title" />
            <i className="loader-line loader-line-title-short" />
            <i className="loader-line loader-line-store" />
            <i className="loader-line loader-line-rating" />
            <hr />
            <i className="loader-line loader-line-price" />
            <i className="loader-line loader-line-meta" />
            <i className="loader-line loader-line-swatch" />
            <i className="loader-line loader-line-heading" />
            <i className="loader-line" />
            <i className="loader-line" />
            <i className="loader-line loader-line-short" />
          </div>
          <div className="listing-loader-buybox">
            <i className="loader-line loader-line-price" />
            <i className="loader-line" />
            <i className="loader-line loader-line-short" />
            <i className="listing-loader-button" />
            <i className="listing-loader-button secondary" />
            <i className="loader-line" />
            <i className="loader-line loader-line-short" />
          </div>
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
      images: completedAPlusImages,
      mobileImages: completedMobileAPlusImages,
    },
    specifications: Object.fromEntries(specs),
    images: completedListingImages,
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
              ({ item, index, image, failed }) => (
                (() => {
                  const isRegenerating = regenerating === item.id;
                  const isReady = Boolean(image) && !isRegenerating;
                  const isFailed = failed && !isRegenerating;
                  return (
                <button
                  type="button"
                  className={`${shownGalleryImage === image && isReady ? "selected" : ""} ${isFailed ? "is-failed" : isReady ? "is-ready" : "is-pending"}`}
                  onClick={() => {
                    if (isReady) setGalleryImage(image);
                    else if (isFailed) onRegenerate(item);
                  }}
                  disabled={!isReady && !isFailed}
                  aria-label={`查看商品图 ${index + 1}`}
                  key={item.id}
                  data-testid={`listing-thumb-${index}`}
                  title={item.title}
                >
                  {isReady ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={assetPreviewUrl(image)} alt="" onError={() => onGeneratedImageError(image)} />
                  ) : isFailed ? (
                    <span className="listing-slot-failed">重试本张</span>
                  ) : (
                    <span className="listing-slot-shimmer" aria-label="正在生成" />
                  )}
                </button>
                  );
                })()
              ),
            )}
          </div>
          <div className="market-main-image">
            {shownGalleryImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetPreviewUrl(shownGalleryImage)}
                  alt={title}
                  onError={() => onGeneratedImageError(shownGalleryImage)}
                />
                <span>移动鼠标放大图片</span>
              </>
            ) : (
              <div className="listing-main-placeholder">
                <i className="listing-slot-shimmer" />
                <span>正在生成商品图</span>
              </div>
            )}
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
                  <img src={assetPreviewUrl(listingImages[0])} alt="" />
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

      {keywordGroups.length ? (
        <section className="product-details listing-keywords" aria-label="Listing 关键词">
          <h2>关键词布局</h2>
          <div className="details-grid">
            {keywordGroups.map(([group, values]) => (
              <p key={group}><b>{group}</b><br />{values.join(" · ")}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="a-plus">
        <p className="a-plus-label">Product description</p>
        <div className="a-plus-copy-editor">
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
            rows={4}
          />
        </div>
        {generatedAPlusImages.length ? (
          <div
            className={`listing-a-plus-gallery ${suite.aPlusType === "standard" ? "is-standard" : "is-advanced"}`}
            aria-label="生成的 A+ 图片"
          >
            {generatedAPlusImages.map(({ item, index, image, failed }) => (
              (() => {
                const isRegenerating = regenerating === item.id;
                const isReady = Boolean(image) && !isRegenerating;
                const isFailed = failed && !isRegenerating;
                return (
              <div
                className={`listing-a-plus-slot ${isFailed ? "is-failed" : isReady ? "is-ready" : "is-pending"}`}
                data-testid={`listing-a-plus-slot-${index}`}
                key={item.id}
                title={item.title}
              >
                {isReady ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetPreviewUrl(image)} alt={`A+ 图片 ${index + 1}`} onError={() => onGeneratedImageError(image)} />
                ) : isFailed ? (
                  <button type="button" onClick={() => onRegenerate(item)}>重试本张</button>
                ) : (
                  <span className="listing-slot-shimmer" aria-label="正在生成" />
                )}
              </div>
                );
              })()
            ))}
          </div>
        ) : null}
        {generatedMobileAPlusImages.length ? (
          <div className="listing-mobile-a-plus" aria-label="生成的手机 A+ 图片">
            {generatedMobileAPlusImages.map(({ item, index, image, failed }) => (
              (() => {
                const isRegenerating = regenerating === item.id;
                const isReady = Boolean(image) && !isRegenerating;
                const isFailed = failed && !isRegenerating;
                return (
              <div
                className={`listing-mobile-a-plus-slot ${isFailed ? "is-failed" : isReady ? "is-ready" : "is-pending"}`}
                data-testid={`listing-mobile-a-plus-slot-${index}`}
                key={item.id}
                title={item.title}
              >
                {isReady ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetPreviewUrl(image)} alt={`手机 A+ 图片 ${index + 1}`} onError={() => onGeneratedImageError(image)} />
                ) : isFailed ? (
                  <button type="button" onClick={() => onRegenerate(item)}>重试本张</button>
                ) : (
                  <span className="listing-slot-shimmer" aria-label="正在生成" />
                )}
              </div>
                );
              })()
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
  onDownload,
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
  onDownload: (item: GalleryItem) => void;
  onRegenerate: (item: GalleryItem) => void;
  regenerating: string | null;
}) {
  const isSeeding = skillId === "china-seeding-image";
  const items: GalleryItem[] = suiteItems(skillId, taskCount, suite).map((item, index): GalleryItem => ({
    ...item,
    image: generatedImages[index] ?? item.image,
  }));
  const groups = items.reduce<Array<{ key: string; title: string; items: Array<{ item: GalleryItem; index: number }> }>>(
    (current, item, index) => {
      const slot = hasSuiteSettings(skillId) ? suiteSlot(suite ?? defaultSuiteSettings, index) : null;
      const key = slot?.type ?? (item.wide ? "wide" : item.portrait ? "portrait" : "square");
      const groupTitle = slot?.type === "main"
        ? "主副图"
        : slot?.type === "a-plus-mobile"
          ? "手机 A+ 图"
          : slot?.type === "a-plus"
            ? `${suite?.aPlusType === "standard" ? "普通" : "高级"} A+ 图`
            : isSeeding
              ? "种草图"
              : item.wide
                ? "横版图"
                : item.portrait
                  ? "竖版图"
                  : "方形图";
      const group = current.find((candidate) => candidate.key === key);
      if (group) group.items.push({ item, index });
      else current.push({ key, title: groupTitle, items: [{ item, index }] });
      return current;
    },
    [],
  );

  return (
    <section className={`image-suite ${isSeeding ? "seeding-suite" : ""}`} data-testid="image-result">
      {groups.map((group) => (
        <section className={`result-ratio-group is-${group.key}`} key={group.key}>
          <header>
            <h3>{group.title}</h3>
            <span>{group.items.length} 张</span>
          </header>
          <div className="asset-grid" aria-live="polite">
        {group.items.map(({ item, index }) => {
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
                <div className="asset-image-shell">
                  <button
                    type="button"
                    className="asset-visual"
                    onClick={() => onPreview(item, index)}
                    aria-label={`预览 ${item.title}`}
                    data-testid={`preview-image-${index}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetPreviewUrl(item.image)} alt={item.title} className={item.crop ?? ""} />
                  </button>
                  <button
                        type="button"
                        onClick={() => onDownload(item)}
                        data-analytics-event="asset_downloaded"
                        data-turn-id={turnId}
                        aria-label={`下载 ${item.title}`}
                        title={`下载 ${item.title}`}
                        className="artifact-download asset-hover-download"
                      >
                        <DownloadSimple aria-hidden="true" weight="bold" />
                  </button>
                </div>
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
      ))}
    </section>
  );
}

const singleImageOutputs: Record<string, GalleryItem> = {
  "amazon-scene-image": {
    id: "amazon-scene-output",
    group: "Amazon 场景图 · 1:1",
    title: "清晨露营咖啡时刻",
    image: "/product-outdoor.webp",
  },
  "china-ecommerce-main-image": {
    id: "china-main-output",
    group: "国内电商主图 · 1:1",
    title: "随时随地，一键现萃",
    image: "/product-lifestyle.webp",
  },
  "white-background-image": {
    id: "white-background-output",
    group: "平台白底图 · 1:1",
    title: "纯白背景商品精修",
    image: "/product-main.webp",
  },
};

function SingleImageResult({
  turnId,
  skillId,
  generatedImage,
  ready,
  onPreview,
  onDownload,
  regenerating,
}: {
  turnId: string;
  skillId: string;
  generatedImage?: string;
  ready: boolean;
  onPreview: (item: GalleryItem, slot: number) => void;
  onDownload: (item: GalleryItem) => void;
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
          <div className="asset-image-shell">
            <button
              type="button"
              className="single-asset-visual"
              onClick={() => onPreview(item, 0)}
              aria-label={`预览 ${item.title}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetPreviewUrl(item.image)} alt={item.title} />
            </button>
            <button
                  type="button"
                  onClick={() => onDownload(item)}
                  data-analytics-event="asset_downloaded"
                  data-turn-id={turnId}
                  aria-label={`下载 ${item.title}`}
                  title={`下载 ${item.title}`}
                  className="artifact-download asset-hover-download"
                >
                  <DownloadSimple aria-hidden="true" weight="bold" />
            </button>
          </div>
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
  videoUrl,
}: {
  turnId: string;
  ready: boolean;
  videoUrl?: string;
}) {
  if (!ready) {
    return (
      <section className="video-result video-loading" data-testid="video-result">
        <div /><i /><i />
      </section>
    );
  }

  return (
    <section className="video-result video-result-simple" data-testid="video-result">
      <div className="video-artifact">
        <video
          controls
          playsInline
          preload="metadata"
          aria-label="生成的视频"
          data-testid="generated-video"
        >
          <source src={videoUrl ?? "/api/demo-video"} type="video/mp4" />
        </video>
        <footer>
        <a
          href={videoUrl ?? "/product-demo.mp4"}
          download
          data-analytics-event="asset_downloaded"
          data-turn-id={turnId}
          aria-label="下载视频"
          title="下载视频"
          className="artifact-download"
        >
          <DownloadSimple aria-hidden="true" weight="bold" />
        </a>
        </footer>
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
  onRename: (conversationId: string, title: string) => void;
  onDelete: (conversationId: string) => void;
  session: ClientSession;
  sessionReady: boolean;
  onAccount: () => void;
}) {
  const orderedConversations = [...conversations].sort((left, right) =>
    new Date(right.updatedAt ?? right.createdAt).getTime()
      - new Date(left.updatedAt ?? left.createdAt).getTime()
  );
  const conversationGroups = CONVERSATION_PERIODS.map((period) => ({
    ...period,
    conversations: orderedConversations.filter((conversation) =>
      conversationPeriod(conversation.updatedAt ?? conversation.createdAt) === period.id
    ),
  })).filter((group) => group.conversations.length > 0);
  const latestConversation = orderedConversations[0];
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
      <nav className="conversation-list" aria-label="全部对话">
        <span className="nav-caption">
          {conversations.length ? "创作历史" : "还没有生成记录"}
        </span>
        {conversationGroups.map((group) => (
          <section className="conversation-group" aria-labelledby={`conversation-group-${group.id}`} key={group.id}>
            <h2 id={`conversation-group-${group.id}`}>{group.label}</h2>
            {group.conversations.map((conversation) => {
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
                  <span className="conversation-title-row">
                    <strong>{conversation.title}</strong>
                    {conversation.unread ? <i className="conversation-unread" aria-label="有新内容未查看" /> : null}
                  </span>
                  <small>
                    {runningCount
                      ? `${runningCount} 个任务生成中`
                      : `${conversationTurns.length} 个任务`}
                  </small>
                </button>
              );
            })}
          </section>
        ))}
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

function assetTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function AssetLibrary({
  assets,
  onPreview,
  onDelete,
}: {
  assets: AssetRecord[];
  onPreview: (asset: AssetRecord) => void;
  onDelete: (asset: AssetRecord) => void;
}) {
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const visibleAssets =
    filter === "all" ? assets : assets.filter((asset) => asset.type === filter);
  return (
    <section className="asset-library" data-testid="asset-library">
      <header className="asset-library-head">
        <h1>资产</h1>
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
        <div className="asset-library-grid">
          {visibleAssets.map((asset) => (
            <article className="library-card" key={asset.id}>
              <div className="library-card-media">
                {asset.type === "video" ? (
                  <video src={asset.url} muted playsInline controls aria-label={asset.title} />
                ) : (
                  <button type="button" onClick={() => onPreview(asset)} aria-label={`预览 ${asset.title}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.url} alt={asset.title} />
                  </button>
                )}
              </div>
              <footer>
                <div>
                  <strong title={asset.title}>{asset.title}</strong>
                  <time dateTime={asset.createdAt}>{assetTimeLabel(asset.createdAt)}</time>
                </div>
                <details className="asset-card-menu">
                  <summary aria-label={`${asset.title} 的更多操作`}>
                    <DotsThree aria-hidden="true" weight="bold" />
                  </summary>
                  <div role="menu">
                    <a href={asset.downloadUrl ?? asset.url} download role="menuitem">
                      <DownloadSimple aria-hidden="true" />下载
                    </a>
                    <button type="button" role="menuitem" onClick={() => onDelete(asset)}>
                      <Trash aria-hidden="true" />删除
                    </button>
                  </div>
                </details>
              </footer>
            </article>
          ))}
        </div>
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
  const [uploadedCases, setUploadedCases] = useState<InspirationCase[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const galleryEndRef = useRef<HTMLDivElement>(null);
  const visibleCases = [...uploadedCases, ...inspirationCases]
    .filter((item) => (item.tabs ?? (item.tab ? [item.tab] : [])).includes(
      activeTab as "featured" | "image" | "video",
    ))
    .sort((left, right) => {
      const tab = activeTab as "featured" | "image" | "video";
      const leftRank = left.orderByTab?.[tab]
        ?? (left.createdAt ? -new Date(left.createdAt).getTime() : Number.MAX_SAFE_INTEGER);
      const rightRank = right.orderByTab?.[tab]
        ?? (right.createdAt ? -new Date(right.createdAt).getTime() : Number.MAX_SAFE_INTEGER);
      return leftRank - rightRank;
    });

  useEffect(() => {
    void fetch("/api/inspiration", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return [];
        const payload = await response.json() as { cases?: InspirationCase[] };
        return Array.isArray(payload.cases) ? payload.cases : [];
      })
      .then(setUploadedCases)
      .catch(() => setUploadedCases([]));
  }, []);

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
        {item.inputImages?.length ? (
          <div className="template-preview-inputs">
            <h2>输入图片</h2>
            <div>
              {item.inputImages.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="案例输入图" key={url} />
              ))}
            </div>
          </div>
        ) : null}
        <dl className="template-preview-settings">
          <div><dt>技能</dt><dd>{skillLabel}</dd></div>
          {item.suite ? (
            <>
              <div><dt>A+ 图</dt><dd>{item.suite.aPlusCount ?? 0} 张</dd></div>
              <div><dt>卖点图</dt><dd>{item.suite.mainImageCount ?? 0} 张</dd></div>
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
  onDownload,
  onClose,
}: {
  preview: PreviewState;
  prompt: string;
  generating: boolean;
  onPrompt: (value: string) => void;
  onSubmit: () => void;
  onDownload: (format: "png" | "jpg") => void;
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
        <img src={assetPreviewUrl(preview.image)} alt={preview.title} />
        <footer>
          <div><span>{preview.group}</span><strong>{preview.title}</strong></div>
          <div className="preview-downloads">
            <button
              type="button"
              onClick={() => onDownload("png")}
              data-analytics-event="asset_downloaded"
              data-turn-id={preview.turnId}
            >
              下载 PNG
            </button>
            <button
              type="button"
              onClick={() => onDownload("jpg")}
              data-analytics-event="asset_downloaded"
              data-turn-id={preview.turnId}
            >
              下载 JPG
            </button>
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
  const source = upload.file ?? await fetch(upload.url)
    .then((response) => response.blob())
    .then((blob) => new File([blob], upload.name || "product.png", {
      type: blob.type || "image/png",
    }));
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
  const value = parseFirstJsonObject(cleaned) as ListingData;
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
  const [imageGenerationModel, setImageGenerationModel] = useState(DEFAULT_IMAGE_MODEL);
  const [videoGenerationModel, setVideoGenerationModel] = useState(DEFAULT_VIDEO_MODEL);
  const [videoRatio, setVideoRatio] = useState(DEFAULT_VIDEO_RATIO);
  const [videoDuration, setVideoDuration] = useState(DEFAULT_VIDEO_DURATION_SECONDS);
  const [skill, setSkill] = useState("amazon-listing");
  const [region, setRegion] = useState("us");
  const [language, setLanguage] = useState("en");
  const [brand, setBrand] = useState<BrandSettings>(defaultBrandSettings);
  const [suite, setSuite] = useState<SuiteSettings>(defaultSuiteSettings);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [inputPreview, setInputPreview] = useState<Upload | null>(null);
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
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [selectedInspiration, setSelectedInspiration] = useState<InspirationCase | null>(null);
  const homeComposerAnchor = useRef<HTMLDivElement | null>(null);
  const controllers = useRef<Map<string, AbortController>>(new Map());
  const persistenceTimers = useRef<Map<string, number>>(new Map());
  const turnsRef = useRef<Turn[]>([]);
  const uploadsRef = useRef<Upload[]>([]);
  const referenceVideoRef = useRef<Upload | null>(null);
  const sessionTracked = useRef(false);
  const pendingHomeConversationId = useRef<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const screenRef = useRef(screen);

  const modeSkills = skillsByMode(mode);
  const generationModel = mode === "video" ? videoGenerationModel : imageGenerationModel;
  const setGenerationModel = mode === "video" ? setVideoGenerationModel : setImageGenerationModel;
  const selectedSkill =
    modeSkills.find((item) => item.id === skill) ?? modeSkills[0];
  const selectedKind = selectedSkill.kind;
  const productImage = uploads[0]?.url ?? "/product-main.webp";
  const activeConversation =
    conversations.find((item) => item.id === activeConversationId) ??
    [...conversations].sort((left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )[0];
  const activeTurns = turns.filter(
    (turn) => turn.conversationId === activeConversation?.id,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(STUDIO_SETTINGS_KEY) ?? "null") as Partial<{
        mode: GenerationMode;
        generationModel: string;
        imageGenerationModel: string;
        videoGenerationModel: string;
        videoRatio: string;
        videoDuration: number;
        skill: string;
        region: string;
        language: string;
        brand: BrandSettings;
        suite: SuiteSettings;
        }> | null;
        if (saved?.mode && modes.some((item) => item.id === saved.mode)) setMode(saved.mode);
        if (saved?.skill && skills.some((item) => item.id === saved.skill)) setSkill(saved.skill);
        if (saved?.imageGenerationModel) setImageGenerationModel(saved.imageGenerationModel);
        if (saved?.videoGenerationModel ?? saved?.generationModel) {
          setVideoGenerationModel(saved.videoGenerationModel ?? saved.generationModel!);
        }
        if (saved?.videoRatio) setVideoRatio(saved.videoRatio);
        if (saved?.videoDuration) setVideoDuration(saved.videoDuration);
        if (saved?.region && regions.some((item) => item.id === saved.region)) setRegion(saved.region);
        if (saved?.language && languages.some((item) => item.id === saved.language)) setLanguage(saved.language);
        if (saved?.brand) setBrand((current) => ({ ...current, ...saved.brand }));
        if (saved?.suite) setSuite((current) => ({ ...current, ...saved.suite }));
      } catch {
        localStorage.removeItem(STUDIO_SETTINGS_KEY);
      } finally {
        setSettingsHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    localStorage.setItem(STUDIO_SETTINGS_KEY, JSON.stringify({
      mode,
      imageGenerationModel,
      videoGenerationModel,
      videoRatio,
      videoDuration,
      skill,
      region,
      language,
      brand,
      suite,
    }));
  }, [brand, imageGenerationModel, language, mode, region, settingsHydrated, skill, suite, videoDuration, videoGenerationModel, videoRatio]);

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
    if (screen !== "home" || selectedInspiration) return;
    const anchor = homeComposerAnchor.current;
    if (!anchor) return;

    const observer = new IntersectionObserver(([entry]) => {
      setHomeComposerMinimized(!entry.isIntersecting);
    }, { threshold: 0.01 });

    observer.observe(anchor);
    return () => observer.disconnect();
  }, [screen, selectedInspiration]);

  useEffect(() => {
    referenceVideoRef.current = referenceVideo;
  }, [referenceVideo]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
    screenRef.current = screen;
  }, [activeConversationId, screen]);

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
        current ?? restoredConversations[0]?.id ?? null,
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

  const downloadImage = (url: string, title: string) => {
    void fetchDownload(url, title).catch((error) => {
      showNotice(error instanceof Error ? error.message : "图片下载失败");
    });
  };

  const downloadTurnImages = async (turn: Turn) => {
    const images = (turn.images ?? []).filter(Boolean);
    if (!images.length) {
      showNotice("当前批次还没有可下载的图片");
      return;
    }
    trackEvent("asset_downloaded", turn, { scope: "batch", count: images.length });
    try {
      if (images.length === 1) {
        await fetchDownload(images[0], `${turn.title}-1`);
        return;
      }
      const entries = await Promise.all(images.map(async (url, index) => {
        const blob = await fetchImageBlob(url);
        return [`${String(index + 1).padStart(2, "0")}-${safeDownloadName(turn.title)}.png`, new Uint8Array(await blob.arrayBuffer())] as const;
      }));
      const { zipSync } = await import("fflate");
      const archive = zipSync(Object.fromEntries(entries), { level: 6 });
      const archiveBytes = new Uint8Array(archive.byteLength);
      archiveBytes.set(archive);
      saveDownload(new Blob([archiveBytes.buffer], { type: "application/zip" }), `${safeDownloadName(turn.title)}-全部图片.zip`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "图片打包下载失败");
    }
  };

  const restoreTurnToComposer = (turn: Turn, sendAgain = false) => {
    uploadsRef.current.forEach((upload) => {
      if (upload.owned) URL.revokeObjectURL(upload.url);
    });
    const restoredUploads = (turn.productImages?.length ? turn.productImages : [turn.productImage])
      .filter(Boolean)
      .slice(0, MAX_UPLOADS)
      .map((url, index) => ({
        id: `${turn.id}-restore-${index}`,
        name: `商品图片-${index + 1}.png`,
        url,
        mediaType: "image" as const,
      }));
    const restoredReference = turn.referenceVideo
      ? {
          id: `${turn.id}-restore-video`,
          name: turn.referenceVideoName || "参考视频.mp4",
          url: turn.referenceVideo,
          mediaType: "video" as const,
        }
      : null;
    uploadsRef.current = restoredUploads;
    referenceVideoRef.current = restoredReference;
    setUploads(restoredUploads);
    setReferenceVideo(restoredReference);
    setPrompt(turn.prompt);
    setMode(turn.mode);
    if (turn.mode === "video") {
      setVideoGenerationModel(turn.generationModel ?? DEFAULT_VIDEO_MODEL);
    } else {
      setImageGenerationModel(turn.generationModel ?? DEFAULT_IMAGE_MODEL);
    }
    setVideoRatio(turn.videoRatio ?? DEFAULT_VIDEO_RATIO);
    setVideoDuration(turn.videoDuration ?? DEFAULT_VIDEO_DURATION_SECONDS);
    setSkill(turn.skill);
    setRegion(turn.region);
    setLanguage(turn.language);
    setBrand({ ...turn.brand });
    setSuite({ ...turn.suite });
    setStudioComposerMinimized(false);
    if (!sendAgain) {
      showNotice("本批次输入和设置已恢复");
      window.requestAnimationFrame(() => document.getElementById("conversation-prompt")?.focus());
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="conversation-send"]')?.click();
    }));
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

  const setConversationUnread = (conversationId: string, unread: boolean) => {
    setConversations((current) => current.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            unread,
            updatedAt: unread ? new Date().toISOString() : conversation.updatedAt,
          }
        : conversation
    ));
    void fetch("/api/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: unread ? "mark-unread" : "mark-read",
        conversationId,
      }),
      keepalive: true,
    }).catch(() => undefined);
  };

  const markResultReady = (conversationId: string) => {
    const isViewing = screenRef.current === "studio" &&
      activeConversationIdRef.current === conversationId;
    setConversationUnread(conversationId, !isViewing);
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
    sourceFile?: File,
    generationId?: string,
  ) => {
    const taskBackedImage = type === "image" &&
      role === "output" &&
      Boolean(generationId) &&
      !sourceFile;
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
      generationId,
      role,
      slot,
      createdAt,
    };
    const hasOptimisticAsset = role === "output" && Boolean(sourceUrl);
    if (hasOptimisticAsset) {
      setAssets((current) => [optimistic, ...current]);
    }
    try {
      const metadata = {
        type,
        title,
        prompt: turn.prompt,
        conversationId: turn.conversationId,
        turnId: turn.id,
        generationId: generationId || "",
        role,
        slot: String(slot),
        createdAt,
        outputWidth: dimensions?.width ? String(dimensions.width) : "",
        outputHeight: dimensions?.height ? String(dimensions.height) : "",
      };
      const body = sourceFile
        ? (() => {
            const form = new FormData();
            form.set("file", sourceFile);
            Object.entries(metadata).forEach(([key, value]) => form.set(key, value));
            return form;
          })()
        : JSON.stringify(taskBackedImage
          ? { imageTaskId: generationId, ...metadata }
          : { sourceUrl, ...metadata });
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: sourceFile ? undefined : { "content-type": "application/json" },
        body,
      });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = await response.json();
      if (role === "output") {
        setAssets((current) => hasOptimisticAsset
          ? current.map((asset) => asset.id === temporaryId ? payload.asset : asset)
          : [payload.asset, ...current]);
      }
      return payload.asset as AssetRecord;
    } catch (error) {
      if (hasOptimisticAsset) {
        setAssets((current) =>
          current.filter((asset) => asset.id !== temporaryId),
        );
      }
      const message = error instanceof Error
        ? error.message
        : "未知错误";
      showNotice(
        role === "input"
          ? `输入图片保存失败：${message}`
          : `生成成功，但资产保存失败：${message}`,
      );
      if (role === "input") throw error;
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
      { id: "sample", name: "便携咖啡机示例图", url: "/product-main.webp" },
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

  const markGeneratedImageUnavailable = (turnId: string, url: string) => {
    const turn = turnsRef.current.find((item) => item.id === turnId);
    const slot = turn?.images?.findIndex((image) => image === url) ?? -1;
    if (!turn || slot < 0 || turn.failedImageSlots?.includes(slot)) return;
    const images = [...(turn.images ?? [])];
    images[slot] = "";
    const failedImageSlots = [...(turn.failedImageSlots ?? []), slot]
      .sort((left, right) => left - right);
    const done = images.filter(Boolean).length;
    const expected = turn.imageTaskCount ?? images.length;
    patchTurn(turnId, {
      images,
      failedImageSlots,
      completed: turn.kind === "listing" ? 1 + done : done,
      phase: turn.kind === "listing"
        ? `Listing 已完成 · 图片 ${done} / ${expected} 张 · ${failedImageSlots.length} 张资源加载失败`
        : `已完成 ${done} / ${expected} 张 · ${failedImageSlots.length} 张资源加载失败`,
    });
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
    if (action === "image") {
      form.set("model", turn.generationModel ?? DEFAULT_IMAGE_MODEL);
    } else if (action === "video") {
      form.set("model", turn.generationModel ?? DEFAULT_VIDEO_MODEL);
      form.set("ratio", turn.videoRatio ?? DEFAULT_VIDEO_RATIO);
      form.set("duration", String(turn.videoDuration ?? DEFAULT_VIDEO_DURATION_SECONDS));
    }
    form.set("skill", turn.skill);
    form.set("turnId", turn.id);
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
    uploadsForTurn.slice(0, MAX_UPLOADS).forEach((upload) => {
      if (upload.assetId) form.append("inputAssetId", upload.assetId);
    });
    if (action !== "video") {
      const files = await Promise.all(
        uploadsForTurn.slice(0, MAX_UPLOADS).map(uploadAsFile),
      );
      files.forEach((file) => form.append("image", file, file.name));
    }
    if (action === "video" && referenceVideoForTurn?.assetId) {
      form.set("referenceVideoAssetId", referenceVideoForTurn.assetId);
    } else if (action === "video" && referenceVideoForTurn) {
      const file = await uploadOriginalFile(referenceVideoForTurn);
      form.append("referenceVideo", file, file.name);
    }
    return form;
  };

  const runImageTask = async (
    form: FormData,
    signal?: AbortSignal,
    onTaskCreated?: (taskId: string) => void,
  ) => {
    const response = await fetch("/api/generate", {
      method: "POST",
      body: form,
      signal,
    });
    if (!response.ok) throw new Error(await responseError(response));
    const created = await response.json();
    const taskId = deepFind(created, ["id", "task_id"]);
    if (!taskId) throw new Error("图片任务后台没有返回任务 ID");
    onTaskCreated?.(taskId);

    for (let attempt = 0; attempt < 240; attempt += 1) {
      if (attempt) await new Promise((resolve) => window.setTimeout(resolve, 3000));
      if (signal?.aborted) throw new DOMException("已停止", "AbortError");
      const poll = await fetch(
        `/api/generate?imageTaskId=${encodeURIComponent(taskId)}&summary=1`,
        { signal, cache: "no-store" },
      );
      if (!poll.ok) throw new Error(await responseError(poll));
      const payload = await poll.json();
      const status = deepFind(payload, ["status", "state"])?.toLowerCase();
      if (["succeeded", "success", "completed", "done"].includes(status ?? "")) {
        return taskId;
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
      imageGenerationIds: suiteImageCount ? [] : turn.imageGenerationIds,
      failedImageSlots: suiteImageCount ? [] : turn.failedImageSlots,
    });
    patchTurn(turn.id, {
      phase: "正在流式生成 Listing",
      completed: suiteImageCount ? 0 : 2,
    });

    const generateListingText = async (retry = false) => {
      const form = await generationForm(turn, uploadsForTurn, "listing");
      form.set("productionId", turn.id);
      if (retry) form.set("listingRetry", "1");
      const response = await fetch("/api/generate", { method: "POST", body: form, signal });
      if (!response.ok || !response.body) throw new Error(await responseError(response));

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let generated = "";
      const consume = (line: string) => {
        generated += openAiResponseLine(line);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        lines.forEach(consume);
      }
      pending += decoder.decode();
      pending.split("\n").forEach(consume);
      return generated;
    };

    let generated = await generateListingText();
    let listing: ListingData;
    try {
      listing = parseListingJson(generated);
    } catch {
      patchTurn(turn.id, { phase: "正在纠正 Listing 返回格式" });
      generated = await generateListingText(true);
      listing = parseListingJson(generated);
    }
    if (!suiteImageCount) {
      patchTurn(turn.id, {
        listing,
        agentText: "",
        phase: "生成完成",
        completed: generationCopy.listing.phases.length,
        running: false,
      });
      return { status: "complete", completed: 1, expected: 1, failed: 0 };
    }

    patchTurn(turn.id, {
      listing,
      agentText: "",
      phase: `Listing 已完成，正在生成 0 / ${suiteImageCount} 张套图`,
      completed: 1,
      images: Array.from({ length: suiteImageCount }, () => ""),
      imageGenerationIds: Array.from({ length: suiteImageCount }, () => ""),
      failedImageSlots: [],
    });

    const results = Array.from({ length: suiteImageCount }, () => "");
    const generationIds = Array.from({ length: suiteImageCount }, () => "");
    const failedSlots: number[] = [];
    let nextSlot = 0;
    let firstError = "";
    const firstMobileSlot = turn.suite.aPlusType === "advanced-mobile"
      ? Math.min(
          suiteImageCount,
          turn.suite.mainImageCount + turn.suite.aPlusCount,
        )
      : suiteImageCount;

    const generateSlot = async (slot: number) => {
      try {
        const slotConfig = suiteSlot(turn.suite, slot);
        const sourceUploads = slotConfig.type === "a-plus-mobile"
          ? (() => {
              const sourceSlot = turn.suite.mainImageCount + slotConfig.index;
              const sourceUrl = results[sourceSlot];
              if (!sourceUrl) throw new Error("对应的高级 A+ 图生成失败，无法继续生成手机 A+");
              return [{
                id: `${turn.id}-premium-a-plus-${slotConfig.index}`,
                name: `premium-a-plus-${slotConfig.index + 1}.png`,
                url: sourceUrl,
              }];
            })()
          : uploadsForTurn;
        const generatedTaskId = await runImageTask(
          await generationForm(turn, sourceUploads, "image", slot),
          signal,
          (taskId) => {
            generationIds[slot] = taskId;
            patchTurn(turn.id, { imageGenerationIds: [...generationIds] });
          },
        );
        const generationId = generationIds[slot] || generatedTaskId;
        generationIds[slot] = generationId;
        const stored = await storeAsset(
          turn,
          "",
          "image",
          suiteItems(turn.skill, suiteImageCount, turn.suite)[slot]?.title ??
            `Listing 图片 ${slot + 1}`,
          slot,
          "output",
          suiteOutputDimensions(turn.suite, slot),
          undefined,
          generationId,
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
        imageGenerationIds: [...generationIds],
        failedImageSlots: [...failedSlots],
        completed: 1 + done,
        phase: failedSlots.length
          ? `Listing 已完成 · 套图 ${done} / ${suiteImageCount} 张 · ${failedSlots.length} 张失败`
          : `Listing 已完成 · 套图 ${done} / ${suiteImageCount} 张`,
      });
    };

    const worker = async () => {
      while (nextSlot < firstMobileSlot) {
        await generateSlot(nextSlot++);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(MAX_IMAGE_TASK_CONCURRENCY, firstMobileSlot) }, worker),
    );
    await Promise.all(
      Array.from(
        { length: suiteImageCount - firstMobileSlot },
        (_, index) => generateSlot(firstMobileSlot + index),
      ),
    );
    const done = results.filter(Boolean).length;
    patchTurn(turn.id, {
      images: results,
      imageGenerationIds: generationIds,
      failedImageSlots: failedSlots,
      phase: failedSlots.length
        ? done
          ? `Listing 与 ${done} / ${suiteImageCount} 张套图已完成 · ${failedSlots.length} 张失败`
          : `Listing 已完成 · ${suiteImageCount} 张套图生成失败，可单独重试`
        : "生成完成",
      completed: 1 + done,
      running: false,
      error: undefined,
    });
    return {
      status: failedSlots.length ? "partial" : "complete",
      completed: done,
      expected: suiteImageCount,
      failed: failedSlots.length,
      reason: failedSlots.length ? firstError || "部分套图生成失败" : undefined,
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
      imageGenerationIds: [],
      failedImageSlots: [],
    });
    const results = Array.from({ length: count }, () => "");
    const generationIds = Array.from({ length: count }, () => "");
    const failedSlots: number[] = [];
    let nextSlot = 0;
    let firstError = "";
    const firstMobileSlot = hasSuiteSettings(turn.skill) &&
        turn.suite.aPlusType === "advanced-mobile"
      ? Math.min(count, turn.suite.mainImageCount + turn.suite.aPlusCount)
      : count;

    const generateSlot = async (slot: number) => {
      try {
        const slotConfig = hasSuiteSettings(turn.skill)
          ? suiteSlot(turn.suite, slot)
          : undefined;
        const sourceUploads = slotConfig?.type === "a-plus-mobile"
          ? (() => {
              const sourceSlot = turn.suite.mainImageCount + slotConfig.index;
              const sourceUrl = results[sourceSlot];
              if (!sourceUrl) throw new Error("对应的高级 A+ 图生成失败，无法继续生成手机 A+");
              return [{
                id: `${turn.id}-premium-a-plus-${slotConfig.index}`,
                name: `premium-a-plus-${slotConfig.index + 1}.png`,
                url: sourceUrl,
              }];
            })()
          : uploadsForTurn;
        const generatedTaskId = await runImageTask(
          await generationForm(turn, sourceUploads, "image", slot),
          signal,
          (taskId) => {
            generationIds[slot] = taskId;
            patchTurn(turn.id, { imageGenerationIds: [...generationIds] });
          },
        );
        const generationId = generationIds[slot] || generatedTaskId;
        generationIds[slot] = generationId;
        const stored = await storeAsset(
          turn,
          "",
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
          undefined,
          generationId,
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
        imageGenerationIds: [...generationIds],
        failedImageSlots: [...failedSlots],
        completed: done,
        phase: failedSlots.length
          ? `已完成 ${done} / ${count} 张 · ${failedSlots.length} 张失败`
          : `已完成 ${done} / ${count} 张`,
      });
    };

    const worker = async () => {
      while (nextSlot < firstMobileSlot) {
        await generateSlot(nextSlot++);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(MAX_IMAGE_TASK_CONCURRENCY, firstMobileSlot) }, worker),
    );
    await Promise.all(
      Array.from(
        { length: count - firstMobileSlot },
        (_, index) => generateSlot(firstMobileSlot + index),
      ),
    );
    const done = results.filter(Boolean).length;
    if (!done) throw new Error(firstError || "图片生成失败");
    patchTurn(turn.id, {
      images: results,
      imageGenerationIds: generationIds,
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
    patchTurn(turn.id, {
      videoGenerationId: taskId,
      phase: "视频正在生成，预计需要几分钟",
      completed: 2,
    });

    for (let attempt = 0; attempt < 150; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 4000));
      if (signal.aborted) throw new DOMException("已停止", "AbortError");
      const poll = await fetch(`/api/generate?taskId=${encodeURIComponent(taskId)}`, { signal });
      if (!poll.ok) throw new Error(await responseError(poll));
      const payload = await poll.json();
      const videoUrl = deepFind(payload, ["video_url", "videoUrl", "url"]);
      const status = deepFind(payload, ["status", "state"])?.toLowerCase();
      if (videoUrl && ["succeeded", "success", "completed", "done"].includes(status ?? "completed")) {
        const stored = await storeAsset(
          turn,
          videoUrl,
          "video",
          turn.title,
          0,
          "output",
          undefined,
          undefined,
          taskId,
        );
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
      if (summary.completed > 0) markResultReady(turn.conversationId);
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

  const startGeneration = async (origin: "home" | "conversation") => {
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
      showNotice("请至少选择 1 张卖点图或 A+ 图");
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
    const pendingConversationId =
      origin === "home" ? pendingHomeConversationId.current : null;
    const conversationId = origin === "home"
      ? pendingConversationId ?? `conversation-${crypto.randomUUID()}`
      : activeConversationId ?? `conversation-${crypto.randomUUID()}`;
    let conversationToPersist: Conversation | undefined;
    const existingConversation = conversations.find(
      (conversation) => conversation.id === conversationId,
    );
    if (!existingConversation) {
      const now = new Date().toISOString();
      conversationToPersist = {
        id: conversationId,
        title: taskPrompt.slice(0, 22),
        createdAt: now,
        updatedAt: now,
        unread: false,
      };
      setConversations((current) => [conversationToPersist!, ...current]);
      setActiveConversationId(conversationId);
    } else {
      setActiveConversationId(conversationId);
      if (existingConversation.title === "新对话") {
        conversationToPersist = {
          ...existingConversation,
          title: taskPrompt.slice(0, 22),
          updatedAt: new Date().toISOString(),
          unread: false,
        };
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? conversationToPersist!
              : conversation,
          ),
        );
      } else {
        setConversations((current) => current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, updatedAt: new Date().toISOString(), unread: false }
            : conversation
        ));
      }
    }
    if (origin === "home") pendingHomeConversationId.current = null;
    const configuredImageCount = hasSuiteSettings(selectedSkill.id)
      ? suiteTaskCount(selectedSkill.id, suite, taskPrompt)
      : imageTaskCount(selectedKind, taskPrompt);
    const turnUploads = uploads.slice(0, MAX_UPLOADS);
    const turnReferenceVideo = referenceVideo ?? undefined;
    let generationUploads = turnUploads;
    let generationReferenceVideo = turnReferenceVideo;
    const turn: Turn = {
      id,
      conversationId,
      createdAt: new Date().toISOString(),
      title: taskPrompt.slice(0, 22),
      prompt: taskPrompt,
      mode,
      generationModel,
      videoRatio: mode === "video" ? videoRatio : undefined,
      videoDuration: mode === "video" ? videoDuration : undefined,
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
          const sourceFile = await uploadAsFile(upload);
          return storeAsset(
            turn,
            upload.url,
            "image",
            upload.name || `输入图片 ${slot + 1}`,
            slot,
            "input",
            undefined,
            sourceFile,
          );
        }),
      );
      if (storedInputs.some((asset) => !asset)) {
        throw new Error("输入图片没有完整保存，请检查网络后重试");
      }
      generationUploads = turnUploads.map((upload, slot) => ({
        ...upload,
        assetId: storedInputs[slot]!.id,
      }));
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
        generationReferenceVideo = {
          ...turnReferenceVideo,
          assetId: storedReference.id,
          url: storedReference.url,
        };
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
      void runGeneration(turn, generationUploads, generationReferenceVideo);
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
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
      let replacementGenerationId = "";
      const generatedTaskId = await runImageTask(
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
        undefined,
        (taskId) => {
          replacementGenerationId = taskId;
        },
      );
      replacementGenerationId ||= generatedTaskId;
      const stored = await storeAsset(
        turn,
        "",
        "image",
        item.title,
        slot,
        "output",
        hasSuiteSettings(turn.skill)
          ? suiteOutputDimensions(turn.suite, slot)
          : undefined,
        undefined,
        replacementGenerationId,
      );
      if (!stored) throw new Error("图片已生成，但没有保存到资产库");
      const nextTurns = turnsRef.current.map((currentTurn) => {
        if (currentTurn.id !== turn.id) return currentTurn;
        const images = [...(currentTurn.images ?? [])];
        images[slot] = stored.url;
        const imageGenerationIds = [...(currentTurn.imageGenerationIds ?? [])];
        if (replacementGenerationId) imageGenerationIds[slot] = replacementGenerationId;
        const failedImageSlots = (currentTurn.failedImageSlots ?? [])
          .filter((failedSlot) => failedSlot !== slot);
        const done = images.filter(Boolean).length;
        const total = currentTurn.imageTaskCount ?? 1;
        return {
          ...currentTurn,
          images,
          imageGenerationIds,
          failedImageSlots,
          completed: currentTurn.kind === "listing" ? 1 + done : done,
          phase: currentTurn.kind === "listing"
            ? `Listing 已完成 · 套图 ${done} / ${total} 张${failedImageSlots.length ? ` · ${failedImageSlots.length} 张失败` : ""}`
            : done === total ? "生成完成" : `已生成 ${done} / ${total} 张`,
          error: undefined,
        };
      });
      turnsRef.current = nextTurns;
      setTurns(nextTurns);
      const updatedTurn = nextTurns.find((currentTurn) => currentTurn.id === turn.id);
      if (updatedTurn) scheduleTurnPersistence(updatedTurn, true);
      setRegenerating(null);
      markResultReady(turn.conversationId);
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
      [...conversations].sort((left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )[0]?.id ??
      `conversation-${crypto.randomUUID()}`;
    const turn: Turn = existingTurn ?? {
      id: `edit-${crypto.randomUUID()}`,
      conversationId: fallbackConversationId,
      createdAt: new Date().toISOString(),
      title: preview.title,
      prompt: previewPrompt.trim(),
      mode: "image",
      generationModel: imageGenerationModel,
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
      let editedGenerationId = "";
      const generatedTaskId = await runImageTask(
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
        undefined,
        (taskId) => {
          editedGenerationId = taskId;
        },
      );
      editedGenerationId ||= generatedTaskId;
      const stored = await storeAsset(
        editedTurn,
        "",
        "image",
        `${preview.title} · 改图`,
        preview.slot,
        "output",
        hasSuiteSettings(editedTurn.skill)
          ? suiteOutputDimensions(editedTurn.suite, preview.slot)
          : undefined,
        undefined,
        editedGenerationId,
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
      conversationId ?? [...conversations].sort((left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )[0].id;
    pendingHomeConversationId.current = null;
    setActiveConversationId(targetConversationId);
    setStudioComposerMinimized(false);
    setScreen("studio");
    setConversationUnread(targetConversationId, false);
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
    if (pendingHomeConversationId.current === conversationId) {
      pendingHomeConversationId.current = null;
    }
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
        [...remainingConversations].sort((left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        )[0].id,
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

  const openHome = () => {
    pendingHomeConversationId.current = null;
    setActiveConversationId(null);
    setScreen("home");
  };

  if (screen === "studio") {
    return (
      <main className="studio" data-testid="studio">
        <AppSidebar
          screen={screen}
          conversations={conversations}
          turns={turns}
          activeConversationId={activeConversationId}
          onHome={openHome}
          onConversation={openConversation}
          onAssets={() => setScreen("assets")}
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
              const total = progressTotal(turn);
              const ready = turn.kind === "listing"
                ? isListingReady(turn)
                : turn.completed === total && !turn.running;
              return (
                <article className="conversation-turn" id={turn.id} key={turn.id} data-testid={`conversation-turn-${index}`}>
                  <div className="user-message">
                    <div className="message-avatar">Y</div>
                    <div className="message-bubble">
                      <div className="message-materials">
                        {turn.referenceVideo ? (
                          <button
                            type="button"
                            className="message-reference-video"
                            aria-label="查看参考视频大图"
                            onClick={() => setInputPreview({
                              id: `${turn.id}-reference-video`,
                              name: turn.referenceVideoName || "参考视频",
                              url: turn.referenceVideo!,
                              mediaType: "video",
                            })}
                          >
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
                          </button>
                        ) : null}
                        {turn.referenceVideo ? (
                          <span className="message-material-plus" aria-hidden="true">
                            <Plus weight="bold" />
                          </span>
                        ) : null}
                        <div className="message-products" aria-label="本次任务的商品图片">
                          {(turn.productImages?.length ? turn.productImages : [turn.productImage])
                            .map((image, imageIndex) => (
                              <button
                                type="button"
                                className="message-product"
                                key={`${turn.id}-input-${imageIndex}`}
                                aria-label={`查看${imageIndex === 0 ? "商品主体" : `商品参考图 ${imageIndex + 1}`}大图`}
                                onClick={() => setInputPreview({
                                  id: `${turn.id}-input-${imageIndex}`,
                                  name: imageIndex === 0 ? "商品主体" : `商品参考图 ${imageIndex + 1}`,
                                  url: image,
                                  mediaType: "image",
                                })}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={image}
                                  alt={imageIndex === 0 ? "用户上传的商品主体" : `用户上传的商品参考图 ${imageIndex + 1}`}
                                />
                              </button>
                            ))}
                        </div>
                      </div>
                      <div className="message-copy">
                        <p>{turn.prompt}</p>
                        <details className="message-details">
                          <summary>
                            详细信息
                            <Info aria-hidden="true" />
                          </summary>
                          <div className="request-tags">
                            <span>{modes.find((item) => item.id === turn.mode)?.label}</span>
                            <span>{skills.find((item) => item.id === turn.skill)?.label}</span>
                            {turn.generationModel ? (
                              <span>
                                模型：{(turn.mode === "video" ? VIDEO_MODEL_OPTIONS : IMAGE_MODEL_OPTIONS)
                                  .find((item) => item.id === turn.generationModel)?.label
                                  ?? turn.generationModel}
                              </span>
                            ) : null}
                            {turn.mode === "video" && turn.videoRatio ? (
                              <span>尺寸：{turn.videoRatio}</span>
                            ) : null}
                            {turn.mode === "video" && turn.videoDuration ? (
                              <span>时长：{turn.videoDuration} 秒</span>
                            ) : null}
                            <span>{regions.find((item) => item.id === turn.region)?.label}</span>
                            <span>{languages.find((item) => item.id === turn.language)?.label}</span>
                            {hasSuiteSettings(turn.skill) ? (
                              <span>
                                卖点图 {turn.suite.mainImageCount} · A+ {turn.suite.aPlusCount}
                                {" · "}{turn.suite.mainImageRatio}
                                {turn.suite.aPlusType === "advanced-mobile" ? " · 含手机 A+" : ""}
                              </span>
                            ) : null}
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>

                  <div className="assistant-message">
                    <div className="message-avatar ai-avatar">M</div>
                    <div className="assistant-content">
                      <header className="assistant-head">
                        <div className="assistant-title-row">
                          <h2>{assetDateLabel(turn.createdAt)}</h2>
                          <ProductionId id={turn.id} onNotice={showNotice} />
                        </div>
                      </header>

                      <div className={`dynamic-result dynamic-${turn.kind}`}>
                        {turn.error ? (
                          <div className="generation-error" role="alert">
                            <strong>生成失败</strong>
                            <p>{turn.error}</p>
                          </div>
                        ) : null}
                        {turn.kind === "listing" ? (
                          <ListingResult
                            key={turn.listing?.productUrlSlug ?? `${turn.id}-loading`}
                            turnId={turn.id}
                            language={turn.language}
                            region={turn.region}
                            data={turn.listing}
                            generatedImages={turn.images}
                            taskCount={turn.imageTaskCount ?? 0}
                            generationIds={turn.imageGenerationIds ?? []}
                            suite={turn.suite}
                            ready={isListingReady(turn)}
                            onNotice={showNotice}
                            onListingChange={(listing) =>
                              patchTurn(turn.id, { listing })
                            }
                            onGeneratedImageError={(url) =>
                              markGeneratedImageUnavailable(turn.id, url)
                            }
                            failedSlots={turn.failedImageSlots ?? []}
                            onRegenerate={(item) => void regenerate(turn, item)}
                            regenerating={regenerating}
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
                            onDownload={(item) => downloadImage(item.image, item.title)}
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
                            onDownload={(item) => downloadImage(item.image, item.title)}
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
                            onDownload={(item) => downloadImage(item.image, item.title)}
                            regenerating={regenerating}
                          />
                        ) : null}
                        {turn.kind === "video" ? (
                          <VideoResult
                            turnId={turn.id}
                            ready={ready}
                            videoUrl={turn.videoUrl}
                          />
                        ) : null}
                      </div>
                      {turn.kind !== "video" ? (
                        <div className="batch-actions" aria-label="本批生成操作">
                          <button type="button" onClick={() => restoreTurnToComposer(turn)}>
                            重新编辑
                          </button>
                          <button type="button" disabled={turn.running} onClick={() => restoreTurnToComposer(turn, true)}>
                            再次生成
                          </button>
                          <button type="button" disabled={!(turn.images ?? []).some(Boolean)} onClick={() => void downloadTurnImages(turn)}>
                            <DownloadSimple aria-hidden="true" weight="bold" />
                            全部下载
                          </button>
                        </div>
                      ) : null}
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
              generationModel={generationModel}
              videoRatio={videoRatio}
              videoDuration={videoDuration}
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
              onSend={() => startGeneration("conversation")}
              onMode={changeMode}
              onGenerationModel={setGenerationModel}
              onVideoRatio={setVideoRatio}
              onVideoDuration={setVideoDuration}
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
            onDownload={(format) => {
              void fetchDownload(preview.image, preview.title, format).catch((error) =>
                showNotice(error instanceof Error ? error.message : "图片下载失败")
              );
            }}
            onClose={() => setPreview(null)}
          />
        ) : null}
        {inputPreview ? (
          <UploadPreviewModal
            upload={inputPreview}
            onClose={() => setInputPreview(null)}
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
          onHome={openHome}
          onConversation={openConversation}
          onAssets={() => setScreen("assets")}
          onRename={renameConversation}
          onDelete={deleteConversation}
          session={session}
          sessionReady={sessionReady}
          onAccount={() => setAccountOpen(true)}
        />
        <section className="studio-main assets-main">
          <AssetLibrary
            assets={assets}
            onDelete={(asset) => {
              if (!window.confirm(`确定删除“${asset.title}”吗？删除后无法恢复。`)) return;
              void fetch(`/api/assets/${encodeURIComponent(asset.id)}`, { method: "DELETE" })
                .then(async (response) => {
                  if (!response.ok) throw new Error(await responseError(response));
                  setAssets((current) => current.filter((item) => item.id !== asset.id));
                  if (preview?.id === asset.id) setPreview(null);
                  showNotice("资产已删除");
                })
                .catch((error) => showNotice(error instanceof Error ? error.message : "资产删除失败"));
            }}
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
            onDownload={(format) => {
              void fetchDownload(preview.image, preview.title, format).catch((error) =>
                showNotice(error instanceof Error ? error.message : "图片下载失败")
              );
            }}
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
        onHome={openHome}
        onConversation={openConversation}
        onAssets={() => setScreen("assets")}
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
          <div
            ref={homeComposerAnchor}
            className={`home-inline-composer${homeComposerMinimized ? " is-docked" : ""}`}
            aria-hidden={homeComposerMinimized || undefined}
          >
              <Composer
                key={`home-inline-composer-${mode}`}
                compact
                prompt={prompt}
                uploads={uploads}
                referenceVideo={referenceVideo}
                mode={mode}
                generationModel={generationModel}
                videoRatio={videoRatio}
                videoDuration={videoDuration}
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
                onSend={() => startGeneration("home")}
                onMode={changeMode}
                onGenerationModel={setGenerationModel}
                onVideoRatio={setVideoRatio}
                onVideoDuration={setVideoDuration}
                onSkill={changeSkill}
                onRegion={setRegion}
                onLanguage={setLanguage}
                onBrand={setBrand}
                onSuite={setSuite}
              />
          </div>
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
            generationModel={generationModel}
            videoRatio={videoRatio}
            videoDuration={videoDuration}
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
            onSend={() => startGeneration("home")}
            onMode={changeMode}
            onGenerationModel={setGenerationModel}
            onVideoRatio={setVideoRatio}
            onVideoDuration={setVideoDuration}
            onSkill={changeSkill}
            onRegion={setRegion}
            onLanguage={setLanguage}
            onBrand={setBrand}
            onSuite={setSuite}
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
