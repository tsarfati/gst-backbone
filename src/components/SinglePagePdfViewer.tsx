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
  onPageRectChange?: (rect: { left: number; top: number; width: number; height: number } | null) => void;
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
  onPageRectChange,
}: SinglePagePdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  const clampZoom = useCallback((z: number) => Math.min(Math.max(z, 0.5), 5), []);

  const updateCanvasCssSize = useCallback((zoom: number) => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;

    const w = Math.ceil(layout.baseWidth * layout.fitScale * zoom);
    const h = Math.ceil(layout.baseHeight * layout.fitScale * zoom);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }, []);

  const emitPageRect = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!onPageRectChange) return;
    if (!container || !canvas || canvas.offsetWidth <= 0 || canvas.offsetHeight <= 0) {
      onPageRectChange(null);
      return;
    }

    const cRect = container.getBoundingClientRect();
    const pRect = canvas.getBoundingClientRect();
    onPageRectChange({
      // Relative to the visible viewport of the internal scroll container.
      // The parent overlay in PlanViewer is not inside this scroll container,
      // so we intentionally do NOT add scroll offsets here.
      left: pRect.left - cRect.left,
      top: pRect.top - cRect.top,
      width: pRect.width,
      height: pRect.height,
    });
  }, [onPageRectChange]);

  const getContentPadding = useCallback(() => {
    const el = contentRef.current;
    if (!el) return { left: 0, top: 0 };
    const s = window.getComputedStyle(el);
    const left = Number.parseFloat(s.paddingLeft || "0") || 0;
    const top = Number.parseFloat(s.paddingTop || "0") || 0;
    return { left, top };
  }, []);

  // Prevent browser/page zoom + implement zoom-to-cursor (trackpad ctrl+wheel) at the PDF level.
  // We attach document-level capture listeners because Safari gesture events often target `document`,
  // but we only act when the interaction is within (or started within) this PDF container.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeRef = { current: false };
    const containsTarget = (target: EventTarget | null) => {
      if (!target) return false;
      try {
        return container.contains(target as Node);
      } catch {
        return false;
      }
    };

    const containsPoint = (clientX: number, clientY: number) => {
      // Some browsers report `target=document` for trackpad pinch wheel events.
      // elementFromPoint gives us the element actually under the cursor.
      try {
        const el = document.elementFromPoint(clientX, clientY);
        return !!el && container.contains(el);
      } catch {
        return false;
      }
    };

    const handlePointerEnter = () => {
      activeRef.current = true;
    };
    const handlePointerLeave = () => {
      activeRef.current = false;
    };

    const handleTouchStartCapture = (e: TouchEvent) => {
      // Mark active when touch originates inside the container.
      if (containsTarget(e.target)) activeRef.current = true;
      // Prevent browser pinch zoom from starting.
      if (activeRef.current && e.touches.length >= 2) {
        try {
          e.preventDefault();
        } catch {
          // ignore
        }
        try {
          (e as any).stopImmediatePropagation?.();
        } catch {
          // ignore
        }
      }
    };
    const handleTouchEndCapture = (e: TouchEvent) => {
      if (e.touches.length === 0) activeRef.current = false;
    };

    const applyZoom = (nextZoom: number, focusX: number, focusY: number) => {
      const prevZoom = zoomRef.current || 1;
      if (!Number.isFinite(nextZoom) || nextZoom <= 0) return;
      const ratio = nextZoom / prevZoom;

      // Our scroll content has padding (p-4). Padding does NOT scale with zoom,
      // so zoom-to-cursor must be computed relative to the canvas origin inside that padding.
      const { left: padLeft, top: padTop } = getContentPadding();

      // Resize immediately so scroll dimensions update before we adjust scroll offsets.
      updateCanvasCssSize(nextZoom);

      // Keep the point under the cursor stable during zoom.
      const prevLeft = container.scrollLeft;
      const prevTop = container.scrollTop;

      // Cursor position in scroll-content coords
      const contentX = prevLeft + focusX;
      const contentY = prevTop + focusY;

      // Cursor position in *canvas* coords (exclude the constant padding)
      const canvasX = Math.max(0, contentX - padLeft);
      const canvasY = Math.max(0, contentY - padTop);

      container.scrollLeft = padLeft + canvasX * ratio - focusX;
      container.scrollTop = padTop + canvasY * ratio - focusY;

      onZoomChangeRef.current?.(nextZoom);
    };

    const handleWheel = (e: WheelEvent) => {
      // Trackpad pinch in Chromium => wheel with ctrlKey=true.
      // Mousewheel zoom on macOS can be used with Cmd (metaKey).
      if (!(e.ctrlKey || e.metaKey)) return;

      // Only intercept when the gesture originates within the PDF viewer.
      const isInside =
        containsTarget(e.target) ||
        activeRef.current ||
        containsPoint(e.clientX, e.clientY);
      if (!isInside) return;

      // Cancel browser page-zoom and keep this event from reaching higher-level listeners.
      // (Some WebKit builds only reliably stop page zoom when we also stopImmediatePropagation.)
      try {
        e.preventDefault();
      } catch {
        // ignore
      }
      try {
        (e as any).stopImmediatePropagation?.();
      } catch {
        // ignore
      }
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
      if (!containsTarget(e.target) && !activeRef.current) return;
      gestureBaseRef.current = zoomRef.current;
      (e as any).preventDefault?.();
      e.preventDefault?.();
      try {
        (e as any).stopImmediatePropagation?.();
      } catch {
        // ignore
      }
    };
    const handleGestureChange = (e: Event) => {
      if (!containsTarget(e.target) && !activeRef.current) return;
      const ge = e as any;
      ge.preventDefault?.();
      e.preventDefault?.();
      try {
        (e as any).stopImmediatePropagation?.();
      } catch {
        // ignore
      }

      if (typeof ge.scale !== "number") return;
      const nextZoom = clampZoom(Math.round(gestureBaseRef.current * ge.scale * 100) / 100);
      // No cursor location for gesture events; zoom around center of viewport.
      const focusX = container.clientWidth / 2;
      const focusY = container.clientHeight / 2;
      applyZoom(nextZoom, focusX, focusY);
    };

    // iOS Safari can ignore preventDefault on React touch handlers; block browser pinch here.
    const handleTouchMoveCapture = (e: TouchEvent) => {
      if (!activeRef.current) return;
      if (e.touches.length >= 2) {
        try {
          e.preventDefault();
        } catch {
          // ignore
        }
        try {
          (e as any).stopImmediatePropagation?.();
        } catch {
          // ignore
        }
      }
    };

    // Prefer an element-level wheel listener (capture + non-passive) so Chrome reliably treats
    // the ctrl+wheel pinch gesture as cancelable and doesn't apply page zoom.
    container.addEventListener("pointerenter", handlePointerEnter);
    container.addEventListener("pointerleave", handlePointerLeave);

    container.addEventListener("wheel", handleWheel, { passive: false, capture: true } as any);

    // In Chromium, trackpad pinch => wheel+ctrlKey. Some contexts (iframes) behave better
    // when we also listen on window.
    window.addEventListener("wheel", handleWheel, { passive: false, capture: true } as any);
    document.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    document.addEventListener("gesturestart", handleGestureStart as any, { passive: false, capture: true } as any);
    document.addEventListener("gesturechange", handleGestureChange as any, { passive: false, capture: true } as any);
    document.addEventListener("touchstart", handleTouchStartCapture, { passive: false, capture: true });
    document.addEventListener("touchmove", handleTouchMoveCapture, { passive: false, capture: true });
    document.addEventListener("touchend", handleTouchEndCapture, { passive: false, capture: true });
    document.addEventListener("touchcancel", handleTouchEndCapture, { passive: false, capture: true });

    return () => {
      container.removeEventListener("pointerenter", handlePointerEnter as any);
      container.removeEventListener("pointerleave", handlePointerLeave as any);

      container.removeEventListener("wheel", handleWheel as any, true as any);

      window.removeEventListener("wheel", handleWheel as any, true as any);
      document.removeEventListener("wheel", handleWheel as any, true as any);
      document.removeEventListener("gesturestart", handleGestureStart as any, true as any);
      document.removeEventListener("gesturechange", handleGestureChange as any, true as any);
      document.removeEventListener("touchstart", handleTouchStartCapture as any, true as any);
      document.removeEventListener("touchmove", handleTouchMoveCapture as any, true as any);
      document.removeEventListener("touchend", handleTouchEndCapture as any, true as any);
      document.removeEventListener("touchcancel", handleTouchEndCapture as any, true as any);
    };
  }, [clampZoom, getContentPadding, updateCanvasCssSize]);

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
        emitPageRect();

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
    [pdfDoc, updateCanvasCssSize, emitPageRect]
  );

  useEffect(() => {
    requestRenderRef.current = requestRender;
  }, [requestRender]);

  // Render on page changes immediately (not on every zoom tick)
  useEffect(() => {
    if (!pdfDoc) return;
    void requestRender({ page: pageNumber, zoom: zoomLevel, reason: "page" });
  }, [pdfDoc, pageNumber, requestRender]);

  // Zoom: resize immediately, then re-render at high-res after user stops zooming
  useEffect(() => {
    updateCanvasCssSize(zoomLevel);
    emitPageRect();

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
  }, [zoomLevel, pageNumber, pdfDoc, requestRender, updateCanvasCssSize, emitPageRect]);

  useEffect(() => {
    if (!onPageRectChange) return;
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => emitPageRect();
    container.addEventListener("scroll", handleScroll, { passive: true });

    const ro = new ResizeObserver(() => emitPageRect());
    ro.observe(container);
    if (canvasRef.current) ro.observe(canvasRef.current);

    let rafId: number | null = null;
    let rafCount = 0;
    const tick = () => {
      emitPageRect();
      rafCount += 1;
      if (rafCount < 30) rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      container.removeEventListener("scroll", handleScroll as any);
      ro.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [onPageRectChange, emitPageRect, pageNumber, zoomLevel, pdfDoc]);

  // Pan/drag
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      const container = containerRef.current;
      if (!container) return;

      // Only enable drag-pan when the content actually overflows in any direction.
      const canPan = container.scrollWidth > container.clientWidth || container.scrollHeight > container.clientHeight;
      if (!canPan) return;

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
        ref={contentRef}
        className={cn(
          "relative min-h-full p-4 w-full",
        )}
      >
        {/* Keep the scroll container width fixed; only this inner wrapper grows with the canvas. */}
        <div className="relative inline-block min-w-full">
          {loading && (
            <div className="absolute top-3 right-3 z-10 pointer-events-none">
              <div className="flex items-center gap-2 rounded-md border bg-background/90 px-2 py-1 shadow-sm backdrop-blur-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  Loading page {pageNumber}
                </p>
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
