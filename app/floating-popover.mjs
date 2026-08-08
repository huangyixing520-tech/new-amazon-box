export function floatingPopoverLayout({
  anchor,
  popoverWidth,
  popoverHeight,
  viewportWidth,
  viewportHeight,
  gap = 10,
  edge = 12,
}) {
  const below = Math.max(0, viewportHeight - anchor.bottom - gap - edge);
  const above = Math.max(0, anchor.top - gap - edge);
  const opensDown = popoverHeight <= below || below >= above;
  const maxHeight = opensDown ? below : above;
  const visibleHeight = Math.min(popoverHeight, maxHeight);
  const width = Math.min(popoverWidth, Math.max(0, viewportWidth - edge * 2));
  const left = Math.min(
    Math.max(edge, anchor.left),
    Math.max(edge, viewportWidth - edge - width),
  );

  return {
    left,
    top: opensDown
      ? anchor.bottom + gap
      : Math.max(edge, anchor.top - gap - visibleHeight),
    width,
    maxHeight,
    placement: opensDown ? "bottom" : "top",
  };
}
