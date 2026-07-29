import { NextResponse } from "next/server";
import { authErrorResponse, requireUser, verifySameOrigin } from "../../lib/auth";
import { ensureProductDataSchema } from "../../lib/product-data";
import { runtimeBindings } from "../../lib/runtime";

const allowedEvents = new Set([
  "session_started",
  "generation_requested",
  "generation_completed",
  "asset_downloaded",
  "listing_json_downloaded",
  "listing_link_copied",
]);

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await requireUser(request);
    const { DB } = await runtimeBindings();
    if (!DB) return NextResponse.json({ error: "统计数据库尚未配置" }, { status: 503 });
    await ensureProductDataSchema(DB);
    const body = await request.json() as {
      event?: string;
      mode?: string;
      skill?: string;
      conversationId?: string;
      turnId?: string;
      metadata?: Record<string, unknown>;
    };
    if (!body.event || !allowedEvents.has(body.event)) {
      return NextResponse.json({ error: "未知统计事件" }, { status: 400 });
    }
    await DB.prepare(`
      INSERT INTO analytics_events (
        id, user_id, event_name, mode, skill, conversation_id,
        turn_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      user.id,
      body.event,
      body.mode || null,
      body.skill || null,
      body.conversationId || null,
      body.turnId || null,
      JSON.stringify(body.metadata ?? {}),
      new Date().toISOString(),
    ).run();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
