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

type Result = {
  id: string;
  group: string;
  title: string;
  image: string;
  kind: "image" | "video";
  crop?: string;
};

const skills: Option[] = [
  {
    id: "amazon",
    label: "亚马逊套图",
    description: "主图、卖点图、场景图",
  },
  {
    id: "scene",
    label: "商品场景图",
    description: "将商品放入真实使用场景",
  },
  {
    id: "white",
    label: "白底商品图",
    description: "生成干净合规的商品主图",
  },
  {
    id: "social",
    label: "种草图",
    description: "生活方式与社交分享素材",
  },
  {
    id: "video",
    label: "商品视频",
    description: "生成 15 秒商品短视频",
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

const results: Result[] = [
  {
    id: "main",
    group: "主图",
    title: "纯净主图",
    image: "/product-main.png",
    kind: "image",
  },
  {
    id: "feature",
    group: "核心卖点",
    title: "轻巧便携",
    image: "/product-main.png",
    kind: "image",
    crop: "crop-detail",
  },
  {
    id: "travel",
    group: "生活方式",
    title: "旅居场景",
    image: "/product-lifestyle.png",
    kind: "image",
  },
  {
    id: "coffee",
    group: "核心卖点",
    title: "随时现磨",
    image: "/product-main.png",
    kind: "image",
    crop: "crop-lower",
  },
  {
    id: "outdoor",
    group: "生活方式",
    title: "户外清晨",
    image: "/product-outdoor.png",
    kind: "image",
  },
  {
    id: "video",
    group: "商品视频",
    title: "15 秒旅行短片",
    image: "/product-outdoor.png",
    kind: "video",
  },
  {
    id: "alternate",
    group: "主图",
    title: "组合展示",
    image: "/product-lifestyle.png",
    kind: "image",
    crop: "crop-wide",
  },
];

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
              {option.id === value ? (
                <span className="selected-mark" aria-hidden="true">
                  ✓
                </span>
              ) : null}
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
                {/* User-selected blob URLs need a native image element. */}
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
          {compact ? "继续调整" : "描述你的创作需求"}
        </label>
        <textarea
          id={compact ? "refine-prompt" : "main-prompt"}
          data-testid={compact ? "refine-input" : "prompt-input"}
          value={prompt}
          rows={compact ? 2 : 4}
          placeholder={
            compact
              ? "例如：让户外场景更自然，保留商品外观"
              : "例如：为这款便携咖啡机生成美国站套图"
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
              multiple
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

export default function Home() {
  const [screen, setScreen] = useState<"home" | "studio">("home");
  const [prompt, setPrompt] = useState("");
  const [refinePrompt, setRefinePrompt] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [skill, setSkill] = useState("amazon");
  const [region, setRegion] = useState("us");
  const [language, setLanguage] = useState("en");
  const [completed, setCompleted] = useState(0);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<Result | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  const addSample = () => {
    setUploads([
      {
        id: "sample",
        name: "便携咖啡机示例图",
        url: "/product-main.png",
      },
    ]);
    setPrompt("为这款便携咖啡机生成美国站套图");
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 4);
    const next = files.map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      name: file.name,
      url: URL.createObjectURL(file),
      owned: true,
    }));
    setUploads((current) => [...current, ...next].slice(0, 4));
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
    results.forEach((_, index) => {
      const timer = setTimeout(() => {
        setCompleted(index + 1);
        if (index === results.length - 1) setRunning(false);
      }, 650 + index * 520);
      timers.current.push(timer);
    });
  };

  const startGeneration = () => {
    if (!uploads.length && !prompt.trim()) return;
    setScreen("studio");
    startStream();
  };

  const stopGeneration = () => {
    clearTimers();
    setRunning(false);
    setNotice("已停止未完成的生成");
    window.setTimeout(() => setNotice(""), 2200);
  };

  const regenerate = (result: Result) => {
    setRegenerating(result.id);
    setNotice(`正在重新生成「${result.title}」`);
    const timer = setTimeout(() => {
      setRegenerating(null);
      setNotice(`「${result.title}」已更新`);
      window.setTimeout(() => setNotice(""), 1800);
    }, 1400);
    timers.current.push(timer);
  };

  const sendRefinement = () => {
    if (!refinePrompt.trim()) return;
    const target = results[Math.min(Math.max(completed - 1, 0), results.length - 1)];
    regenerate(target);
    setRefinePrompt("");
  };

  if (screen === "studio") {
    return (
      <main className="studio" data-testid="studio">
        <aside className="studio-sidebar">
          <button
            className="brand brand-button"
            type="button"
            onClick={() => setScreen("home")}
            aria-label="返回创作首页"
          >
            <span className="brand-mark" aria-hidden="true">
              M
            </span>
            <span>MERCATO</span>
          </button>
          <button className="new-chat" type="button" onClick={() => setScreen("home")}>
            ＋ 新建创作
          </button>
          <nav className="conversation-list" aria-label="创作历史">
            <span className="nav-caption">今天</span>
            <button type="button" className="conversation-active">
              <strong>亚马逊美国站素材</strong>
              <small>{completed} / {results.length} 项已生成</small>
            </button>
            <span className="nav-caption">昨天</span>
            <button type="button">
              <strong>德国站场景图</strong>
              <small>8 项素材</small>
            </button>
          </nav>
          <button className="sidebar-footer" type="button">
            设置
          </button>
        </aside>

        <section className="studio-main">
          <header className="studio-header">
            <div>
              <span className="studio-kicker">
                {regions.find((item) => item.id === region)?.label}
              </span>
              <h1>便携咖啡机创作</h1>
            </div>
            {completed ? (
              <a
                className="download-all"
                href="/mercato-demo-assets.zip"
                download
                data-testid="download-all"
              >
                下载全部
              </a>
            ) : (
              <span className="download-all download-all-disabled">
                下载全部
              </span>
            )}
          </header>

          <div className="request-summary">
            <div className="request-product">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uploads[0]?.url ?? "/product-main.png"}
                alt="本次创作的商品"
              />
            </div>
            <p>{prompt || "为商品生成跨境电商素材"}</p>
            <div className="request-tags" aria-label="本次设置">
              <span>{skills.find((item) => item.id === skill)?.label}</span>
              <span>{languages.find((item) => item.id === language)?.label}</span>
            </div>
          </div>

          <div className="progress-row">
            <div>
              <strong data-testid="progress">
                {running ? "正在生成" : completed === results.length ? "生成完成" : "已停止"}
              </strong>
              <span>{completed} / {results.length}</span>
            </div>
            {running ? (
              <button type="button" onClick={stopGeneration}>
                停止生成
              </button>
            ) : completed < results.length ? (
              <button type="button" onClick={startStream}>
                继续生成
              </button>
            ) : null}
          </div>

          <div className="progress-meter" aria-hidden="true">
            <span style={{ transform: `scaleX(${completed / results.length})` }} />
          </div>

          <div className="result-grid" aria-live="polite">
            {results.map((result, index) => {
              const ready = index < completed && regenerating !== result.id;
              return (
                <article
                  className={`result-card result-${index + 1}`}
                  key={result.id}
                  data-testid={`result-card-${index}`}
                >
                  {ready ? (
                    <>
                      <button
                        type="button"
                        className="result-visual"
                        onClick={() => setPreview(result)}
                        aria-label={`预览 ${result.title}`}
                        data-testid={`preview-result-${index}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={result.image}
                          alt={result.title}
                          className={result.crop ?? ""}
                        />
                        {result.kind === "video" ? (
                          <span className="play-button" aria-hidden="true">
                            ▶
                          </span>
                        ) : null}
                      </button>
                      <footer className="result-footer">
                        <div>
                          <span>{result.group}</span>
                          <strong>{result.title}</strong>
                        </div>
                        <div className="result-actions">
                          <a
                            href={result.image}
                            download
                            data-testid={`download-result-${index}`}
                          >
                            下载
                          </a>
                          <button type="button" onClick={() => regenerate(result)}>
                            重做
                          </button>
                        </div>
                      </footer>
                    </>
                  ) : (
                    <div className="result-skeleton">
                      <span>{regenerating === result.id ? "正在重做" : result.group}</span>
                      <i />
                      <i />
                    </div>
                  )}
                </article>
              );
            })}
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
            <button
              type="button"
              className="preview-close"
              onClick={() => setPreview(null)}
              aria-label="关闭预览"
            >
              ×
            </button>
            <div className="preview-content">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.image} alt={preview.title} />
              <footer>
                <div>
                  <span>{preview.group}</span>
                  <strong>{preview.title}</strong>
                </div>
                <a href={preview.image} download>
                  下载原图
                </a>
              </footer>
            </div>
          </div>
        ) : null}

        {notice ? (
          <div className="toast" role="status" data-testid="toast">
            {notice}
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="home">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span>MERCATO</span>
        </div>
        <nav aria-label="主导航">
          <a href="#create" className="active">
            创作
          </a>
          <a href="#assets">资产</a>
          <a href="#history">历史</a>
        </nav>
        <button type="button" className="avatar" aria-label="账户">
          Y
        </button>
      </header>

      <section className="home-grid" id="create">
        <div className="home-intro">
          <div>
            <p className="home-kicker">AI 商品创作工作台</p>
            <h1>
              <span>一张商品图，</span>
              <span>生成全球素材</span>
            </h1>
            <p className="home-subtitle">
              选择市场与创作能力，图片和视频会在同一处持续出现。
            </p>
          </div>

          <div className="editorial-preview" aria-label="生成效果示例">
            <figure className="preview-tall">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/product-main.png" alt="便携咖啡机商品主图示例" />
            </figure>
            <figure className="preview-wide">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/product-outdoor.png" alt="便携咖啡机户外场景示例" />
            </figure>
            <span className="preview-count">
              <strong>7</strong>
              <small>项素材</small>
            </span>
          </div>
        </div>

        <div className="create-panel">
          <div className="create-panel-header">
            <div>
              <span>开始创作</span>
              <h2>上传你的商品</h2>
            </div>
            <button
              type="button"
              className="sample-button"
              data-testid="sample-product"
              onClick={addSample}
            >
              使用示例商品
            </button>
          </div>

          <Composer
            prompt={prompt}
            uploads={uploads}
            skill={skill}
            region={region}
            language={language}
            disabled={!uploads.length && !prompt.trim()}
            onPrompt={setPrompt}
            onFiles={handleFiles}
            onRemove={removeUpload}
            onSend={startGeneration}
            onSkill={setSkill}
            onRegion={setRegion}
            onLanguage={setLanguage}
          />

          <div className="quick-starts" aria-label="快捷创作">
            <button type="button" onClick={() => setPrompt("生成一套美国站亚马逊商品图")}>
              亚马逊套图
            </button>
            <button type="button" onClick={() => setPrompt("把商品放进真实旅行场景")}>
              旅行场景
            </button>
            <button
              type="button"
              onClick={() => {
                setSkill("video");
                setPrompt("生成一支 15 秒商品短视频");
              }}
            >
              15 秒视频
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
