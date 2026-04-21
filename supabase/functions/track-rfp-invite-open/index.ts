import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

const PIXEL_BYTES = Uint8Array.from([
  71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0,
  255, 255, 255, 33, 249, 4, 1, 0, 0, 0, 0, 44, 0, 0, 0, 0,
  1, 0, 1, 0, 0, 2, 2, 68, 1, 0, 59,
]);

const gifResponse = () =>
  new Response(PIXEL_BYTES, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL_BYTES.byteLength),
      ...corsHeaders,
    },
  });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return gifResponse();
    }

    const url = new URL(req.url);
    const rfpId = String(url.searchParams.get("rfpId") || "").trim();
    const vendorId = String(url.searchParams.get("vendorId") || "").trim();

    if (!rfpId || !vendorId) {
      return gifResponse();
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase
      .from("rfp_invited_vendors")
      .update({
        email_status: "opened",
        email_opened_at: new Date().toISOString(),
      })
      .eq("rfp_id", rfpId)
      .eq("vendor_id", vendorId)
      .is("email_opened_at", null);

    if (error) {
      console.error("Failed to track RFP invite open:", error);
    }
  } catch (error) {
    console.error("track-rfp-invite-open error:", error);
  }

  return gifResponse();
});
