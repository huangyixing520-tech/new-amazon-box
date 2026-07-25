"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

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
};

type SkillKind = "listing" | "images" | "single" | "seeding" | "video";

type SkillOption = Option & {
  kind: SkillKind;
  starter: string;
};

type GalleryItem = {
  id: string;
  group: string;
  title: string;
  image: string;
  wide?: boolean;
  crop?: string;
};

type Turn = {
  id: string;
  title: string;
  prompt: string;
  skill: string;
  kind: SkillKind;
  region: string;
  language: string;
  productImage: string;
  completed: number;
  running: boolean;
};

const skills: SkillOption[] = [
  {
    id: "listing",
    kind: "listing",
    label: "Amazon Listing",
    description: "生成完整商品链接、文案与 A+ 详情",
    starter: "生成完整商品 Listing",
  },
  {
    id: "amazon-image-set",
    kind: "images",
    label: "Amazon A+／卖点套图",
    description: "生成 A+ 图、卖点图或完整 Amazon 套图",
    starter: "生成 Amazon A+ 图和卖点套图",
  },
  {
    id: "ecommerce-image-set",
    kind: "images",
    label: "跨境电商套图",
    description: "适配 Amazon、TikTok、Shopee 的营销套图",
    starter: "生成跨境电商商品营销套图",
  },
  {
    id: "amazon-scene-image",
    kind: "single",
    label: "Amazon 人物场景图",
    description: "生成真人使用或操作商品的生活方式图",
    starter: "生成一张 Amazon 人物使用场景图",
  },
  {
    id: "china-ecommerce-main-image",
    kind: "single",
    label: "国内电商主图",
    description: "生成淘宝、天猫、京东等中文商品主图",
    starter: "生成一张国内中文电商商品主图",
  },
  {
    id: "china-seeding-image",
    kind: "seeding",
    label: "种草组图",
    description: "生成好物分享、安利与合集种草图片",
    starter: "生成一组 3:4 商品种草图",
  },
  {
    id: "white-background-image",
    kind: "single",
    label: "商品白底精修",
    description: "抠图换纯白背景并精修商品质感",
    starter: "生成一张平台规范的商品白底图",
  },
  {
    id: "video",
    kind: "video",
    label: "商品视频",
    description: "生成商品短视频与镜头脚本",
    starter: "生成一支 15 秒商品短视频",
  },
];

const regions: Option[] = [
  { id: "us", label: "美国站" },
  { id: "uk", label: "英国站" },
  { id: "de", label: "德国站" },
  { id: "jp", label: "日本站" },
  { id: "sea", label: "东南亚" },
];

const languages: Option[] = [
  { id: "en", label: "English" },
  { id: "de", label: "Deutsch" },
  { id: "jp", label: "日本語" },
  { id: "zh", label: "简体中文" },
];

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
  jp: {
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
const promptIdeas = [
  "亚马逊商品链接",
  "一套商品主副图",
  "A+ 卖点套图",
  "15 秒商品视频",
];

function OptionMenu({
  label,
  options,
  value,
  open,
  onOpen,
  onChange,
  prefix,
  rich = false,
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
  testId: string;
}) {
  const selected = options.find((option) => option.id === value) ?? options[0];

  return (
    <div className={`option-menu ${rich ? "option-menu-rich" : ""}`}>
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
  skill,
  region,
  language,
  disabled,
  onPrompt,
  onFiles,
  onRemove,
  onSend,
  onSkill,
  onRegion,
  onLanguage,
}: {
  compact?: boolean;
  prompt: string;
  uploads: Upload[];
  skill: string;
  region: string;
  language: string;
  disabled: boolean;
  onPrompt: (value: string) => void;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: string) => void;
  onSend: () => void;
  onSkill: (value: string) => void;
  onRegion: (value: string) => void;
  onLanguage: (value: string) => void;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [promptIdea, setPromptIdea] = useState(0);

  useEffect(() => {
    if (compact || prompt || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setPromptIdea((current) => (current + 1) % promptIdeas.length),
      2200,
    );
    return () => window.clearInterval(timer);
  }, [compact, prompt]);

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
              : `让 Mercato 帮我生成${promptIdeas[promptIdea]}`
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
            <span>商品图</span>
          </label>
          <OptionMenu
            label="选择 Skill"
            options={skills}
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
          <OptionMenu
            label="销售地区"
            options={regions}
            value={region}
            open={openMenu === "region"}
            onOpen={() => setOpenMenu(openMenu === "region" ? null : "region")}
            onChange={(value) => {
              onRegion(value);
              setOpenMenu(null);
            }}
            testId="region-trigger"
          />
          <OptionMenu
            label="输出语言"
            options={languages}
            value={language}
            open={openMenu === "language"}
            onOpen={() => setOpenMenu(openMenu === "language" ? null : "language")}
            onChange={(value) => {
              onLanguage(value);
              setOpenMenu(null);
            }}
            testId="language-trigger"
          />
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
    </section>
  );
}

function ListingResult({
  productImage,
  language,
  region,
  ready,
  onNotice,
}: {
  productImage: string;
  language: string;
  region: string;
  ready: boolean;
  onNotice: (text: string) => void;
}) {
  const copy = listingCopy[language as keyof typeof listingCopy] ?? listingCopy.en;
  const price = prices[region] ?? prices.us;
  const [galleryImage, setGalleryImage] = useState("");
  const [title, setTitle] = useState(copy.title);
  const [salePrice, setSalePrice] = useState(
    `${price.major}${price.minor ? `.${price.minor}` : ""}`,
  );
  const [listPrice, setListPrice] = useState(price.list.replace(price.symbol, ""));
  const [bullets, setBullets] = useState(copy.bullets);
  const [description, setDescription] = useState(copy.description);
  const [aPlusHeadline, setAPlusHeadline] = useState("Your café ritual, anywhere.");
  const [specs, setSpecs] = useState([
    ["Brand", "BrewGo"],
    ["Color", "Carbon Black"],
    ["Dimensions", '3.1"D × 3.1"W × 9.6"H'],
    ["Special Feature", "Self Heating, Portable"],
    ["Pressure", "20 Bar"],
    ["Battery", "7500 mAh"],
    ["Material", "Food-grade stainless steel"],
    ["Item Weight", "1.5 pounds"],
  ]);
  const shownGalleryImage = galleryImage || productImage;

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
      "https://marketplace.example/dp/BREWGO-20BAR",
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
    productUrl: "https://marketplace.example/dp/BREWGO-20BAR",
    title,
    pricing: {
      currency: price.symbol,
      salePrice,
      listPrice,
    },
    rating: 4.6,
    reviewCount: 1284,
    bullets,
    description,
    aPlus: {
      headline: aPlusHeadline,
      featureStats: [
        ["20 BAR", "Rich, balanced extraction"],
        ["3 MIN", "Heat and brew"],
        ["USB-C", "Charge wherever you go"],
      ],
    },
    specifications: Object.fromEntries(specs),
    images: [productImage, "/product-lifestyle.png", "/product-outdoor.png"],
    generatedBy: "Mercato AI prototype",
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
          <span className="listing-url">marketplace.example/dp/BREWGO-20BAR</span>
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
        Home & Kitchen › Coffee Machines › Portable Espresso Makers
      </div>

      <div className="market-product">
        <div className="market-gallery">
          <div className="thumbnail-rail" aria-label="商品图片">
            {[productImage, "/product-lifestyle.png", "/product-outdoor.png"].map(
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
            <img src={shownGalleryImage} alt="BrewGo 便携咖啡机" />
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
          <a href="#brand">Visit the BrewGo Store</a>
          <div className="rating-row">
            <b>4.6</b>
            <span className="stars">★★★★★</span>
            <a href="#reviews">1,284 ratings</a>
            <span> | </span>
            <a href="#questions">142 answered questions</a>
          </div>
          <div className="badge-row">
            <b>#1 Best Seller</b>
            <span>in Portable Espresso Makers</span>
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
          <div className="variation-row"><b>Color:</b> Carbon Black</div>
          <div className="color-swatch">
            <button type="button" aria-label="Carbon Black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={productImage} alt="" />
            </button>
          </div>
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
          <p><a href="#delivery">FREE delivery</a> Wednesday, July 29</p>
          <p>Or fastest delivery <b>Tomorrow</b>. Order within 7 hrs 21 mins</p>
          <p className="delivery-location">⌖ Deliver to Shanghai 200000</p>
          <strong className="stock">In Stock</strong>
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
            <dt>Sold by</dt><dd>BrewGo Direct</dd>
            <dt>Returns</dt><dd>30-day refund</dd>
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
          <img src="/product-lifestyle.png" alt="BrewGo 旅行咖啡场景" />
          <div>
            <span>BREW WITHOUT BORDERS</span>
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
        <div className="a-plus-features">
          <div><b>20 BAR</b><span>Rich, balanced extraction</span></div>
          <div><b>3 MIN</b><span>Heat and brew</span></div>
          <div><b>USB-C</b><span>Charge wherever you go</span></div>
        </div>
      </section>
    </article>
  );
}

function ImageSuite({
  skillId,
  readyCount,
  onPreview,
  onRegenerate,
  regenerating,
}: {
  skillId: string;
  readyCount: number;
  onPreview: (item: GalleryItem) => void;
  onRegenerate: (item: GalleryItem) => void;
  regenerating: string | null;
}) {
  const isSeeding = skillId === "china-seeding-image";
  const items = isSeeding ? seedingGallery : gallery;
  const title = skills.find((item) => item.id === skillId)?.label ?? "商品套图";

  return (
    <section className={`image-suite ${isSeeding ? "seeding-suite" : ""}`} data-testid="image-result">
      <header className="result-section-head">
        <div>
          <span>{isSeeding ? "SEEDING COLLECTION" : "IMAGE COLLECTION"}</span>
          <h2>{title}</h2>
        </div>
        <p>{isSeeding ? "3:4 种草组图 4 张" : "正方形卖点图 4 张 · 横版 A+ 2 张"}</p>
      </header>
      <div className="asset-grid" aria-live="polite">
        {items.map((item, index) => {
          const ready = index < readyCount && regenerating !== item.id;
          return (
            <article
              className={`asset-card ${item.wide ? "asset-wide" : ""}`}
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
                <div className="asset-skeleton">
                  <span>{regenerating === item.id ? "正在重做" : item.group}</span>
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
  ready,
  onPreview,
  onRegenerate,
  regenerating,
}: {
  skillId: string;
  ready: boolean;
  onPreview: (item: GalleryItem) => void;
  onRegenerate: (item: GalleryItem) => void;
  regenerating: string | null;
}) {
  const item = singleImageOutputs[skillId] ?? singleImageOutputs["amazon-scene-image"];
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
  onNotice,
}: {
  ready: boolean;
  productImage: string;
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
            <source src="/product-demo.mp4" type="video/mp4" />
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
          const total = generationCopy[turn.kind].phases.length;
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
              <small>{turn.running ? `${turn.completed} / ${total} 步` : turn.completed === total ? "生成完成" : "已停止"}</small>
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

export default function Home() {
  const [screen, setScreen] = useState<"home" | "studio">("home");
  const [prompt, setPrompt] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [skill, setSkill] = useState("listing");
  const [region, setRegion] = useState("us");
  const [language, setLanguage] = useState("en");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [preview, setPreview] = useState<GalleryItem | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>[]>>(new Map());
  const turnCounter = useRef(0);

  const selectedSkill = skills.find((item) => item.id === skill) ?? skills[0];
  const selectedKind = selectedSkill.kind;
  const productImage = uploads[0]?.url ?? "/product-main.png";
  const activeTurn = turns.find((turn) => turn.id === activeTurnId) ?? turns[turns.length - 1];

  const clearTurnTimers = (turnId: string) => {
    timers.current.get(turnId)?.forEach((timer) => clearTimeout(timer));
    timers.current.delete(turnId);
  };

  const clearAllTimers = () => {
    timers.current.forEach((turnTimers) => {
      turnTimers.forEach((timer) => clearTimeout(timer));
    });
    timers.current.clear();
  };

  useEffect(() => clearAllTimers, []);

  const showNotice = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const addSample = () => {
    setUploads([{ id: "sample", name: "便携咖啡机示例图", url: "/product-main.png" }]);
    setPrompt("为这款便携咖啡机生成完整跨境电商内容");
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploads([{
      id: `${file.name}-${file.lastModified}`,
      name: file.name,
      url: URL.createObjectURL(file),
      owned: true,
    }]);
    event.target.value = "";
  };

  const removeUpload = (id: string) => {
    setUploads((current) => current.filter((upload) => upload.id !== id));
  };

  const streamTurn = (turnId: string, kind: SkillKind, startAt = 0) => {
    clearTurnTimers(turnId);
    setTurns((current) =>
      current.map((turn) =>
        turn.id === turnId ? { ...turn, running: true } : turn,
      ),
    );
    const phases = generationCopy[kind].phases;
    const turnTimers: ReturnType<typeof setTimeout>[] = [];
    for (let index = startAt; index < phases.length; index += 1) {
      const timer = setTimeout(() => {
        setTurns((current) =>
          current.map((turn) =>
            turn.id === turnId
              ? {
                  ...turn,
                  completed: index + 1,
                  running: index < phases.length - 1,
                }
              : turn,
          ),
        );
        if (index === phases.length - 1) timers.current.delete(turnId);
      }, 500 + (index - startAt) * 430);
      turnTimers.push(timer);
    }
    timers.current.set(turnId, turnTimers);
  };

  const startGeneration = () => {
    if (!uploads.length) return;
    const id = `turn-${turnCounter.current += 1}`;
    const taskPrompt = prompt.trim() || selectedSkill.starter;
    const turn: Turn = {
      id,
      title: conversationTitle,
      prompt: taskPrompt,
      skill: selectedSkill.id,
      kind: selectedKind,
      region,
      language,
      productImage,
      completed: 0,
      running: true,
    };
    setTurns((current) => [...current, turn]);
    setActiveTurnId(id);
    setScreen("studio");
    setPrompt("");
    window.setTimeout(() => {
      streamTurn(id, selectedKind);
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const stopGeneration = (turnId: string) => {
    clearTurnTimers(turnId);
    setTurns((current) =>
      current.map((turn) =>
        turn.id === turnId ? { ...turn, running: false } : turn,
      ),
    );
    showNotice("已停止未完成的生成");
  };

  const regenerate = (item: GalleryItem) => {
    setRegenerating(item.id);
    showNotice(`正在重新生成「${item.title}」`);
    const timer = setTimeout(() => {
      setRegenerating(null);
      showNotice(`「${item.title}」已更新`);
    }, 1200);
    const key = `regenerate-${item.id}`;
    timers.current.set(key, [timer]);
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
    clearTurnTimers(turnId);
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
              const total = generation.phases.length;
              const ready = turn.completed === total && !turn.running;
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
                          <span>{skills.find((item) => item.id === turn.skill)?.label}</span>
                          <span>{regions.find((item) => item.id === turn.region)?.label}</span>
                          <span>{languages.find((item) => item.id === turn.language)?.label}</span>
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
                        <span>{generation.count}</span>
                      </header>

                      <div className="generation-status">
                        <div>
                          <span className={turn.running ? "pulse-dot" : "done-dot"} />
                          <strong data-testid={`progress-${index}`}>
                            {turn.running
                              ? generation.phases[Math.min(turn.completed, total - 1)]
                              : ready
                                ? "生成完成"
                                : "已停止"}
                          </strong>
                          <span>{turn.completed} / {total}</span>
                        </div>
                        {turn.running ? (
                          <button type="button" onClick={() => stopGeneration(turn.id)}>停止生成</button>
                        ) : turn.completed < total ? (
                          <button type="button" onClick={() => streamTurn(turn.id, turn.kind, turn.completed)}>继续生成</button>
                        ) : null}
                      </div>
                      <div className="progress-meter" aria-hidden="true">
                        <span style={{ transform: `scaleX(${turn.completed / total})` }} />
                      </div>

                      <div className={`dynamic-result dynamic-${turn.kind}`}>
                        {turn.kind === "listing" ? (
                          <ListingResult
                            productImage={turn.productImage}
                            language={turn.language}
                            region={turn.region}
                            ready={ready}
                            onNotice={showNotice}
                          />
                        ) : null}
                        {turn.kind === "images" ? (
                          <ImageSuite
                            skillId={turn.skill}
                            readyCount={Math.min(turn.completed, gallery.length)}
                            onPreview={setPreview}
                            onRegenerate={regenerate}
                            regenerating={regenerating}
                          />
                        ) : null}
                        {turn.kind === "seeding" ? (
                          <ImageSuite
                            skillId={turn.skill}
                            readyCount={Math.min(turn.completed, seedingGallery.length)}
                            onPreview={setPreview}
                            onRegenerate={regenerate}
                            regenerating={regenerating}
                          />
                        ) : null}
                        {turn.kind === "single" ? (
                          <SingleImageResult
                            skillId={turn.skill}
                            ready={ready}
                            onPreview={setPreview}
                            onRegenerate={regenerate}
                            regenerating={regenerating}
                          />
                        ) : null}
                        {turn.kind === "video" ? (
                          <VideoResult ready={ready} productImage={turn.productImage} onNotice={showNotice} />
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
              compact
              prompt={prompt}
              uploads={uploads}
              skill={skill}
              region={region}
              language={language}
              disabled={!uploads.length}
              onPrompt={setPrompt}
              onFiles={handleFiles}
              onRemove={removeUpload}
              onSend={startGeneration}
              onSkill={setSkill}
              onRegion={setRegion}
              onLanguage={setLanguage}
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
            <h1>一张商品图，<br />生成亚马逊链接</h1>
          </div>
          <div className="home-composer-wrap">
            <div className="home-sample-row">
              <button type="button" className="sample-button" data-testid="sample-product" onClick={addSample}>使用示例商品</button>
            </div>
            <Composer
              prompt={prompt}
              uploads={uploads}
              skill={skill}
              region={region}
              language={language}
              disabled={!uploads.length}
              onPrompt={setPrompt}
              onFiles={handleFiles}
              onRemove={removeUpload}
              onSend={startGeneration}
              onSkill={setSkill}
              onRegion={setRegion}
              onLanguage={setLanguage}
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
