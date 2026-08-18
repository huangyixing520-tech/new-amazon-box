import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODEL_OPTIONS,
  selectedImageModel,
} from "../app/image-models.mjs";

test("image generation uses the DolaO GPT Image 2 channel", () => {
  assert.equal(DEFAULT_IMAGE_MODEL, "dolaio/gpt-image-2");
  assert.deepEqual(IMAGE_MODEL_OPTIONS.map(({ id }) => id), [DEFAULT_IMAGE_MODEL]);
  assert.equal(selectedImageModel(DEFAULT_IMAGE_MODEL, "gpt-image-2"), DEFAULT_IMAGE_MODEL);
  assert.equal(selectedImageModel("unknown", "gpt-image-2"), DEFAULT_IMAGE_MODEL);
});
