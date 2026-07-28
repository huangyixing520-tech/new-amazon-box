import {
  authErrorResponse,
  encryptApiKey,
  ensureIdentitySchema,
  requireUser,
  verifySameOrigin,
} from "../../../lib/auth";
import { runtimeBindings } from "../../../lib/runtime";

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await requireUser(request);
    const body = await request.json() as { apiKey?: string };
    const apiKey = body.apiKey?.trim() ?? "";
    if (apiKey.length < 12 || apiKey.length > 512 || /\s/.test(apiKey)) {
      return Response.json(
        { error: "请输入有效的 API Key（不能包含空格）" },
        { status: 400 },
      );
    }
    const { DB } = await runtimeBindings();
    if (!DB) return Response.json({ error: "用户数据库尚未配置" }, { status: 503 });
    await ensureIdentitySchema(DB);
    const now = new Date().toISOString();
    const encryptedKey = await encryptApiKey(apiKey);
    const keyLastFour = apiKey.slice(-4);
    await DB.prepare(`
      INSERT INTO user_api_keys (
        user_id, encrypted_key, key_last_four, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        encrypted_key = excluded.encrypted_key,
        key_last_four = excluded.key_last_four,
        updated_at = excluded.updated_at
    `).bind(user.id, encryptedKey, keyLastFour, now, now).run();
    return Response.json({ ok: true, hasApiKey: true, keyLastFour });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await requireUser(request);
    const { DB } = await runtimeBindings();
    if (!DB) return Response.json({ error: "用户数据库尚未配置" }, { status: 503 });
    await ensureIdentitySchema(DB);
    await DB.prepare("DELETE FROM user_api_keys WHERE user_id = ?")
      .bind(user.id)
      .run();
    return Response.json({ ok: true, hasApiKey: false, keyLastFour: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}
