const rules = [
  {
    matches: ["not have enough consumable usd-equivalent balance", "insufficient balance"],
    message: "API Key 可用余额不足，请充值或更换 API Key 后重试",
  },
  {
    matches: ["invalid api key", "incorrect api key", "unauthorized", "permission denied"],
    message: "API Key 无效或没有当前模型权限，请在账号设置中检查 API Key",
  },
  {
    matches: ["model not found", "model is not available", "unsupported model"],
    message: "当前模型暂不可用，请切换模型或稍后重试",
  },
  {
    matches: ["upstream group is full", "overloaded", "too many requests", "rate limit"],
    message: "上游模型当前满载，请稍后重试",
  },
];

export function friendlyUpstreamError(message, fallback = "上游服务请求失败") {
  const detail = typeof message === "string" ? message.trim() : "";
  if (!detail) return fallback;
  const normalized = detail.toLowerCase();
  const rule = rules.find(({ matches }) =>
    matches.some((value) => normalized.includes(value))
  );
  return rule?.message ?? detail;
}
