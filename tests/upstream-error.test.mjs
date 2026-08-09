import assert from "node:assert/strict";
import test from "node:test";

import { friendlyUpstreamError } from "../app/upstream-error.mjs";

test("turns an upstream balance error into an actionable Chinese message", () => {
  assert.equal(
    friendlyUpstreamError(
      "The current permission ticket does not have enough consumable USD-equivalent balance.",
    ),
    "API Key 可用余额不足，请充值或更换 API Key 后重试",
  );
});

test("explains API key permission errors", () => {
  assert.equal(
    friendlyUpstreamError("Unauthorized: invalid API key"),
    "API Key 无效或没有当前模型权限，请在账号设置中检查 API Key",
  );
});

test("preserves an unknown upstream error for diagnosis", () => {
  assert.equal(
    friendlyUpstreamError("Provider request abc-123 failed"),
    "Provider request abc-123 failed",
  );
});

test("uses the caller fallback when no detail is available", () => {
  assert.equal(friendlyUpstreamError(undefined, "视频任务创建失败"), "视频任务创建失败");
});
