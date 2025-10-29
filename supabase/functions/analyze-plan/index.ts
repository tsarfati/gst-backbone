import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { planUrl, planName } = await req.json();
    
    if (!planUrl) {
      return new Response(
        JSON.stringify({ error: "Plan URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analyzing plan:", planName, planUrl);

    // Fetch the PDF to get metadata
    const pdfResponse = await fetch(planUrl);
    if (!pdfResponse.ok) {
      throw new Error("Failed to fetch PDF");
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log("PDF size:", pdfBuffer.byteLength, "bytes");

    // Use pdf.js to parse the PDF and count pages
    // Import pdf.js for Deno
    const pdfjs = await import("https://esm.sh/pdfjs-dist@3.11.174/build/pdf.mjs");
    
    // Load the PDF document
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    console.log("PDF has", numPages, "pages");

    // For now, create basic page entries without AI analysis
    // Users can edit these manually
    const pages = [];
    for (let i = 1; i <= numPages; i++) {
      pages.push({
        page_number: i,
        sheet_number: `Page ${i}`,
        page_title: `Sheet ${i}`,
        discipline: "General",
        page_description: `Page ${i} of ${planName}`,
      });
    }

    await pdf.destroy();

    return new Response(
      JSON.stringify({ pages }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error analyzing plan:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});