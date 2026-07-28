"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { imageTaskCount } from "./image-task-count.mjs";

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

const modes: Option[] = [
  { id: "image", label: "图片生成", description: "生成商品图、场景图与电商套图" },
  { id: "video", label: "视频生成", description: "生成商品视频与带货口播" },
  { id: "listing", label: "Listing 生成", description: "生成亚马逊商品链接内容" },
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
    description: "生成标题、卖点、描述、定价与 A+ 文案",
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

const aPlusCounts: Option[] = Array.from({ length: 6 }, (_, count) => ({
  id: String(count),
  label: `${count} 张`,
}));

const mainImageCounts: Option[] = Array.from({ length: 8 }, (_, index) => ({
  id: String(index + 1),
  label: `${index + 1} 张`,
}));

const mainImageRatios: Option[] = [
  { id: "1:1", label: "1:1" },
  { id: "3:4", label: "3:4" },
];

const defaultBrandSettings: BrandSettings = {
  primaryColor: "#111111",
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
    phases: ["识别商品信息", "生成标题与卖点", "生成定价与详情", "排版 A+ 页面"],
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

const prices: Record<string, { symbol: string; major: string; minor: string; list: string }> = {
  us: { symbol: "$", major: "79", minor: "99", list: "$99.99" },
  uk: { symbol: "£", major: "69", minor: "99", list: "£89.99" },
  de: { symbol: "€", major: "74", minor: "99", list: "€94.99" },
  jp: { symbol: "¥", major: "11,980", minor: "", list: "¥14,980" },
  sea: { symbol: "$", major: "82", minor: "00", list: "$105.00" },
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
  onChange: (value: string) => void;
  prefix?: string;
  rich?: boolean;
  accent?: boolean;
  testId: string;
}) {
  const selected = options.find((option) => option.id === value) ?? options[0];

  return (
    <div className={`option-menu ${rich ? "option-menu-rich" : ""} ${accent ? "option-menu-accent" : ""}`}>
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
          {open ? "⌃" : "⌄"}
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

function Composer({
  compact = false,
  prompt,
  uploads,
  mode,
  skill,
  region,
  language,
  brand,
  suite,
  disabled,
  onPrompt,
  onFiles,
  onRemove,
  onSend,
  onMode,
  onSkill,
  onRegion,
  onLanguage,
  onBrand,
  onSuite,
}: {
  compact?: boolean;
  prompt: string;
  uploads: Upload[];
  mode: GenerationMode;
  skill: string;
  region: string;
  language: string;
  brand: BrandSettings;
  suite: SuiteSettings;
  disabled: boolean;
  onPrompt: (value: string) => void;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: string) => void;
  onSend: () => void;
  onMode: (value: GenerationMode) => void;
  onSkill: (value: string) => void;
  onRegion: (value: string) => void;
  onLanguage: (value: string) => void;
  onBrand: (value: BrandSettings) => void;
  onSuite: (value: SuiteSettings) => void;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [promptIdea, setPromptIdea] = useState(0);
  const [promptIdeaText, setPromptIdeaText] = useState(promptIdeasByMode[mode][0]);
  const [deletingPromptIdea, setDeletingPromptIdea] = useState(false);
  const modeSkills = skillsByMode(mode);

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

  const submitOnShortcut = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !disabled) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <section className={`composer ${compact ? "composer-compact" : ""}`}>
      <div className="composer-body">
        {uploads.length ? (
          <div className="upload-strip" aria-label="已添加商品图">
            {uploads.map((upload) => (
              <figure className="upload-thumb" key={upload.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={upload.url} alt={upload.name} />
                <button
                  type="button"
                  aria-label={`移除 ${upload.name}`}
                  onClick={() => onRemove(upload.id)}
                >
                  ×
                </button>
              </figure>
            ))}
          </div>
        ) : null}

        <label className="prompt-label" htmlFor={compact ? "conversation-prompt" : "main-prompt"}>
          {compact ? "继续发送新任务" : "描述你希望生成的内容"}
        </label>
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
      </div>

      <div className="composer-toolbar">
        <div className="settings-cluster">
          <label className="upload-button">
            <input
              type="file"
              accept="image/*"
              data-testid="file-input"
              onChange={onFiles}
            />
            <span aria-hidden="true">＋</span>
            <span>上传图片</span>
          </label>
          <OptionMenu
            label="选择生成模式"
            options={modes}
            value={mode}
            open={openMenu === "mode"}
            onOpen={() => setOpenMenu(openMenu === "mode" ? null : "mode")}
            onChange={(value) => {
              onMode(value as GenerationMode);
              setOpenMenu(null);
            }}
            accent
            testId="mode-trigger"
          />
          <div className="brand-gene-control">
            <button
              type="button"
              className="option-trigger brand-gene-trigger"
              aria-expanded={openMenu === "brand-gene"}
              aria-controls={compact ? "compact-brand-gene-panel" : "brand-gene-panel"}
              data-testid="brand-gene-trigger"
              onClick={() => setOpenMenu(openMenu === "brand-gene" ? null : "brand-gene")}
            >
              <span>品牌基因</span>
              <span className="chevron" aria-hidden="true">
                {openMenu === "brand-gene" ? "⌃" : "⌄"}
              </span>
            </button>
          </div>
          <OptionMenu
            label={`${modes.find((item) => item.id === mode)?.label ?? "生成"} Skill`}
            options={modeSkills}
            value={skill}
            open={openMenu === "skill"}
            onOpen={() => setOpenMenu(openMenu === "skill" ? null : "skill")}
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
                onChange={(value) => {
                  onSuite({ ...suite, aPlusCount: Number(value) });
                  setOpenMenu(null);
                }}
                prefix="A+ 图"
                testId="a-plus-count-trigger"
              />
              <OptionMenu
                label="主副图数量"
                options={mainImageCounts}
                value={String(suite.mainImageCount)}
                open={openMenu === "main-image-count"}
                onOpen={() => setOpenMenu(openMenu === "main-image-count" ? null : "main-image-count")}
                onChange={(value) => {
                  onSuite({ ...suite, mainImageCount: Number(value) });
                  setOpenMenu(null);
                }}
                prefix="主副图"
                testId="main-image-count-trigger"
              />
              <OptionMenu
                label="主副图比例"
                options={mainImageRatios}
                value={suite.mainImageRatio}
                open={openMenu === "main-image-ratio"}
                onOpen={() => setOpenMenu(
                  openMenu === "main-image-ratio" ? null : "main-image-ratio",
                )}
                onChange={(value) => {
                  onSuite({ ...suite, mainImageRatio: value as "1:1" | "3:4" });
                  setOpenMenu(null);
                }}
                prefix="主副图比例"
                testId="main-image-ratio-trigger"
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
            disabled={disabled}
            onClick={onSend}
          >
            ↑
          </button>
        </div>
      </div>

      {openMenu === "brand-gene" ? (
        <section
          className="brand-gene-panel"
          id={compact ? "compact-brand-gene-panel" : "brand-gene-panel"}
          data-testid="brand-gene-panel"
          aria-label="品牌基因设置"
        >
          <label className="brand-field color-field">
            <span>品牌主色</span>
            <div>
              <input
                type="color"
                value={brand.primaryColor}
                aria-label="选择品牌主色"
                data-testid="brand-color-picker"
                onChange={(event) => onBrand({ ...brand, primaryColor: event.target.value })}
              />
              <input
                type="text"
                value={brand.primaryColor.toUpperCase()}
                aria-label="品牌主色十六进制"
                data-testid="brand-color-text"
                maxLength={7}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^#[0-9a-f]{6}$/i.test(value)) {
                    onBrand({ ...brand, primaryColor: value });
                  }
                }}
              />
            </div>
          </label>
          <label className="brand-field">
            <span>字体风格</span>
            <select
              value={brand.fontStyle}
              data-testid="font-style-select"
              onChange={(event) => onBrand({ ...brand, fontStyle: event.target.value })}
            >
              {fontStyles.map((option) => (
                <option value={option.id} key={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="brand-field">
            <span>销售国家/地区</span>
            <select
              value={region}
              data-testid="region-trigger"
              onChange={(event) => onRegion(event.target.value)}
            >
              {regions.map((option) => (
                <option value={option.id} key={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="brand-field">
            <span>生成内容语言</span>
            <select
              value={language}
              data-testid="language-trigger"
              onChange={(event) => onLanguage(event.target.value)}
            >
              {languages.map((option) => (
                <option value={option.id} key={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="brand-field">
            <span>发布平台</span>
            <select
              value={brand.platform}
              data-testid="platform-select"
              onChange={(event) => onBrand({ ...brand, platform: event.target.value })}
            >
              {platforms.map((option) => (
                <option value={option.id} key={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <p className="brand-gene-summary">
            {platforms.find((item) => item.id === brand.platform)?.label} ·{" "}
            {regions.find((item) => item.id === region)?.label} ·{" "}
            {languages.find((item) => item.id === language)?.label}
          </p>
        </section>
      ) : null}
    </section>
  );
}

function ListingResult({
  productImage,
  language,
  region,
  data,
  generatedImages = [],
  suite,
  ready,
  onNotice,
}: {
  productImage: string;
  language: string;
  region: string;
  data?: ListingData;
  generatedImages?: string[];
  suite: SuiteSettings;
  ready: boolean;
  onNotice: (text: string) => void;
}) {
  const copy = listingCopy[language as keyof typeof listingCopy] ?? listingCopy.en;
  const price = prices[region] ?? prices.us;
  const [galleryImage, setGalleryImage] = useState("");
  const [title, setTitle] = useState(plainListingText(data?.title, copy.title));
  const [salePrice, setSalePrice] = useState(
    data?.salePrice?.trim() || `${price.major}${price.minor ? `.${price.minor}` : ""}`,
  );
  const [listPrice, setListPrice] = useState(
    data?.listPrice?.trim() || price.list.replace(price.symbol, ""),
  );
  const [bullets, setBullets] = useState(data?.bullets ?? copy.bullets);
  const [description, setDescription] = useState(
    plainListingText(data?.description, copy.description),
  );
  const [aPlusHeadline, setAPlusHeadline] = useState(
    plainListingText(data?.aPlusHeadline, "Your product story, made for this market."),
  );
  const [specs, setSpecs] = useState(
    Object.entries(data?.specifications ?? {
      Brand: data?.brand ?? "Generic",
      "Product type": "To be confirmed",
      "Recommended use": "Everyday use",
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
    : [productImage, "/product-lifestyle.png", "/product-outdoor.png"];
  const shownGalleryImage = galleryImage || listingImages[0];
  const productSlug = data?.productUrlSlug ?? "MERCATO-GENERATED";

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

  const updateBullet = (index: number, value: string) => {
    setBullets((current) =>
      current.map((bullet, bulletIndex) => bulletIndex === index ? value : bullet),
    );
  };

  const updateSpec = (index: number, value: string) => {
    setSpecs((current) =>
      current.map((spec, specIndex) => specIndex === index ? [spec[0], value] : spec),
    );
  };

  const listingJson = JSON.stringify({
    schemaVersion: 1,
    marketplace: regions.find((item) => item.id === region)?.label,
    language: languages.find((item) => item.id === language)?.label,
    productUrl: `https://marketplace.example/dp/${productSlug}`,
    title,
    pricing: {
      type: "AI merchandising suggestion",
      currency: price.symbol,
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
          <button type="button" onClick={copyLink} data-testid="copy-listing-link">
            复制链接
          </button>
          <a
            href={downloadHref}
            download={`brewgo-listing-${region}-${language}.json`}
            onClick={() => onNotice("Listing JSON 已下载")}
            data-testid="download-listing"
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
            onChange={(event) => setTitle(event.target.value)}
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
            <span>{category}</span>
          </div>
          <hr />
          <div className="price-line">
            <span className="discount">-20%</span>
            <span className="price">
              <sup>{price.symbol}</sup>
              <input
                className="editable-field price-input"
                value={salePrice}
                onChange={(event) => setSalePrice(event.target.value)}
                aria-label="编辑销售价格"
                data-testid="listing-price-input"
              />
            </span>
          </div>
          <label className="list-price">
            List Price: {price.symbol}
            <input
              className="editable-field list-price-input"
              value={listPrice}
              onChange={(event) => setListPrice(event.target.value)}
              aria-label="编辑原价"
            />
          </label>
          <p className="tax-note">No Import Fees Deposit &amp; free returns</p>
          <div className="coupon">
            <b>Coupon</b>
            <span>Apply 10% coupon</span>
          </div>
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
            <sup>{price.symbol}</sup>{salePrice}
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
            src={generatedAPlusImages[0] ?? "/product-lifestyle.png"}
            alt={`${brand} 品牌场景`}
          />
          <div>
            <span>{brand.toUpperCase()}</span>
            <textarea
              className="editable-field a-plus-title-input"
              value={aPlusHeadline}
              onChange={(event) => setAPlusHeadline(event.target.value)}
              aria-label="编辑 A+ 标题"
              rows={2}
            />
            <textarea
              className="editable-field description-input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
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
  skillId,
  taskCount,
  suite,
  generatedImages = [],
  failedSlots = [],
  onPreview,
  onRegenerate,
  regenerating,
}: {
  skillId: string;
  taskCount: number;
  suite?: SuiteSettings;
  generatedImages?: string[];
  failedSlots?: number[];
  onPreview: (item: GalleryItem) => void;
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
                    onClick={() => onPreview(item)}
                    aria-label={`预览 ${item.title}`}
                    data-testid={`preview-image-${index}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image} alt={item.title} className={item.crop ?? ""} />
                  </button>
                  <footer>
                    <div><span>{item.group}</span><strong>{item.title}</strong></div>
                    <div>
                      <a href={item.image} download>下载</a>
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
  skillId,
  generatedImage,
  ready,
  onPreview,
  onRegenerate,
  regenerating,
}: {
  skillId: string;
  generatedImage?: string;
  ready: boolean;
  onPreview: (item: GalleryItem) => void;
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
              onClick={() => onPreview(item)}
              aria-label={`预览 ${item.title}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt={item.title} />
            </button>
            <footer>
              <div><span>{item.group}</span><strong>{item.title}</strong></div>
              <div>
                <a href={item.image} download>下载原图</a>
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
  ready,
  productImage,
  videoUrl,
  onNotice,
}: {
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
        <button type="button" onClick={() => onNotice("视频文件已准备下载")}>下载视频</button>
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
            <source src={videoUrl ?? "/product-demo.mp4"} type="video/mp4" />
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
  turns,
  activeTurnId,
  onHome,
  onStudio,
  onNewTask,
  onRename,
  onDelete,
}: {
  screen: "home" | "studio";
  turns: Turn[];
  activeTurnId: string | null;
  onHome: () => void;
  onStudio: (turnId?: string) => void;
  onNewTask: () => void;
  onRename: (turnId: string, title: string) => void;
  onDelete: (turnId: string) => void;
}) {
  const latestTurn = turns[turns.length - 1];
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    turnId: string;
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

  useEffect(() => {
    if (!userMenuOpen) return;
    const close = () => setUserMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [userMenuOpen]);

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
        <button type="button" className={screen === "home" ? "active" : ""} onClick={onHome}>⌂ 首页</button>
        <button
          type="button"
          className={screen === "studio" ? "active" : ""}
          disabled={!turns.length}
          onClick={() => onStudio(turns[0]?.id)}
        >
          ◉ 当前对话
        </button>
        <button type="button" disabled={!turns.length} onClick={() => onStudio(latestTurn?.id)}>◇ 最近结果</button>
      </nav>
      {screen === "studio" ? (
        <button className="new-chat" type="button" onClick={onNewTask}>
          ＋ 添加新任务
        </button>
      ) : null}
      <nav className="conversation-list" aria-label="当前对话任务">
        <span className="nav-caption">
          {turns.length ? `当前对话 · ${turns.length} 个任务` : "还没有生成记录"}
        </span>
        {turns.map((turn) => {
          const total = progressTotal(turn);
          return (
            <button
              type="button"
              className={screen === "studio" && turn.id === activeTurnId ? "conversation-active" : ""}
              onClick={() => onStudio(turn.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                setContextMenu({ turnId: turn.id, x: event.clientX, y: event.clientY });
              }}
              key={turn.id}
            >
              <strong>{turn.title}</strong>
              <small>{turn.running ? `${turn.completed} / ${total}` : turn.completed === total ? "生成完成" : `${turn.completed} / ${total}`}</small>
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
              const turn = turns.find((item) => item.id === contextMenu.turnId);
              const title = window.prompt("重命名对话", turn?.title ?? "");
              if (title?.trim()) onRename(contextMenu.turnId, title.trim());
            }}
          >
            重命名
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              const turn = turns.find((item) => item.id === contextMenu.turnId);
              if (window.confirm(`确定删除「${turn?.title ?? "这个任务"}」吗？`)) {
                onDelete(contextMenu.turnId);
              }
            }}
          >
            删除
          </button>
        </div>
      ) : null}
      <div className="sidebar-account">
        {userMenuOpen ? (
          <div className="account-menu" role="menu" data-testid="account-menu">
            <div className="account-menu-head">
              <span className="avatar" aria-hidden="true">Y</span>
              <div><strong>我的账户</strong><small>Mercato 创作者</small></div>
            </div>
            {["个人资料", "设置", "外观", "帮助与支持"].map((item) => (
              <button type="button" role="menuitem" key={item}>{item}<span>›</span></button>
            ))}
            <button type="button" role="menuitem" className="sign-out">退出登录</button>
          </div>
        ) : null}
        <button
          type="button"
          className="sidebar-user"
          aria-label="个人账户"
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          onClick={(event) => {
            event.stopPropagation();
            setUserMenuOpen((open) => !open);
          }}
          data-testid="account-trigger"
        >
          <span className="avatar" aria-hidden="true">Y</span>
          <span>
            <strong>我的账户</strong>
            <small>个人设置</small>
          </span>
        </button>
      </div>
    </aside>
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
  const [screen, setScreen] = useState<"home" | "studio">("home");
  const [prompt, setPrompt] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [mode, setMode] = useState<GenerationMode>("image");
  const [skill, setSkill] = useState("amazon-image-set");
  const [region, setRegion] = useState("us");
  const [language, setLanguage] = useState("en");
  const [brand, setBrand] = useState<BrandSettings>(defaultBrandSettings);
  const [suite, setSuite] = useState<SuiteSettings>(defaultSuiteSettings);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [preview, setPreview] = useState<GalleryItem | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const controllers = useRef<Map<string, AbortController>>(new Map());
  const turnCounter = useRef(0);

  const modeSkills = skillsByMode(mode);
  const selectedSkill =
    modeSkills.find((item) => item.id === skill) ?? modeSkills[0];
  const selectedKind = selectedSkill.kind;
  const productImage = uploads[0]?.url ?? "/product-main.png";
  const activeTurn = turns.find((turn) => turn.id === activeTurnId) ?? turns[turns.length - 1];

  useEffect(() => () => {
    controllers.current.forEach((controller) => controller.abort());
    controllers.current.clear();
  }, []);

  const showNotice = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const addSample = () => {
    setUploads([{ id: "sample", name: "便携咖啡机示例图", url: "/product-main.png" }]);
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

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploads([{
      id: `${file.name}-${file.lastModified}`,
      name: file.name,
      url: URL.createObjectURL(file),
      owned: true,
      file,
    }]);
    event.target.value = "";
  };

  const removeUpload = (id: string) => {
    setUploads((current) => current.filter((upload) => upload.id !== id));
  };

  const patchTurn = (turnId: string, patch: Partial<Turn>) => {
    setTurns((current) =>
      current.map((turn) => turn.id === turnId ? { ...turn, ...patch } : turn),
    );
  };

  const generationForm = async (
    turn: Turn,
    upload: Upload,
    action: "listing" | "image" | "video",
    slot?: number,
  ) => {
    const form = new FormData();
    form.set("action", action);
    form.set("mode", turn.mode);
    form.set("skill", turn.skill);
    form.set("region", turn.region);
    form.set("language", turn.language);
    form.set("platform", turn.brand.platform);
    form.set("brandColor", turn.brand.primaryColor);
    form.set("fontStyle", turn.brand.fontStyle);
    form.set("aPlusType", turn.suite.aPlusType);
    form.set("aPlusCount", String(turn.suite.aPlusCount));
    form.set("mainImageCount", String(turn.suite.mainImageCount));
    form.set("mainImageRatio", turn.suite.mainImageRatio);
    form.set("brandContext", JSON.stringify({
      primaryColor: turn.brand.primaryColor,
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
    const file = await uploadAsFile(upload);
    form.set("image", file, file.name);
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

  const runListing = async (turn: Turn, upload: Upload, signal: AbortSignal) => {
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
      body: await generationForm(turn, upload, "listing"),
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
      return;
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
          results[slot] = await runImageTask(
            await generationForm(turn, upload, "image", slot),
            signal,
          );
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
  };

  const runImages = async (turn: Turn, upload: Upload, signal: AbortSignal) => {
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
          results[slot] = await runImageTask(
            await generationForm(turn, upload, "image", slot),
            signal,
          );
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
  };

  const runVideo = async (turn: Turn, upload: Upload, signal: AbortSignal) => {
    patchTurn(turn.id, { phase: "正在提交视频任务", completed: 1 });
    const response = await fetch("/api/generate", {
      method: "POST",
      body: await generationForm(turn, upload, "video"),
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
        patchTurn(turn.id, {
          videoUrl,
          phase: "生成完成",
          completed: generationCopy.video.phases.length,
          running: false,
        });
        return;
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

  const runGeneration = async (turn: Turn, upload: Upload) => {
    const controller = new AbortController();
    controllers.current.set(turn.id, controller);
    patchTurn(turn.id, { running: true, error: undefined });
    try {
      if (turn.kind === "listing") await runListing(turn, upload, controller.signal);
      else if (turn.kind === "video") await runVideo(turn, upload, controller.signal);
      else await runImages(turn, upload, controller.signal);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      patchTurn(turn.id, {
        running: false,
        error: error instanceof Error ? error.message : "生成失败",
        phase: "生成失败",
      });
    } finally {
      controllers.current.delete(turn.id);
    }
  };

  const startGeneration = () => {
    if (!uploads.length) return;
    const id = `turn-${turnCounter.current += 1}`;
    const taskPrompt = prompt.trim() || selectedSkill.starter;
    const configuredImageCount = hasSuiteSettings(selectedSkill.id)
      ? suiteTaskCount(selectedSkill.id, suite, taskPrompt)
      : imageTaskCount(selectedKind, taskPrompt);
    const turn: Turn = {
      id,
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
      completed: 0,
      running: true,
      phase: generationCopy[selectedKind].phases[0],
      imageTaskCount: configuredImageCount || undefined,
    };
    setTurns((current) => [...current, turn]);
    setActiveTurnId(id);
    setScreen("studio");
    setPrompt("");
    window.setTimeout(() => {
      void runGeneration(turn, uploads[0]);
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
        await generationForm(turn, {
          id: `${turn.id}-regenerate`,
          name: "product.png",
          url: turn.productImage,
        }, "image", slot),
      );
      setTurns((current) => current.map((currentTurn) => {
        if (currentTurn.id !== turn.id) return currentTurn;
        const images = [...(currentTurn.images ?? [])];
        images[slot] = url;
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
      }));
      setRegenerating(null);
      showNotice(`「${item.title}」已更新`);
    } catch (error) {
      setRegenerating(null);
      showNotice(error instanceof Error ? error.message : "重新生成失败");
    }
  };

  const openStudio = (turnId?: string) => {
    if (!turns.length) return;
    const targetTurnId = turnId ?? turns[turns.length - 1].id;
    setActiveTurnId(targetTurnId);
    setScreen("studio");
    window.setTimeout(() => {
      document.getElementById(targetTurnId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const renameTurn = (turnId: string, title: string) => {
    setTurns((current) =>
      current.map((turn) => turn.id === turnId ? { ...turn, title } : turn),
    );
    showNotice("对话已重命名");
  };

  const deleteTurn = (turnId: string) => {
    controllers.current.get(turnId)?.abort();
    controllers.current.delete(turnId);
    const remaining = turns.filter((turn) => turn.id !== turnId);
    setTurns(remaining);
    if (!remaining.length) {
      setActiveTurnId(null);
      setScreen("home");
    } else if (activeTurnId === turnId) {
      setActiveTurnId(remaining[remaining.length - 1].id);
    }
    showNotice("对话已删除");
  };

  const openNewTask = () => {
    setScreen("home");
    window.setTimeout(() => document.getElementById("main-prompt")?.focus(), 0);
  };

  if (screen === "studio") {
    return (
      <main className="studio" data-testid="studio">
        <AppSidebar
          screen={screen}
          turns={turns}
          activeTurnId={activeTurnId}
          onHome={() => setScreen("home")}
          onStudio={openStudio}
          onNewTask={openNewTask}
          onRename={renameTurn}
          onDelete={deleteTurn}
        />

        <section className="studio-main conversation-main">
          <header className="studio-header" id="conversation-top">
            <h1>{activeTurn?.title ?? conversationTitle}</h1>
            <span className="output-type">{turns.length} 个任务</span>
          </header>

          <section className="conversation-stream" aria-label="创作对话">
            {turns.map((turn, index) => {
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
                      <div className="message-product">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={turn.productImage} alt="用户上传的商品" />
                      </div>
                      <div className="message-copy">
                        <span>你</span>
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
                          <span>Mercato AI</span>
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
                            onClick={() => void runGeneration(turn, {
                              id: `${turn.id}-retry`,
                              name: "product.png",
                              url: turn.productImage,
                            })}
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
                            productImage={turn.productImage}
                            language={turn.language}
                            region={turn.region}
                            data={turn.listing}
                            generatedImages={turn.images}
                            suite={turn.suite}
                            ready={ready}
                            onNotice={showNotice}
                          />
                        ) : null}
                        {turn.kind === "images" ? (
                          <ImageSuite
                            skillId={turn.skill}
                            taskCount={turn.imageTaskCount ?? 6}
                            suite={turn.suite}
                            generatedImages={turn.images}
                            failedSlots={turn.failedImageSlots}
                            onPreview={setPreview}
                            onRegenerate={(item) => void regenerate(turn, item)}
                            regenerating={regenerating}
                          />
                        ) : null}
                        {turn.kind === "seeding" ? (
                          <ImageSuite
                            skillId={turn.skill}
                            taskCount={turn.imageTaskCount ?? 4}
                            suite={turn.suite}
                            generatedImages={turn.images}
                            failedSlots={turn.failedImageSlots}
                            onPreview={setPreview}
                            onRegenerate={(item) => void regenerate(turn, item)}
                            regenerating={regenerating}
                          />
                        ) : null}
                        {turn.kind === "single" ? (
                          <SingleImageResult
                            skillId={turn.skill}
                            generatedImage={turn.images?.[0]}
                            ready={ready}
                            onPreview={setPreview}
                            onRegenerate={(item) => void regenerate(turn, item)}
                            regenerating={regenerating}
                          />
                        ) : null}
                        {turn.kind === "video" ? (
                          <VideoResult
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

          <div className="studio-composer">
            <Composer
              key={`studio-composer-${mode}`}
              compact
              prompt={prompt}
              uploads={uploads}
              mode={mode}
              skill={skill}
              region={region}
              language={language}
              brand={brand}
              suite={suite}
              disabled={!uploads.length}
              onPrompt={setPrompt}
              onFiles={handleFiles}
              onRemove={removeUpload}
              onSend={startGeneration}
              onMode={changeMode}
              onSkill={setSkill}
              onRegion={setRegion}
              onLanguage={setLanguage}
              onBrand={setBrand}
              onSuite={setSuite}
            />
          </div>
        </section>

        {preview ? (
          <div
            className="preview-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`预览 ${preview.title}`}
            data-testid="preview-modal"
          >
            <button type="button" className="preview-close" onClick={() => setPreview(null)} aria-label="关闭预览">×</button>
            <div className="preview-content">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.image} alt={preview.title} />
              <footer>
                <div><span>{preview.group}</span><strong>{preview.title}</strong></div>
                <a href={preview.image} download>下载原图</a>
              </footer>
            </div>
          </div>
        ) : null}

        {notice ? <div className="toast" role="status" data-testid="toast">{notice}</div> : null}
      </main>
    );
  }

  return (
    <main className="studio home-shell">
      <AppSidebar
        screen={screen}
        turns={turns}
        activeTurnId={activeTurnId}
        onHome={() => setScreen("home")}
        onStudio={openStudio}
        onNewTask={openNewTask}
        onRename={renameTurn}
        onDelete={deleteTurn}
      />
      <section className="home-workspace" id="create">
        <div className="home-stage">
          <div className="home-copy">
            <h1>一张商品图，生成亚马逊链接</h1>
          </div>
          <div className="home-composer-wrap">
            <div className="home-sample-row">
              <button type="button" className="sample-button" data-testid="sample-product" onClick={addSample}>使用示例商品</button>
            </div>
            <Composer
              key={`home-composer-${mode}`}
              prompt={prompt}
              uploads={uploads}
              mode={mode}
              skill={skill}
              region={region}
              language={language}
              brand={brand}
              suite={suite}
              disabled={!uploads.length}
              onPrompt={setPrompt}
              onFiles={handleFiles}
              onRemove={removeUpload}
              onSend={startGeneration}
              onMode={changeMode}
              onSkill={setSkill}
              onRegion={setRegion}
              onLanguage={setLanguage}
              onBrand={setBrand}
              onSuite={setSuite}
            />
            {turns.length ? (
              <button type="button" className="resume-conversation" onClick={() => openStudio()}>
                返回当前对话 · {turns.length} 个任务
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
