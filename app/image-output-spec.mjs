export function imageOutputSpec({
  slotType = "",
  slotIndex = 0,
  aPlusType = "advanced",
  mainImageRatio = "1:1",
} = {}) {
  if (slotType === "a-plus") {
    const standard = aPlusType === "standard";
    const outputWidth = standard ? 970 : 1460;
    const outputHeight = 600;
    return {
      // GPT Image only accepts a constrained set of working canvases. The
      // task backend turns this working image into the exact final canvas.
      providerSize: "1536x1024",
      outputWidth,
      outputHeight,
      label: `${standard ? "Standard" : "Advanced"} Amazon A+ desktop image ${slotIndex + 1}`,
      formatInstruction: standard
        ? "Create a landscape Amazon Standard A+ composition. The final delivered canvas is exactly 970 x 600 px; keep every essential product detail and all copy inside that safe area."
        : "Create an ultra-wide Amazon Premium A+ composition. The final delivered canvas is exactly 1460 x 600 px; keep every essential product detail and all copy inside that safe area, with no critical content above or below it.",
    };
  }

  if (slotType === "a-plus-mobile") {
    return {
      providerSize: "1536x1024",
      outputWidth: 600,
      outputHeight: 450,
      label: `Mobile Amazon A+ image ${slotIndex + 1}`,
      formatInstruction: "Adapt the supplied completed Premium A+ image to one exact 600 x 450 px landscape canvas. Keep its product, theme, scene, copy, and brand system unchanged.",
    };
  }

  if (slotType === "main") {
    const portrait = mainImageRatio === "3:4";
    return {
      providerSize: portrait ? "1024x1536" : "1024x1024",
      outputWidth: portrait ? 1024 : 1024,
      outputHeight: portrait ? 1365 : 1024,
      label: `Amazon main or secondary image ${slotIndex + 1}`,
      formatInstruction: portrait
        ? "Compose for one 3:4 portrait ecommerce image. Keep all essential content inside a centered 3:4 safe area."
        : "Compose for one square 1:1 ecommerce image.",
    };
  }

  return {
    providerSize: "1024x1024",
    outputWidth: 1024,
    outputHeight: 1024,
    label: `Generated image ${slotIndex + 1}`,
    formatInstruction: "Compose as one finished image.",
  };
}

export const singleImageTaskBoundary =
  "This is one independent image task. Produce exactly one finished image for this slot only. Never create a collage, contact sheet, grid, triptych, storyboard, multi-panel layout, thumbnail sheet, or several alternatives. Do not depict or summarize the other planned suite images.";
