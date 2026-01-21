import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Bundle worker locally (avoids relying on external CDNs that may be blocked)
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

interface SinglePagePdfViewerProps {
  url: string;
  pageNumber: number;
  totalPages: number;
  zoomLevel: number;
  onTotalPagesChange?: (total: number) => void;
  onZoomChange?: (zoom: number) => void;
}

type RenderReason = "page" | "zoom";

/**
 * Single-page PDF renderer.
 * - Trackpad pinch and touch pinch are handled without zooming the whole page.
 * - Zoom feels smooth by resizing via CSS immediately, then re-rendering at high-res after a short idle.
 * - Panning works in both directions when zoomed.
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

  // Keep latest values for native event listeners (avoid re-binding on every render).
  const zoomRef = useRef(zoomLevel);
  const onZoomChangeRef = useRef(onZoomChange);
  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);
  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  // Tracks layout metrics so we can instantly resize the canvas element during zoom.
  const layoutRef = useRef<{
    fitScale: number;
    baseWidth: number;
    baseHeight: number;
  } | null>(null);

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const scrollStartRef = useRef({ x: 0, y: 0 });

  // Touch pinch state
  const lastTouchDistance = useRef<number | null>(null);
  const baseZoomRef = useRef<number>(zoomLevel);

  // Render scheduling
  const isRenderingRef = useRef(false);
  const pendingRenderRef = useRef<{ page: number; zoom: number; reason: RenderReason } | null>(null);
  const requestRenderRef = useRef<((args: { page: number; zoom: number; reason: RenderReason }) => void) | null>(null);
  const zoomRenderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clampZoom = useCallback((z: number) => Math.min(Math.max(z, 0.5), 4), []);

  const updateCanvasCssSize = useCallback((zoom: number) => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;

    const w = Math.ceil(layout.baseWidth * layout.fitScale * zoom);
    const h = Math.ceil(layout.baseHeight * layout.fitScale * zoom);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }, []);

  // Prevent browser/page zoom + implement zoom-to-cursor (trackpad ctrl+wheel) at the PDF level.
  // This is deliberately attached to the PDF scroll container (not the page) so the toolbar never scales.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const applyZoom = (nextZoom: number, focusX: number, focusY: number) => {
      const prevZoom = zoomRef.current || 1;
      if (!Number.isFinite(nextZoom) || nextZoom <= 0) return;
      const ratio = nextZoom / prevZoom;

      // Resize immediately so scroll dimensions update before we adjust scroll offsets.
      updateCanvasCssSize(nextZoom);

      // Keep the point under the cursor stable during zoom.
      const prevLeft = container.scrollLeft;
      const prevTop = container.scrollTop;
      container.scrollLeft = (prevLeft + focusX) * ratio - focusX;
      container.scrollTop = (prevTop + focusY) * ratio - focusY;

      onZoomChangeRef.current?.(nextZoom);
    };

    const handleWheel = (e: WheelEvent) => {
      // Trackpad pinch in Chromium => wheel with ctrlKey=true.
      if (!e.ctrlKey) return;

      e.preventDefault();
      e.stopPropagation();

      const prevZoom = zoomRef.current;
      const delta = -e.deltaY * 0.01;
      const nextZoom = clampZoom(Math.round((prevZoom + delta) * 100) / 100);

      const rect = container.getBoundingClientRect();
      const focusX = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
      const focusY = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
      applyZoom(nextZoom, focusX, focusY);
    };

    // Safari desktop pinch produces gesture events.
    const gestureBaseRef = { current: zoomRef.current };
    const handleGestureStart = (e: Event) => {
      gestureBaseRef.current = zoomRef.current;
      (e as any).preventDefault?.();
      e.preventDefault?.();
    };
    const handleGestureChange = (e: Event) => {
      const ge = e as any;
      ge.preventDefault?.();
      e.preventDefault?.();

      if (typeof ge.scale !== "number") return;
      const nextZoom = clampZoom(Math.round(gestureBaseRef.current * ge.scale * 100) / 100);
      // No cursor location for gesture events; zoom around center of viewport.
      const focusX = container.clientWidth / 2;
      const focusY = container.clientHeight / 2;
      applyZoom(nextZoom, focusX, focusY);
    };

    // iOS Safari can ignore preventDefault on React touch handlers; block browser pinch here.
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    container.addEventListener("gesturestart", handleGestureStart as any, { passive: false, capture: true } as any);
    container.addEventListener("gesturechange", handleGestureChange as any, { passive: false, capture: true } as any);
    container.addEventListener("touchmove", handleTouchMove, { passive: false, capture: true });

    return () => {
      container.removeEventListener("wheel", handleWheel as any, true as any);
      container.removeEventListener("gesturestart", handleGestureStart as any, true as any);
      container.removeEventListener("gesturechange", handleGestureChange as any, true as any);
      container.removeEventListener("touchmove", handleTouchMove as any, true as any);
    };
  }, [clampZoom, updateCanvasCssSize]);

  // Load PDF document once per URL
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);
        layoutRef.current = null;

        const pdfjs = await import("pdfjs-dist");
        (pdfjs as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
  }, [url, onTotalPagesChange]);

  const requestRender = useCallback(
    async ({ page, zoom, reason }: { page: number; zoom: number; reason: RenderReason }) => {
      if (!pdfDoc) return;

      if (isRenderingRef.current) {
        pendingRenderRef.current = { page, zoom, reason };
        return;
      }

      isRenderingRef.current = true;

      try {
        if (reason === "page") {
          setLoading(true);
        }
        setError(null);

        const pdfPage = await pdfDoc.getPage(page);
        const container = containerRef.current;
        const displayCanvas = canvasRef.current;
        if (!container || !displayCanvas) return;

        const containerWidth = container.clientWidth || window.innerWidth;
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        // Keep page fitted at 100% but allow *any* zoom > 1 to overflow horizontally.
        // Inner wrapper uses p-4, so subtract its horizontal padding (16px * 2).
        const horizontalPadding = 32;
        const availableWidth = Math.max(1, containerWidth - horizontalPadding);
        const fitScale = availableWidth / baseViewport.width;

        layoutRef.current = {
          fitScale,
          baseWidth: baseViewport.width,
          baseHeight: baseViewport.height,
        };

        // Resize immediately (keeps existing bitmap visible while we re-render).
        updateCanvasCssSize(zoom);

        const dpr = window.devicePixelRatio || 1;
        const displayScale = fitScale * zoom;
        const renderScale = displayScale * dpr;
        const renderViewport = pdfPage.getViewport({ scale: renderScale });

        // Render to offscreen first to avoid visible "blank" flashes.
        const offscreen = document.createElement("canvas");
        offscreen.width = Math.ceil(renderViewport.width);
        offscreen.height = Math.ceil(renderViewport.height);
        const offscreenCtx = offscreen.getContext("2d");
        if (!offscreenCtx) return;

        await pdfPage.render({ canvasContext: offscreenCtx, viewport: renderViewport, canvas: offscreen }).promise;

        const ctx = displayCanvas.getContext("2d");
        if (!ctx) return;

        displayCanvas.width = offscreen.width;
        displayCanvas.height = offscreen.height;
        ctx.drawImage(offscreen, 0, 0);

        if (reason === "page") {
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Page render error:", err);
        setError("Failed to render page");
        setLoading(false);
      } finally {
        isRenderingRef.current = false;

        const pending = pendingRenderRef.current;
        if (pending) {
          pendingRenderRef.current = null;
          requestRenderRef.current?.(pending);
        }
      }
    },
    [pdfDoc, updateCanvasCssSize]
  );

  useEffect(() => {
    requestRenderRef.current = requestRender;
  }, [requestRender]);

  // Render on page changes immediately
  useEffect(() => {
    if (!pdfDoc) return;
    void requestRender({ page: pageNumber, zoom: zoomLevel, reason: "page" });
  }, [pdfDoc, pageNumber, zoomLevel, requestRender]);

  // Zoom: resize immediately, then re-render at high-res after user stops zooming
  useEffect(() => {
    updateCanvasCssSize(zoomLevel);

    if (!pdfDoc) return;

    if (zoomRenderTimeoutRef.current) {
      clearTimeout(zoomRenderTimeoutRef.current);
    }

    zoomRenderTimeoutRef.current = setTimeout(() => {
      void requestRender({ page: pageNumber, zoom: zoomLevel, reason: "zoom" });
    }, 250);

    return () => {
      if (zoomRenderTimeoutRef.current) {
        clearTimeout(zoomRenderTimeoutRef.current);
      }
    };
  }, [zoomLevel, pageNumber, pdfDoc, requestRender, updateCanvasCssSize]);

  // Pan/drag
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (zoomLevel <= 1) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      const container = containerRef.current;
      if (!container) return;

      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      scrollStartRef.current = { x: container.scrollLeft, y: container.scrollTop };

      // Keep receiving move events even if pointer leaves the container.
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      e.preventDefault();
    },
    [zoomLevel]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return;
      const container = containerRef.current;
      if (!container) return;

      const dx = panStartRef.current.x - e.clientX;
      const dy = panStartRef.current.y - e.clientY;

      container.scrollLeft = scrollStartRef.current.x + dx;
      container.scrollTop = scrollStartRef.current.y + dy;

      e.preventDefault();
    },
    [isPanning]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    setIsPanning(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, [isPanning]);

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        lastTouchDistance.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
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
        e.preventDefault();
        e.stopPropagation();

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const scale = distance / lastTouchDistance.current;
        onZoomChange(clampZoom(baseZoomRef.current * scale));
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
    [isPanning, onZoomChange, clampZoom]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length < 2) {
        lastTouchDistance.current = null;
        baseZoomRef.current = zoomLevel;
      }
      if (e.touches.length === 0) {
        setIsPanning(false);
      }
    },
    [zoomLevel]
  );

  const cursorStyle = useMemo(() => {
    if (zoomLevel > 1) return isPanning ? "grabbing" : "grab";
    return "default";
  }, [zoomLevel, isPanning]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-w-0 min-h-0 overflow-auto bg-muted/30"
      style={{
        cursor: cursorStyle,
        touchAction: "none",
        overscrollBehavior: "contain",
        userSelect: isPanning ? "none" : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-label={`PDF page ${pageNumber} of ${totalPages}`}
    >
      <div
        className={cn(
          "relative min-h-full p-4 flex",
          zoomLevel <= 1 ? "w-full items-center justify-center" : "w-max items-start justify-start"
        )}
      >
        <div className="relative shrink-0">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 pointer-events-none">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading page {pageNumber}...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-destructive bg-background/60 z-10">
              <p>{error}</p>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className="shadow-lg rounded shrink-0"
            style={{
              display: "block",
              maxWidth: zoomLevel > 1 ? "none" : "100%",
            }}
          />
        </div>
      </div>
    </div>
  );
}
