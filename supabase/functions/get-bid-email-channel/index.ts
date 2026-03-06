import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  bidId: string;
}

const randomSuffix = () => Math.random().toString(36).slice(2, 8);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const inboundDomain = Deno.env.get("BID_EMAIL_INBOUND_DOMAIN") || "send.builderlynk.com";
    if (!supabaseUrl || !serviceRole) throw new Error("Missing required environment variables");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, serviceRole);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { bidId }: RequestBody = await req.json();
    if (!bidId) {
      return new Response(JSON.stringify({ error: "bidId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: bidRow, error: bidError } = await supabase
      .from("bids")
      .select("id, company_id, vendor_id")
      .eq("id", bidId)
      .single();
    if (bidError || !bidRow) throw bidError || new Error("Bid not found");

    const { data: access } = await supabase
      .from("user_company_access")
      .select("role, is_active")
      .eq("user_id", userData.user.id)
      .eq("company_id", (bidRow as any).company_id)
      .maybeSingle();
    const role = String((access as any)?.role || "");
    if (!access || access.is_active === false || role === "vendor" || role === "design_professional") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let { data: channel } = await supabase
      .from("bid_email_channels")
      .select("id, tracking_email")
      .eq("bid_id", bidId)
      .maybeSingle();

    if (!channel) {
      const localPart = `bid-${bidId.slice(0, 8)}-${randomSuffix()}`;
      const trackingEmail = `${localPart}@${inboundDomain}`.toLowerCase();
      const { data: inserted, error: insertError } = await supabase
        .from("bid_email_channels")
        .insert({
          bid_id: bidId,
          company_id: (bidRow as any).company_id,
          vendor_id: (bidRow as any).vendor_id,
          tracking_local_part: localPart,
          tracking_email: trackingEmail,
          created_by: userData.user.id,
        })
        .select("id, tracking_email")
        .single();
      if (insertError) throw insertError;
      channel = inserted;
    }

    return new Response(
      JSON.stringify({
        success: true,
        trackingEmail: (channel as any).tracking_email,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("get-bid-email-channel error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
