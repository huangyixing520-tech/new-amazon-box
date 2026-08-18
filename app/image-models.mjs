export const IMAGE_MODEL_OPTIONS = [
  {
    id: "dolaio/gpt-image-2",
    label: "GPT Image 2",
    description: "DolaO 低价通道，适合商品图与电商套图",
  },
];

export const DEFAULT_IMAGE_MODEL = "dolaio/gpt-image-2";

const IMAGE_MODEL_IDS = new Set(IMAGE_MODEL_OPTIONS.map((option) => option.id));

export function selectedImageModel(requested, configured) {
  if (IMAGE_MODEL_IDS.has(requested)) return requested;
  if (IMAGE_MODEL_IDS.has(configured)) return configured;
  return DEFAULT_IMAGE_MODEL;
}
