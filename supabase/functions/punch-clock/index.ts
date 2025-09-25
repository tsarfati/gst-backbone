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
  if (!pin || pin.trim().length !== 6) return null;
  
  // Normalize PIN to ensure consistent format
  pin = pin.trim();
  
  // First check regular profiles table
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, first_name, last_name, role')
    .eq('pin_code', pin)
    .maybeSingle();

  if (profileData && !profileError) {
    return {
      user_id: profileData.user_id,
      first_name: profileData.first_name,
      last_name: profileData.last_name,
      role: profileData.role,
      is_pin_employee: false
    };
  }

  // Then check PIN employees table
  const { data: pinEmployeeData, error: pinError } = await supabaseAdmin
    .from('pin_employees')
    .select('id, first_name, last_name, display_name')
    .eq('pin_code', pin)
    .eq('is_active', true)
    .maybeSingle();

  if (pinEmployeeData && !pinError) {
    return {
      user_id: pinEmployeeData.id,
      first_name: pinEmployeeData.first_name,
      last_name: pinEmployeeData.last_name,
      role: 'employee',
      is_pin_employee: true
    };
  }

  return null;
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

        // Check if user is already punched in
        const { data: existingPunch, error: checkErr } = await supabaseAdmin
          .from("current_punch_status")
          .select("*")
          .eq("user_id", userRow.user_id)
          .eq("is_active", true)
          .maybeSingle();
        
        if (checkErr) return errorResponse(checkErr.message, 500);
        if (existingPunch) return errorResponse("User is already punched in", 400);

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

        const { error: statusErr } = await supabaseAdmin
          .from("current_punch_status")
          .upsert({
            user_id: userRow.user_id,
            job_id,
            cost_code_id,
            punch_in_time: now,
            punch_in_location_lat: latitude,
            punch_in_location_lng: longitude,
            punch_in_photo_url: photo_url,
            is_active: true,
          }, { onConflict: 'user_id' });
        if (statusErr) return errorResponse(statusErr.message, 500);

        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      if (action === "out") {
        console.log(`Punch out attempt for user ${userRow.user_id}`);
        
        // Load current status
        const { data: currentPunch, error: curErr } = await supabaseAdmin
          .from("current_punch_status")
          .select("*")
          .eq("user_id", userRow.user_id)
          .eq("is_active", true)
          .maybeSingle();
          
        if (curErr) {
          console.error("Error loading current punch status:", curErr);
          return errorResponse(curErr.message, 500);
        }
        if (!currentPunch) {
          console.log(`No active punch found for user ${userRow.user_id}`);
          return errorResponse("User is not currently punched in", 400);
        }

        console.log(`Found active punch for user ${userRow.user_id}, job: ${currentPunch.job_id}`);

        // Insert punch out record
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
        
        if (punchErr) {
          console.error("Error inserting punch out record:", punchErr);
          return errorResponse(punchErr.message, 500);
        }

        console.log(`Punch out record created for user ${userRow.user_id}`);

        // Update current status to inactive
        const { error: statusErr } = await supabaseAdmin
          .from("current_punch_status")
          .update({ is_active: false })
          .eq("user_id", userRow.user_id)
          .eq("is_active", true);
          
        if (statusErr) {
          console.error("Error updating punch status:", statusErr);
          return errorResponse(statusErr.message, 500);
        }

        console.log(`Punch out completed successfully for user ${userRow.user_id}`);
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
