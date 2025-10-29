import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch the PDF from the URL
    const pdfResponse = await fetch(planUrl);
    if (!pdfResponse.ok) {
      throw new Error("Failed to fetch PDF");
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    // Call Lovable AI to analyze the PDF
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a construction plan analyzer. Analyze the provided PDF construction plan and extract a detailed index of all pages. For each page, identify:
- Page number
- Sheet number (if visible, e.g., A-101, S-201)
- Page title/description
- Discipline (e.g., Architectural, Structural, Mechanical, Electrical, Plumbing, Civil)
- Brief description of what the page shows

Return ONLY a JSON array with this exact structure:
[
  {
    "page_number": 1,
    "sheet_number": "A-101",
    "page_title": "Site Plan",
    "discipline": "Architectural",
    "page_description": "Overall site layout showing building placement and property boundaries"
  }
]`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this construction plan: "${planName}". Extract the page index.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64Pdf}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_plan_index",
              description: "Extract the page index from construction plans",
              parameters: {
                type: "object",
                properties: {
                  pages: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        page_number: { type: "integer" },
                        sheet_number: { type: "string" },
                        page_title: { type: "string" },
                        discipline: { type: "string" },
                        page_description: { type: "string" }
                      },
                      required: ["page_number", "page_title", "discipline"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["pages"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_plan_index" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "No analysis data returned from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const functionArgs = JSON.parse(toolCall.function.arguments);
    const pages = functionArgs.pages || [];

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