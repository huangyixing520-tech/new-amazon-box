import { authErrorResponse, requireAdmin } from "../../../lib/auth";
import { ensureAssetsSchema } from "../../../lib/assets-data";
import { ensureProductDataSchema, safeJson } from "../../../lib/product-data";
import { runtimeBindings } from "../../../lib/runtime";

type EventRow = {
  user_id: string;
  event_name: string;
  mode: string | null;
  skill: string | null;
  generation_id: string | null;
  metadata_json: string;
  created_at: string;
};

type GenerationRow = {
  id: string;
  user_id: string;
  media_type: "image" | "video";
  skill: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type AssetRow = {
  id: string;
  user_id: string;
  type: "image" | "video";
  skill: string | null;
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

type Bucket = {
  active: Set<string>;
  requested: Set<string>;
  succeeded: Set<string>;
  exported: Set<string>;
  images: number;
  videos: number;
  attempts: number;
  successes: number;
  failures: number;
};

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dayKey(value: string | Date) {
  return dayFormatter.format(typeof value === "string" ? new Date(value) : value);
}

function bucket(): Bucket {
  return {
    active: new Set(), requested: new Set(), succeeded: new Set(), exported: new Set(),
    images: 0, videos: 0, attempts: 0, successes: 0, failures: 0,
  };
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.max(0, Math.ceil(ordered.length * ratio) - 1)];
}

function funnel(events: EventRow[]) {
  const stages = ["session_started", "generation_requested", "generation_succeeded", "media_exported"];
  const aliases: Record<string, string> = {
    generation_completed: "generation_succeeded",
    asset_downloaded: "media_exported",
    listing_json_downloaded: "media_exported",
    listing_link_copied: "media_exported",
  };
  const progress = new Map<string, number>();
  const counts = stages.map(() => 0);
  for (const event of events) {
    const name = aliases[event.event_name] ?? event.event_name;
    if (event.event_name === "generation_completed") {
      const metadata = safeJson<Record<string, unknown>>(event.metadata_json, {});
      if (String(metadata.status || "failed") === "failed") continue;
    }
    const expected = progress.get(event.user_id) ?? 0;
    if (name !== stages[expected]) continue;
    counts[expected] += 1;
    progress.set(event.user_id, expected + 1);
  }
  return stages.map((name, index) => ({
    name,
    count: counts[index],
    conversionRate: index === 0 ? 1 : counts[index - 1] ? counts[index] / counts[index - 1] : 0,
    overallRate: counts[0] ? counts[index] / counts[0] : 0,
    dropoff: index === 0 ? 0 : Math.max(0, counts[index - 1] - counts[index]),
  }));
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { DB } = await runtimeBindings();
    if (!DB) return Response.json({ error: "统计数据库尚未配置" }, { status: 503 });
    await ensureProductDataSchema(DB);
    await ensureAssetsSchema(DB);
    const requestedDays = Number(new URL(request.url).searchParams.get("days") || 30);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const now = new Date();
    const cutoff = new Date(now.getTime() - (days - 1) * 86_400_000);
    cutoff.setUTCHours(0, 0, 0, 0);
    const activityCutoff = new Date(now.getTime() - Math.max(days, 30) * 86_400_000).toISOString();
    const cutoffIso = cutoff.toISOString();

    const [eventResult, generationResult, assetResult, userResult, totalUserRow] = await Promise.all([
      DB.prepare(`
        SELECT user_id, event_name, mode, skill, generation_id, metadata_json, created_at
        FROM analytics_events WHERE created_at >= ?
        ORDER BY created_at ASC, id ASC LIMIT 200000
      `).bind(activityCutoff).all<EventRow>(),
      DB.prepare(`
        SELECT id, user_id, media_type, skill, status, error_message,
          created_at, started_at, completed_at
        FROM generation_records WHERE created_at >= ?
        ORDER BY created_at ASC LIMIT 200000
      `).bind(cutoffIso).all<GenerationRow>(),
      DB.prepare(`
        SELECT a.id, o.user_id, a.type, g.skill, a.created_at
        FROM assets a
        INNER JOIN asset_owners o ON o.asset_id = a.id
        LEFT JOIN generation_records g ON g.id = a.generation_id
        WHERE a.role = 'output' AND a.created_at >= ?
        ORDER BY a.created_at ASC LIMIT 200000
      `).bind(cutoffIso).all<AssetRow>(),
      DB.prepare(`
        SELECT u.id, u.email, u.name, u.created_at,
          MAX(e.created_at) AS last_active,
          COUNT(DISTINCT g.request_id) AS generations
        FROM users u
        LEFT JOIN analytics_events e ON e.user_id = u.id
        LEFT JOIN generation_records g ON g.user_id = u.id
        GROUP BY u.id, u.email, u.name, u.created_at
        ORDER BY last_active DESC, u.created_at DESC LIMIT 500
      `).all<UserRow>(),
      DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>(),
    ]);

    const events = eventResult.results ?? [];
    const generations = generationResult.results ?? [];
    const assets = assetResult.results ?? [];
    const daily = new Map<string, Bucket>();
    const period = bucket();
    const active30 = new Set<string>();
    const thirtyDayCutoff = now.getTime() - 30 * 86_400_000;
    const getDay = (date: string) => {
      const key = dayKey(date);
      const value = daily.get(key) ?? bucket();
      daily.set(key, value);
      return value;
    };

    for (const event of events) {
      if (event.event_name === "session_started" && new Date(event.created_at).getTime() >= thirtyDayCutoff) {
        active30.add(event.user_id);
      }
      if (event.created_at < cutoffIso) continue;
      const target = getDay(event.created_at);
      if (event.event_name === "session_started") {
        target.active.add(event.user_id);
        period.active.add(event.user_id);
      }
      if (event.event_name === "generation_requested") {
        target.requested.add(event.user_id);
        period.requested.add(event.user_id);
      }
      if (["generation_succeeded", "generation_completed"].includes(event.event_name)) {
        const metadata = safeJson<Record<string, unknown>>(event.metadata_json, {});
        if (event.event_name !== "generation_completed" || String(metadata.status || "failed") !== "failed") {
          target.succeeded.add(event.user_id);
          period.succeeded.add(event.user_id);
        }
      }
      if (["media_exported", "asset_downloaded", "listing_json_downloaded", "listing_link_copied"].includes(event.event_name)) {
        target.exported.add(event.user_id);
        period.exported.add(event.user_id);
      }
    }
    for (const generation of generations) {
      const target = getDay(generation.created_at);
      target.attempts += 1;
      period.attempts += 1;
      if (generation.status === "succeeded") { target.successes += 1; period.successes += 1; }
      if (generation.status === "failed") { target.failures += 1; period.failures += 1; }
    }
    for (const asset of assets) {
      const target = getDay(asset.created_at);
      if (asset.type === "video") { target.videos += 1; period.videos += 1; }
      else { target.images += 1; period.images += 1; }
    }

    const dailyRows = Array.from(daily, ([date, value]) => ({
      date,
      dau: value.active.size,
      generationDau: value.requested.size,
      successDau: value.succeeded.size,
      exportDau: value.exported.size,
      images: value.images,
      videos: value.videos,
      attempts: value.attempts,
      successes: value.successes,
      failures: value.failures,
      exportRate: value.active.size ? value.exported.size / value.active.size : 0,
    })).sort((left, right) => left.date.localeCompare(right.date));

    const exportsByGeneration = new Set(
      events.filter((event) => event.event_name === "media_exported" && event.generation_id)
        .map((event) => event.generation_id!),
    );
    const skillMap = new Map<string, { attempts: number; successes: number; exports: number; users: Set<string> }>();
    for (const generation of generations) {
      const id = generation.skill || "unknown";
      const item = skillMap.get(id) ?? { attempts: 0, successes: 0, exports: 0, users: new Set() };
      item.attempts += 1;
      item.users.add(generation.user_id);
      if (generation.status === "succeeded") item.successes += 1;
      if (exportsByGeneration.has(generation.id)) item.exports += 1;
      skillMap.set(id, item);
    }
    const durations = generations
      .filter((item) => item.started_at && item.completed_at)
      .map((item) => new Date(item.completed_at!).getTime() - new Date(item.started_at!).getTime())
      .filter((value) => Number.isFinite(value) && value >= 0);
    const failureMap = new Map<string, number>();
    for (const item of generations.filter((entry) => entry.status === "failed")) {
      const key = (item.error_message || "unknown").slice(0, 120);
      failureMap.set(key, (failureMap.get(key) || 0) + 1);
    }
    const endDay = dailyRows.at(-1);

    return Response.json({
      days,
      totalUsers: Number(totalUserRow?.total || 0),
      summary: {
        dau: endDay?.dau ?? 0,
        mau: active30.size,
        images: period.images,
        videos: period.videos,
        exportRate: endDay?.exportRate ?? 0,
        attempts: period.attempts,
        successes: period.successes,
        failures: period.failures,
      },
      totals: {
        dau: period.active.size,
        generationDau: period.requested.size,
        successDau: period.succeeded.size,
        exportDau: period.exported.size,
        requests: period.attempts,
        completeSuccesses: period.successes,
        partialSuccesses: 0,
        failures: period.failures,
        exports: exportsByGeneration.size,
      },
      daily: dailyRows,
      mainFunnel: { stages: funnel(events.filter((event) => event.created_at >= cutoffIso)) },
      skills: Array.from(skillMap, ([id, value]) => ({
        id,
        generationDau: value.users.size,
        requests: value.attempts,
        completeSuccesses: value.successes,
        partialSuccesses: 0,
        failures: value.attempts - value.successes,
        exports: value.exports,
      })).sort((left, right) => right.requests - left.requests),
      diagnostics: {
        latency: { p50Ms: percentile(durations, 0.5), p95Ms: percentile(durations, 0.95) },
        failureReasons: Array.from(failureMap, ([reason, count]) => ({ reason, count }))
          .sort((left, right) => right.count - left.count).slice(0, 8),
      },
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
