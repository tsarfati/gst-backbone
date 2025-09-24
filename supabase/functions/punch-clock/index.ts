// Supabase Edge Function: punch-clock
// Enables PIN-authenticated punch clock operations without a Supabase auth session
// Endpoints:
// - GET /init?pin=XXXXXX -> returns { jobs, cost_codes, current_punch }
// - POST /punch { pin, action: 'in'|'out', job_id?, cost_code_id?, latitude?, longitude?, photo_url? }
//   -> performs punch in/out and returns { ok: true }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function validatePin(supabaseAdmin: any, pin: string) {
  if (!pin || pin.length !== 6) return null;
  const { data, error } = await supabaseAdmin.rpc("validate_pin", { p_pin: pin });
  if (error || !data || !data[0]) return null;
  return data[0]; // { user_id, first_name, last_name, role }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    if (req.method === "GET" && url.pathname.endsWith("/init")) {
      const pin = url.searchParams.get("pin") || "";
      const userRow = await validatePin(supabaseAdmin, pin);
      if (!userRow) return errorResponse("Invalid PIN", 401);

      // Load active jobs and cost codes
      const [{ data: jobs, error: jobsErr }, { data: costCodes, error: ccErr }] = await Promise.all([
        supabaseAdmin.from("jobs").select("id, name, address").eq("status", "active").order("name"),
        supabaseAdmin.from("cost_codes").select("id, code, description").eq("is_active", true).order("code"),
      ]);
      if (jobsErr) return errorResponse(jobsErr.message, 500);
      if (ccErr) return errorResponse(ccErr.message, 500);

      const { data: currentPunch, error: curErr } = await supabaseAdmin
        .from("current_punch_status")
        .select("*")
        .eq("user_id", userRow.user_id)
        .eq("is_active", true)
        .maybeSingle();
      if (curErr) return errorResponse(curErr.message, 500);

      return new Response(JSON.stringify({ jobs: jobs || [], cost_codes: costCodes || [], current_punch: currentPunch || null }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (req.method === "POST" && url.pathname.endsWith("/punch")) {
      const body = await req.json();
      const { pin, action, job_id, cost_code_id, latitude, longitude, photo_url } = body || {};
      const userRow = await validatePin(supabaseAdmin, pin);
      if (!userRow) return errorResponse("Invalid PIN", 401);

      const now = new Date().toISOString();

      if (action === "in") {
        if (!job_id || !cost_code_id) return errorResponse("Missing job_id or cost_code_id");

        const { error: punchErr } = await supabaseAdmin.from("punch_records").insert({
          user_id: userRow.user_id,
          job_id,
          cost_code_id,
          punch_type: "punched_in",
          punch_time: now,
          latitude,
          longitude,
          photo_url,
        });
        if (punchErr) return errorResponse(punchErr.message, 500);

        const { error: statusErr } = await supabaseAdmin.from("current_punch_status").insert({
          user_id: userRow.user_id,
          job_id,
          cost_code_id,
          punch_in_time: now,
          punch_in_location_lat: latitude,
          punch_in_location_lng: longitude,
          punch_in_photo_url: photo_url,
        });
        if (statusErr) return errorResponse(statusErr.message, 500);

        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      if (action === "out") {
        // Load current status
        const { data: currentPunch, error: curErr } = await supabaseAdmin
          .from("current_punch_status")
          .select("*")
          .eq("user_id", userRow.user_id)
          .eq("is_active", true)
          .maybeSingle();
        if (curErr) return errorResponse(curErr.message, 500);

        const { error: punchErr } = await supabaseAdmin.from("punch_records").insert({
          user_id: userRow.user_id,
          job_id: currentPunch?.job_id ?? null,
          cost_code_id: currentPunch?.cost_code_id ?? null,
          punch_type: "punched_out",
          punch_time: now,
          latitude,
          longitude,
          photo_url,
        });
        if (punchErr) return errorResponse(punchErr.message, 500);

        const { error: statusErr } = await supabaseAdmin
          .from("current_punch_status")
          .update({ is_active: false })
          .eq("user_id", userRow.user_id)
          .eq("is_active", true);
        if (statusErr) return errorResponse(statusErr.message, 500);

        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      return errorResponse("Invalid action. Use 'in' or 'out'", 400);
    }

    return new Response(JSON.stringify({ message: "Punch Clock Function" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Unexpected error", 500);
  }
});
