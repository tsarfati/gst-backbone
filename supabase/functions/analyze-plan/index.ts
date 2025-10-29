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

    // Return a simple success response
    // The client-side fallback will handle actual page extraction
    const pages = [{
      page_number: 1,
      sheet_number: "Page 1",
      page_title: "Sheet 1",
      discipline: "General",
      page_description: `Page 1 of ${planName}`,
    }];

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