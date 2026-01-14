import React, { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface SinglePagePdfViewerProps {
  url: string;
  pageNumber: number;
  totalPages: number;
  zoomLevel: number;
  onTotalPagesChange?: (total: number) => void;
}

/**
 * Renders a single page of a PDF with high-resolution support for zooming.
 * Supports pan/drag when zoomed in.
 */
export default function SinglePagePdfViewer({
  url,
  pageNumber,
  totalPages,
  zoomLevel,
  onTotalPagesChange,
}: SinglePagePdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  
  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });

  // Load PDF document once
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);

        const pdfjs = await import("pdfjs-dist");
        (pdfjs as any).GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const loadingTask = (pdfjs as any).getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        if (cancelled) {
          await pdf.destroy();
          return;
        }

        setPdfDoc(pdf);
        onTotalPagesChange?.(pdf.numPages);
      } catch (err: any) {
        console.error("PDF load error:", err);
        if (!cancelled) {
          setError("Failed to load PDF");
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Render current page when page number or zoom changes
  useEffect(() => {
    if (!pdfDoc) return;

    let cancelled = false;

    async function renderPage() {
      try {
        setLoading(true);
        setError(null);

        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Calculate scale to fit container width, then apply zoom
        const containerWidth = container.clientWidth || window.innerWidth;
        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = (containerWidth * 0.95) / baseViewport.width;
        
        // For high-res rendering, use device pixel ratio * zoom
        const devicePixelRatio = window.devicePixelRatio || 1;
        const renderScale = fitScale * zoomLevel * devicePixelRatio;
        const displayScale = fitScale * zoomLevel;
        
        const viewport = page.getViewport({ scale: renderScale });
        const displayViewport = page.getViewport({ scale: displayScale });

        // Set canvas size to high-res dimensions
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        
        // Set display size via CSS
        canvas.style.width = `${Math.ceil(displayViewport.width)}px`;
        canvas.style.height = `${Math.ceil(displayViewport.height)}px`;

        await page.render({ canvasContext: ctx, viewport }).promise;

        if (!cancelled) {
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Page render error:", err);
        if (!cancelled) {
          setError("Failed to render page");
          setLoading(false);
        }
      }
    }

    renderPage();
    // Reset pan offset when page changes
    setPanOffset({ x: 0, y: 0 });

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber, zoomLevel]);

  // Pan/drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoomLevel <= 1) return; // Only pan when zoomed
      
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      
      // Store current scroll position
      const container = containerRef.current;
      if (container) {
        setScrollStart({ x: container.scrollLeft, y: container.scrollTop });
      }
      
      e.preventDefault();
    },
    [zoomLevel]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;

      const container = containerRef.current;
      if (!container) return;

      const dx = panStart.x - e.clientX;
      const dy = panStart.y - e.clientY;

      container.scrollLeft = scrollStart.x + dx;
      container.scrollTop = scrollStart.y + dy;
    },
    [isPanning, panStart, scrollStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (zoomLevel <= 1 || e.touches.length !== 1) return;
      
      setIsPanning(true);
      setPanStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      
      const container = containerRef.current;
      if (container) {
        setScrollStart({ x: container.scrollLeft, y: container.scrollTop });
      }
    },
    [zoomLevel]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPanning || e.touches.length !== 1) return;

      const container = containerRef.current;
      if (!container) return;

      const dx = panStart.x - e.touches[0].clientX;
      const dy = panStart.y - e.touches[0].clientY;

      container.scrollLeft = scrollStart.x + dx;
      container.scrollTop = scrollStart.y + dy;
    },
    [isPanning, panStart, scrollStart]
  );

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  const cursorStyle = zoomLevel > 1 ? (isPanning ? "grabbing" : "grab") : "default";

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto bg-muted/30"
      style={{ cursor: cursorStyle }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-center min-h-full p-4">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading page {pageNumber}...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center gap-2 text-destructive">
            <p>{error}</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={`bg-white shadow-lg rounded ${loading ? "opacity-50" : ""}`}
          style={{ 
            display: "block",
            maxWidth: zoomLevel > 1 ? "none" : "100%",
          }}
        />
      </div>
    </div>
  );
}
