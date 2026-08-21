import assert from "node:assert/strict";
import test from "node:test";
import { conversationPeriod } from "../app/conversation-period.mjs";

test("groups conversation activity into local calendar periods", () => {
  const now = new Date(2026, 7, 21, 15);

  assert.equal(conversationPeriod(new Date(2026, 7, 21, 8), now), "today");
  assert.equal(conversationPeriod(new Date(2026, 7, 20, 23), now), "yesterday");
  assert.equal(conversationPeriod(new Date(2026, 7, 17, 9), now), "week");
  assert.equal(conversationPeriod(new Date(2026, 7, 2, 9), now), "month");
  assert.equal(conversationPeriod(new Date(2026, 6, 31, 23), now), "earlier");
  assert.equal(conversationPeriod("not-a-date", now), "earlier");
});
