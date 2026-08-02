export function imageOutputSpec({
  slotType = "",
  slotIndex = 0,
  aPlusType = "advanced",
  mainImageRatio = "1:1",
} = {}) {
  if (slotType === "a-plus") {
    const standard = aPlusType === "standard";
    const outputWidth = standard ? 960 : 1464;
    const outputHeight = 600;
    return {
      // GPT Image only accepts a constrained set of working canvases. The
      // task backend turns this working image into the exact final canvas.
      providerSize: "1536x1024",
      outputWidth,
      outputHeight,
      label: `${standard ? "Standard" : "Advanced"} Amazon A+ desktop image ${slotIndex + 1}`,
      formatInstruction: standard
        ? "Create an 8:5 Amazon A+ composition. The final delivered canvas is exactly 960 x 600 px; keep every essential product detail and all copy inside that 8:5 safe area."
        : "Create an ultra-wide 61:25 Amazon Advanced A+ composition. The final delivered canvas is exactly 1464 x 600 px; keep every essential product detail and all copy inside the centered 61:25 safe area, with no critical content above or below it.",
    };
  }

  if (slotType === "a-plus-mobile") {
    return {
      providerSize: "1024x1536",
      outputWidth: 1024,
      outputHeight: 1536,
      label: `Mobile Amazon A+ image ${slotIndex + 1}`,
      formatInstruction: "Compose as one vertical, phone-first Amazon A+ image.",
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
