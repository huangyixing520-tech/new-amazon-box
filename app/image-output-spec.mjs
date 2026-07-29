export function imageOutputSpec({
  slotType = "",
  slotIndex = 0,
  aPlusType = "advanced",
  mainImageRatio = "1:1",
} = {}) {
  if (slotType === "a-plus") {
    const standard = aPlusType === "standard";
    return {
      providerSize: "1536x1024",
      outputWidth: standard ? 960 : 1464,
      outputHeight: 600,
      label: `${standard ? "Standard" : "Advanced"} Amazon A+ desktop image ${slotIndex + 1}`,
      formatInstruction: standard
        ? "Compose for an exact 960 x 600 px final canvas (8:5 ratio)."
        : "Compose for an exact 1464 x 600 px final canvas (61:25 ratio). Keep essential product and copy inside the centered wide safe area.",
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
