"use client";

import { ArrowLeft, ChartLineUp, DownloadSimple, Sparkle, Users } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import Link from "next/link";

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

type DashboardData = {
  days: number;
  totalUsers: number;
  totals: Metric;
  daily: Array<Metric & { date: string }>;
  skills: Array<Metric & { id: string }>;
  users: Array<{
    id: string;
    email: string;
    name: string;
    createdAt: string;
    lastActive: string | null;
    generations: number;
  }>;
};

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

export default function AdminPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`/api/admin/metrics?days=${days}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "无法读取数据");
        setData(payload);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "无法读取数据"));
  }, [days]);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <Link href="/" className="admin-back"><ArrowLeft weight="bold" />返回 Mercato</Link>
          <h1>数据后台</h1>
          <p>真实用户行为、生成质量与导出转化。</p>
        </div>
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
      </header>

      {error ? (
        <section className="admin-state" role="alert">
          <strong>暂时无法进入后台</strong>
          <p>{error}</p>
        </section>
      ) : !data ? (
        <section className="admin-state"><strong>正在读取真实数据</strong></section>
      ) : (
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
            <header><h2>生成漏斗</h2><span>最近 {data.days} 天</span></header>
            <div>
              <article><span>发起生成</span><strong>{data.totals.requests}</strong></article>
              <article><span>完全成功</span><strong>{data.totals.completeSuccesses}</strong><small>{rate(data.totals.completeSuccesses, data.totals.requests)}</small></article>
              <article><span>部分成功</span><strong>{data.totals.partialSuccesses}</strong><small>{rate(data.totals.partialSuccesses, data.totals.requests)}</small></article>
              <article><span>导出/下载</span><strong>{data.totals.exports}</strong><small>{rate(data.totals.exports, data.totals.completeSuccesses + data.totals.partialSuccesses)}</small></article>
            </div>
          </section>

          <section className="admin-table-section">
            <header><h2>Skill 表现</h2><span>请求、成功与导出分开计算</span></header>
            <div className="admin-table-wrap">
              <table>
                <thead><tr><th>Skill</th><th>生成 DAU</th><th>请求</th><th>完全成功</th><th>部分成功</th><th>成功率</th><th>导出</th></tr></thead>
                <tbody>
                  {data.skills.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{skillNames[item.id] ?? item.id}</strong></td>
                      <td>{item.generationDau}</td>
                      <td>{item.requests}</td>
                      <td>{item.completeSuccesses}</td>
                      <td>{item.partialSuccesses}</td>
                      <td>{rate(item.completeSuccesses + item.partialSuccesses, item.requests)}</td>
                      <td>{item.exports}</td>
                    </tr>
                  ))}
                  {!data.skills.length ? <tr><td colSpan={7}>还没有生成事件</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-table-section">
            <header><h2>最近用户</h2><span>默认不展示 Prompt、原图或 API Key</span></header>
            <div className="admin-table-wrap">
              <table>
                <thead><tr><th>用户</th><th>邮箱</th><th>注册时间</th><th>最后活跃</th><th>生成次数</th></tr></thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id}>
                      <td><strong>{user.name}</strong></td>
                      <td>{user.email}</td>
                      <td>{new Date(user.createdAt).toLocaleDateString("zh-CN")}</td>
                      <td>{user.lastActive ? new Date(user.lastActive).toLocaleString("zh-CN") : "暂无"}</td>
                      <td>{user.generations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
