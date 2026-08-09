import { openAiContent } from "./openai-content.mjs";
import { parseFirstJsonObject } from "./first-json-object.mjs";

export function listingTextFromPayload(payload) {
  return openAiContent(payload)
    || openAiContent(payload?.data)
    || openAiContent(payload?.result)
    || (typeof payload?.text === "string" ? payload.text : "")
    || (typeof payload?.response === "string" ? payload.response : "");
}

export function validatedListingFromPayload(payload) {
  const text = listingTextFromPayload(payload)
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trim();
  const listing = parseFirstJsonObject(text);
  if (
    !listing?.title?.trim()
    || !Array.isArray(listing.bullets)
    || listing.bullets.length !== 5
    || !listing.description?.trim()
  ) {
    throw new Error("Listing JSON 字段不完整");
  }
  return listing;
}

export function listingSse(listing) {
  const event = JSON.stringify({
    choices: [{ delta: { content: JSON.stringify(listing) } }],
  });
  return `data: ${event}\n\ndata: [DONE]\n\n`;
}
