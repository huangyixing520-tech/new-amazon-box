import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  SignJWT,
} from "jose";
import {
  createAssetOwnersTableSql,
  createAssetOwnersUserIndexSql,
  createGenerationTasksTableSql,
  createGenerationTasksUserIndexSql,
  createUserApiKeysTableSql,
  createUsersTableSql,
} from "../../db/schema";
import { runtimeBindings, type D1Binding } from "./runtime";

const SESSION_COOKIE = "mercato_session";
const CSRF_COOKIE = "mercato_csrf";
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
  hasApiKey: boolean;
  keyLastFour: string | null;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  picture_url: string | null;
  key_last_four: string | null;
};

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function envValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function isAdminEmail(email: string) {
  const allowed = envValue("ADMIN_EMAILS")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (!isAdminEmail(user.email)) {
    throw new AuthError("当前账号没有数据后台权限", 403);
  }
  return user;
}

function requiredSecret(name: string) {
  const value = envValue(name);
  if (value.length < 32) {
    throw new Error(`${name} 尚未配置或长度不足`);
  }
  return value;
}

function cookieMap(request: Request) {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    result.set(
      part.slice(0, separator).trim(),
      decodeURIComponent(part.slice(separator + 1).trim()),
    );
  }
  return result;
}

function cookieOptions(request: Request, httpOnly: boolean, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:";
  return [
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
    secure ? "Secure" : "",
    httpOnly ? "HttpOnly" : "",
  ].filter(Boolean).join("; ");
}

function encodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function derivedEncryptionKey() {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(requiredSecret("API_KEY_ENCRYPTION_SECRET")),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptApiKey(apiKey: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await derivedEncryptionKey(),
    new TextEncoder().encode(apiKey),
  );
  return `v1.${encodeBytes(iv)}.${encodeBytes(new Uint8Array(encrypted))}`;
}

export async function decryptApiKey(value: string) {
  const [version, ivValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !encryptedValue) {
    throw new Error("用户 API Key 密文格式无效");
  }
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBytes(ivValue) },
    await derivedEncryptionKey(),
    decodeBytes(encryptedValue),
  );
  return new TextDecoder().decode(decrypted);
}

export async function ensureIdentitySchema(db: D1Binding) {
  await db.batch([
    db.prepare(createUsersTableSql),
    db.prepare(createUserApiKeysTableSql),
    db.prepare(createGenerationTasksTableSql),
    db.prepare(createGenerationTasksUserIndexSql),
    db.prepare(createAssetOwnersTableSql),
    db.prepare(createAssetOwnersUserIndexSql),
  ]);
}

export function verifySameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new AuthError("请求来源校验失败", 403);
  }
}

export function createCsrfToken() {
  return encodeBytes(crypto.getRandomValues(new Uint8Array(24)));
}

export function setCsrfCookie(
  response: Response,
  request: Request,
  token: string,
) {
  response.headers.append(
    "Set-Cookie",
    `${CSRF_COOKIE}=${encodeURIComponent(token)}; ${cookieOptions(request, false, 10 * 60)}`,
  );
}

export function verifyCsrf(request: Request, suppliedToken: unknown) {
  const cookieToken = cookieMap(request).get(CSRF_COOKIE);
  if (
    !cookieToken ||
    typeof suppliedToken !== "string" ||
    suppliedToken.length < 20 ||
    cookieToken !== suppliedToken
  ) {
    throw new AuthError("登录校验已过期，请重试", 403);
  }
}

async function sessionSecret() {
  return new TextEncoder().encode(requiredSecret("SESSION_SECRET"));
}

export async function createSessionToken(userId: string) {
  return new SignJWT({ scope: "mercato:user" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("mercato")
    .setAudience("mercato-web")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(await sessionSecret());
}

export function setSessionCookie(
  response: Response,
  request: Request,
  token: string,
) {
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieOptions(
      request,
      true,
      SESSION_DURATION_SECONDS,
    )}`,
  );
}

export function clearSessionCookie(response: Response, request: Request) {
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; ${cookieOptions(request, true, 0)}`,
  );
}

export function googleClientId() {
  return envValue("GOOGLE_CLIENT_ID");
}

export async function verifyGoogleCredential(credential: string) {
  const clientId = googleClientId();
  if (!clientId) throw new AuthError("Google 登录尚未完成线上配置", 503);
  const header = decodeProtectedHeader(credential);
  if (header.alg !== "RS256") throw new AuthError("Google 登录凭证无效", 401);
  const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
    audience: clientId,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });
  if (!payload.sub || !payload.email || payload.email_verified !== true) {
    throw new AuthError("Google 账号信息不完整或邮箱未验证", 401);
  }
  return {
    id: payload.sub,
    email: String(payload.email),
    name: String(payload.name || payload.email),
    pictureUrl: payload.picture ? String(payload.picture) : null,
  };
}

export async function upsertGoogleUser(user: {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
}) {
  const { DB } = await runtimeBindings();
  if (!DB) throw new AuthError("用户数据库尚未配置", 503);
  await ensureIdentitySchema(DB);
  const now = new Date().toISOString();
  await DB.prepare(`
    INSERT INTO users (id, email, name, picture_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      picture_url = excluded.picture_url,
      updated_at = excluded.updated_at
  `).bind(
    user.id,
    user.email,
    user.name,
    user.pictureUrl,
    now,
    now,
  ).run();
  return user;
}

export async function sessionUserById(userId: string): Promise<SessionUser | null> {
  const { DB } = await runtimeBindings();
  if (!DB) return null;
  await ensureIdentitySchema(DB);
  const row = await DB.prepare(`
    SELECT u.id, u.email, u.name, u.picture_url, k.key_last_four
    FROM users u
    LEFT JOIN user_api_keys k ON k.user_id = u.id
    WHERE u.id = ?
  `).bind(userId).first<UserRow>();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    pictureUrl: row.picture_url,
    hasApiKey: Boolean(row.key_last_four),
    keyLastFour: row.key_last_four,
  };
}

export async function currentUser(request: Request): Promise<SessionUser | null> {
  const token = cookieMap(request).get(SESSION_COOKIE);
  if (!token) return null;
  let userId: string | undefined;
  try {
    const { payload } = await jwtVerify(token, await sessionSecret(), {
      issuer: "mercato",
      audience: "mercato-web",
    });
    userId = payload.sub;
  } catch {
    return null;
  }
  if (!userId) return null;
  return sessionUserById(userId);
}

export async function requireUser(request: Request) {
  const user = await currentUser(request);
  if (!user) throw new AuthError("请先使用 Google 登录", 401);
  return user;
}

export async function userApiKey(request: Request) {
  const user = await requireUser(request);
  const { DB } = await runtimeBindings();
  if (!DB) throw new AuthError("用户数据库尚未配置", 503);
  await ensureIdentitySchema(DB);
  const row = await DB.prepare(
    "SELECT encrypted_key FROM user_api_keys WHERE user_id = ?",
  ).bind(user.id).first<{ encrypted_key: string }>();
  if (!row) throw new AuthError("请先在左下角账号管理中配置 API Key", 428);
  return { user, apiKey: await decryptApiKey(row.encrypted_key), DB };
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json(
    { error: error instanceof Error ? error.message : "身份验证失败" },
    { status: 500 },
  );
}
