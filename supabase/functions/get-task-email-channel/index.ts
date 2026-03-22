import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  taskId: string;
}

const randomSuffix = () => Math.random().toString(36).slice(2, 8);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const inboundDomain = Deno.env.get("TASK_EMAIL_INBOUND_DOMAIN") || "send.builderlynk.com";
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

    const { taskId }: RequestBody = await req.json();
    if (!taskId) {
      return new Response(JSON.stringify({ error: "taskId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: taskRow, error: taskError } = await supabase
      .from("tasks")
      .select("id, company_id")
      .eq("id", taskId)
      .single();
    if (taskError || !taskRow) throw taskError || new Error("Task not found");

    const { data: access } = await supabase
      .from("user_company_access")
      .select("role, is_active")
      .eq("user_id", userData.user.id)
      .eq("company_id", (taskRow as any).company_id)
      .maybeSingle();
    const role = String((access as any)?.role || "");
    if (!access || access.is_active === false || role === "vendor" || role === "design_professional") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let { data: channel } = await supabase
      .from("task_email_channels")
      .select("id, tracking_email")
      .eq("task_id", taskId)
      .maybeSingle();

    if (!channel) {
      const localPart = `task-${taskId.slice(0, 8)}-${randomSuffix()}`;
      const trackingEmail = `${localPart}@${inboundDomain}`.toLowerCase();
      const { data: inserted, error: insertError } = await supabase
        .from("task_email_channels")
        .insert({
          task_id: taskId,
          company_id: (taskRow as any).company_id,
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
    console.error("get-task-email-channel error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
