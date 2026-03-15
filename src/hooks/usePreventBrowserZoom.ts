import { useEffect, RefObject } from "react";

type UsePreventBrowserZoomParams = {
  /** Only prevent browser zoom when the gesture originates within this element */
  containerRef: RefObject<HTMLElement>;
  enabled?: boolean;
  /** Current zoom, used as the baseline for Safari gesture events */
  zoom: number;
  /** Update zoom (should clamp in caller or here via clamp) */
  setZoom: (updater: (prev: number) => number) => void;
  clamp?: (z: number) => number;
  /** Optional callback for pointer-anchored zoom behavior in the caller */
  onZoomChange?: (params: {
    prevZoom: number;
    nextZoom: number;
    clientX: number;
    clientY: number;
    source: "wheel" | "gesture";
  }) => void;
  /** Multiplier for wheel/trackpad pinch delta-to-zoom conversion */
  wheelSensitivity?: number;
  /** Minimum zoom delta step (in zoom units) for wheel pinch gestures */
  minWheelStep?: number;
};

/**
 * Prevents browser/page zoom (Ctrl+wheel / trackpad pinch, Safari gesture events)
 * and routes the interaction to an app-level zoom state.
 *
 * Uses capture-phase + non-passive listeners so prevention works reliably in iframes.
 */
export function usePreventBrowserZoom({
  containerRef,
  enabled = true,
  zoom,
  setZoom,
  clamp,
  onZoomChange,
  wheelSensitivity = 0.01,
  minWheelStep = 0,
}: UsePreventBrowserZoomParams) {
  useEffect(() => {
    if (!enabled) return;

    // Some browsers (notably iOS Safari + some WebViews) will ignore `preventDefault`
    // on React's synthetic touch events because underlying listeners can be passive.
    // We therefore attach *native, non-passive, capture-phase* listeners.
    const containerEl = containerRef.current;

    const containsTarget = (target: EventTarget | null) => {
      const el = containerRef.current;
      if (!el || !target) return false;
      return el.contains(target as Node);
    };

    const clampZoom = (z: number) => (clamp ? clamp(z) : z);

    // Track whether the most recent interaction started inside the container.
    // Safari gesture events often have `target=document`, so we can't rely on containsTarget.
    const activeRef = { current: false };
    const setActive = (v: boolean) => {
      activeRef.current = v;
    };

    const handleContainerPointerDown = (e: PointerEvent) => {
      if (!containerEl) return;
      if (!containerEl.contains(e.target as Node)) return;
      setActive(true);
    };
    const handleContainerPointerLeave = () => setActive(false);

    const handleContainerTouchStart = (e: TouchEvent) => {
      if (!containerEl) return;
      if (!containerEl.contains(e.target as Node)) return;
      setActive(true);

      // Prevent browser pinch zoom from starting.
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };
    const handleContainerTouchMove = (e: TouchEvent) => {
      if (!activeRef.current) return;
      // Prevent browser pinch zoom while allowing app-level pinch handlers to run.
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };
    const handleContainerTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) setActive(false);
    };

    const handleWheel = (e: WheelEvent) => {
      // On macOS trackpad pinch, Chrome/Edge emit wheel with ctrlKey=true.
      if (!e.ctrlKey) return;
      if (!containsTarget(e.target) && !activeRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      const rawDelta = -e.deltaY * wheelSensitivity;
      const delta =
        Math.abs(rawDelta) < minWheelStep && rawDelta !== 0
          ? Math.sign(rawDelta) * minWheelStep
          : rawDelta;
      setZoom((prev) => {
        const next = clampZoom(Math.round((prev + delta) * 100) / 100);
        onZoomChange?.({
          prevZoom: prev,
          nextZoom: next,
          clientX: e.clientX,
          clientY: e.clientY,
          source: "wheel",
        });
        return next;
      });
    };

    // Safari (especially iOS/iPadOS) emits gesture events for pinch.
    let gestureBase = zoom;
    const handleGestureStart = (e: Event) => {
      if (!containsTarget(e.target) && !activeRef.current) return;
      gestureBase = zoom;
      (e as any).preventDefault?.();
      e.preventDefault?.();
    };
    const handleGestureChange = (e: Event) => {
      if (!containsTarget(e.target) && !activeRef.current) return;
      const ge = e as any;
      ge.preventDefault?.();
      e.preventDefault?.();
      if (typeof ge.scale === "number") {
        const next = clampZoom(Math.round(gestureBase * ge.scale * 100) / 100);
        const rect = containerRef.current?.getBoundingClientRect();
        const clientX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const clientY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
        setZoom((prev) => {
          onZoomChange?.({
            prevZoom: prev,
            nextZoom: next,
            clientX,
            clientY,
            source: "gesture",
          });
          return next;
        });
      }
    };

    // Capture-phase is key so the browser doesn't handle zoom first.
    // Attach native listeners on the container to reliably block browser pinch zoom.
    if (containerEl) {
      containerEl.addEventListener("pointerdown", handleContainerPointerDown, { capture: true });
      containerEl.addEventListener("pointerleave", handleContainerPointerLeave, { capture: true });
      containerEl.addEventListener("touchstart", handleContainerTouchStart, { passive: false, capture: true });
      containerEl.addEventListener("touchmove", handleContainerTouchMove, { passive: false, capture: true });
      containerEl.addEventListener("touchend", handleContainerTouchEnd, { passive: false, capture: true });
      containerEl.addEventListener("touchcancel", handleContainerTouchEnd, { passive: false, capture: true });
    }

    document.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    document.addEventListener("gesturestart", handleGestureStart as any, { passive: false, capture: true } as any);
    document.addEventListener("gesturechange", handleGestureChange as any, { passive: false, capture: true } as any);

    return () => {
      if (containerEl) {
        containerEl.removeEventListener("pointerdown", handleContainerPointerDown as any, true as any);
        containerEl.removeEventListener("pointerleave", handleContainerPointerLeave as any, true as any);
        containerEl.removeEventListener("touchstart", handleContainerTouchStart as any, true as any);
        containerEl.removeEventListener("touchmove", handleContainerTouchMove as any, true as any);
        containerEl.removeEventListener("touchend", handleContainerTouchEnd as any, true as any);
        containerEl.removeEventListener("touchcancel", handleContainerTouchEnd as any, true as any);
      }
      document.removeEventListener("wheel", handleWheel as any, true as any);
      document.removeEventListener("gesturestart", handleGestureStart as any, true as any);
      document.removeEventListener("gesturechange", handleGestureChange as any, true as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, zoom, setZoom, clamp, containerRef, onZoomChange]);
}
