function directImage(value) {
  if (!value || typeof value !== "object") return undefined;
  if (typeof value.b64_json === "string" && value.b64_json) {
    return `data:image/png;base64,${value.b64_json}`;
  }
  for (const key of ["url", "image_url", "imageUrl"]) {
    if (typeof value[key] === "string" && /^(?:https?:|data:image\/)/.test(value[key])) {
      return value[key];
    }
  }
}

export function imageOutputUrl(payload) {
  const queue = [payload];
  const seen = new Set();
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    const image = directImage(value);
    if (image) return image;
    if (Array.isArray(value)) queue.push(...value);
    else {
      for (const key of ["data", "output", "result", "images", "image", "content"]) {
        if (value[key]) queue.push(value[key]);
      }
    }
  }
}
