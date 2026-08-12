import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_VIDEO_DURATION_SECONDS,
  DEFAULT_VIDEO_RATIO,
  VIDEO_DURATION_OPTIONS,
  VIDEO_RATIO_OPTIONS,
  selectedVideoDuration,
  selectedVideoRatio,
} from "../app/video-settings.mjs";

test("video settings expose supported ratios and every duration from 1 to 15 seconds", () => {
  assert.deepEqual(VIDEO_RATIO_OPTIONS.map((option) => option.id), ["9:16", "16:9", "1:1"]);
  assert.equal(VIDEO_DURATION_OPTIONS.length, 15);
  assert.equal(VIDEO_DURATION_OPTIONS[0].id, "1");
  assert.equal(VIDEO_DURATION_OPTIONS[14].id, "15");
});

test("video settings validate request values and use safe defaults", () => {
  assert.equal(selectedVideoRatio("16:9"), "16:9");
  assert.equal(selectedVideoRatio("3:2"), DEFAULT_VIDEO_RATIO);
  assert.equal(selectedVideoDuration("1"), 1);
  assert.equal(selectedVideoDuration("15"), 15);
  assert.equal(selectedVideoDuration("0"), DEFAULT_VIDEO_DURATION_SECONDS);
  assert.equal(selectedVideoDuration("16"), DEFAULT_VIDEO_DURATION_SECONDS);
  assert.equal(selectedVideoDuration("2.5"), DEFAULT_VIDEO_DURATION_SECONDS);
});
