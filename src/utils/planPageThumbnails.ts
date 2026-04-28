import { supabase } from "@/integrations/supabase/client";

const THUMBNAIL_TARGET_WIDTH = 360;
const THUMBNAIL_JPEG_QUALITY = 0.8;
const THUMBNAIL_BATCH_SIZE = 5;

type PdfPageLike = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: any; canvas: HTMLCanvasElement }) => {
    promise: Promise<void>;
  };
};

type BackfillRow = {
  page_number: number;
  thumbnail_url?: string | null;
};

type BackfillResult = {
  pageNumber: number;
  thumbnailUrl: string;
};

async function resolveThumbnailCompanyId(planId: string, companyId?: string | null) {
  if (companyId) return companyId;
  const { data, error } = await supabase
    .from("job_plans" as any)
    .select("company_id")
    .eq("id", planId)
    .single();

  if (error) {
    throw error;
  }

  const resolvedCompanyId = String((data as any)?.company_id || "");
  if (!resolvedCompanyId) {
    throw new Error(`Missing company_id for plan ${planId}`);
  }

  return resolvedCompanyId;
}

function getThumbnailPath(companyId: string, planId: string, pageNumber: number) {
  return `${companyId}/company-files/plan-thumbnails/${planId}/page-${String(pageNumber).padStart(4, "0")}.jpg`;
}

function isStoragePolicyError(error: unknown) {
  const message = String((error as any)?.message || "").toLowerCase();
  return message.includes("row-level security") || message.includes("violates row-level security policy");
}

export async function renderAndUploadPlanPageThumbnail(params: {
  planId: string;
  pageNumber: number;
  page: PdfPageLike;
  companyId?: string | null;
}): Promise<string> {
  const { planId, pageNumber, page, companyId } = params;

  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.max(0.1, THUMBNAIL_TARGET_WIDTH / Math.max(1, baseViewport.width));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable for plan thumbnail rendering");
  }

  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Failed to convert rendered plan page to thumbnail blob"));
        }
      },
      "image/jpeg",
      THUMBNAIL_JPEG_QUALITY,
    );
  });

  const resolvedCompanyId = await resolveThumbnailCompanyId(planId, companyId);
  const storagePath = getThumbnailPath(resolvedCompanyId, planId, pageNumber);
  const { error: uploadError } = await supabase.storage
    .from("company-files")
    .upload(storagePath, blob, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  return supabase.storage.from("company-files").getPublicUrl(storagePath).data.publicUrl;
}

export async function backfillPlanPageThumbnails(params: {
  planId: string;
  planUrl: string;
  pageRows: BackfillRow[];
  companyId?: string | null;
  onBatch?: (results: BackfillResult[]) => void;
}) {
  const { planId, planUrl, pageRows, companyId, onBatch } = params;
  const missingRows = pageRows
    .filter((row) => !row.thumbnail_url)
    .sort((a, b) => a.page_number - b.page_number);

  if (missingRows.length === 0) {
    return [];
  }

  const pdfjs: any = await import("pdfjs-dist");
  const pdfWorkerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const resolvedCompanyId = await resolveThumbnailCompanyId(planId, companyId);

  const loadingTask = pdfjs.getDocument({
    url: planUrl,
    withCredentials: false,
    disableAutoFetch: false,
    disableStream: false,
    rangeChunkSize: 1024 * 1024,
  });

  const pdf = await loadingTask.promise;
  const allResults: BackfillResult[] = [];

  try {
    let abortRemaining = false;
    for (let index = 0; index < missingRows.length; index += THUMBNAIL_BATCH_SIZE) {
      if (abortRemaining) break;
      const slice = missingRows.slice(index, index + THUMBNAIL_BATCH_SIZE);
      const batchResults: BackfillResult[] = [];

      for (const row of slice) {
        try {
          const page = await pdf.getPage(row.page_number);
          const thumbnailUrl = await renderAndUploadPlanPageThumbnail({
            planId,
            pageNumber: row.page_number,
            page,
            companyId: resolvedCompanyId,
          });

          const { error: updateError } = await supabase
            .from("plan_pages" as any)
            .update({ thumbnail_url: thumbnailUrl })
            .eq("plan_id", planId)
            .eq("page_number", row.page_number);

          if (updateError) {
            throw updateError;
          }

          batchResults.push({
            pageNumber: row.page_number,
            thumbnailUrl,
          });
        } catch (error) {
          if (isStoragePolicyError(error)) {
            console.warn(`Thumbnail backfill stopped for plan ${planId}: storage policy blocked thumbnail uploads.`, error);
            abortRemaining = true;
            break;
          }
          console.warn(`Failed backfilling thumbnail for plan ${planId} page ${row.page_number}:`, error);
        }
      }

      if (batchResults.length > 0) {
        allResults.push(...batchResults);
        onBatch?.(batchResults);
      }
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

  return allResults;
}
