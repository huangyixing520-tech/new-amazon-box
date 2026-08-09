function contentText(value) {
  if (typeof value === "string") return value;
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
  return contentText(choice?.delta?.content) || contentText(choice?.message?.content);
}

