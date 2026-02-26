import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar, SidebarContent, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, MessageSquare, Pencil, Save, X, PanelRightClose, PanelRightOpen, Ruler, ZoomIn, ZoomOut, Maximize2, Move } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Canvas as FabricCanvas, PencilBrush, Circle, Line } from "fabric";
import SinglePagePdfViewer from "@/components/SinglePagePdfViewer";
import { format } from "date-fns";

// Bundle worker locally (avoids relying on external CDNs that may be blocked)
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

interface PlanPage {
  id: string;
  page_number: number;
  page_title: string | null;
  page_description: string | null;
  sheet_number: string | null;
  discipline: string | null;
  thumbnail_url?: string | null;
}

interface PlanComment {
  id: string;
  user_id: string;
  comment_text: string;
  page_number: number | null;
  x_position: number | null;
  y_position: number | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
  };
}

interface PlanMarkup {
  id: string;
  user_id: string;
  page_number: number;
  markup_data: any;
  created_at: string;
  profiles?: {
    full_name: string | null;
  };
}

interface PlanPageLink {
  id: string;
  plan_id: string;
  source_page_number: number;
  target_page_number: number;
  ref_text: string;
  target_sheet_number: string | null;
  target_title: string | null;
  x_norm: number;
  y_norm: number;
  w_norm: number;
  h_norm: number;
  confidence: number | null;
  is_auto: boolean;
}

interface PlanPageRevision {
  id: string;
  plan_id: string;
  target_page_number: number;
  sheet_number: string | null;
  normalized_sheet_key: string;
  revision_label: string;
  revision_sort: number | null;
  is_current: boolean | null;
}

type DetectedLinkCandidate = {
  source_page_number: number;
  ref_text: string;
  normalized_ref: string;
  x_norm: number;
  y_norm: number;
  w_norm: number;
  h_norm: number;
  confidence?: number;
  kind?: "sheet_ref" | "symbol_tag";
};

type UnresolvedLinkCandidate = {
  source_page_number: number;
  ref_text: string;
};

const SHEET_REF_PATTERN = /\b(?:\d+\s*\/\s*)?([A-Z]{1,4}\s*[-.]?\s*\d{1,3}(?:\.\d{1,3})?)\b/g;
const SYMBOL_CODE_PATTERN = /^[A-Z]{1,4}$/;
const SYMBOL_NUM_PATTERN = /^\d{1,3}[A-Z]?$/i;

const normalizeSheetRef = (value: string | null | undefined) =>
  (value || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/([A-Z])[-_](\d)/g, "$1$2");

const normalizeSymbolTagRef = (code: string | null | undefined, num: string | null | undefined) =>
  `${(code || "").toUpperCase().replace(/\s+/g, "")}${(num || "").toUpperCase().replace(/\s+/g, "")}`;

type ExtractedTextBox = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const extractPdfTextBoxes = (params: { textItems: any[]; viewportWidth: number; viewportHeight: number }): ExtractedTextBox[] => {
  const { textItems, viewportWidth, viewportHeight } = params;
  const boxes: ExtractedTextBox[] = [];

  for (const item of textItems || []) {
    const text = String(item?.str || "").trim();
    if (!text) continue;
    const transform = Array.isArray(item?.transform) ? item.transform : null;
    if (!transform || transform.length < 6) continue;

    const x = Number(transform[4]) || 0;
    const yBase = Number(transform[5]) || 0;
    const rawW = Math.abs(Number(item?.width) || Number(transform[0]) || 0);
    const rawH = Math.abs(Number(item?.height) || Number(transform[3]) || 10);
    if (!rawW || !rawH || !viewportWidth || !viewportHeight) continue;

    const boxX = Math.max(0, x);
    const boxY = Math.max(0, viewportHeight - yBase - rawH);
    const boxW = Math.min(rawW, viewportWidth - boxX);
    const boxH = Math.min(rawH, viewportHeight - boxY);
    if (boxW <= 0 || boxH <= 0) continue;

    boxes.push({ text, x: boxX, y: boxY, w: boxW, h: boxH });
  }

  return boxes;
};

const extractSheetRefCandidates = (params: {
  pageNumber: number;
  textItems: any[];
  viewportWidth: number;
  viewportHeight: number;
}): DetectedLinkCandidate[] => {
  const { pageNumber, textItems, viewportWidth, viewportHeight } = params;
  const out: DetectedLinkCandidate[] = [];

  for (const item of textItems || []) {
    const str = String(item?.str || "").trim();
    if (!str || str.length > 48) continue;
    if (!/[A-Z]/i.test(str) || !/\d/.test(str)) continue;

    const matches = Array.from(str.matchAll(SHEET_REF_PATTERN));
    if (matches.length === 0) continue;

    const transform = Array.isArray(item?.transform) ? item.transform : null;
    if (!transform || transform.length < 6) continue;

    const x = Number(transform[4]) || 0;
    const yBase = Number(transform[5]) || 0;
    const rawW = Math.abs(Number(item?.width) || Number(transform[0]) || 0);
    const rawH = Math.abs(Number(item?.height) || Number(transform[3]) || 10);
    if (!rawW || !rawH || !viewportWidth || !viewportHeight) continue;

    const boxX = Math.max(0, x);
    const boxY = Math.max(0, viewportHeight - yBase - rawH);
    const boxW = Math.min(rawW, viewportWidth - boxX);
    const boxH = Math.min(rawH, viewportHeight - boxY);

    for (const match of matches) {
      const fullMatch = (match[0] || "").trim();
      const rawRef = (match[1] || "").trim();
      const normalizedRef = normalizeSheetRef(rawRef);
      if (!normalizedRef) continue;

      const itemText = String(item?.str || "");
      const totalChars = Math.max(1, itemText.length);
      const fullMatchStart = Math.max(0, match.index ?? itemText.indexOf(match[0] || ""));
      const fullMatchLen = Math.max(1, String(match[0] || "").length);
      const refOffsetInFull = String(match[0] || "").toUpperCase().indexOf(String(match[1] || "").toUpperCase());
      const refStart = fullMatchStart + Math.max(0, refOffsetInFull);
      const refLen = Math.max(1, String(match[1] || "").length);
      const charW = boxW / totalChars;
      const refinedX = boxX + refStart * charW;
      const refinedW = Math.min(boxW, Math.max(charW * refLen, 12));

      out.push({
        source_page_number: pageNumber,
        ref_text: fullMatch || rawRef,
        normalized_ref: normalizedRef,
        x_norm: Math.max(0, Math.min(1, refinedX / viewportWidth)),
        y_norm: Math.max(0, Math.min(1, boxY / viewportHeight)),
        w_norm: Math.max(0.01, Math.min(1, refinedW / viewportWidth)),
        h_norm: Math.max(0.01, Math.min(1, boxH / viewportHeight)),
        confidence: 0.75,
        kind: "sheet_ref",
      });
    }
  }

  return out;
};

const extractSymbolTagCandidates = (params: {
  pageNumber: number;
  textBoxes: ExtractedTextBox[];
  viewportWidth: number;
  viewportHeight: number;
}): DetectedLinkCandidate[] => {
  const { pageNumber, textBoxes, viewportWidth, viewportHeight } = params;
  const out: DetectedLinkCandidate[] = [];
  const seen = new Set<string>();

  // Split-circle callout heuristic: stacked alpha code over numeric code, aligned in X and close in Y.
  for (const top of textBoxes) {
    const topText = top.text.toUpperCase().replace(/\s+/g, "");
    if (!SYMBOL_CODE_PATTERN.test(topText)) continue;
    if (topText.length < 1 || topText.length > 4) continue;
    // Ignore common one-char note bubbles that are too generic.
    if (topText.length === 1) continue;

    const topCx = top.x + top.w / 2;
    const topBottom = top.y + top.h;

    for (const bottom of textBoxes) {
      if (bottom === top) continue;
      const bottomText = bottom.text.toUpperCase().replace(/\s+/g, "");
      if (!SYMBOL_NUM_PATTERN.test(bottomText)) continue;

      const bottomCx = bottom.x + bottom.w / 2;
      const xDelta = Math.abs(topCx - bottomCx);
      const maxWidth = Math.max(top.w, bottom.w);
      if (xDelta > Math.max(12, maxWidth * 0.8)) continue;

      const yGap = bottom.y - topBottom;
      if (yGap < -4 || yGap > Math.max(28, (top.h + bottom.h) * 1.4)) continue;

      const left = Math.min(top.x, bottom.x);
      const right = Math.max(top.x + top.w, bottom.x + bottom.w);
      const upper = Math.min(top.y, bottom.y);
      const lower = Math.max(top.y + top.h, bottom.y + bottom.h);
      const w = right - left;
      const h = lower - upper;

      const normalizedRef = normalizeSymbolTagRef(topText, bottomText);
      if (!normalizedRef) continue;
      const key = `${pageNumber}:${normalizedRef}:${Math.round(left)}:${Math.round(upper)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        source_page_number: pageNumber,
        ref_text: `${topText}${bottomText}`,
        normalized_ref: normalizedRef,
        x_norm: Math.max(0, Math.min(1, left / viewportWidth)),
        y_norm: Math.max(0, Math.min(1, upper / viewportHeight)),
        w_norm: Math.max(0.01, Math.min(1, w / viewportWidth)),
        h_norm: Math.max(0.01, Math.min(1, h / viewportHeight)),
        confidence: 0.62,
        kind: "symbol_tag",
      });
    }
  }

  return out;
};

const toDateInputValue = (value: string | null | undefined) => {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value.slice(0, 10);
};

export default function PlanViewer() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [plan, setPlan] = useState<any>(null);
  const [jobName, setJobName] = useState<string>("");
  const [pages, setPages] = useState<PlanPage[]>([]);
  const [comments, setComments] = useState<PlanComment[]>([]);
  const [markups, setMarkups] = useState<PlanMarkup[]>([]);
  const [pageLinks, setPageLinks] = useState<PlanPageLink[]>([]);
  const [pageRevisions, setPageRevisions] = useState<PlanPageRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [activeTool, setActiveTool] = useState<"select" | "pen" | "circle" | "line" | "comment" | "measure">("select");
  const [markupColor, setMarkupColor] = useState("#FF0000");
  const [pendingCommentPosition, setPendingCommentPosition] = useState<{ x: number; y: number } | null>(null);
  const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [planScale, setPlanScale] = useState<{ realDistance: number; pixelDistance: number } | null>(null);
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [scaleFormData, setScaleFormData] = useState({ knownDistance: "", unit: "feet" });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panMode, setPanMode] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initialPlanDataLoaded, setInitialPlanDataLoaded] = useState(false);
  const [planInfoSaving, setPlanInfoSaving] = useState(false);
  const [managePagesOpen, setManagePagesOpen] = useState(false);
  const [selectedMarkupId, setSelectedMarkupId] = useState<string>("");
  const [pendingMarkupLoadId, setPendingMarkupLoadId] = useState<string | null>(null);
  const [selectedPageLinkId, setSelectedPageLinkId] = useState<string | null>(null);
  const [pdfPageRect, setPdfPageRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [linkMinConfidence, setLinkMinConfidence] = useState<string>("all");
  const [unresolvedAutoRefs, setUnresolvedAutoRefs] = useState<UnresolvedLinkCandidate[]>([]);
  const [planInfoForm, setPlanInfoForm] = useState({
    plan_name: "",
    plan_number: "",
    revision: "",
    architect: "",
    revision_date: "",
    description: "",
    is_permit_set: false,
  });
  

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  

  useEffect(() => {
    if (planId) {
      setInitialPlanDataLoaded(false);
      fetchPlanData();
    }
  }, [planId]);

  useEffect(() => {
    const pageParam = searchParams.get("page");
    if (pageParam) {
      setCurrentPage(parseInt(pageParam));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!planId) return;
    fetchMarkups();
  }, [planId, currentPage]);

  // pdfPageRect is now provided directly by SinglePagePdfViewer so hotspots track
  // the actual internal scroll/zoom container correctly.

  useEffect(() => {
    if (!pendingMarkupLoadId) return;
    const markup = markups.find((m) => m.id === pendingMarkupLoadId);
    if (!markup || markup.page_number !== currentPage || !fabricCanvasRef.current) return;

    const loadPending = async () => {
      try {
        await fabricCanvasRef.current!.loadFromJSON(markup.markup_data);
        fabricCanvasRef.current!.renderAll();
        setPendingMarkupLoadId(null);
        toast.success("Markup loaded");
      } catch (error) {
        console.error("Error loading pending markup layer:", error);
        toast.error("Failed to load markup");
        setPendingMarkupLoadId(null);
      }
    };

    void loadPending();
  }, [pendingMarkupLoadId, markups, currentPage]);

  // IMPORTANT (Chrome macOS): trackpad pinch can trigger *page* zoom (which scales the header/toolbar).
  // We disable browser zoom while this viewer is mounted so zoom only affects the PDF.
  useEffect(() => {
    // Some Safari/embedded WebViews still page-zoom even when gesture events are prevented.
    // This tiny "zoom nudge" is a known workaround to force WebKit to cancel the page zoom.
    const body = document.body;
    const originalBodyZoom = body?.style.zoom;
    const nudgeBodyZoom = () => {
      try {
        if (!document.body) return;
        document.body.style.zoom = "0.999";
        requestAnimationFrame(() => {
          // Restore previous explicit zoom style (usually empty)
          document.body.style.zoom = originalBodyZoom || "";
        });
      } catch {
        // ignore
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as Node | null;
      const inPdfViewer = !!(target && pdfContainerRef.current?.contains(target));
      if (inPdfViewer) return;
      // Prevent Chrome page zoom (Cmd +/- is still available if the user wants it).
      if (e.cancelable) e.preventDefault();
      nudgeBodyZoom();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;

      const key = e.key;
      const zoomInKeys = key === "+" || key === "=";
      const zoomOutKeys = key === "-" || key === "_";
      const resetKeys = key === "0";

      if (!zoomInKeys && !zoomOutKeys && !resetKeys) return;

      if (e.cancelable) e.preventDefault();
      e.stopPropagation();

      if (zoomInKeys) {
        setZoomLevel((prev) => Math.min(prev + 0.25, 3));
      } else if (zoomOutKeys) {
        setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
      } else {
        setZoomLevel(1);
      }

      nudgeBodyZoom();
    };

    // Safari pinch zoom emits gesture events that can zoom the whole page.
    const onGesture = (e: Event) => {
      // Don't stop propagation; the PDF viewer still needs to receive this to apply its own zoom.
      (e as any).preventDefault?.();
      e.preventDefault?.();
      nudgeBodyZoom();
    };

    const onGestureEnd = (e: Event) => {
      (e as any).preventDefault?.();
      e.preventDefault?.();
      nudgeBodyZoom();
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("gesturestart", onGesture as any, { passive: false, capture: true } as any);
    window.addEventListener("gesturechange", onGesture as any, { passive: false, capture: true } as any);
    window.addEventListener("gestureend", onGestureEnd as any, { passive: false, capture: true } as any);

    // Some WebKit builds dispatch gesture events on `document` rather than `window`.
    document.addEventListener("gesturestart", onGesture as any, { passive: false, capture: true } as any);
    document.addEventListener("gesturechange", onGesture as any, { passive: false, capture: true } as any);
    document.addEventListener("gestureend", onGestureEnd as any, { passive: false, capture: true } as any);
    document.addEventListener("wheel", onWheel, { passive: false, capture: true } as any);
    document.addEventListener("keydown", onKeyDown, { capture: true } as any);

    return () => {
      window.removeEventListener("wheel", onWheel as any, true as any);
      window.removeEventListener("keydown", onKeyDown as any, true as any);
      window.removeEventListener("gesturestart", onGesture as any, true as any);
      window.removeEventListener("gesturechange", onGesture as any, true as any);
      window.removeEventListener("gestureend", onGestureEnd as any, true as any);

      document.removeEventListener("gesturestart", onGesture as any, true as any);
      document.removeEventListener("gesturechange", onGesture as any, true as any);
      document.removeEventListener("gestureend", onGestureEnd as any, true as any);
      document.removeEventListener("wheel", onWheel as any, true as any);
      document.removeEventListener("keydown", onKeyDown as any, true as any);

      // Restore any previous zoom style
      try {
        if (document.body) document.body.style.zoom = originalBodyZoom || "";
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    // Only auto-analyze after the initial plan/pages fetch has completed.
    // Otherwise `setPlan(...)` can fire before `setPages(...)` and falsely look like an empty index.
    if (!initialPlanDataLoaded || loading) return;
    if (plan && pages.length === 0 && !analyzing) {
      analyzePlan();
    }
  }, [initialPlanDataLoaded, loading, plan, pages, analyzing]);

  // Initialize Fabric.js canvas for markups (only once)
  useEffect(() => {
    if (!canvasRef.current || !pdfContainerRef.current || fabricCanvasRef.current) return;

    const containerWidth = pdfContainerRef.current.offsetWidth;
    const containerHeight = pdfContainerRef.current.offsetHeight;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: containerWidth,
      height: containerHeight,
      backgroundColor: "transparent",
      isDrawingMode: false,
      selection: false,
    });

    fabricCanvasRef.current = canvas;

    // Handle canvas clicks for comment and measurement placement
    const handleCanvasClick = (e: any) => {
      if (!e.pointer) return;

      const currentTool = canvas.getActiveObject() ? "select" : canvas.get("activeTool") as string;

      if (currentTool === "comment") {
        // Calculate relative position (0-1) for database storage
        const relativeX = e.pointer.x / canvas.width;
        const relativeY = e.pointer.y / canvas.height;
        
        setPendingCommentPosition({
          x: relativeX,
          y: relativeY,
        });
        
        // Show visual feedback
        const pin = new Circle({
          left: e.pointer.x - 10,
          top: e.pointer.y - 10,
          radius: 10,
          fill: "#3b82f6",
          stroke: "#ffffff",
          strokeWidth: 2,
          selectable: false,
          evented: false,
          tempPin: true,
        } as any);
        
        canvas.add(pin);
        canvas.renderAll();
        
        toast.success("Pin placed! Now write your comment.");
      } else if (currentTool === "measure") {
        const newPoint = { x: e.pointer.x, y: e.pointer.y };
        const currentPoints = canvas.get("measurePoints") as Array<{ x: number; y: number }> || [];
        
        if (currentPoints.length === 0) {
          canvas.set("measurePoints", [newPoint]);
          setMeasurePoints([newPoint]);
          
          // Show first point marker
          const marker = new Circle({
            left: newPoint.x - 5,
            top: newPoint.y - 5,
            radius: 5,
            fill: "#00ff00",
            selectable: false,
          });
          canvas.add(marker);
        } else if (currentPoints.length === 1) {
          const point1 = currentPoints[0];
          const pixelDistance = Math.sqrt(
            Math.pow(newPoint.x - point1.x, 2) + Math.pow(newPoint.y - point1.y, 2)
          );
          
          const currentScale = canvas.get("planScale") as { realDistance: number; pixelDistance: number } | null;
          const currentUnit = canvas.get("scaleUnit") as string || "feet";
          
          if (currentScale) {
            const realDistance = (pixelDistance / currentScale.pixelDistance) * currentScale.realDistance;
            toast.success(`Distance: ${realDistance.toFixed(2)} ${currentUnit}`);
          } else {
            toast.error("Please set the scale first");
          }
          
          // Draw measurement line
          const line = new Line([point1.x, point1.y, newPoint.x, newPoint.y], {
            stroke: "#00ff00",
            strokeWidth: 2,
            selectable: false,
          });
          canvas.add(line);
          
          canvas.set("measurePoints", []);
          setMeasurePoints([]);
        }
      }
    };

    canvas.on("mouse:down", handleCanvasClick);

    return () => {
      canvas.off("mouse:down", handleCanvasClick);
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [plan]);

  // Handle markup tool changes (update canvas settings without recreating)
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    
    // Store tool state on canvas for click handler
    canvas.set("activeTool", activeTool);
    canvas.set("markupColor", markupColor);
    canvas.set("planScale", planScale);
    canvas.set("scaleUnit", scaleFormData.unit);
    
    canvas.isDrawingMode = activeTool === "pen";
    canvas.selection = activeTool === "select";

    if (activeTool === "pen") {
      const brush = new PencilBrush(canvas);
      brush.color = markupColor;
      brush.width = 3;
      canvas.freeDrawingBrush = brush;
    }

    // Change cursor for different tools
    if (activeTool === "comment") {
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
    } else if (activeTool === "measure") {
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
    } else if (panMode) {
      canvas.defaultCursor = "grab";
      canvas.hoverCursor = "grab";
    } else {
      canvas.defaultCursor = "default";
      canvas.hoverCursor = "move";
    }
    
    // Reset measurement points when changing tools
    if (activeTool !== "measure") {
      setMeasurePoints([]);
      canvas.set("measurePoints", []);
    }
    
    // Clear temp pins when changing from comment tool
    if (activeTool !== "comment") {
      const tempPins = canvas.getObjects().filter((obj: any) => obj.tempPin);
      tempPins.forEach(pin => canvas.remove(pin));
      canvas.renderAll();
    }
  }, [activeTool, markupColor, panMode, planScale, scaleFormData.unit]);

  // Render comment pins on canvas
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const currentPageComments = comments.filter(c => c.page_number === currentPage);

    // Clear existing pins
    const existingPins = canvas.getObjects().filter((obj: any) => obj.commentPin);
    existingPins.forEach(pin => canvas.remove(pin));

    // Add pins for current page comments
    currentPageComments.forEach((comment) => {
      if (comment.x_position !== null && comment.y_position !== null) {
        const x = comment.x_position * canvas.width;
        const y = comment.y_position * canvas.height;

        const pin = new Circle({
          left: x - 10,
          top: y - 10,
          radius: 10,
          fill: "#3b82f6",
          stroke: "#ffffff",
          strokeWidth: 2,
          selectable: false,
          evented: true,
          commentPin: true,
          commentId: comment.id,
        } as any);

        canvas.add(pin);
      }
    });

    canvas.renderAll();
  }, [comments, currentPage]);

  const fetchPlanData = async () => {
    try {
      const { data: planData, error: planError } = await supabase
        .from("job_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError) throw planError;
      setPlan(planData);

      if (planData?.job_id) {
        const { data: jobData } = await supabase
          .from("jobs")
          .select("name")
          .eq("id", planData.job_id)
          .maybeSingle();
        setJobName(jobData?.name || "");
      } else {
        setJobName("");
      }

      const { data: pagesData, error: pagesError } = await supabase
        .from("plan_pages" as any)
        .select("*")
        .eq("plan_id", planId)
        .order("page_number");

      if (pagesError) throw pagesError;
      const nextPages = (pagesData || []) as any;
      setPages(nextPages);

      const { data: linksData, error: linksError } = await supabase
        .from("plan_page_links" as any)
        .select("*")
        .eq("plan_id", planId)
        .eq("is_auto", true)
        .order("source_page_number", { ascending: true });

      if (!linksError) {
        setPageLinks((linksData || []) as any);
      } else {
        console.warn("Error fetching plan links:", linksError);
        setPageLinks([]);
      }

      const { data: revisionsData, error: revisionsError } = await supabase
        .from("plan_page_revisions" as any)
        .select("*")
        .eq("plan_id", planId)
        .order("normalized_sheet_key", { ascending: true })
        .order("revision_sort", { ascending: false })
        .order("target_page_number", { ascending: true });

      if (!revisionsError) {
        setPageRevisions((revisionsData || []) as any);
      } else {
        // Migration may not be applied yet; keep plan viewer working.
        console.warn("Error fetching plan revisions:", revisionsError);
        setPageRevisions([]);
      }

      const firstIndexedPage = nextPages.find((p: PlanPage) => p.page_number === 1) || nextPages[0];
      setPlanInfoForm({
        plan_name: planData?.plan_name || firstIndexedPage?.page_title || "",
        plan_number: planData?.plan_number || firstIndexedPage?.sheet_number || "",
        revision: planData?.revision || "",
        architect: planData?.architect || "",
        revision_date: toDateInputValue(planData?.revision_date),
        description: planData?.description || firstIndexedPage?.page_description || "",
        is_permit_set: !!planData?.is_permit_set,
      });

      fetchComments();
      fetchMarkups();
    } catch (error) {
      console.error("Error fetching plan:", error);
      toast.error("Failed to load plan");
    } finally {
      setInitialPlanDataLoaded(true);
      setLoading(false);
    }
  };

  const pageMapByNumber = useMemo(() => {
    const m = new Map<number, PlanPage>();
    pages.forEach((p) => m.set(p.page_number, p));
    return m;
  }, [pages]);

  const filteredPageLinks = useMemo(() => {
    if (linkMinConfidence === "all") return pageLinks;
    const min = Number(linkMinConfidence);
    if (!Number.isFinite(min)) return pageLinks;
    return pageLinks.filter((l) => (l.confidence ?? 0) >= min);
  }, [pageLinks, linkMinConfidence]);

  const currentPageLinks = useMemo(
    () => filteredPageLinks.filter((l) => l.source_page_number === currentPage),
    [filteredPageLinks, currentPage]
  );

  const selectedPageLink = useMemo(
    () => filteredPageLinks.find((l) => l.id === selectedPageLinkId) || null,
    [filteredPageLinks, selectedPageLinkId]
  );

  const autoLinkSummaryByPage = useMemo(() => {
    const counts = new Map<number, number>();
    filteredPageLinks.forEach((l) => {
      counts.set(l.source_page_number, (counts.get(l.source_page_number) || 0) + 1);
    });
    return counts;
  }, [filteredPageLinks]);

  const pageRevisionGroups = useMemo(() => {
    const groups = new Map<string, PlanPageRevision[]>();
    for (const rev of pageRevisions) {
      const key = rev.normalized_sheet_key || normalizeSheetRef(rev.sheet_number) || `PAGE${rev.target_page_number}`;
      const next = groups.get(key) || [];
      next.push(rev);
      groups.set(key, next);
    }

    groups.forEach((list) => {
      list.sort((a, b) => {
        const sortA = a.revision_sort ?? 0;
        const sortB = b.revision_sort ?? 0;
        if (sortA !== sortB) return sortB - sortA;
        if ((a.is_current ? 1 : 0) !== (b.is_current ? 1 : 0)) return (b.is_current ? 1 : 0) - (a.is_current ? 1 : 0);
        return b.target_page_number - a.target_page_number;
      });
    });

    return groups;
  }, [pageRevisions]);

  const handleJumpToLinkedPage = (link: PlanPageLink) => {
    setSelectedPageLinkId(link.id);
    if (link.target_page_number !== currentPage) {
      setCurrentPage(link.target_page_number);
      setSearchParams({ page: link.target_page_number.toString() });
    }
  };

  const fetchComments = async () => {
    try {
      let { data, error } = await supabase
        .from("plan_comments" as any)
        .select(`
          *,
          profiles:user_id (full_name)
        `)
        .eq("plan_id", planId)
        .order("created_at", { ascending: false });

      if (error) {
        // Fallback if the join alias is invalid in this environment.
        const fallback = await supabase
          .from("plan_comments" as any)
          .select("*")
          .eq("plan_id", planId)
          .order("created_at", { ascending: false });
        data = fallback.data as any;
        error = fallback.error as any;
      }

      if (error) throw error;
      setComments((data || []) as any);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const fetchMarkups = async () => {
    try {
      let { data, error } = await supabase
        .from("plan_markups" as any)
        .select(`
          *,
          profiles:user_id (full_name)
        `)
        .eq("plan_id", planId)
        .order("created_at", { ascending: false });

      if (error) {
        // Fallback if the join alias is invalid in this environment.
        const fallback = await supabase
          .from("plan_markups" as any)
          .select("*")
          .eq("plan_id", planId)
          .order("created_at", { ascending: false });
        data = fallback.data as any;
        error = fallback.error as any;
      }

      if (error) throw error;
      const nextMarkups = (data || []) as any;
      setMarkups(nextMarkups);
    } catch (error) {
      console.error("Error fetching markups:", error);
    }
  };

  const [analyzeProgress, setAnalyzeProgress] = useState<{ current: number; total: number } | null>(null);

  const analyzePlan = async () => {
    if (!plan) return;

    setAnalyzing(true);
    setAnalyzeProgress(null);
    try {
      console.log('Starting plan analysis with OCR...');
      
      // Load PDF
      const pdfjs: any = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      
      const resp = await fetch(plan.file_url);
      if (!resp.ok) throw new Error(`Failed to fetch PDF: ${resp.status}`);
      const buf = await resp.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: buf });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      console.log(`PDF has ${numPages} pages`);
      setAnalyzeProgress({ current: 0, total: numPages });

      let successCount = 0;
      const collectedPageRows: any[] = [];
      const detectedLinkCandidates: DetectedLinkCandidate[] = [];
      const pageTextSearchRows: Array<{ page_number: number; textBlob: string }> = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        setAnalyzeProgress({ current: pageNum, total: numPages });
        
        let pageData: any;
        try {
          console.log(`Processing page ${pageNum}/${numPages} with OCR...`);
          const page = await pdf.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          
          // Render page to canvas for OCR
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context!,
            viewport: viewport,
            canvas,
          }).promise;

          // Convert canvas to base64
          const imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

          // Call OCR edge function
          const { data: ocrData, error: ocrError } = await supabase.functions.invoke(
            'analyze-plan-ocr',
            {
              body: {
                imageBase64,
                pageNumber: pageNum,
              },
            }
          );

          if (ocrError) {
            console.error(`OCR error for page ${pageNum}:`, ocrError);
            throw ocrError;
          }

          const result = ocrData?.data || {};
          console.log(`Page ${pageNum} OCR result:`, result);

          pageData = {
            plan_id: planId,
            page_number: pageNum,
            sheet_number: result.sheet_number || null,
            page_title: result.sheet_number && result.sheet_title
              ? `${result.sheet_number} - ${result.sheet_title}`
              : (result.sheet_title || `Sheet ${pageNum}`),
            discipline: result.discipline || 'General',
            page_description: result.sheet_title 
              ? `${result.discipline || 'General'} - ${result.sheet_title}`
              : `Page ${pageNum}`,
          };

          try {
            const textContent = await page.getTextContent();
            const textItems = (textContent?.items || []) as any[];
            const candidates = extractSheetRefCandidates({
              pageNumber: pageNum,
              textItems,
              viewportWidth: baseViewport.width,
              viewportHeight: baseViewport.height,
            });
            const textBoxes = extractPdfTextBoxes({
              textItems,
              viewportWidth: baseViewport.width,
              viewportHeight: baseViewport.height,
            });
            const symbolCandidates = extractSymbolTagCandidates({
              pageNumber: pageNum,
              textBoxes,
              viewportWidth: baseViewport.width,
              viewportHeight: baseViewport.height,
            });
            detectedLinkCandidates.push(...candidates, ...symbolCandidates);

            const normalizedTextBlob = textBoxes
              .map((b) => b.text.toUpperCase())
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
            pageTextSearchRows.push({
              page_number: pageNum,
              textBlob: normalizedTextBlob,
            });
          } catch (textErr) {
            console.warn(`Text extraction failed for page ${pageNum}:`, textErr);
          }
        } catch (pageError) {
          console.error(`Error processing page ${pageNum}:`, pageError);
          // Fallback to basic page info
          pageData = {
            plan_id: planId,
            page_number: pageNum,
            sheet_number: `Page ${pageNum}`,
            page_title: `Sheet ${pageNum}`,
            discipline: 'General',
            page_description: `Page ${pageNum}`,
          };
        }

        collectedPageRows.push(pageData);

        // Save each page immediately so progress is not lost
        try {
          const { error: upsertError } = await supabase
            .from("plan_pages" as any)
            .upsert(pageData, { onConflict: 'plan_id,page_number' });
          
          if (upsertError) {
            console.error(`Failed to save page ${pageNum}:`, upsertError);
          } else {
            successCount++;
          }
        } catch (saveError) {
          console.error(`Failed to save page ${pageNum}:`, saveError);
        }
      }

      // Build and save auto-detected inter-sheet links from extracted text references.
      try {
        const sheetToPage = new Map<string, { page_number: number; sheet_number: string | null; title: string | null }>();
        for (const p of collectedPageRows) {
          const sheet = p.sheet_number || null;
          const title = p.page_title || null;
          const keys = new Set<string>();
          if (sheet) keys.add(normalizeSheetRef(sheet));
          if (title) {
            const titleMatch = String(title).match(/\b([A-Z]{1,4}\s*[-.]?\s*\d{1,3}(?:\.\d{1,3})?)\b/i);
            if (titleMatch?.[1]) keys.add(normalizeSheetRef(titleMatch[1]));
          }
          keys.forEach((key) => {
            if (key) sheetToPage.set(key, { page_number: p.page_number, sheet_number: sheet, title });
          });
        }

        const unresolvedRefs: UnresolvedLinkCandidate[] = [];
        const pageTextBlobMap = new Map<number, string>(
          pageTextSearchRows.map((r) => [r.page_number, r.textBlob])
        );
        const findTargetPageForSymbolTag = (candidate: DetectedLinkCandidate) => {
          const compact = candidate.normalized_ref.toUpperCase();
          const alpha = compact.match(/^[A-Z]+/)?.[0] || "";
          const numeric = compact.slice(alpha.length);
          if (!alpha || !numeric) return null;

          const variants = [
            `${alpha}${numeric}`,
            `${alpha}-${numeric}`,
            `${alpha} ${numeric}`,
          ];

          // Prefer schedule/detail sheets first, then any other page with a matching row label token.
          const preferredPages = collectedPageRows
            .filter((p) => p.page_number !== candidate.source_page_number)
            .map((p) => ({
              page_number: p.page_number,
              title: String(p.page_title || p.page_description || "").toUpperCase(),
              sheet_number: p.sheet_number || null,
              page_title: p.page_title || null,
            }))
            .filter((p) => {
              const blob = pageTextBlobMap.get(p.page_number) || "";
              return variants.some((v) => blob.includes(v));
            })
            .sort((a, b) => {
              const aScore = /SCHEDULE|EQUIPMENT|LEGEND|DETAIL/.test(a.title) ? 1 : 0;
              const bScore = /SCHEDULE|EQUIPMENT|LEGEND|DETAIL/.test(b.title) ? 1 : 0;
              return bScore - aScore;
            });

          return preferredPages[0] || null;
        };

        const linkRows = detectedLinkCandidates
          .map((c) => {
            let target = sheetToPage.get(c.normalized_ref);
            if (!target && c.kind === "symbol_tag") {
              target = findTargetPageForSymbolTag(c) as any;
            }
            if (!target) {
              unresolvedRefs.push({
                source_page_number: c.source_page_number,
                ref_text: c.ref_text,
              });
              return null;
            }
            if (target.page_number === c.source_page_number) return null;

            const rx = Math.round(c.x_norm * 10000) / 10000;
            const ry = Math.round(c.y_norm * 10000) / 10000;
            const rw = Math.round(c.w_norm * 10000) / 10000;
            const rh = Math.round(c.h_norm * 10000) / 10000;
            return {
              plan_id: planId,
              source_page_number: c.source_page_number,
              target_page_number: target.page_number,
              ref_text: c.ref_text,
              target_sheet_number: target.sheet_number,
              target_title: target.title,
              x_norm: rx,
              y_norm: ry,
              w_norm: rw,
              h_norm: rh,
              confidence: c.confidence ?? (c.kind === "symbol_tag" ? 0.62 : 0.75),
              is_auto: true,
              link_key: `${c.source_page_number}:${target.page_number}:${c.normalized_ref}:${rx}:${ry}`,
            };
          })
          .filter(Boolean) as any[];

        const uniqueByKey = new Map<string, any>();
        for (const row of linkRows) {
          if (!uniqueByKey.has(row.link_key)) uniqueByKey.set(row.link_key, row);
        }
        const dedupedLinks = Array.from(uniqueByKey.values());

        await supabase
          .from("plan_page_links" as any)
          .delete()
          .eq("plan_id", planId)
          .eq("is_auto", true);

        if (dedupedLinks.length > 0) {
          const { error: linkUpsertError } = await supabase
            .from("plan_page_links" as any)
            .upsert(dedupedLinks, { onConflict: "link_key" });
          if (linkUpsertError) {
            console.warn("Failed to save auto plan links:", linkUpsertError);
          }
        }
        setUnresolvedAutoRefs(
          Array.from(
            new Map(
              unresolvedRefs.map((r) => [`${r.source_page_number}:${r.ref_text.toUpperCase()}`, r])
            ).values()
          ).slice(0, 100)
        );
      } catch (linkError) {
        console.warn("Auto link detection/save failed:", linkError);
        setUnresolvedAutoRefs([]);
      }

      try { await pdf.cleanup?.(); } catch {}
      try { await pdf.destroy?.(); } catch {}

      await fetchPlanData();
      toast.success(`Plan analyzed - ${successCount}/${numPages} pages indexed`);
    } catch (error: any) {
      console.error("Error analyzing plan:", error);
      toast.error(error.message || "Failed to analyze plan");
      // Still try to reload whatever pages were saved
      await fetchPlanData();
    } finally {
      setAnalyzing(false);
      setAnalyzeProgress(null);
    }
  };

  const handleUpdatePage = async (pageId: string, updates: Partial<PlanPage>) => {
    try {
      const { error } = await supabase
        .from("plan_pages" as any)
        .update(updates)
        .eq("id", pageId);

      if (error) throw error;

      setPages(pages.map(p => p.id === pageId ? { ...p, ...updates } : p));
      setEditingPage(null);
      toast.success("Page updated");
    } catch (error) {
      console.error("Error updating page:", error);
      toast.error("Failed to update page");
    }
  };

  const handleUpdatePlanInfo = async () => {
    if (!plan?.id) return;
    if (!planInfoForm.plan_name.trim()) {
      toast.error("Plan name is required");
      return;
    }

    setPlanInfoSaving(true);
    try {
      const updates = {
        plan_name: planInfoForm.plan_name.trim(),
        plan_number: planInfoForm.plan_number || null,
        revision: planInfoForm.revision || null,
        architect: planInfoForm.architect || null,
        revision_date: planInfoForm.revision_date || null,
        description: planInfoForm.description || null,
        is_permit_set: !!planInfoForm.is_permit_set,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("job_plans")
        .update(updates)
        .eq("id", plan.id);

      if (error) throw error;
      setPlan((prev: any) => ({ ...prev, ...updates }));
      toast.success("Plan information updated");
    } catch (error) {
      console.error("Error updating plan information:", error);
      toast.error("Failed to update plan information");
    } finally {
      setPlanInfoSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    if (!pendingCommentPosition) {
      toast.error("Please click on the plan to place your comment pin");
      return;
    }

    try {
      const { error } = await supabase
        .from("plan_comments" as any)
        .insert({
          plan_id: planId,
          user_id: user?.id,
          comment_text: newComment,
          page_number: currentPage,
          x_position: pendingCommentPosition.x,
          y_position: pendingCommentPosition.y,
        });

      if (error) throw error;

      setNewComment("");
      setPendingCommentPosition(null);
      setActiveTool("select");
      fetchComments();
      toast.success("Comment added with pin location");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    }
  };

  const handleSaveMarkup = async () => {
    if (!fabricCanvasRef.current) return;

    try {
      const markupData = fabricCanvasRef.current.toJSON();

      const { error } = await supabase
        .from("plan_markups" as any)
        .insert({
          plan_id: planId,
          user_id: user?.id,
          page_number: currentPage,
          markup_data: markupData,
        });

      if (error) throw error;

      toast.success("Markup saved");
      if (fabricCanvasRef.current) fabricCanvasRef.current.clear();
      fetchMarkups();
    } catch (error) {
      console.error("Error saving markup:", error);
      toast.error("Failed to save markup");
    }
  };

  const handleClearCanvas = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.clear();
    }
  };

  const handleLoadMarkupLayer = async (markup: PlanMarkup) => {
    if (!fabricCanvasRef.current) return;

    if (markup.page_number !== currentPage) {
      setPendingMarkupLoadId(markup.id);
      setCurrentPage(markup.page_number);
      setSearchParams({ page: markup.page_number.toString() });
      toast.message(`Switched to page ${markup.page_number}. Loading markup...`);
      return;
    }

    try {
      await fabricCanvasRef.current.loadFromJSON(markup.markup_data);
      fabricCanvasRef.current.renderAll();
      toast.success("Markup layer loaded");
    } catch (error) {
      console.error("Error loading markup layer:", error);
      toast.error("Failed to load markup layer");
    }
  };


  const handleAddShape = (shape: "circle" | "line") => {
    if (!fabricCanvasRef.current) return;

    if (shape === "circle") {
      const circle = new Circle({
        left: 100,
        top: 100,
        radius: 30,
        stroke: markupColor,
        strokeWidth: 3,
        fill: "transparent",
      });
      fabricCanvasRef.current.add(circle);
    } else if (shape === "line") {
      const line = new Line([50, 50, 200, 50], {
        stroke: markupColor,
        strokeWidth: 3,
      });
      fabricCanvasRef.current.add(line);
    }
  };

  const sortedPageNumbers = useMemo(
    () => pages.map((p) => p.page_number).sort((a, b) => a - b),
    [pages]
  );

  const currentPageIndex = useMemo(
    () => sortedPageNumbers.indexOf(currentPage),
    [sortedPageNumbers, currentPage]
  );

  const prevPageNumber = currentPageIndex > 0 ? sortedPageNumbers[currentPageIndex - 1] : null;
  const nextPageNumber =
    currentPageIndex >= 0 && currentPageIndex < sortedPageNumbers.length - 1
      ? sortedPageNumbers[currentPageIndex + 1]
      : null;

  const currentSheetKey = useMemo(() => {
    const page = pages.find((p) => p.page_number === currentPage);
    if (!page) return `PAGE${currentPage}`;
    return normalizeSheetRef(page.sheet_number) || `PAGE${page.page_number}`;
  }, [pages, currentPage]);

  const currentSheetRevisions = useMemo(
    () => pageRevisionGroups.get(currentSheetKey) || [],
    [pageRevisionGroups, currentSheetKey]
  );

  const selectedRevisionId = useMemo(() => {
    if (currentSheetRevisions.length === 0) return "";
    const exact = currentSheetRevisions.find((r) => r.target_page_number === currentPage);
    return (exact || currentSheetRevisions[0]).id;
  }, [currentSheetRevisions, currentPage]);

  const navigateToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    setSearchParams({ page: pageNumber.toString() });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p>Plan not found</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  const handleSetScale = () => {
    if (!scaleFormData.knownDistance) {
      toast.error("Please enter a known distance");
      return;
    }
    
    if (measurePoints.length !== 2) {
      toast.error("Please select two points on the plan to set the scale");
      return;
    }
    
    const point1 = measurePoints[0];
    const point2 = measurePoints[1];
    const pixelDistance = Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
    );
    
    setPlanScale({
      realDistance: parseFloat(scaleFormData.knownDistance),
      pixelDistance: pixelDistance,
    });
    
    setMeasurePoints([]);
    setScaleDialogOpen(false);
    toast.success(`Scale set: ${scaleFormData.knownDistance} ${scaleFormData.unit}`);
  };

  const currentPageData = pages.find(p => p.page_number === currentPage);
  const currentPageComments = comments.filter(c => c.page_number === currentPage);
  const getMarkupLabel = (markup: PlanMarkup) => {
    const author = markup.profiles?.full_name || "Unknown User";
    const pageMeta = pages.find((p) => p.page_number === markup.page_number);
    const sheet = pageMeta?.sheet_number?.trim();
    const title = pageMeta?.page_title?.trim();
    let pageLabel = `Pg ${markup.page_number}`;

    if (sheet && title) {
      const normalizedSheet = sheet.toLowerCase();
      const normalizedTitle = title.toLowerCase();
      pageLabel = normalizedTitle.startsWith(normalizedSheet) ? title : `${sheet} - ${title}`;
    } else if (title || sheet) {
      pageLabel = title || sheet || pageLabel;
    }

    return `${pageLabel} • ${author} • ${format(new Date(markup.created_at), "MMM d, h:mm a")}`;
  };
  const handleBackToJobPlans = () => {
    if (plan?.job_id) {
      navigate(`/jobs/${plan.job_id}?tab=plans`);
      return;
    }
    navigate(-1);
  };
  const getPageLabel = (page: PlanPage) => {
    const sheet = page.sheet_number?.trim();
    const title = page.page_title?.trim();

    if (sheet && title) {
      const normalizedSheet = sheet.toLowerCase();
      const normalizedTitle = title.toLowerCase();
      if (normalizedTitle.startsWith(normalizedSheet)) {
        return title;
      }
      return `${sheet} - ${title}`;
    }

    return title || sheet || `Page ${page.page_number}`;
  };

  const pageSelectorWidthCh = (() => {
    const longest = pages.reduce((max, page) => {
      const labelLength = getPageLabel(page).length;
      return Math.max(max, labelLength);
    }, 0);

    // Fixed width based on the largest label in the set so the toolbar does not shift.
    return Math.min(72, Math.max(30, longest + 4));
  })();

  const handleSelectRevision = (revisionId: string) => {
    const revision = currentSheetRevisions.find((r) => r.id === revisionId);
    if (!revision) return;
    if (revision.target_page_number !== currentPage) {
      navigateToPage(revision.target_page_number);
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex flex-col h-screen bg-background w-full overflow-hidden">
        {/* Header - completely separated from PDF, never affected by zoom */}
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-background shrink-0 z-40">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBackToJobPlans}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {jobName ? `${jobName} — ${plan.plan_name}` : plan.plan_name}
              </h1>
              {plan.plan_number && (
                <p className="truncate text-sm text-muted-foreground">Plan Set #: {plan.plan_number}</p>
              )}
            </div>
          </div>

          {/* Page Navigation + Tools */}
          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            {analyzing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mr-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                {analyzeProgress 
                  ? `Analyzing page ${analyzeProgress.current}/${analyzeProgress.total}...`
                  : "Analyzing plan..."}
              </div>
            )}
            {pages.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => prevPageNumber && navigateToPage(prevPageNumber)}
                  disabled={!prevPageNumber}
                  title="Previous Page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => nextPageNumber && navigateToPage(nextPageNumber)}
                  disabled={!nextPageNumber}
                  title="Next Page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Select
                  value={currentPage.toString()}
                  onValueChange={(value) => navigateToPage(parseInt(value))}
                >
                  <SelectTrigger
                    className="bg-background z-50 max-w-[42rem]"
                    style={{ width: `${pageSelectorWidthCh}ch` }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                    {pages.map((page) => (
                      <SelectItem key={page.id} value={page.page_number.toString()}>
                        {getPageLabel(page)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentSheetRevisions.length > 0 && (
                  <Select value={selectedRevisionId} onValueChange={handleSelectRevision}>
                    <SelectTrigger className="w-[14rem] bg-background z-50">
                      <SelectValue placeholder="Revision" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {currentSheetRevisions.map((rev, idx) => (
                        <SelectItem key={rev.id} value={rev.id}>
                          {rev.revision_label || `Revision ${idx + 1}`}
                          {rev.is_current ? " (Current)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            {/* Tools in header */}
            <div className="flex items-center gap-1 ml-1">
              <Button variant="outline" size="sm" onClick={handleZoomOut} title="Zoom Out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomIn} title="Zoom In">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetZoom} title="Reset Zoom">
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant={panMode ? "default" : "outline"}
                size="sm"
                onClick={() => setPanMode(!panMode)}
                title="Pan Mode"
              >
                <Move className="h-4 w-4" />
              </Button>
              <div className="text-xs px-2 text-muted-foreground w-10 text-right">
                {Math.round(zoomLevel * 100)}%
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title="Toggle details panel"
              >
                {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content - PDF + sidebar row */}
        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          {/* PDF Viewer wrapper - purely a layout container; SinglePagePdfViewer handles scroll internally */}
          <div
            ref={pdfContainerRef}
            className="flex-1 relative min-h-0 min-w-0 bg-muted/30 overflow-hidden"
          >
            {/* Canvas overlay for markups and interactions */}
            <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{
                // When panMode is on, let the PDF viewer receive pointer events so
                // drag-pan works in BOTH directions. The overlay only needs events for markups.
                pointerEvents: panMode ? "none" : activeTool !== "select" ? "auto" : "none",
              }}
            >
              <canvas ref={canvasRef} />
            </div>

            {/* Single-page PDF viewer with built-in pan/drag */}
            {plan?.file_url && (
              <div className="absolute inset-0 min-w-0 min-h-0">
                <SinglePagePdfViewer
                  url={plan.file_url}
                  pageNumber={currentPage}
                  totalPages={pages.length}
                  zoomLevel={zoomLevel}
                  onPageRectChange={setPdfPageRect}
                  onTotalPagesChange={(total) => {
                    // If no pages exist yet and we get a total, we could trigger analysis
                    if (pages.length === 0 && total > 0 && !analyzing) {
                      // Optionally auto-analyze
                    }
                  }}
                  onZoomChange={(newZoom) => {
                    setZoomLevel(Math.round(newZoom * 100) / 100);
                  }}
                />
              </div>
            )}

            {/* Auto-detected sheet reference hotspots */}
            {activeTool === "select" && pdfPageRect && currentPageLinks.length > 0 && (
              <div className="absolute inset-0 z-20 pointer-events-none">
                {currentPageLinks.map((link) => {
                  const left = pdfPageRect.left + link.x_norm * pdfPageRect.width;
                  const top = pdfPageRect.top + link.y_norm * pdfPageRect.height;
                  const width = Math.max(18, link.w_norm * pdfPageRect.width);
                  const height = Math.max(14, link.h_norm * pdfPageRect.height);
                  const targetMeta = pageMapByNumber.get(link.target_page_number);
                  const isSelected = selectedPageLinkId === link.id;

                  return (
                    <div
                      key={link.id}
                      className="absolute pointer-events-auto"
                      style={{ left, top, width, height }}
                    >
                      <button
                        type="button"
                        className={`group h-full w-full rounded border-2 bg-blue-500/10 transition-colors ${
                          isSelected ? "border-blue-300 bg-blue-500/20" : "border-blue-400/80 hover:bg-blue-500/20"
                        }`}
                        title={`Go to ${targetMeta?.sheet_number || link.target_sheet_number || `Page ${link.target_page_number}`}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPageLinkId((prev) => (prev === link.id ? null : link.id));
                        }}
                      >
                        <span className="sr-only">{link.ref_text}</span>
                      </button>

                      {isSelected && (
                        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-64 rounded-lg border bg-background/95 shadow-lg backdrop-blur">
                          <div className="border-b px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sheet Link</p>
                            <p className="text-sm font-semibold truncate">
                              {targetMeta?.sheet_number || link.target_sheet_number || `Page ${link.target_page_number}`}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {targetMeta?.page_title || link.target_title || "Detected sheet reference"}
                            </p>
                          </div>
                          {targetMeta?.thumbnail_url && (
                            <div className="px-3 pt-3">
                              <div className="overflow-hidden rounded border bg-muted/30">
                                <img
                                  src={targetMeta.thumbnail_url}
                                  alt={targetMeta.page_title || targetMeta.sheet_number || `Page ${link.target_page_number}`}
                                  className="h-28 w-full object-contain bg-background"
                                />
                              </div>
                            </div>
                          )}
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            Ref: <span className="font-medium text-foreground">{link.ref_text}</span>
                          </div>
                          <div className="flex items-center justify-end gap-2 px-3 pb-3">
                            <Button size="sm" variant="outline" onClick={() => setSelectedPageLinkId(null)}>
                              Close
                            </Button>
                            <Button size="sm" onClick={() => handleJumpToLinkedPage(link)}>
                              Open Sheet
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          {sidebarOpen && (
          <div className="w-96 border-l bg-background flex flex-col min-h-0">
            <Tabs defaultValue="plan-info" className="flex-1 min-h-0 grid grid-rows-[auto_minmax(0,1fr)] p-2 overflow-hidden gap-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="plan-info">Plan Info</TabsTrigger>
                <TabsTrigger value="markup">Markup</TabsTrigger>
                <TabsTrigger value="comments">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Comments
                </TabsTrigger>
              </TabsList>
              <div className="relative min-h-0 overflow-hidden">

            {/* Page Index Tab */}
            <TabsContent value="index" className="absolute inset-0 mt-0 overflow-hidden hidden data-[state=active]:flex data-[state=active]:flex-col">
              <div className="h-full min-h-0 flex flex-col overflow-hidden">
                <div className="shrink-0 px-4 pt-4 pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Page Index</h3>
                    <Button 
                      onClick={analyzePlan} 
                      disabled={analyzing}
                      variant="outline"
                      size="sm"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        pages.length === 0 ? "Analyze Plan" : "Re-analyze"
                      )}
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1 min-h-0 overflow-hidden px-4 py-3">
                  {pages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <p className="text-sm text-muted-foreground mb-4">
                        No page index yet
                      </p>
                      <p className="text-xs text-muted-foreground text-center max-w-xs">
                        Run plan analysis to auto-populate pages, then edit any page details below.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pages.map((page) => (
                        <div
                          key={page.id}
                          className={`p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                            currentPage === page.page_number ? "bg-accent" : ""
                          }`}
                          onClick={() => {
                            setCurrentPage(page.page_number);
                            setSearchParams({ page: page.page_number.toString() });
                          }}
                        >
                          {editingPage === page.id ? (
                            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                              <Input
                                value={page.sheet_number || ""}
                                onChange={(e) => setPages(pages.map(p =>
                                  p.id === page.id ? { ...p, sheet_number: e.target.value } : p
                                ))}
                                placeholder="Sheet Number"
                                className="text-sm"
                              />
                              <Input
                                value={page.page_title || ""}
                                onChange={(e) => setPages(pages.map(p =>
                                  p.id === page.id ? { ...p, page_title: e.target.value } : p
                                ))}
                                placeholder="Page Title"
                                className="text-sm"
                              />
                              <Input
                                value={page.discipline || ""}
                                onChange={(e) => setPages(pages.map(p =>
                                  p.id === page.id ? { ...p, discipline: e.target.value } : p
                                ))}
                                placeholder="Discipline"
                                className="text-sm"
                              />
                              <Textarea
                                value={page.page_description || ""}
                                onChange={(e) => setPages(pages.map(p =>
                                  p.id === page.id ? { ...p, page_description: e.target.value } : p
                                ))}
                                placeholder="Description"
                                rows={2}
                                className="text-sm"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdatePage(page.id, page)}
                                >
                                  <Save className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingPage(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="font-medium text-sm">
                                    {(page.sheet_number || `Page ${page.page_number}`)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{page.discipline}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingPage(page.id);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="font-medium text-sm">{page.page_title}</p>
                              {page.page_title && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {page.page_title}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Plan Set Information Tab */}
            <TabsContent value="plan-info" className="absolute inset-0 mt-0 overflow-hidden hidden data-[state=active]:flex data-[state=active]:flex-col">
              <div className="flex h-full min-h-0 flex-col">
                <div className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-3 pr-5">
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    <Button
                      onClick={analyzePlan}
                      disabled={analyzing}
                      variant="outline"
                      size="sm"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        pages.length === 0 ? "Analyze Plan" : "Re-analyze"
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setManagePagesOpen(true)}>
                      Update Plan Pages
                    </Button>
                    <Button size="sm" onClick={handleUpdatePlanInfo} disabled={planInfoSaving}>
                      {planInfoSaving ? "Saving..." : "Save Plan Set Info"}
                    </Button>
                  </div>
                </div>
                <ScrollArea className="flex-1 min-h-0 overflow-hidden">
                <div className="pl-4 pr-6 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Total Pages</Label>
                      <Input value={String(pages.length || 0)} readOnly className="text-sm bg-muted/40" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="drawer_plan_name">Plan Set Name</Label>
                      <Input
                        id="drawer_plan_name"
                        value={planInfoForm.plan_name}
                        onChange={(e) => setPlanInfoForm((prev) => ({ ...prev, plan_name: e.target.value }))}
                        placeholder="Plan set name"
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="drawer_plan_number">Plan Set #</Label>
                      <Input
                        id="drawer_plan_number"
                        value={planInfoForm.plan_number}
                        onChange={(e) => setPlanInfoForm((prev) => ({ ...prev, plan_number: e.target.value }))}
                        placeholder="A-101"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="drawer_revision">Revision</Label>
                      <Input
                        id="drawer_revision"
                        value={planInfoForm.revision}
                        onChange={(e) => setPlanInfoForm((prev) => ({ ...prev, revision: e.target.value }))}
                        placeholder="Rev 1"
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="drawer_architect">Architect / Design Engineer</Label>
                    <Input
                      id="drawer_architect"
                      value={planInfoForm.architect}
                      onChange={(e) => setPlanInfoForm((prev) => ({ ...prev, architect: e.target.value }))}
                      placeholder="Firm name"
                      className="text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 items-end">
                    <div className="space-y-2">
                      <Label htmlFor="drawer_revision_date">Revision Date</Label>
                      <Input
                        id="drawer_revision_date"
                        type="date"
                        value={planInfoForm.revision_date}
                        onChange={(e) => setPlanInfoForm((prev) => ({ ...prev, revision_date: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex items-center space-x-2 pb-2">
                      <Checkbox
                        id="drawer_is_permit_set"
                        checked={planInfoForm.is_permit_set}
                        onCheckedChange={(checked) => setPlanInfoForm((prev) => ({ ...prev, is_permit_set: checked === true }))}
                      />
                      <Label htmlFor="drawer_is_permit_set" className="text-sm cursor-pointer">
                        Permit Set
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="drawer_plan_description">Description</Label>
                    <Textarea
                      id="drawer_plan_description"
                      value={planInfoForm.description}
                      onChange={(e) => setPlanInfoForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="text-sm"
                      placeholder="Plan set notes or context"
                    />
                  </div>

                  <div className="pt-2 border-t space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold">Auto Sheet Links</h4>
                        <p className="text-xs text-muted-foreground">
                          {filteredPageLinks.length} detected link{filteredPageLinks.length === 1 ? "" : "s"} in this plan set
                        </p>
                      </div>
                      <div className="w-32">
                        <Select value={linkMinConfidence} onValueChange={setLinkMinConfidence}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All links</SelectItem>
                            <SelectItem value="0.7">High confidence</SelectItem>
                            <SelectItem value="0.85">Very high</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="rounded-md border">
                      <ScrollArea className="max-h-40">
                        <div className="divide-y">
                          {pages.map((page) => {
                            const count = autoLinkSummaryByPage.get(page.page_number) || 0;
                            if (count === 0) return null;
                            return (
                              <button
                                key={`auto-links-page-${page.id}`}
                                type="button"
                                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent"
                                onClick={() => {
                                  setCurrentPage(page.page_number);
                                  setSearchParams({ page: page.page_number.toString() });
                                }}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{page.sheet_number || `Page ${page.page_number}`}</p>
                                  <p className="text-xs text-muted-foreground truncate">{page.page_title || page.page_description || ""}</p>
                                </div>
                                <div className="ml-2 rounded-full border px-2 py-0.5 text-xs">
                                  {count}
                                </div>
                              </button>
                            );
                          })}
                          {filteredPageLinks.length === 0 && (
                            <div className="px-3 py-4 text-xs text-muted-foreground">
                              No auto links detected yet. Run Analyze / Re-analyze from Plan Info.
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>

                    <div className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Unresolved References
                        </h5>
                        <span className="text-xs text-muted-foreground">{unresolvedAutoRefs.length}</span>
                      </div>
                      {unresolvedAutoRefs.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {unresolvedAutoRefs.slice(0, 12).map((ref) => (
                            <button
                              key={`${ref.source_page_number}:${ref.ref_text}`}
                              type="button"
                              className="rounded-full border px-2 py-1 text-xs hover:bg-accent"
                              onClick={() => {
                                setCurrentPage(ref.source_page_number);
                                setSearchParams({ page: ref.source_page_number.toString() });
                              }}
                            >
                              {ref.ref_text} · p{ref.source_page_number}
                            </button>
                          ))}
                          {unresolvedAutoRefs.length > 12 && (
                            <span className="text-xs text-muted-foreground self-center">
                              +{unresolvedAutoRefs.length - 12} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No unresolved references from the latest analysis run.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Markup Tools Tab */}
            <TabsContent value="markup" className="absolute inset-0 mt-0 overflow-hidden hidden data-[state=active]:flex data-[state=active]:flex-col">
              <div className="h-full min-h-0 flex flex-col">
                <ScrollArea className="flex-1 min-h-0">
                  <div className="pl-4 pr-6 py-4 space-y-4">
                    <div className="rounded-lg border p-3 space-y-3">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Drawing Tools</label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant={activeTool === "select" ? "default" : "outline"}
                            onClick={() => setActiveTool("select")}
                            size="sm"
                          >
                            Select
                          </Button>
                          <Button
                            variant={activeTool === "pen" ? "default" : "outline"}
                            onClick={() => setActiveTool("pen")}
                            size="sm"
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Pen
                          </Button>
                          <Button variant="outline" onClick={() => handleAddShape("circle")} size="sm">
                            Circle
                          </Button>
                          <Button variant="outline" onClick={() => handleAddShape("line")} size="sm">
                            Line
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Measurement Tool</label>
                        <div className="space-y-2">
                          <Button
                            variant={activeTool === "measure" ? "default" : "outline"}
                            onClick={() => setActiveTool("measure")}
                            size="sm"
                            className="w-full"
                          >
                            <Ruler className="h-4 w-4 mr-2" />
                            Measure Distance
                          </Button>

                          {planScale ? (
                            <div className="p-2 bg-primary/10 rounded text-xs">
                              Scale: {planScale.realDistance} {scaleFormData.unit} = {planScale.pixelDistance.toFixed(0)}px
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                setActiveTool("measure");
                                setScaleDialogOpen(true);
                              }}
                            >
                              Set Scale
                            </Button>
                          )}

                          {activeTool === "measure" && (
                            <div className="p-2 bg-muted rounded text-xs">
                              {measurePoints.length === 0 && "Click first point"}
                              {measurePoints.length === 1 && "Click second point to measure"}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Color</label>
                        <div className="flex gap-2 flex-wrap">
                          {["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#000000"].map(
                            (color) => (
                              <button
                                key={color}
                                className={`w-8 h-8 rounded border-2 ${
                                  markupColor === color ? "border-primary" : "border-transparent"
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => setMarkupColor(color)}
                              />
                            )
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleSaveMarkup} className="flex-1">
                          Save Markup Layer
                        </Button>
                        <Button variant="outline" onClick={handleClearCanvas} title="Clear Draft Canvas">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3 space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold">Saved Markups</h3>
                        <p className="text-xs text-muted-foreground">
                          Select a saved markup to jump to that page and load it
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="saved-markup-select" className="text-xs">Markup</Label>
                        <Select
                          value={selectedMarkupId || undefined}
                          onValueChange={(value) => {
                            setSelectedMarkupId(value);
                            const selected = markups.find((m) => m.id === value);
                            if (selected) void handleLoadMarkupLayer(selected);
                          }}
                        >
                          <SelectTrigger id="saved-markup-select" className="w-full">
                            <SelectValue placeholder={markups.length ? "Select a markup layer" : "No saved markups"} />
                          </SelectTrigger>
                          <SelectContent>
                            {markups.map((markup) => (
                              <SelectItem key={markup.id} value={markup.id}>
                                {getMarkupLabel(markup)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {markups.length === 0
                          ? "Save a markup to create your first saved layer."
                          : `${markups.length} saved markup layer${markups.length === 1 ? "" : "s"} for this plan`}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Comments Tab */}
            <TabsContent value="comments" className="absolute inset-0 mt-0 overflow-hidden hidden data-[state=active]:flex data-[state=active]:flex-col">
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="pl-4 pr-6 py-4">
                  {currentPageComments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No comments yet. Click "Place Pin" below to add a comment.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {currentPageComments.map((comment) => (
                        <div key={comment.id} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-primary" />
                              <p className="font-medium text-sm">
                                {comment.profiles?.full_name || "Unknown User"}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(comment.created_at), "MMM d, h:mm a")}
                            </p>
                          </div>
                          <p className="text-sm">{comment.comment_text}</p>
                          {comment.x_position !== null && comment.y_position !== null && (
                            <p className="text-xs text-muted-foreground mt-1">
                              📍 Pinned on plan
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                </ScrollArea>
              </div>

              {/* Add Comment */}
              <div className="p-4 border-t space-y-2">
                {pendingCommentPosition && (
                  <div className="p-2 bg-primary/10 rounded text-xs text-primary">
                    📍 Pin placed! Write your comment below.
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant={activeTool === "comment" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setActiveTool(activeTool === "comment" ? "select" : "comment");
                      if (activeTool === "comment") {
                        setPendingCommentPosition(null);
                      }
                    }}
                    className="flex-1"
                  >
                    {activeTool === "comment" ? "Cancel Pin" : "Place Pin"}
                  </Button>
                </div>
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={
                    pendingCommentPosition
                      ? "Write your comment here..."
                      : "Click 'Place Pin' first, then click on the plan where you want to comment"
                  }
                  rows={3}
                  disabled={!pendingCommentPosition}
                />
                <Button
                  onClick={handleAddComment}
                  className="w-full"
                  disabled={!newComment.trim() || !pendingCommentPosition}
                >
                  Post Comment with Pin
                </Button>
              </div>
            </TabsContent>
              </div>
            </Tabs>
          </div>
          )}
        </div>
      </div>

      <Dialog open={managePagesOpen} onOpenChange={setManagePagesOpen}>
        <DialogContent className="max-w-6xl h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Update Plan Pages</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {pages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-sm text-muted-foreground mb-3">No pages indexed yet.</p>
                    <Button onClick={analyzePlan} disabled={analyzing} variant="outline">
                      {analyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        "Analyze Plan"
                      )}
                    </Button>
                  </div>
                ) : (
                  pages.map((page) => (
                    <div
                      key={`manage-page-${page.id}`}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                        currentPage === page.page_number ? "bg-accent" : ""
                      }`}
                      onClick={() => {
                        setCurrentPage(page.page_number);
                        setSearchParams({ page: page.page_number.toString() });
                      }}
                    >
                      {editingPage === page.id ? (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={page.sheet_number || ""}
                            onChange={(e) => setPages(pages.map(p =>
                              p.id === page.id ? { ...p, sheet_number: e.target.value } : p
                            ))}
                            placeholder="Sheet Number"
                            className="text-sm"
                          />
                          <Input
                            value={page.page_title || ""}
                            onChange={(e) => setPages(pages.map(p =>
                              p.id === page.id ? { ...p, page_title: e.target.value } : p
                            ))}
                            placeholder="Page Title"
                            className="text-sm"
                          />
                          <Input
                            value={page.discipline || ""}
                            onChange={(e) => setPages(pages.map(p =>
                              p.id === page.id ? { ...p, discipline: e.target.value } : p
                            ))}
                            placeholder="Discipline"
                            className="text-sm"
                          />
                          <Textarea
                            value={page.page_description || ""}
                            onChange={(e) => setPages(pages.map(p =>
                              p.id === page.id ? { ...p, page_description: e.target.value } : p
                            ))}
                            placeholder="Description"
                            rows={2}
                            className="text-sm"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleUpdatePage(page.id, page)}>
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingPage(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-sm">
                                {page.sheet_number || `Page ${page.page_number}`}
                              </p>
                              <p className="text-xs text-muted-foreground">{page.discipline}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPage(page.id);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="font-medium text-sm">{page.page_title}</p>
                          {page.page_description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {page.page_description}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManagePagesOpen(false)}>
              Save & Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scale Setting Dialog */}
      <Dialog open={scaleDialogOpen} onOpenChange={setScaleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Plan Scale</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click two points on the plan that represent a known distance, then enter that distance below.
            </p>
            
            {measurePoints.length === 2 && (
              <div className="p-2 bg-primary/10 rounded text-sm text-primary">
                ✓ Two points selected
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="knownDistance">Known Distance</Label>
              <Input
                id="knownDistance"
                type="number"
                step="0.01"
                value={scaleFormData.knownDistance}
                onChange={(e) => setScaleFormData({ ...scaleFormData, knownDistance: e.target.value })}
                placeholder="Enter distance"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Select
                value={scaleFormData.unit}
                onValueChange={(value) => setScaleFormData({ ...scaleFormData, unit: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="feet">Feet</SelectItem>
                  <SelectItem value="meters">Meters</SelectItem>
                  <SelectItem value="inches">Inches</SelectItem>
                  <SelectItem value="centimeters">Centimeters</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setScaleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetScale} disabled={measurePoints.length !== 2 || !scaleFormData.knownDistance}>
              Set Scale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
