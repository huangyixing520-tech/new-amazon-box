"use client";

import {
  useEffect,
  useMemo,
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

type SkillKind = "listing" | "images" | "video";

type GalleryItem = {
  id: string;
  group: string;
  title: string;
  image: string;
  wide?: boolean;
  crop?: string;
};

const skills: (Option & { kind: SkillKind })[] = [
  {
    id: "listing",
    kind: "listing",
    label: "Amazon Listing",
    description: "生成完整商品链接、文案与 A+ 详情",
  },
  {
    id: "images",
    kind: "images",
    label: "商品套图",
    description: "正方形主副图与横版 A+ 图片",
  },
  {
    id: "video",
    kind: "video",
    label: "商品视频",
    description: "生成商品短视频与镜头脚本",
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

function OptionMenu({
  label,
  options,
  value,
  open,
  onOpen,
  onChange,
  rich = false,
  testId,
}: {
  label: string;
  options: Option[];
  value: string;
  open: boolean;
  onOpen: () => void;
  onChange: (value: string) => void;
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
        <span>{selected.label}</span>
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

        <label className="prompt-label" htmlFor={compact ? "refine-prompt" : "main-prompt"}>
          {compact ? "继续调整当前结果" : "描述你希望生成的内容"}
        </label>
        <textarea
          id={compact ? "refine-prompt" : "main-prompt"}
          data-testid={compact ? "refine-input" : "prompt-input"}
          value={prompt}
          rows={compact ? 2 : 4}
          placeholder={
            compact
              ? "例如：标题更简洁，突出自加热和 20 Bar 压力"
              : "上传一张商品图，选择 Skill、销售地区与语言"
          }
          onChange={(event) => onPrompt(event.target.value)}
          onKeyDown={submitOnShortcut}
        />
      </div>

      <div className="composer-toolbar">
        <div className="settings-cluster">
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
          <button
            type="button"
            className="send-button"
            aria-label={compact ? "发送调整要求" : "开始生成"}
            data-testid={compact ? "refine-send" : "send"}
            disabled={disabled}
            onClick={onSend}
          >
            ↗
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
        <button type="button" onClick={copyLink} data-testid="copy-listing-link">
          复制链接
        </button>
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
          <h2>{copy.title}</h2>
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
              {price.major}
              {price.minor ? <sup>{price.minor}</sup> : null}
            </span>
          </div>
          <p className="list-price">List Price: <s>{price.list}</s></p>
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
            {copy.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
          </ul>
        </section>

        <aside className="buy-box">
          <div className="buy-price">
            <sup>{price.symbol}</sup>{price.major}
            {price.minor ? <sup>{price.minor}</sup> : null}
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
              <tr><th>Brand</th><td>BrewGo</td></tr>
              <tr><th>Color</th><td>Carbon Black</td></tr>
              <tr><th>Dimensions</th><td>3.1&quot;D × 3.1&quot;W × 9.6&quot;H</td></tr>
              <tr><th>Special Feature</th><td>Self Heating, Portable</td></tr>
            </tbody>
          </table>
          <table>
            <tbody>
              <tr><th>Pressure</th><td>20 Bar</td></tr>
              <tr><th>Battery</th><td>7500 mAh</td></tr>
              <tr><th>Material</th><td>Food-grade stainless steel</td></tr>
              <tr><th>Item Weight</th><td>1.5 pounds</td></tr>
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
            <h2>Your café ritual, anywhere.</h2>
            <p>{copy.description}</p>
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
  readyCount,
  onPreview,
  onRegenerate,
  regenerating,
}: {
  readyCount: number;
  onPreview: (item: GalleryItem) => void;
  onRegenerate: (item: GalleryItem) => void;
  regenerating: string | null;
}) {
  return (
    <section className="image-suite" data-testid="image-result">
      <header className="result-section-head">
        <div>
          <span>IMAGE COLLECTION</span>
          <h2>商品套图</h2>
        </div>
        <p>正方形主副图 4 张 · 横版 A+ 2 张</p>
      </header>
      <div className="asset-grid" aria-live="polite">
        {gallery.map((item, index) => {
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

export default function Home() {
  const [screen, setScreen] = useState<"home" | "studio">("home");
  const [prompt, setPrompt] = useState("");
  const [refinePrompt, setRefinePrompt] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [skill, setSkill] = useState("listing");
  const [region, setRegion] = useState("us");
  const [language, setLanguage] = useState("en");
  const [completed, setCompleted] = useState(0);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<GalleryItem | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const selectedSkill = skills.find((item) => item.id === skill) ?? skills[0];
  const selectedKind = selectedSkill.kind;
  const generation = generationCopy[selectedKind];
  const productImage = uploads[0]?.url ?? "/product-main.png";
  const total = generation.phases.length;
  const ready = completed === total && !running;

  const history = useMemo(
    () => [
      { title: `${selectedSkill.label} · 便携咖啡机`, detail: ready ? "生成完成" : `${completed} / ${total} 步` },
      { title: "德国站商品套图", detail: "6 张图片" },
    ],
    [completed, ready, selectedSkill.label, total],
  );

  const clearTimers = () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

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
    setUploads((current) => {
      current.forEach((upload) => {
        if (upload.owned) URL.revokeObjectURL(upload.url);
      });
      return [{
        id: `${file.name}-${file.lastModified}`,
        name: file.name,
        url: URL.createObjectURL(file),
        owned: true,
      }];
    });
    event.target.value = "";
  };

  const removeUpload = (id: string) => {
    setUploads((current) => {
      const target = current.find((upload) => upload.id === id);
      if (target?.owned) URL.revokeObjectURL(target.url);
      return current.filter((upload) => upload.id !== id);
    });
  };

  const startStream = () => {
    clearTimers();
    setCompleted(0);
    setRunning(true);
    generation.phases.forEach((_, index) => {
      const timer = setTimeout(() => {
        setCompleted(index + 1);
        if (index === generation.phases.length - 1) setRunning(false);
      }, 520 + index * 460);
      timers.current.push(timer);
    });
  };

  const startGeneration = () => {
    if (!uploads.length) return;
    setScreen("studio");
    startStream();
  };

  const stopGeneration = () => {
    clearTimers();
    setRunning(false);
    showNotice("已停止未完成的生成");
  };

  const regenerate = (item: GalleryItem) => {
    setRegenerating(item.id);
    showNotice(`正在重新生成「${item.title}」`);
    const timer = setTimeout(() => {
      setRegenerating(null);
      showNotice(`「${item.title}」已更新`);
    }, 1200);
    timers.current.push(timer);
  };

  const sendRefinement = () => {
    if (!refinePrompt.trim()) return;
    showNotice("已应用调整，正在刷新结果");
    setRefinePrompt("");
    startStream();
  };

  if (screen === "studio") {
    const imageReadyCount = Math.min(completed, gallery.length);
    return (
      <main className="studio" data-testid="studio">
        <aside className="studio-sidebar">
          <button
            className="brand brand-button"
            type="button"
            onClick={() => {
              clearTimers();
              setScreen("home");
            }}
            aria-label="返回创作首页"
          >
            <span className="brand-mark" aria-hidden="true">M</span>
            <span>MERCATO</span>
          </button>
          <button className="new-chat" type="button" onClick={() => setScreen("home")}>
            ＋ 新建创作
          </button>
          <nav className="conversation-list" aria-label="创作历史">
            <span className="nav-caption">今天</span>
            {history.map((item, index) => (
              <button type="button" className={index === 0 ? "conversation-active" : ""} key={item.title}>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </button>
            ))}
          </nav>
          <button className="sidebar-footer" type="button">设置</button>
        </aside>

        <section className="studio-main">
          <header className="studio-header">
            <div>
              <span className="studio-kicker">{regions.find((item) => item.id === region)?.label} · {languages.find((item) => item.id === language)?.label}</span>
              <h1>{generation.title}</h1>
            </div>
            <span className="output-type">{generation.count}</span>
          </header>

          <div className="request-summary">
            <div className="request-product">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={productImage} alt="本次创作的商品" />
            </div>
            <p>{prompt || "为商品生成跨境电商内容"}</p>
            <div className="request-tags" aria-label="本次设置">
              <span>{selectedSkill.label}</span>
              <span>{regions.find((item) => item.id === region)?.label}</span>
              <span>{languages.find((item) => item.id === language)?.label}</span>
            </div>
          </div>

          <div className="generation-status">
            <div>
              <span className={running ? "pulse-dot" : "done-dot"} />
              <strong data-testid="progress">
                {running
                  ? generation.phases[Math.min(completed, total - 1)]
                  : ready
                    ? "生成完成"
                    : "已停止"}
              </strong>
              <span>{completed} / {total}</span>
            </div>
            {running ? (
              <button type="button" onClick={stopGeneration}>停止生成</button>
            ) : completed < total ? (
              <button type="button" onClick={startStream}>继续生成</button>
            ) : null}
          </div>
          <div className="progress-meter" aria-hidden="true">
            <span style={{ transform: `scaleX(${completed / total})` }} />
          </div>

          <div className={`dynamic-result dynamic-${selectedKind}`}>
            {selectedKind === "listing" ? (
              <ListingResult
                productImage={productImage}
                language={language}
                region={region}
                ready={ready}
                onNotice={showNotice}
              />
            ) : null}
            {selectedKind === "images" ? (
              <ImageSuite
                readyCount={imageReadyCount}
                onPreview={setPreview}
                onRegenerate={regenerate}
                regenerating={regenerating}
              />
            ) : null}
            {selectedKind === "video" ? (
              <VideoResult ready={ready} productImage={productImage} onNotice={showNotice} />
            ) : null}
          </div>

          <div className="studio-composer">
            <Composer
              compact
              prompt={refinePrompt}
              uploads={[]}
              skill={skill}
              region={region}
              language={language}
              disabled={!refinePrompt.trim()}
              onPrompt={setRefinePrompt}
              onFiles={handleFiles}
              onRemove={removeUpload}
              onSend={sendRefinement}
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
    <main className="home">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">M</span><span>MERCATO</span></div>
        <nav aria-label="主导航"><a href="#create" className="active">创作</a><a href="#assets">资产</a><a href="#history">历史</a></nav>
        <button type="button" className="avatar" aria-label="账户">Y</button>
      </header>

      <section className="home-grid" id="create">
        <div className="home-intro">
          <div>
            <p className="home-kicker">AI COMMERCE STUDIO</p>
            <h1><span>一张商品图，</span><span>生成完整商品内容</span></h1>
            <p className="home-subtitle">
              选择 Skill 决定最终产物：商品链接、成套图片，或可直接投放的视频。
            </p>
          </div>
          <div className="outcome-preview" aria-label="三种生成结果">
            <div className="outcome-card outcome-listing"><span>LISTING</span><b>完整商品链接</b><i>Title · Price · A+</i></div>
            <div className="outcome-card outcome-images"><span>IMAGES</span><b>主副图与 A+</b><i>1:1 · 1464 × 600</i></div>
            <div className="outcome-card outcome-video"><span>VIDEO</span><b>商品短视频</b><i>15s · 9:16</i><em>▶</em></div>
          </div>
        </div>

        <div className="create-panel">
          <div className="create-panel-header">
            <div><span>开始创作</span><h2>上传你的商品</h2></div>
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
          <div className="skill-hint">
            <span>Skill 决定结果页</span>
            <p data-testid="skill-output-hint">
              {selectedKind === "listing" && "将生成可浏览的商品详情页、文案、价格与 A+ 内容"}
              {selectedKind === "images" && "将生成 4 张正方形主副图与 2 张横版 A+ 图片"}
              {selectedKind === "video" && "将生成一条 15 秒商品视频与镜头脚本"}
            </p>
          </div>
          <div className="quick-starts" aria-label="快捷创作">
            {skills.map((item) => (
              <button
                type="button"
                className={skill === item.id ? "active" : ""}
                onClick={() => {
                  setSkill(item.id);
                  setPrompt(item.kind === "listing" ? "生成完整商品 Listing" : item.kind === "images" ? "生成商品主副图和 A+ 套图" : "生成一支 15 秒商品短视频");
                }}
                key={item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
