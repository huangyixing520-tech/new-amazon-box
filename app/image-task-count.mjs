const defaults = { images: 6, seeding: 4, single: 1 };
const chineseNumbers = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8 };

export function imageTaskCount(kind, prompt = "") {
  const fallback = defaults[kind] ?? 0;
  if (!fallback || kind === "single") return fallback;

  const match =
    prompt.match(/([1-8一两二三四五六七八])\s*(?:张|幅)(?:图|图片)?/) ??
    prompt.match(/\b([1-8])\s*(?:images?|pictures?)\b/i);
  if (!match) return fallback;

  return Number(match[1]) || chineseNumbers[match[1]] || fallback;
}
