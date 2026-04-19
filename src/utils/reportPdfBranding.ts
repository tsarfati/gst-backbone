import type jsPDF from "jspdf";
import { resolveCompanyLogoUrl } from "@/utils/resolveCompanyLogoUrl";

const loadImageDimensions = (src: string): Promise<{ dataUrl: string; width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Unable to render logo image"));
          return;
        }
        context.drawImage(image, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          width: image.naturalWidth || image.width,
          height: image.naturalHeight || image.height,
        });
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("Failed to load company logo"));
    image.src = src;
  });

export async function addCompanyLogoToPdf(
  doc: jsPDF,
  rawLogoUrl?: string | null,
  options?: { x?: number; y?: number; maxWidth?: number; maxHeight?: number },
): Promise<{ width: number; height: number }> {
  const logoUrl = resolveCompanyLogoUrl(rawLogoUrl);
  if (!logoUrl) return { width: 0, height: 0 };

  try {
    const separator = logoUrl.includes("?") ? "&" : "?";
    const { dataUrl, width, height } = await loadImageDimensions(`${logoUrl}${separator}t=${Date.now()}`);
    const x = options?.x ?? 14;
    const y = options?.y ?? 12;
    const maxWidth = options?.maxWidth ?? 120;
    const maxHeight = options?.maxHeight ?? 40;
    const aspectRatio = width / height || 1;
    let logoWidth = Math.min(maxWidth, width);
    let logoHeight = logoWidth / aspectRatio;
    if (logoHeight > maxHeight) {
      logoHeight = maxHeight;
      logoWidth = logoHeight * aspectRatio;
    }
    doc.addImage(dataUrl, "PNG", x, y, logoWidth, logoHeight);
    return { width: logoWidth, height: logoHeight };
  } catch (error) {
    console.warn("Unable to load report PDF logo:", error);
    return { width: 0, height: 0 };
  }
}
