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
}: UsePreventBrowserZoomParams) {
  useEffect(() => {
    if (!enabled) return;

    const containsTarget = (target: EventTarget | null) => {
      const el = containerRef.current;
      if (!el || !target) return false;
      return el.contains(target as Node);
    };

    const clampZoom = (z: number) => (clamp ? clamp(z) : z);

    const handleWheel = (e: WheelEvent) => {
      // On macOS trackpad pinch, Chrome/Edge emit wheel with ctrlKey=true.
      if (!e.ctrlKey) return;
      if (!containsTarget(e.target)) return;

      e.preventDefault();
      e.stopPropagation();

      const delta = -e.deltaY * 0.01;
      setZoom((prev) => clampZoom(Math.round((prev + delta) * 100) / 100));
    };

    // Safari (especially iOS/iPadOS) emits gesture events for pinch.
    let gestureBase = zoom;
    const handleGestureStart = (e: Event) => {
      if (!containsTarget(e.target)) return;
      gestureBase = zoom;
      (e as any).preventDefault?.();
      e.preventDefault?.();
    };
    const handleGestureChange = (e: Event) => {
      if (!containsTarget(e.target)) return;
      const ge = e as any;
      ge.preventDefault?.();
      e.preventDefault?.();
      if (typeof ge.scale === "number") {
        const next = clampZoom(Math.round(gestureBase * ge.scale * 100) / 100);
        setZoom(() => next);
      }
    };

    // Capture-phase is key so the browser doesn't handle zoom first.
    document.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    document.addEventListener("gesturestart", handleGestureStart as any, { passive: false, capture: true } as any);
    document.addEventListener("gesturechange", handleGestureChange as any, { passive: false, capture: true } as any);

    return () => {
      document.removeEventListener("wheel", handleWheel as any, true as any);
      document.removeEventListener("gesturestart", handleGestureStart as any, true as any);
      document.removeEventListener("gesturechange", handleGestureChange as any, true as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, zoom, setZoom, clamp, containerRef]);
}
