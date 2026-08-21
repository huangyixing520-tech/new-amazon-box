"use client";

import {
  CheckCircle,
  ChartBar,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  Key,
  LockKey,
  SignOut,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

export type ClientSession = {
  user: {
    id: string;
    email: string;
    name: string;
    pictureUrl: string | null;
  };
  hasApiKey: boolean;
  keyLastFour: string | null;
  isAdmin?: boolean;
} | null;

type GoogleCredentialResponse = {
  credential: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            ux_mode?: "popup";
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              type: "standard";
              theme: "outline";
              size: "large";
              shape: "pill";
              text: "continue_with";
              width: number;
            },
          ) => void;
        };
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleScript() {
  if (window.google) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google 登录组件加载失败")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google 登录组件加载失败"));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

export function preloadGoogleSignIn() {
  if (typeof window === "undefined") return;
  void loadGoogleScript().catch(() => undefined);
}

async function responseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as {
    error?: string;
  } | null;
  return payload?.error || fallback;
}

export default function AccountPanel({
  session,
  onSession,
  onClose,
}: {
  session: ClientSession;
  onSession: (session: ClientSession) => void;
  onClose: () => void;
}) {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [configured, setConfigured] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [emailMode, setEmailMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (session) return;
    let active = true;
    void fetch("/api/auth/config", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "登录配置读取失败"));
        return response.json();
      })
      .then((payload) => {
        if (!active) return;
        setConfigured(Boolean(payload.configured));
        setClientId(payload.clientId || "");
        setCsrfToken(payload.csrfToken || "");
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "登录配置读取失败");
      });
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (session || !clientId || !csrfToken || !googleButtonRef.current) return;
    let active = true;
    void loadGoogleScript()
      .then(() => {
        if (!active || !window.google || !googleButtonRef.current) return;
        googleButtonRef.current.replaceChildren();
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          callback: (googleResponse) => {
            setBusy(true);
            setError("");
            void fetch("/api/auth/google", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                credential: googleResponse.credential,
                csrfToken,
              }),
            })
              .then(async (response) => {
                if (!response.ok) {
                  throw new Error(await responseError(response, "Google 登录失败"));
                }
                return response.json();
              })
              .then((payload) => onSession(payload))
              .catch((reason) => {
                setError(reason instanceof Error ? reason.message : "Google 登录失败");
              })
              .finally(() => setBusy(false));
          },
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: Math.min(440, googleButtonRef.current.clientWidth || 440),
        });
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Google 登录组件加载失败");
      });
    return () => {
      active = false;
    };
  }, [clientId, csrfToken, onSession, session]);

  const saveApiKey = async () => {
    if (!apiKey.trim() || busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/account/api-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "API Key 保存失败"));
      }
      const payload = await response.json();
      onSession(session ? {
        ...session,
        hasApiKey: true,
        keyLastFour: payload.keyLastFour,
      } : session);
      setApiKey("");
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "API Key 保存失败");
    } finally {
      setBusy(false);
    }
  };

  const submitEmailAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !csrfToken) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/email/${emailMode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, password, csrfToken }),
      });
      if (!response.ok) {
        throw new Error(await responseError(
          response,
          emailMode === "login" ? "邮箱登录失败" : "邮箱注册失败",
        ));
      }
      const payload = await response.json();
      setPassword("");
      onSession(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "邮箱登录失败");
    } finally {
      setBusy(false);
    }
  };

  const removeApiKey = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/api-key", { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await responseError(response, "API Key 删除失败"));
      }
      onSession(session ? {
        ...session,
        hasApiKey: false,
        keyLastFour: null,
      } : session);
      setApiKey("");
      setSaved(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "API Key 删除失败");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error(await responseError(response, "退出登录失败"));
      onSession(null);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "退出登录失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="account-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`account-dialog ${!session ? "account-dialog-login" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        data-testid="account-dialog"
      >
        <header className="account-dialog-header">
          <div>
            {!session ? (
              <>
                <strong className="account-login-brand"><i aria-hidden="true">♥</i>MERCATO</strong>
                <h2 id="account-dialog-title">登录后继续创作</h2>
              </>
            ) : (
              <>
                <span>ACCOUNT</span>
                <h2 id="account-dialog-title">账号与模型 API</h2>
              </>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="关闭账号管理">
            <X weight="bold" />
          </button>
        </header>

        {!session ? (
          <div className="account-login">
            {configured ? (
              <div
                className={`google-login-slot ${busy ? "is-busy" : ""}`}
                ref={googleButtonRef}
                aria-label="使用 Google 登录"
              />
            ) : (
              <p className="account-inline-error">Google 登录尚未完成线上配置。</p>
            )}
            <div className="account-login-divider"><span>或</span></div>
            <div className="email-auth-tabs" role="tablist" aria-label="邮箱账号方式">
              <button
                type="button"
                role="tab"
                aria-selected={emailMode === "login"}
                className={emailMode === "login" ? "active" : ""}
                onClick={() => {
                  setEmailMode("login");
                  setError("");
                }}
              >邮箱登录</button>
              <button
                type="button"
                role="tab"
                aria-selected={emailMode === "register"}
                className={emailMode === "register" ? "active" : ""}
                onClick={() => {
                  setEmailMode("register");
                  setError("");
                }}
              >注册账号</button>
            </div>
            <form className="email-auth-form" onSubmit={submitEmailAuth}>
              {emailMode === "register" ? (
                <label>
                  <span>昵称</span>
                  <input
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    minLength={2}
                    maxLength={60}
                    required
                    placeholder="你的称呼"
                  />
                </label>
              ) : null}
              <label>
                <span>邮箱</span>
                <div><EnvelopeSimple aria-hidden="true" />
                  <input
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                    placeholder="name@example.com"
                  />
                </div>
              </label>
              <label>
                <span>密码</span>
                <div><LockKey aria-hidden="true" />
                  <input
                    name="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={emailMode === "login" ? "current-password" : "new-password"}
                    minLength={8}
                    maxLength={72}
                    required
                    placeholder="至少 8 个字符"
                  />
                </div>
              </label>
              <button type="submit" disabled={busy || !csrfToken}>
                {busy ? "处理中…" : emailMode === "login" ? "登录工作台" : "创建账号"}
              </button>
            </form>
            <p className="account-login-terms">
              继续即表示你同意我们的 <span>服务条款</span> 和 <span>隐私政策</span>。
            </p>
          </div>
        ) : (
          <>
            <div className="account-profile">
              {session.user.pictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.pictureUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span>{session.user.name.slice(0, 1).toUpperCase()}</span>
              )}
              <div>
                <strong>{session.user.name}</strong>
                <small>{session.user.email}</small>
              </div>
              <CheckCircle weight="fill" aria-label="已登录" />
            </div>

            <div className="api-key-panel">
              <div className="api-key-heading">
                <span><Key weight="duotone" /></span>
                <div>
                  <h3>模型 API Key</h3>
                  <p>用于 LLM、生图和视频生成。服务端加密保存，不会返回明文。</p>
                </div>
              </div>
              {session.hasApiKey ? (
                <div className="api-key-status">
                  <span>已配置</span>
                  <code>•••• •••• •••• {session.keyLastFour}</code>
                  <button type="button" onClick={() => void removeApiKey()} disabled={busy}>
                    删除
                  </button>
                </div>
              ) : null}
              <label className="api-key-input">
                <span>{session.hasApiKey ? "替换 API Key" : "添加 API Key"}</span>
                <div>
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(event) => {
                      setApiKey(event.target.value);
                      setSaved(false);
                    }}
                    placeholder="粘贴你的中转站 API Key"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((visible) => !visible)}
                    aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                  >
                    {showApiKey ? <EyeSlash /> : <Eye />}
                  </button>
                </div>
              </label>
              <button
                type="button"
                className="save-api-key"
                disabled={!apiKey.trim() || busy}
                onClick={() => void saveApiKey()}
              >
                {busy ? "处理中…" : saved ? "已安全保存" : "保存 API Key"}
              </button>
            </div>

            <button
              type="button"
              className="account-signout"
              disabled={busy}
              onClick={() => void logout()}
            >
              <SignOut />退出登录
            </button>
            {session.isAdmin ? (
              <a className="account-admin-link" href="/admin">
                <ChartBar weight="duotone" />打开数据后台
              </a>
            ) : null}
          </>
        )}

        {error ? <p className="account-inline-error" role="alert">{error}</p> : null}
      </section>
    </div>
  );
}
