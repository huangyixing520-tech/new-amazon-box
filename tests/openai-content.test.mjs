import assert from "node:assert/strict";
import test from "node:test";
import { openAiContent, openAiResponseLine } from "../app/openai-content.mjs";

test("reads common OpenAI-compatible content shapes", () => {
  assert.equal(openAiContent({ choices: [{ delta: { content: "{\"title\":" } }] }), "{\"title\":");
  assert.equal(openAiContent({ choices: [{ delta: { content: [{ type: "text", text: "{}" }] } }] }), "{}");
  assert.equal(openAiContent({ choices: [{ message: { content: "{}" } }] }), "{}");
});

test("reads Yunwu Claude and Responses-compatible content shapes", () => {
  assert.equal(openAiContent({ type: "content_block_delta", delta: { type: "text_delta", text: "{}" } }), "{}");
  assert.equal(openAiContent({ content: [{ type: "text", text: "{}" }] }), "{}");
  assert.equal(openAiContent({ type: "response.output_text.delta", delta: "{}" }), "{}");
  assert.equal(openAiContent({ output_text: "{}" }), "{}");
  assert.equal(openAiContent({ choices: [{ text: "{}" }] }), "{}");
  assert.equal(openAiContent({ choices: [{ delta: { reasoning_content: "prefix {}" } }] }), "prefix {}");
});

test("reads SSE and plain JSON response lines", () => {
  const event = '{"choices":[{"delta":{"content":"{}"}}]}';
  assert.equal(openAiResponseLine(`data: ${event}`), "{}");
  assert.equal(openAiResponseLine(event), "{}");
  assert.equal(openAiResponseLine("data: [DONE]"), "");
});
