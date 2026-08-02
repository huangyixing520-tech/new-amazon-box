const supportedImageOutputs = new Set([
  "960x600",
  "1024x1024",
  "1024x1365",
  "1024x1536",
  "1464x600",
]);

export function normalizedImageOutputDimensions(width, height) {
  const normalizedWidth = Number(width);
  const normalizedHeight = Number(height);
  const key = `${normalizedWidth}x${normalizedHeight}`;
  if (!supportedImageOutputs.has(key)) return null;
  return { width: normalizedWidth, height: normalizedHeight };
}
