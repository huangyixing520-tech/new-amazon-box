export type ImageModelKey = "image-2" | "nano-2-lite" | "nano-2";
export type VideoModelKey =
  | "seedance-2-fast"
  | "seedance-2-mini"
  | "seedance-2-pro";
export type GenerationModelKey = ImageModelKey | VideoModelKey;

export type GenerationModelOption = {
  id: GenerationModelKey;
  label: string;
  description: string;
};

export const imageModelOptions: GenerationModelOption[] = [
  { id: "image-2", label: "Image 2", description: "高质量商品图与文字排版" },
  { id: "nano-2-lite", label: "Nano 2 lite", description: "更快、更轻量的图片生成" },
  { id: "nano-2", label: "Nano 2", description: "质量与速度更均衡" },
];

export const videoModelOptions: GenerationModelOption[] = [
  { id: "seedance-2-fast", label: "Seedance 2.0 fast", description: "优先生成速度" },
  { id: "seedance-2-mini", label: "Seedance 2.0 mini", description: "默认，成本与效果均衡" },
  { id: "seedance-2-pro", label: "Seedance 2.0 pro", description: "优先视频质量与表现力" },
];

export const DEFAULT_IMAGE_MODEL: ImageModelKey = "image-2";
export const DEFAULT_VIDEO_MODEL: VideoModelKey = "seedance-2-mini";

export function generationModelLabel(model: string | undefined) {
  return [...imageModelOptions, ...videoModelOptions]
    .find((option) => option.id === model)?.label;
}
