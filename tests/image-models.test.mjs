import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODEL_OPTIONS,
  selectedImageModel,
} from "../app/image-models.mjs";

test("image generation supports selectable DolaO image models", () => {
  assert.equal(DEFAULT_IMAGE_MODEL, "dolaio/gpt-image-2");
  assert.deepEqual(IMAGE_MODEL_OPTIONS.map(({ id }) => id), [
    DEFAULT_IMAGE_MODEL,
    "qwen-image-3.0-pro",
  ]);
  assert.equal(selectedImageModel(DEFAULT_IMAGE_MODEL, "gpt-image-2"), DEFAULT_IMAGE_MODEL);
  assert.equal(selectedImageModel("qwen-image-3.0-pro"), "qwen-image-3.0-pro");
  assert.equal(selectedImageModel("unknown", "gpt-image-2"), DEFAULT_IMAGE_MODEL);
});
