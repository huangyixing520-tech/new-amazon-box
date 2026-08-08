import assert from "node:assert/strict";
import test from "node:test";
import { parseFirstJsonObject } from "../app/first-json-object.mjs";

test("parses the first complete JSON object and ignores trailing output", () => {
  assert.deepEqual(
    parseFirstJsonObject('prefix {"title":"Listing"} trailing {"extra":true}'),
    { title: "Listing" },
  );
});

test("keeps braces and escaped quotes inside JSON strings", () => {
  assert.deepEqual(
    parseFirstJsonObject('{"description":"Fits {most} products and \\"travels\\" well"} note'),
    { description: 'Fits {most} products and "travels" well' },
  );
});

test("rejects an incomplete JSON object", () => {
  assert.throws(
    () => parseFirstJsonObject('{"title":"Listing"'),
    /没有返回完整/,
  );
});
