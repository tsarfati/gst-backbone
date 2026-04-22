import { supabase } from "@/integrations/supabase/client";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { buildPlanPageRecord, extractPlanSheetMetadataFromPdfText, isPlaceholderPlanLabel } from "@/utils/planSheetMetadata";

type HydratePlanPagesParams = {
  planId: string;
  planUrl: string;
};

type HydratePlanPagesResult = {
  totalPages: number;
  updatedCount: number;
};

const UPSERT_BATCH_SIZE = 20;

export async function hydratePlanPagesFromPdfText({
  planId,
  planUrl,
}: HydratePlanPagesParams): Promise<HydratePlanPagesResult> {
  const { data: existingRows, error: existingError } = await supabase
    .from("plan_pages" as any)
    .select("page_number, sheet_number")
    .eq("plan_id", planId)
    .order("page_number", { ascending: true });

  if (existingError) throw existingError;

  const existingByPageNumber = new Map<number, { page_number: number; sheet_number?: string | null }>(
    (((existingRows || []) as any[]) || []).map((row) => [Number(row.page_number), row]),
  );

  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const loadingTask = pdfjs.getDocument({
    url: planUrl,
    withCredentials: false,
    disableAutoFetch: false,
    disableStream: false,
    rangeChunkSize: 1024 * 1024,
  });

  const pdf = await loadingTask.promise;
  const totalPages = Number(pdf.numPages || 0);
  const pageNumbersToHydrate: number[] = [];

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const existing = existingByPageNumber.get(pageNumber);
    if (!existing || isPlaceholderPlanLabel(existing.sheet_number || null, pageNumber)) {
      pageNumbersToHydrate.push(pageNumber);
    }
  }

  if (pageNumbersToHydrate.length === 0) {
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
    return { totalPages, updatedCount: 0 };
  }

  const pendingRows: any[] = [];
  let updatedCount = 0;

  try {
    for (const pageNumber of pageNumbersToHydrate) {
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        const pdfTextResult = extractPlanSheetMetadataFromPdfText({
          textItems: (textContent?.items || []) as any[],
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
        });
        pendingRows.push(
          buildPlanPageRecord({
            planId,
            pageNumber,
            pdfTextResult,
          }),
        );
      } catch (pageError) {
        console.warn(`Hydration fallback failed for plan ${planId} page ${pageNumber}:`, pageError);
        pendingRows.push(
          buildPlanPageRecord({
            planId,
            pageNumber,
          }),
        );
      }

      if (pendingRows.length >= UPSERT_BATCH_SIZE) {
        const batch = pendingRows.splice(0, UPSERT_BATCH_SIZE);
        const { error: upsertError } = await supabase
          .from("plan_pages" as any)
          .upsert(batch, { onConflict: "plan_id,page_number" });
        if (upsertError) throw upsertError;
        updatedCount += batch.length;
      }
    }

    if (pendingRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("plan_pages" as any)
        .upsert(pendingRows, { onConflict: "plan_id,page_number" });
      if (upsertError) throw upsertError;
      updatedCount += pendingRows.length;
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

  return { totalPages, updatedCount };
}
