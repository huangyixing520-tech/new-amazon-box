import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_VIDEO_MODEL,
  VIDEO_MODEL_OPTIONS,
  selectedVideoModel,
} from "../app/video-models.mjs";

test("video model list exposes the three ByteDance Seedance choices", () => {
  assert.deepEqual(
    VIDEO_MODEL_OPTIONS.map(({ id }) => id),
    ["seedance-2.0-fast", "seedance-2.0-mini", "seedance-2.0"],
  );
});

test("defaults video generation to Seedance 2.0 Fast", () => {
  assert.equal(DEFAULT_VIDEO_MODEL, "seedance-2.0-fast");
});

test("requested video model wins when it is allowed", () => {
  assert.equal(
    selectedVideoModel("seedance-2.0-fast", "seedance-2.0-mini"),
    "seedance-2.0-fast",
  );
});

test("invalid model values cannot escape the ByteDance allowlist", () => {
  assert.equal(
    selectedVideoModel("novai/seedance-2.0-mini", "novai/seedance-2.0-mini"),
    DEFAULT_VIDEO_MODEL,
  );
});
