export type PlanOcrMode = "titleblock" | "full";

const TITLE_BLOCK_X_START = 0.42;
const TITLE_BLOCK_Y_START = 0.68;

export async function renderPlanOcrImageBase64(page: any, mode: PlanOcrMode = "titleblock") {
  const scale = mode === "titleblock" ? 2.4 : 1.5;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create OCR canvas context");
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  if (mode === "full") {
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  }

  const cropX = Math.max(0, Math.floor(canvas.width * TITLE_BLOCK_X_START));
  const cropY = Math.max(0, Math.floor(canvas.height * TITLE_BLOCK_Y_START));
  const cropWidth = Math.max(1, canvas.width - cropX);
  const cropHeight = Math.max(1, canvas.height - cropY);

  const cropCanvas = document.createElement("canvas");
  const cropContext = cropCanvas.getContext("2d");
  if (!cropContext) {
    throw new Error("Could not create OCR crop canvas context");
  }

  cropCanvas.width = cropWidth;
  cropCanvas.height = cropHeight;
  cropContext.drawImage(
    canvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  return cropCanvas.toDataURL("image/jpeg", 0.92).split(",")[1];
}

export function hasMeaningfulPlanOcrResult(result: any) {
  const sheetNumber = String(result?.sheet_number || "").trim();
  const sheetTitle = String(result?.sheet_title || "").trim();
  const confidence = Number(result?.confidence || 0);
  return Boolean(sheetNumber || sheetTitle) && confidence >= 0.35;
}
