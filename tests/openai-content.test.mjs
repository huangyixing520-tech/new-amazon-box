import assert from "node:assert/strict";
import test from "node:test";
import { openAiContent } from "../app/openai-content.mjs";

test("reads common OpenAI-compatible content shapes", () => {
  assert.equal(openAiContent({ choices: [{ delta: { content: "{\"title\":" } }] }), "{\"title\":");
  assert.equal(openAiContent({ choices: [{ delta: { content: [{ type: "text", text: "{}" }] } }] }), "{}");
  assert.equal(openAiContent({ choices: [{ message: { content: "{}" } }] }), "{}");
});

