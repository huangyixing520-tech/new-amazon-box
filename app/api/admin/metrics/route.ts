import { authErrorResponse, requireAdmin } from "../../../lib/auth";
import { ensureProductDataSchema, safeJson } from "../../../lib/product-data";
import { runtimeBindings } from "../../../lib/runtime";

type EventRow = {
  user_id: string;
  event_name: string;
  mode: string | null;
  skill: string | null;
  metadata_json: string;
  created_at: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_active: string | null;
  generations: number;
};

type MetricBucket = {
  activeUsers: Set<string>;
  generatingUsers: Set<string>;
  successfulUsers: Set<string>;
  exportingUsers: Set<string>;
  requests: number;
  completeSuccesses: number;
  partialSuccesses: number;
  failures: number;
  exports: number;
};

function bucket(): MetricBucket {
  return {
    activeUsers: new Set(),
    generatingUsers: new Set(),
    successfulUsers: new Set(),
    exportingUsers: new Set(),
    requests: 0,
    completeSuccesses: 0,
    partialSuccesses: 0,
    failures: 0,
    exports: 0,
  };
}

function publicBucket(value: MetricBucket) {
  return {
    dau: value.activeUsers.size,
    generationDau: value.generatingUsers.size,
    successDau: value.successfulUsers.size,
    exportDau: value.exportingUsers.size,
    requests: value.requests,
    completeSuccesses: value.completeSuccesses,
    partialSuccesses: value.partialSuccesses,
    failures: value.failures,
    exports: value.exports,
  };
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { DB } = await runtimeBindings();
    if (!DB) return Response.json({ error: "统计数据库尚未配置" }, { status: 503 });
    await ensureProductDataSchema(DB);
    const requestedDays = Number(new URL(request.url).searchParams.get("days") || 30);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const [eventResult, userResult, totalUserRow] = await Promise.all([
      DB.prepare(`
        SELECT user_id, event_name, mode, skill, metadata_json, created_at
        FROM analytics_events
        WHERE created_at >= ?
        ORDER BY created_at ASC
        LIMIT 100000
      `).bind(cutoff).all<EventRow>(),
      DB.prepare(`
        SELECT u.id, u.email, u.name, u.created_at,
          MAX(e.created_at) AS last_active,
          SUM(CASE WHEN e.event_name = 'generation_requested' THEN 1 ELSE 0 END) AS generations
        FROM users u
        LEFT JOIN analytics_events e ON e.user_id = u.id
        GROUP BY u.id, u.email, u.name, u.created_at
        ORDER BY last_active DESC, u.created_at DESC
        LIMIT 100
      `).all<UserRow>(),
      DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>(),
    ]);
    const daily = new Map<string, MetricBucket>();
    const skill = new Map<string, MetricBucket>();
    const total = bucket();

    for (const event of eventResult.results ?? []) {
      const date = event.created_at.slice(0, 10);
      const dailyBucket = daily.get(date) ?? bucket();
      daily.set(date, dailyBucket);
      const skillId = event.skill || "unknown";
      const skillBucket = skill.get(skillId) ?? bucket();
      skill.set(skillId, skillBucket);
      const targets = [total, dailyBucket, skillBucket];
      const metadata = safeJson<Record<string, unknown>>(event.metadata_json, {});

      for (const target of targets) {
        if (event.event_name === "session_started") target.activeUsers.add(event.user_id);
        if (event.event_name === "generation_requested") {
          target.generatingUsers.add(event.user_id);
          target.requests += 1;
        }
        if (event.event_name === "generation_completed") {
          const status = String(metadata.status || "failed");
          if (status === "complete") {
            target.completeSuccesses += 1;
            target.successfulUsers.add(event.user_id);
          } else if (status === "partial") {
            target.partialSuccesses += 1;
            target.successfulUsers.add(event.user_id);
          } else {
            target.failures += 1;
          }
        }
        if (event.event_name.endsWith("_downloaded") || event.event_name === "listing_link_copied") {
          target.exportingUsers.add(event.user_id);
          target.exports += 1;
        }
      }
    }

    return Response.json({
      days,
      totalUsers: Number(totalUserRow?.total || 0),
      totals: publicBucket(total),
      daily: Array.from(daily, ([date, value]) => ({ date, ...publicBucket(value) })),
      skills: Array.from(skill, ([id, value]) => ({ id, ...publicBucket(value) }))
        .filter((item) => item.id !== "unknown" || item.requests || item.exports)
        .sort((left, right) => right.requests - left.requests),
      users: (userResult.results ?? []).map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at,
        lastActive: user.last_active,
        generations: Number(user.generations || 0),
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
