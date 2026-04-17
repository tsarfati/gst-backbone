import { supabase } from "@/integrations/supabase/client";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { buildPlanPageRecord, extractPlanSheetMetadataFromPdfText } from "@/utils/planSheetMetadata";

type IndexPlanPagesParams = {
  planId: string;
  planUrl: string;
  force?: boolean;
  onProgress?: (current: number, total: number) => void;
};

type IndexPlanPagesResult = {
  skipped: boolean;
  successCount: number;
  totalPages: number;
};

export async function indexPlanPagesOnce({
  planId,
  planUrl,
  force = false,
  onProgress,
}: IndexPlanPagesParams): Promise<IndexPlanPagesResult> {
  if (!force) {
    const { count, error } = await supabase
      .from("plan_pages" as any)
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId);

    if (error) {
      throw error;
    }

    if ((count || 0) > 0) {
      return {
        skipped: true,
        successCount: count || 0,
        totalPages: count || 0,
      };
    }
  }

  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const response = await fetch(planUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  let successCount = 0;

  try {
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      onProgress?.(pageNumber, totalPages);

      let pageData: Record<string, unknown>;
      try {
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        let textItems: any[] = [];
        try {
          const textContent = await page.getTextContent();
          textItems = (textContent?.items || []) as any[];
        } catch (textError) {
          console.warn(`Plan page text extraction fallback failed for page ${pageNumber}:`, textError);
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context!,
          viewport,
          canvas,
        }).promise;

        const imageBase64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
        const { data: ocrData, error: ocrError } = await supabase.functions.invoke(
          "analyze-plan-ocr",
          {
            body: {
              imageBase64,
              pageNumber,
            },
          }
        );

        if (ocrError) {
          throw ocrError;
        }

        const result = ocrData?.data || {};
        const pdfTextResult = extractPlanSheetMetadataFromPdfText({
          textItems,
          viewportWidth: baseViewport.width,
          viewportHeight: baseViewport.height,
        });
        pageData = buildPlanPageRecord({
          planId,
          pageNumber,
          ocrResult: result,
          pdfTextResult,
        });
      } catch (error) {
        console.warn(`Plan page indexing fallback for page ${pageNumber}:`, error);
        try {
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const textContent = await page.getTextContent();
          const pdfTextResult = extractPlanSheetMetadataFromPdfText({
            textItems: (textContent?.items || []) as any[],
            viewportWidth: baseViewport.width,
            viewportHeight: baseViewport.height,
          });
          pageData = buildPlanPageRecord({
            planId,
            pageNumber,
            pdfTextResult,
          });
        } catch (textFallbackError) {
          console.warn(`Plan page indexing text-only fallback failed for page ${pageNumber}:`, textFallbackError);
          pageData = buildPlanPageRecord({
            planId,
            pageNumber,
          });
        }
      }

      const { error: upsertError } = await supabase
        .from("plan_pages" as any)
        .upsert(pageData, { onConflict: "plan_id,page_number" });

      if (upsertError) {
        console.error(`Failed to save indexed plan page ${pageNumber}:`, upsertError);
        continue;
      }

      successCount += 1;
    }
  } finally {
    try {
      await pdf.cleanup?.();
    } catch {
      // ignore cleanup errors
    }
    try {
      await pdf.destroy?.();
    } catch {
      // ignore destroy errors
    }
  }

  return {
    skipped: false,
    successCount,
    totalPages,
  };
}
