export const DEFAULT_VIDEO_RATIO = "9:16";
export const DEFAULT_VIDEO_DURATION_SECONDS = 15;

export const VIDEO_RATIO_OPTIONS = [
  { id: "9:16", label: "9:16 竖屏" },
  { id: "16:9", label: "16:9 横屏" },
  { id: "1:1", label: "1:1 方形" },
];

export const VIDEO_DURATION_OPTIONS = Array.from({ length: 15 }, (_, index) => ({
  id: String(index + 1),
  label: `${index + 1} 秒`,
}));

export function selectedVideoRatio(value, fallback = DEFAULT_VIDEO_RATIO) {
  const ratios = new Set(VIDEO_RATIO_OPTIONS.map((option) => option.id));
  return ratios.has(value) ? value : ratios.has(fallback) ? fallback : DEFAULT_VIDEO_RATIO;
}

export function selectedVideoDuration(
  value,
  fallback = DEFAULT_VIDEO_DURATION_SECONDS,
) {
  const duration = Number(value);
  if (Number.isInteger(duration) && duration >= 1 && duration <= 15) return duration;
  const safeFallback = Number(fallback);
  return Number.isInteger(safeFallback) && safeFallback >= 1 && safeFallback <= 15
    ? safeFallback
    : DEFAULT_VIDEO_DURATION_SECONDS;
}
