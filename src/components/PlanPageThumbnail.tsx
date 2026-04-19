import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { resolveStorageUrl } from "@/utils/storageUtils";

interface PlanPageThumbnailProps {
  thumbnailUrl?: string | null;
  planFileUrl?: string | null;
  pageNumber: number;
  alt: string;
  className?: string;
}

const renderCache = new Map<string, string>();

function inferBucket(pathOrUrl: string) {
  if (pathOrUrl.includes("/job-filing-cabinet/") || pathOrUrl.startsWith("job-filing-cabinet/")) {
    return "job-filing-cabinet" as const;
  }
  return "company-files" as const;
}

export default function PlanPageThumbnail({
  thumbnailUrl,
  planFileUrl,
  pageNumber,
  alt,
  className = "h-16 w-16 rounded-lg border object-cover shrink-0 bg-muted",
}: PlanPageThumbnailProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(thumbnailUrl || null);
  const [loading, setLoading] = useState(!thumbnailUrl && !!planFileUrl);

  useEffect(() => {
    let cancelled = false;

    async function loadFallbackThumbnail() {
      if (thumbnailUrl) {
        setPreviewUrl(thumbnailUrl);
        setLoading(false);
        return;
      }

      if (!planFileUrl) {
        setPreviewUrl(null);
        setLoading(false);
        return;
      }

      const cacheKey = `${planFileUrl}::${pageNumber}`;
      const cached = renderCache.get(cacheKey);
      if (cached) {
        setPreviewUrl(cached);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const resolvedUrl = await resolveStorageUrl(inferBucket(planFileUrl) as any, planFileUrl);
        if (!resolvedUrl) throw new Error("No plan preview URL");

        const pdfjs: any = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

        const response = await fetch(resolvedUrl, { cache: "force-cache" });
        if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
        const buffer = await response.arrayBuffer();

        const loadingTask = pdfjs.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        const safePage = Math.min(Math.max(1, pageNumber || 1), pdf.numPages);
        const page = await pdf.getPage(safePage);
        const viewport = page.getViewport({ scale: 0.26 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas not available");

        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));

        await page.render({ canvasContext: context, viewport, canvas }).promise;
        const nextPreviewUrl = canvas.toDataURL("image/jpeg", 0.82);
        renderCache.set(cacheKey, nextPreviewUrl);

        if (!cancelled) {
          setPreviewUrl(nextPreviewUrl);
          setLoading(false);
        }
      } catch (error) {
        console.error("PlanPageThumbnail: failed generating PDF thumbnail", error);
        if (!cancelled) {
          setPreviewUrl(null);
          setLoading(false);
        }
      }
    }

    void loadFallbackThumbnail();

    return () => {
      cancelled = true;
    };
  }, [pageNumber, planFileUrl, thumbnailUrl]);

  if (previewUrl) {
    return <img src={previewUrl} alt={alt} className={className} />;
  }

  if (loading) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
      <FileText className="h-5 w-5" />
    </div>
  );
}
