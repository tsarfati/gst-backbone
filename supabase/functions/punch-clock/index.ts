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
    .select('id, first_name, last_name, display_name, avatar_url')
    .eq('pin_code', pin)
    .eq('is_active', true)
    .maybeSingle();

  if (pinEmployeeData && !pinError) {
    return {
      user_id: pinEmployeeData.id,
      first_name: pinEmployeeData.first_name,
      last_name: pinEmployeeData.last_name,
      role: 'employee',
      is_pin_employee: true,
      existing_avatar: pinEmployeeData.avatar_url
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

      // Load user's assigned jobs and cost codes across all companies
      let assignedJobs: string[] = [];
      let assignedCostCodes: string[] = [];
      
      if (userRow.is_pin_employee) {
        // For PIN employees, get all assigned jobs and cost codes across all companies
        const { data: allSettings } = await supabaseAdmin
          .from('pin_employee_timecard_settings')
          .select('assigned_jobs, assigned_cost_codes')
          .eq('pin_employee_id', userRow.user_id);
        
        // Merge all assigned jobs and cost codes from all companies
        if (allSettings && allSettings.length > 0) {
          const allJobs = new Set<string>();
          const allCostCodes = new Set<string>();
          
          for (const setting of allSettings) {
            (setting.assigned_jobs || []).forEach((j: string) => allJobs.add(j));
            (setting.assigned_cost_codes || []).forEach((c: string) => allCostCodes.add(c));
          }
          
          assignedJobs = Array.from(allJobs);
          assignedCostCodes = Array.from(allCostCodes);
        }
      }

      // Load jobs - filter by assignments only (across all companies)
      let jobsQuery = supabaseAdmin
        .from("jobs")
        .select("id, name, address, status")
        .in("status", ["active", "planning"])
        .order("name");
      
      if (userRow.is_pin_employee && assignedJobs.length > 0) {
        jobsQuery = jobsQuery.in("id", assignedJobs);
      }
      
      const { data: jobs, error: jobsErr } = await jobsQuery;
      if (jobsErr) return errorResponse(jobsErr.message, 500);

      // Load cost codes - filter by assignments and type=labor only
      let costCodesQuery = supabaseAdmin
        .from("cost_codes")
        .select("id, code, description, job_id")
        .eq("is_active", true)
        .eq("type", "labor")
        .order("code");
      
      if (userRow.is_pin_employee && assignedCostCodes.length > 0) {
        costCodesQuery = costCodesQuery.in("id", assignedCostCodes);
      }
      
      const { data: costCodes, error: ccErr } = await costCodesQuery;
      if (ccErr) return errorResponse(ccErr.message, 500);

      const { data: currentPunch, error: curErr } = await supabaseAdmin
        .from("current_punch_status")
        .select("*")
        .eq("user_id", userRow.user_id)
        .eq("is_active", true)
        .maybeSingle();
      if (curErr) return errorResponse(curErr.message, 500);

      return new Response(JSON.stringify({ 
        jobs: jobs || [], 
        cost_codes: costCodes || [], 
        current_punch: currentPunch || null 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (req.method === "POST" && url.pathname.endsWith("/upload-photo")) {
      try {
        const body = await req.json();
        const { pin, image } = body || {};
        if (!pin || !image) return errorResponse("Missing pin or image", 400);

        const userRow = await validatePin(supabaseAdmin, pin);
        if (!userRow) return errorResponse("Invalid PIN", 401);

        // Decode base64 image (no data URL prefix expected; strip if present)
        const base64 = (typeof image === 'string' && image.includes(',')) ? image.split(',')[1] : image;
        let bytes: Uint8Array;
        try {
          const binary = atob(base64);
          bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        } catch (_e) {
          console.error('Invalid image encoding provided to /upload-photo');
          return errorResponse("Invalid image encoding", 400);
        }

        const fileName = `${userRow.user_id}-${Date.now()}.jpg`;
        const filePath = `punch-photos/${fileName}`;

        // Use Blob for better compatibility with storage API in Edge runtime
        const fileBlob = new Blob([bytes], { type: 'image/jpeg' });

        const { error: uploadErr } = await supabaseAdmin.storage
          .from('punch-photos')
          .upload(filePath, fileBlob, { contentType: 'image/jpeg', upsert: false });
        if (uploadErr) {
          console.error('Storage upload error in /upload-photo:', uploadErr);
          return errorResponse(uploadErr.message, 500);
        }

        const { data: pub } = await supabaseAdmin.storage
          .from('punch-photos')
          .getPublicUrl(filePath);

        console.log('Photo uploaded for', userRow.user_id, '->', pub.publicUrl);
        return new Response(JSON.stringify({ publicUrl: pub.publicUrl, path: filePath }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        return errorResponse((e as Error).message || 'Upload failed', 500);
      }
    } else if (req.method === "POST" && url.pathname.endsWith("/punch")) {
      const body = await req.json();
      let { pin, action, job_id, cost_code_id, latitude, longitude, photo_url, image } = body || {};
      const userRow = await validatePin(supabaseAdmin, pin);
      if (!userRow) return errorResponse("Invalid PIN", 401);

      // If a base64 image is provided but no photo_url, upload it now and set photo_url
      try {
        if (!photo_url && image) {
          // Normalize base64 (strip data URL prefix if present)
          const base64 = (typeof image === 'string' && image.includes(',')) ? image.split(',')[1] : image;
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

          const fileName = `${userRow.user_id}-${Date.now()}.jpg`;
          const filePath = `punch-photos/${fileName}`;
          const fileBlob = new Blob([bytes], { type: 'image/jpeg' });

          const { error: uploadErr } = await supabaseAdmin.storage
            .from('punch-photos')
            .upload(filePath, fileBlob, { contentType: 'image/jpeg', upsert: false });
          if (!uploadErr) {
            const { data: pub } = await supabaseAdmin.storage
              .from('punch-photos')
              .getPublicUrl(filePath);
            photo_url = pub?.publicUrl || null;
          } else {
            console.error('Failed to upload inline image in /punch:', uploadErr);
          }
        }
      } catch (e) {
        console.error('Inline image processing error:', e);
      }

      // Get company_id for the user
      let companyId: string | null = null;
      if (userRow.is_pin_employee) {
        const { data: companyAccess } = await supabaseAdmin
          .from('user_company_access')
          .select('company_id')
          .eq('user_id', userRow.user_id)
          .limit(1)
          .maybeSingle();
        companyId = companyAccess?.company_id || null;
      } else {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('current_company_id')
          .eq('user_id', userRow.user_id)
          .maybeSingle();
        companyId = profile?.current_company_id || null;
      }

      if (!companyId) return errorResponse("Unable to determine company", 400);

      const now = new Date().toISOString();

      if (action === "in") {
        if (!job_id || !cost_code_id) return errorResponse("Missing job_id or cost_code_id");

        // Load punch clock settings for this job to check photo requirements
        const { data: jobSettings, error: settingsErr } = await supabaseAdmin
          .from("job_punch_clock_settings")
          .select("require_photo, require_location")
          .eq("job_id", job_id)
          .maybeSingle();

        // Also load company-wide punch clock settings as fallback
        const { data: companySettings, error: companySettingsErr } = await supabaseAdmin
          .from("punch_clock_settings")
          .select("require_photo, require_location, company_id")
          .limit(1)
          .maybeSingle();

        if (settingsErr) {
          console.error("Error loading job settings:", settingsErr);
        }
        if (companySettingsErr) {
          console.error("Error loading company settings:", companySettingsErr);
        }

        // Use job-specific settings first, fall back to company settings
        const photoRequired = jobSettings?.require_photo ?? companySettings?.require_photo ?? false;
        const locationRequired = jobSettings?.require_location ?? companySettings?.require_location ?? false;

        // Check photo requirement
        if (photoRequired && !photo_url) {
          return errorResponse("Photo is required for this job", 400);
        }

        // Check location requirement
        if (locationRequired && (!latitude || !longitude)) {
          return errorResponse("Location is required for this job", 400);
        }

        // Check if user is already punched in
        const { data: existingPunch, error: checkErr } = await supabaseAdmin
          .from("current_punch_status")
          .select("*")
          .eq("user_id", userRow.user_id)
          .eq("is_active", true)
          .maybeSingle();
        
        if (checkErr) return errorResponse(checkErr.message, 500);
        if (existingPunch) return errorResponse("User is already punched in", 400);

        // Capture device and network information
        const userAgent = req.headers.get('user-agent') || null;
        const ipAddress = req.headers.get('x-forwarded-for') || 
                         req.headers.get('x-real-ip') || 
                         req.headers.get('cf-connecting-ip') || 
                         null;

        const { error: punchErr } = await supabaseAdmin.from("punch_records").insert({
          user_id: userRow.user_id,
          company_id: companyId,
          job_id,
          cost_code_id,
          punch_type: "punched_in",
          punch_time: now,
          latitude,
          longitude,
          photo_url,
          user_agent: userAgent,
          ip_address: ipAddress,
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
          
        // Update PIN employee avatar if they don't have one but took a photo
        if (userRow.is_pin_employee && photo_url && !userRow.existing_avatar) {
          await supabaseAdmin
            .from('pin_employees')
            .update({ avatar_url: photo_url })
            .eq('id', userRow.user_id);
        }
        if (statusErr) return errorResponse(statusErr.message, 500);

        // Update PIN employee avatar with punch photo if applicable
        if (userRow.is_pin_employee && photo_url) {
          await supabaseAdmin
            .from('pin_employees')
            .update({ avatar_url: photo_url })
            .eq('id', userRow.user_id);
        }

        // Return the updated current punch status
        const { data: updatedPunch } = await supabaseAdmin
          .from("current_punch_status")
          .select("*")
          .eq("user_id", userRow.user_id)
          .eq("is_active", true)
          .maybeSingle();

        return new Response(JSON.stringify({ ok: true, current_punch: updatedPunch }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
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

        // Load punch clock settings for this job to check photo requirements
        const { data: jobSettings, error: settingsErr } = await supabaseAdmin
          .from("job_punch_clock_settings")
          .select("require_photo, require_location")
          .eq("job_id", currentPunch.job_id)
          .maybeSingle();

        // Also load company-wide punch clock settings as fallback
        const { data: companySettings, error: companySettingsErr } = await supabaseAdmin
          .from("punch_clock_settings")
          .select("require_photo, require_location, company_id")
          .limit(1)
          .maybeSingle();

        if (settingsErr) {
          console.error("Error loading job settings:", settingsErr);
        }
        if (companySettingsErr) {
          console.error("Error loading company settings:", companySettingsErr);
        }

        // Use job-specific settings first, fall back to company settings
        const photoRequired = jobSettings?.require_photo ?? companySettings?.require_photo ?? false;
        const locationRequired = jobSettings?.require_location ?? companySettings?.require_location ?? false;

        // Check photo requirement for punch out
        if (photoRequired && !photo_url) {
          return errorResponse("Photo is required for punch out on this job", 400);
        }

        // Check location requirement for punch out
        if (locationRequired && (!latitude || !longitude)) {
          return errorResponse("Location is required for punch out on this job", 400);
        }

        // Capture device and network information
        const userAgent = req.headers.get('user-agent') || null;
        const ipAddress = req.headers.get('x-forwarded-for') || 
                         req.headers.get('x-real-ip') || 
                         req.headers.get('cf-connecting-ip') || 
                         null;

        // Insert punch out record
        const { error: punchErr } = await supabaseAdmin.from("punch_records").insert({
          user_id: userRow.user_id,
          company_id: companyId,
          job_id: currentPunch?.job_id ?? null,
          cost_code_id: currentPunch?.cost_code_id ?? null,
          punch_type: "punched_out",
          punch_time: now,
          latitude,
          longitude,
          photo_url,
          user_agent: userAgent,
          ip_address: ipAddress,
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

        // Create corresponding time card entry
        try {
          const punchInDate = new Date(currentPunch.punch_in_time);
          const punchOutDate = new Date(now);
          let totalHours = Math.max(0, (punchOutDate.getTime() - punchInDate.getTime()) / (1000 * 60 * 60));
          const breakMinutes = totalHours > 6 ? 30 : 0; // auto 30-min break if over 6 hours
          totalHours = totalHours - breakMinutes / 60;
          const overtimeHours = Math.max(0, totalHours - 8);

          const { error: tcErr } = await supabaseAdmin
            .from('time_cards')
            .insert({
              user_id: userRow.user_id,
              company_id: companyId,
              job_id: currentPunch.job_id,
              cost_code_id: currentPunch.cost_code_id,
              punch_in_time: currentPunch.punch_in_time,
              punch_out_time: now,
              total_hours: totalHours,
              overtime_hours: overtimeHours,
              break_minutes: breakMinutes,
              punch_in_location_lat: currentPunch.punch_in_location_lat ?? null,
              punch_in_location_lng: currentPunch.punch_in_location_lng ?? null,
              punch_out_location_lat: latitude ?? null,
              punch_out_location_lng: longitude ?? null,
              punch_in_photo_url: currentPunch.punch_in_photo_url ?? null,
              punch_out_photo_url: photo_url ?? null,
              notes: body?.notes ?? null,
              status: 'approved',
              created_via_punch_clock: true,
              requires_approval: false,
              distance_warning: false
            });

          if (tcErr) {
            console.error('Error creating time card:', tcErr);
          }
        } catch (tcCatchErr) {
          console.error('Exception while creating time card:', tcCatchErr);
        }

        return new Response(JSON.stringify({ ok: true, current_punch: null }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
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
