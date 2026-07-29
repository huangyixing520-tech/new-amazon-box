"use client";

import {
  ArrowLeft,
  ChartLineUp,
  DownloadSimple,
  FileText,
  ImageSquare,
  MagnifyingGlass,
  Sparkle,
  Users,
  VideoCamera,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Metric = {
  dau: number;
  generationDau: number;
  successDau: number;
  exportDau: number;
  requests: number;
  completeSuccesses: number;
  partialSuccesses: number;
  failures: number;
  exports: number;
};

type UserSummary = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastActive: string | null;
  generations: number;
};

type DashboardData = {
  days: number;
  totalUsers: number;
  totals: Metric;
  daily: Array<Metric & { date: string }>;
  skills: Array<Metric & { id: string }>;
  users: UserSummary[];
};

type ListingResult = {
  title?: string;
  brand?: string;
  salePrice?: string;
  listPrice?: string;
  bullets?: string[];
  description?: string;
};

type ResultAsset = {
  id: string;
  type: "image" | "video";
  title: string;
  prompt: string;
  slot: number;
  createdAt: string;
  url: string;
};

type ResultTurn = {
  id: string;
  title: string;
  prompt: string;
  mode: "image" | "video" | "listing";
  skill: string;
  phase: string;
  error: string | null;
  completed: number;
  listing: ListingResult | null;
  createdAt: string;
  assets: ResultAsset[];
};

type AdminUserResults = {
  user: {
    id: string;
    email: string;
    name: string;
    pictureUrl: string | null;
    createdAt: string;
    lastActive: string | null;
  };
  summary: {
    conversations: number;
    generations: number;
    images: number;
    videos: number;
    listings: number;
  };
  conversations: Array<{
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    turns: ResultTurn[];
  }>;
};

type ResultFilter = "all" | "image" | "video" | "listing";

const skillNames: Record<string, string> = {
  "amazon-listing": "亚马逊 Listing",
  "listing-replica": "链接复刻",
  "amazon-image-set": "商品套图",
  "ecommerce-image-set": "跨境电商套图",
  "amazon-scene-image": "人物场景图",
  "china-ecommerce-main-image": "国内电商主图",
  "china-seeding-image": "种草组图",
  "white-background-image": "商品白底图",
  "video-replica": "视频复刻",
  "talking-product-video": "带货口播",
};

function rate(part: number, total: number) {
  return total ? `${Math.round((part / total) * 100)}%` : "0%";
}

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN") : "暂无";
}

function matchesResultFilter(turn: ResultTurn, filter: ResultFilter) {
  if (filter === "all") return Boolean(turn.listing || turn.assets.length);
  if (filter === "listing") return Boolean(turn.listing);
  return turn.assets.some((asset) => asset.type === filter);
}

export default function AdminPage() {
  const [section, setSection] = useState<"overview" | "results">("overview");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userResults, setUserResults] = useState<AdminUserResults | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [preview, setPreview] = useState<ResultAsset | null>(null);
  const resultsRequestId = useRef(0);

  useEffect(() => {
    void fetch(`/api/admin/metrics?days=${days}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "无法读取数据");
        setData(payload);
      })
      .catch((reason) => setError(
        reason instanceof Error ? reason.message : "无法读取数据",
      ));
  }, [days]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data?.users ?? [];
    return (data?.users ?? []).filter((user) =>
      `${user.name} ${user.email}`.toLowerCase().includes(query)
    );
  }, [data?.users, search]);

  const visibleConversations = useMemo(() =>
    (userResults?.conversations ?? [])
      .map((conversation) => ({
        ...conversation,
        turns: conversation.turns
          .filter((turn) => matchesResultFilter(turn, resultFilter))
          .map((turn) => ({
            ...turn,
            assets: resultFilter === "image" || resultFilter === "video"
              ? turn.assets.filter((asset) => asset.type === resultFilter)
              : turn.assets,
          })),
      }))
      .filter((conversation) => conversation.turns.length),
  [resultFilter, userResults?.conversations]);

  function selectUser(userId: string) {
    if (userId === selectedUserId && (resultsLoading || userResults)) return;
    const requestId = resultsRequestId.current + 1;
    resultsRequestId.current = requestId;
    setSelectedUserId(userId);
    setResultsLoading(true);
    setResultsError("");
    setUserResults(null);
    void fetch(
      `/api/admin/users/${encodeURIComponent(userId)}/results`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "无法读取用户生成结果");
        }
        if (resultsRequestId.current === requestId) setUserResults(payload);
      })
      .catch((reason) => {
        if (resultsRequestId.current !== requestId) return;
        setResultsError(
          reason instanceof Error ? reason.message : "无法读取用户生成结果",
        );
      })
      .finally(() => {
        if (resultsRequestId.current === requestId) setResultsLoading(false);
      });
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <Link href="/" className="admin-back">
            <ArrowLeft weight="bold" />返回 Mercato
          </Link>
          <h1>数据后台</h1>
          <p>查看产品表现、用户活跃与每次真实生成结果。</p>
        </div>
        {section === "overview" ? (
          <div className="admin-range" aria-label="统计周期">
            {[7, 30, 90].map((value) => (
              <button
                type="button"
                className={days === value ? "active" : ""}
                onClick={() => {
                  setData(null);
                  setError("");
                  setDays(value);
                }}
                key={value}
              >
                {value} 天
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <nav className="admin-section-tabs" aria-label="后台模块">
        <button
          type="button"
          className={section === "overview" ? "active" : ""}
          onClick={() => setSection("overview")}
        >
          <ChartLineUp weight="bold" />数据概览
        </button>
        <button
          type="button"
          className={section === "results" ? "active" : ""}
          onClick={() => {
            setSection("results");
            if (!selectedUserId && data?.users[0]) {
              selectUser(data.users[0].id);
            }
          }}
        >
          <ImageSquare weight="bold" />用户生成结果
        </button>
      </nav>

      {error ? (
        <section className="admin-state" role="alert">
          <strong>暂时无法进入后台</strong>
          <p>{error}</p>
        </section>
      ) : !data ? (
        <section className="admin-state">
          <strong>正在读取真实数据</strong>
        </section>
      ) : section === "overview" ? (
        <>
          <section className="admin-kpis" aria-label="核心指标">
            {[
              ["累计用户", data.totalUsers, <Users key="users" weight="duotone" />],
              ["DAU", data.daily.at(-1)?.dau ?? 0, <ChartLineUp key="dau" weight="duotone" />],
              ["生成 DAU", data.daily.at(-1)?.generationDau ?? 0, <Sparkle key="generation" weight="duotone" />],
              ["导出 DAU", data.daily.at(-1)?.exportDau ?? 0, <DownloadSimple key="export" weight="duotone" />],
            ].map(([label, value, icon]) => (
              <article key={String(label)}>
                <span>{icon}{label}</span>
                <strong>{String(value)}</strong>
              </article>
            ))}
          </section>

          <section className="admin-funnel">
            <header>
              <h2>生成漏斗</h2>
              <span>最近 {data.days} 天</span>
            </header>
            <div>
              <article>
                <span>发起生成</span><strong>{data.totals.requests}</strong>
              </article>
              <article>
                <span>完全成功</span>
                <strong>{data.totals.completeSuccesses}</strong>
                <small>{rate(data.totals.completeSuccesses, data.totals.requests)}</small>
              </article>
              <article>
                <span>部分成功</span>
                <strong>{data.totals.partialSuccesses}</strong>
                <small>{rate(data.totals.partialSuccesses, data.totals.requests)}</small>
              </article>
              <article>
                <span>导出/下载</span>
                <strong>{data.totals.exports}</strong>
                <small>{rate(
                  data.totals.exports,
                  data.totals.completeSuccesses + data.totals.partialSuccesses,
                )}</small>
              </article>
            </div>
          </section>

          <section className="admin-table-section">
            <header>
              <h2>Skill 表现</h2>
              <span>请求、成功与导出分开计算</span>
            </header>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Skill</th><th>生成 DAU</th><th>请求</th>
                    <th>完全成功</th><th>部分成功</th><th>成功率</th><th>导出</th>
                  </tr>
                </thead>
                <tbody>
                  {data.skills.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{skillNames[item.id] ?? item.id}</strong></td>
                      <td>{item.generationDau}</td>
                      <td>{item.requests}</td>
                      <td>{item.completeSuccesses}</td>
                      <td>{item.partialSuccesses}</td>
                      <td>{rate(
                        item.completeSuccesses + item.partialSuccesses,
                        item.requests,
                      )}</td>
                      <td>{item.exports}</td>
                    </tr>
                  ))}
                  {!data.skills.length ? (
                    <tr><td colSpan={7}>还没有生成事件</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-table-section">
            <header>
              <h2>最近用户</h2>
              <button
                type="button"
                className="admin-inline-action"
                onClick={() => {
                  setSection("results");
                  if (!selectedUserId && data.users[0]) {
                    selectUser(data.users[0].id);
                  }
                }}
              >
                查看生成结果
              </button>
            </header>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>用户</th><th>邮箱</th><th>注册时间</th>
                    <th>最后活跃</th><th>生成次数</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id}>
                      <td><strong>{user.name}</strong></td>
                      <td>{user.email}</td>
                      <td>{new Date(user.createdAt).toLocaleDateString("zh-CN")}</td>
                      <td>{dateTime(user.lastActive)}</td>
                      <td>{user.generations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="admin-results-layout">
          <aside className="admin-user-directory">
            <header>
              <div>
                <h2>用户</h2>
                <span>{filteredUsers.length} 人</span>
              </div>
              <label className="admin-user-search">
                <MagnifyingGlass aria-hidden="true" />
                <span className="sr-only">搜索用户</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索姓名或邮箱"
                />
              </label>
            </header>
            <div className="admin-user-list">
              {filteredUsers.map((user) => (
                <button
                  type="button"
                  className={selectedUserId === user.id ? "active" : ""}
                  onClick={() => selectUser(user.id)}
                  key={user.id}
                >
                  <span className="admin-user-avatar" aria-hidden="true">
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </span>
                  <b>{user.generations}</b>
                </button>
              ))}
              {!filteredUsers.length ? (
                <p className="admin-user-empty">没有匹配的用户</p>
              ) : null}
            </div>
          </aside>

          <div className="admin-user-results">
            {!selectedUserId ? (
              <div className="admin-results-empty">
                <Users weight="duotone" />
                <h2>选择一个用户</h2>
                <p>查看该用户的图片、视频和 Listing 结果。</p>
              </div>
            ) : resultsLoading ? (
              <div className="admin-results-empty">
                <strong>正在读取用户生成结果</strong>
              </div>
            ) : resultsError ? (
              <div className="admin-results-empty" role="alert">
                <h2>读取失败</h2><p>{resultsError}</p>
              </div>
            ) : userResults ? (
              <>
                <header className="admin-results-head">
                  <div className="admin-results-person">
                    <span className="admin-user-avatar" aria-hidden="true">
                      {userResults.user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <h2>{userResults.user.name}</h2>
                      <p>{userResults.user.email}</p>
                    </div>
                  </div>
                  <span>最后活跃 {dateTime(userResults.user.lastActive)}</span>
                </header>

                <div className="admin-results-summary">
                  {[
                    ["生成任务", userResults.summary.generations],
                    ["图片", userResults.summary.images],
                    ["视频", userResults.summary.videos],
                    ["Listing", userResults.summary.listings],
                  ].map(([label, value]) => (
                    <article key={String(label)}>
                      <span>{label}</span><strong>{value}</strong>
                    </article>
                  ))}
                </div>

                <div className="admin-results-filter" aria-label="结果类型">
                  {([
                    ["all", "全部"],
                    ["image", "图片"],
                    ["video", "视频"],
                    ["listing", "Listing"],
                  ] as Array<[ResultFilter, string]>).map(([id, label]) => (
                    <button
                      type="button"
                      className={resultFilter === id ? "active" : ""}
                      onClick={() => setResultFilter(id)}
                      key={id}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="admin-conversation-results">
                  {visibleConversations.map((conversation) => (
                    <section key={conversation.id}>
                      <header>
                        <h3>{conversation.title}</h3>
                        <span>{dateTime(conversation.updatedAt)}</span>
                      </header>
                      <div>
                        {conversation.turns.map((turn) => (
                          <article className="admin-generation-card" key={turn.id}>
                            <header>
                              <div>
                                <strong>{turn.title}</strong>
                                <span>{skillNames[turn.skill] ?? turn.skill}</span>
                              </div>
                              <time>{dateTime(turn.createdAt)}</time>
                            </header>

                            {turn.listing && resultFilter !== "image" && resultFilter !== "video" ? (
                              <div className="admin-listing-result">
                                <div>
                                  <FileText weight="duotone" />
                                  <span>Listing</span>
                                </div>
                                <h4>{turn.listing.title || "未命名 Listing"}</h4>
                                {turn.listing.salePrice ? (
                                  <b>{turn.listing.salePrice}</b>
                                ) : null}
                                {turn.listing.bullets?.length ? (
                                  <ul>
                                    {turn.listing.bullets.slice(0, 5).map((bullet) => (
                                      <li key={bullet}>{bullet}</li>
                                    ))}
                                  </ul>
                                ) : null}
                                {turn.listing.description ? (
                                  <p>{turn.listing.description}</p>
                                ) : null}
                              </div>
                            ) : null}

                            {turn.assets.length ? (
                              <div className="admin-result-assets">
                                {turn.assets.map((asset) => (
                                  <div className="admin-result-asset" key={asset.id}>
                                    {asset.type === "video" ? (
                                      <video
                                        src={asset.url}
                                        controls
                                        preload="metadata"
                                        aria-label={asset.title}
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setPreview(asset)}
                                        aria-label={`预览 ${asset.title}`}
                                      >
                                        <img src={asset.url} alt={asset.title} />
                                      </button>
                                    )}
                                    <footer>
                                      {asset.type === "video" ? (
                                        <VideoCamera weight="bold" />
                                      ) : (
                                        <ImageSquare weight="bold" />
                                      )}
                                      <strong>{asset.title}</strong>
                                    </footer>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            {turn.prompt ? (
                              <details className="admin-prompt-details">
                                <summary>查看用户输入</summary>
                                <p>{turn.prompt}</p>
                              </details>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                  {!visibleConversations.length ? (
                    <div className="admin-results-empty">
                      <ImageSquare weight="duotone" />
                      <h2>还没有这类生成结果</h2>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </section>
      )}

      {preview ? (
        <div
          className="admin-preview"
          role="dialog"
          aria-modal="true"
          aria-label={`预览 ${preview.title}`}
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            className="admin-preview-close"
            onClick={() => setPreview(null)}
            aria-label="关闭预览"
          >
            <X weight="bold" />
          </button>
          <figure onClick={(event) => event.stopPropagation()}>
            <img src={preview.url} alt={preview.title} />
            <figcaption>
              <strong>{preview.title}</strong>
              <span>{dateTime(preview.createdAt)}</span>
            </figcaption>
          </figure>
        </div>
      ) : null}
    </main>
  );
}
