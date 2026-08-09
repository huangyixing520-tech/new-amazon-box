function contentText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.text === "string") return value.text;
  if (!Array.isArray(value)) return "";
  return value.map((part) => {
    if (typeof part === "string") return part;
    if (!part || typeof part !== "object") return "";
    return typeof part.text === "string"
      ? part.text
      : typeof part.content === "string"
        ? part.content
        : "";
  }).join("");
}

export function openAiContent(event) {
  const choice = event?.choices?.[0];
  return contentText(choice?.delta?.content)
    || contentText(choice?.message?.content)
    || contentText(choice?.text)
    || contentText(event?.delta?.text)
    || contentText(event?.delta)
    || contentText(event?.content_block?.text)
    || contentText(event?.content)
    || contentText(event?.output_text)
    || contentText(event?.output)
    || contentText(choice?.delta?.reasoning_content)
    || contentText(choice?.message?.reasoning_content);
}

export function openAiResponseLine(line) {
  const trimmed = line.trim();
  const data = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
  if (!data || data === "[DONE]" || !data.startsWith("{")) return "";
  try { return openAiContent(JSON.parse(data)); } catch { return ""; }
}
