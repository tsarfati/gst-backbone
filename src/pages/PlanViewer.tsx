import { useState, useEffect, useRef } from "react";
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
import { toast } from "sonner";
import { ArrowLeft, Loader2, MessageSquare, Pencil, Save, X, PanelRightClose } from "lucide-react";
import { Canvas as FabricCanvas, PencilBrush, Circle, Line } from "fabric";
import FullPagePdfViewer from "@/components/FullPagePdfViewer";
import { format } from "date-fns";

interface PlanPage {
  id: string;
  page_number: number;
  page_title: string | null;
  page_description: string | null;
  sheet_number: string | null;
  discipline: string | null;
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
}

export default function PlanViewer() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [plan, setPlan] = useState<any>(null);
  const [pages, setPages] = useState<PlanPage[]>([]);
  const [comments, setComments] = useState<PlanComment[]>([]);
  const [markups, setMarkups] = useState<PlanMarkup[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [activeTool, setActiveTool] = useState<"select" | "pen" | "circle" | "line" | "comment">("select");
  const [markupColor, setMarkupColor] = useState("#FF0000");
  const [pendingCommentPosition, setPendingCommentPosition] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (planId) {
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
    if (plan && pages.length === 0 && !analyzing) {
      analyzePlan();
    }
  }, [plan, pages]);

  // Initialize Fabric.js canvas for markups
  useEffect(() => {
    if (!canvasRef.current || !pdfContainerRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: pdfContainerRef.current.offsetWidth,
      height: pdfContainerRef.current.offsetHeight,
      backgroundColor: "transparent",
      isDrawingMode: false,
      selection: activeTool === "select",
    });

    fabricCanvasRef.current = canvas;

    // Handle canvas clicks for comment placement
    const handleCanvasClick = (e: any) => {
      if (activeTool === "comment" && e.pointer) {
        setPendingCommentPosition({
          x: e.pointer.x / canvas.width,
          y: e.pointer.y / canvas.height,
        });
      }
    };

    canvas.on("mouse:down", handleCanvasClick);

    return () => {
      canvas.off("mouse:down", handleCanvasClick);
      canvas.dispose();
    };
  }, [plan, activeTool]);

  // Handle markup tool changes
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    canvas.isDrawingMode = activeTool === "pen";
    canvas.selection = activeTool === "select";

    if (activeTool === "pen" && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.color = markupColor;
      canvas.freeDrawingBrush.width = 3;
    }

    // Change cursor for comment tool
    if (activeTool === "comment") {
      canvas.defaultCursor = "crosshair";
    } else {
      canvas.defaultCursor = "default";
    }
  }, [activeTool, markupColor]);

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

      const { data: pagesData, error: pagesError } = await supabase
        .from("plan_pages" as any)
        .select("*")
        .eq("plan_id", planId)
        .order("page_number");

      if (pagesError) throw pagesError;
      setPages((pagesData || []) as any);

      fetchComments();
      fetchMarkups();
    } catch (error) {
      console.error("Error fetching plan:", error);
      toast.error("Failed to load plan");
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("plan_comments" as any)
        .select(`
          *,
          profiles:user_id (full_name)
        `)
        .eq("plan_id", planId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComments((data || []) as any);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const fetchMarkups = async () => {
    try {
      const { data, error } = await supabase
        .from("plan_markups" as any)
        .select("*")
        .eq("plan_id", planId)
        .eq("page_number", currentPage);

      if (error) throw error;
      setMarkups((data || []) as any);
    } catch (error) {
      console.error("Error fetching markups:", error);
    }
  };

  const analyzePlan = async () => {
    setAnalyzing(true);
    try {
      console.log("Starting plan analysis...");
      
      const { data, error } = await supabase.functions.invoke("analyze-plan", {
        body: {
          planUrl: plan.file_url,
          planName: plan.plan_name,
        },
      });

      console.log("Analysis response:", { data, error });

      if (error) {
        console.error("Edge function error:", error);
        toast.error(`Analysis failed: ${error.message}`);
        return;
      }

      if (data?.error) {
        console.error("API error:", data.error);
        toast.error(data.error);
        return;
      }

      if (!data?.pages || data.pages.length === 0) {
        toast.error("No pages were extracted from the plan");
        return;
      }

      // Insert pages into database
      const pagesToInsert = data.pages.map((page: any) => ({
        plan_id: planId,
        page_number: page.page_number,
        page_title: page.page_title,
        page_description: page.page_description,
        sheet_number: page.sheet_number || null,
        discipline: page.discipline || null,
      }));

      console.log("Inserting pages:", pagesToInsert);

      const { error: insertError } = await supabase
        .from("plan_pages" as any)
        .insert(pagesToInsert);

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }

      await fetchPlanData();
      toast.success(`Plan analyzed successfully - ${data.pages.length} pages found`);
    } catch (error: any) {
      console.error("Error analyzing plan:", error);
      toast.error(error.message || "Failed to analyze plan");
    } finally {
      setAnalyzing(false);
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

  const currentPageData = pages.find(p => p.page_number === currentPage);
  const currentPageComments = comments.filter(c => c.page_number === currentPage);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex flex-col h-screen bg-background w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="font-semibold">{plan.plan_name}</h1>
              {plan.plan_number && (
                <p className="text-sm text-muted-foreground">Plan #: {plan.plan_number}</p>
              )}
            </div>
          </div>

          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            {analyzing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing plan...
              </div>
            )}
            {pages.length > 0 && (
              <Select
                value={currentPage.toString()}
                onValueChange={(value) => {
                  setCurrentPage(parseInt(value));
                  setSearchParams({ page: value });
                }}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((page) => (
                    <SelectItem key={page.id} value={page.page_number.toString()}>
                      Page {page.page_number}
                      {page.sheet_number && ` - ${page.sheet_number}`}
                      {page.page_title && ` - ${page.page_title}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <SidebarTrigger>
              <Button variant="outline" size="sm">
                <PanelRightClose className="h-4 w-4" />
              </Button>
            </SidebarTrigger>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* PDF Viewer with Markup Canvas */}
          <div className="flex-1 relative" ref={pdfContainerRef}>
            <div className="absolute inset-0 z-10 pointer-events-none">
              <canvas ref={canvasRef} className="pointer-events-auto" />
            </div>
            <FullPagePdfViewer
              file={{ name: plan.file_name, url: plan.file_url }}
              onBack={() => navigate(-1)}
              hideBackButton={true}
            />
          </div>

          {/* Right Sidebar */}
          <Sidebar side="right" className="border-l" collapsible="offcanvas">
            <SidebarContent>
              <Tabs defaultValue="index" className="h-full flex flex-col p-2">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="index">Index</TabsTrigger>
                  <TabsTrigger value="markup">Markup</TabsTrigger>
                  <TabsTrigger value="comments">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Comments
                  </TabsTrigger>
                </TabsList>

            {/* Page Index Tab */}
            <TabsContent value="index" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full p-4">
                {pages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-sm text-muted-foreground mb-4">
                      No page index yet
                    </p>
                    <Button onClick={analyzePlan} disabled={analyzing}>
                      {analyzing ? "Analyzing..." : "Analyze Plan"}
                    </Button>
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
                                  Page {page.page_number}
                                  {page.sheet_number && ` - ${page.sheet_number}`}
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
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Markup Tools Tab */}
            <TabsContent value="markup" className="flex-1 overflow-hidden">
              <div className="p-4 space-y-4">
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
                    <Button
                      variant="outline"
                      onClick={() => handleAddShape("circle")}
                      size="sm"
                    >
                      Circle
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAddShape("line")}
                      size="sm"
                    >
                      Line
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Color</label>
                  <div className="flex gap-2">
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
                    Save Markup
                  </Button>
                  <Button variant="outline" onClick={handleClearCanvas}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {markups.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium mb-2">Saved Markups</h3>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {markups.map((markup) => (
                          <div key={markup.id} className="p-2 border rounded text-xs">
                            <p className="text-muted-foreground">
                              {format(new Date(markup.created_at), "MMM d, yyyy h:mm a")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Comments Tab */}
            <TabsContent value="comments" className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full p-4">
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
            </Tabs>
          </SidebarContent>
        </Sidebar>
        </div>
      </div>
    </SidebarProvider>
  );
}