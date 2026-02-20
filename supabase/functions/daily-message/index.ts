import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const companyId = url.searchParams.get("company_id");

    if (!type || !companyId) {
      return new Response(
        JSON.stringify({ error: "Missing type or company_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["joke", "riddle", "quote"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid type. Must be joke, riddle, or quote" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // For quotes, we can skip caching or use short cache
    const today = new Date().toISOString().split("T")[0];

    if (type !== "quote") {
      // Check cache for jokes/riddles
      const { data: cached } = await supabase
        .from("daily_messages")
        .select("*")
        .eq("company_id", companyId)
        .eq("message_date", today)
        .eq("message_type", type)
        .maybeSingle();

      if (cached) {
        return new Response(
          JSON.stringify({ question: cached.question, answer: cached.answer, type: cached.message_type }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate content using Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback to hardcoded content if no API key
      const fallback = getFallbackContent(type);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = getPrompt(type);
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a helpful assistant that generates content for construction workers. Keep it clean, family-friendly, and work-appropriate. Always respond with valid JSON only, no markdown." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_message",
              description: "Return the generated message content",
              parameters: {
                type: "object",
                properties: {
                  question: { type: "string", description: "The joke setup, riddle, or quote text" },
                  answer: { type: "string", description: "The punchline, riddle answer, or quote attribution" },
                },
                required: ["question", "answer"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_message" } },
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI gateway error:", aiResponse.status, await aiResponse.text());
      const fallback = getFallbackContent(type);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let content: { question: string; answer: string };

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        content = JSON.parse(toolCall.function.arguments);
      } else {
        throw new Error("No tool call in response");
      }
    } catch {
      console.error("Failed to parse AI response, using fallback");
      const fallback = getFallbackContent(type);
      content = fallback;
    }

    // Cache jokes and riddles (not quotes)
    if (type !== "quote") {
      const { error: insertError } = await supabase.from("daily_messages").upsert(
        {
          company_id: companyId,
          message_date: today,
          message_type: type,
          question: content.question,
          answer: content.answer,
        },
        { onConflict: "company_id,message_date,message_type" }
      );
      if (insertError) {
        console.error("Cache insert error:", insertError);
      }
    }

    return new Response(
      JSON.stringify({ question: content.question, answer: content.answer, type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("daily-message error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getPrompt(type: string): string {
  switch (type) {
    case "joke":
      return 'Generate a funny, clean, work-appropriate joke suitable for construction workers starting their day. Return the setup as "question" and the punchline as "answer".';
    case "riddle":
      return 'Generate a fun, clean riddle suitable for construction workers. Return the riddle as "question" and the solution as "answer".';
    case "quote":
      return 'Generate an inspirational or motivational quote suitable for hardworking construction professionals. Return the quote text as "question" and the attribution (author name) as "answer".';
    default:
      return 'Generate a motivational quote. Return as "question" (the quote) and "answer" (the author).';
  }
}

function getFallbackContent(type: string): { question: string; answer: string; type: string } {
  switch (type) {
    case "joke":
      return { question: "Why did the construction worker break up with the calculator?", answer: "Because he felt like she was always trying to divide them!", type: "joke" };
    case "riddle":
      return { question: "I have a head and a tail but no body. What am I?", answer: "A nail!", type: "riddle" };
    case "quote":
      return { question: "The only way to do great work is to love what you do.", answer: "Steve Jobs", type: "quote" };
    default:
      return { question: "Every day is a new opportunity to build something great.", answer: "Unknown", type };
  }
}
