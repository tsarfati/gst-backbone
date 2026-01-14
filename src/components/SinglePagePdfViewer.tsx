import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Loader2 } from "lucide-react";

interface SinglePagePdfViewerProps {
  url: string;
  pageNumber: number;
  totalPages: number;
  zoomLevel: number;
  onTotalPagesChange?: (total: number) => void;
  onZoomChange?: (zoom: number) => void;
}

/**
 * Renders a single page of a PDF with high-resolution support for zooming.
 * Supports pan/drag when zoomed in and pinch-to-zoom on trackpad/touch.
 * Only the PDF content zooms - parent toolbars remain unaffected.
 */
export default function SinglePagePdfViewer({
  url,
  pageNumber,
  totalPages,
  zoomLevel,
  onTotalPagesChange,
  onZoomChange,
}: SinglePagePdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [renderedZoom, setRenderedZoom] = useState<number | null>(null);
  
  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const scrollStartRef = useRef({ x: 0, y: 0 });

  // Pinch zoom state for touch
  const lastTouchDistance = useRef<number | null>(null);
  const baseZoomRef = useRef<number>(zoomLevel);

  // Debounce rendering to reduce flashing
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRenderingRef = useRef(false);

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

  // Render current page when page number or zoom changes (debounced)
  useEffect(() => {
    if (!pdfDoc) return;

    // Clear any pending render
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    // Debounce rendering during active zooming
    const delay = isRenderingRef.current ? 150 : 0;
    
    renderTimeoutRef.current = setTimeout(() => {
      renderPage();
    }, delay);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [pdfDoc, pageNumber, zoomLevel]);

  const renderPage = async () => {
    if (!pdfDoc || isRenderingRef.current) return;
    
    isRenderingRef.current = true;
    
    try {
      setLoading(true);
      setError(null);

      const page = await pdfDoc.getPage(pageNumber);

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) {
        isRenderingRef.current = false;
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        isRenderingRef.current = false;
        return;
      }

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

      setRenderedZoom(zoomLevel);
      setLoading(false);
    } catch (err: any) {
      console.error("Page render error:", err);
      setError("Failed to render page");
      setLoading(false);
    } finally {
      isRenderingRef.current = false;
    }
  };

  // Pan/drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoomLevel <= 1) return;
      
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      
      const container = containerRef.current;
      if (container) {
        scrollStartRef.current = { x: container.scrollLeft, y: container.scrollTop };
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

      const dx = panStartRef.current.x - e.clientX;
      const dy = panStartRef.current.y - e.clientY;

      container.scrollLeft = scrollStartRef.current.x + dx;
      container.scrollTop = scrollStartRef.current.y + dy;
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Touch handlers for mobile pan and pinch zoom
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch gesture start
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        lastTouchDistance.current = distance;
        baseZoomRef.current = zoomLevel;
        return;
      }
      
      if (zoomLevel <= 1 || e.touches.length !== 1) return;
      
      setIsPanning(true);
      panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      
      const container = containerRef.current;
      if (container) {
        scrollStartRef.current = { x: container.scrollLeft, y: container.scrollTop };
      }
    },
    [zoomLevel]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistance.current !== null && onZoomChange) {
        // Pinch gesture - prevent default to stop page zoom
        e.preventDefault();
        e.stopPropagation();
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        
        const scale = distance / lastTouchDistance.current;
        const newZoom = Math.min(Math.max(baseZoomRef.current * scale, 0.5), 4);
        
        onZoomChange(newZoom);
        return;
      }
      
      if (!isPanning || e.touches.length !== 1) return;

      const container = containerRef.current;
      if (!container) return;

      const dx = panStartRef.current.x - e.touches[0].clientX;
      const dy = panStartRef.current.y - e.touches[0].clientY;

      container.scrollLeft = scrollStartRef.current.x + dx;
      container.scrollTop = scrollStartRef.current.y + dy;
    },
    [isPanning, onZoomChange]
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      // Pinch ended, update base zoom level
      lastTouchDistance.current = null;
      baseZoomRef.current = zoomLevel;
    }
    if (e.touches.length === 0) {
      setIsPanning(false);
    }
  }, [zoomLevel]);

  // Trackpad pinch-to-zoom (wheel event with ctrlKey)
  // This is a native event handler to ensure we can properly preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Trackpad pinch gesture fires as wheel event with ctrlKey
      if (e.ctrlKey && onZoomChange) {
        // CRITICAL: Prevent the browser from zooming the page
        e.preventDefault();
        e.stopPropagation();
        
        const delta = -e.deltaY * 0.01;
        const newZoom = Math.min(Math.max(zoomLevel + delta, 0.5), 4);
        onZoomChange(newZoom);
      }
    };

    // Use passive: false to allow preventDefault
    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [zoomLevel, onZoomChange]);

  const cursorStyle = useMemo(() => {
    if (zoomLevel > 1) {
      return isPanning ? "grabbing" : "grab";
    }
    return "default";
  }, [zoomLevel, isPanning]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto bg-muted/30"
      style={{ 
        cursor: cursorStyle,
        touchAction: "none", // Disable browser touch gestures
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-center min-h-full p-4">
        {loading && renderedZoom !== zoomLevel && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 pointer-events-none">
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
          className="bg-white shadow-lg rounded"
          style={{ 
            display: "block",
            maxWidth: zoomLevel > 1 ? "none" : "100%",
            transition: "none", // No transition to reduce flashing
          }}
        />
      </div>
    </div>
  );
}
