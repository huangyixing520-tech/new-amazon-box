import test from "node:test";
import assert from "node:assert/strict";
import {
  listingSse,
  validatedListingFromPayload,
} from "../app/listing-response.mjs";

const listing = {
  title: "Portable Coffee Maker",
  bullets: ["One", "Two", "Three", "Four", "Five"],
  description: "Compact coffee maker for travel.",
};

test("extracts and validates a non-stream chat completion", () => {
  assert.deepEqual(validatedListingFromPayload({
    choices: [{ message: { content: `thinking\n${JSON.stringify(listing)}` } }],
  }), listing);
});

test("rejects an incomplete listing before it reaches the browser", () => {
  assert.throws(
    () => validatedListingFromPayload({ choices: [{ message: { content: '{"title":"x"}' } }] }),
    /字段不完整/,
  );
});

test("wraps a validated listing in the existing SSE contract", () => {
  const body = listingSse(listing);
  assert.match(body, /^data: /);
  assert.match(body, /Portable Coffee Maker/);
  assert.match(body, /data: \[DONE\]/);
});
