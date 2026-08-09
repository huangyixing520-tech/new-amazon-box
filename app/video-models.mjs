export const VIDEO_MODEL_OPTIONS = [
  {
    id: "seedance-2.0-fast",
    label: "Seedance 2.0 Fast",
    description: "ByteDance 高速版，适合快速预览与批量尝试",
  },
  {
    id: "seedance-2.0-mini",
    label: "Seedance 2.0 Mini",
    description: "ByteDance 轻量版，适合日常商品短视频",
  },
  {
    id: "seedance-2.0",
    label: "Seedance 2.0",
    description: "ByteDance 标准版，适合正式成片",
  },
];

export const DEFAULT_VIDEO_MODEL = "seedance-2.0-mini";

const VIDEO_MODEL_IDS = new Set(VIDEO_MODEL_OPTIONS.map((option) => option.id));

export function selectedVideoModel(requested, configured) {
  if (VIDEO_MODEL_IDS.has(requested)) return requested;
  if (VIDEO_MODEL_IDS.has(configured)) return configured;
  return DEFAULT_VIDEO_MODEL;
}
