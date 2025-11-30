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
      let jobs: any[] = [];
      if (userRow.is_pin_employee) {
        if (assignedJobs.length > 0) {
          const { data: j, error: jobsErr } = await supabaseAdmin
            .from("jobs")
            .select("id, name, address, status, company_id")
            .in("status", ["active", "planning"]) 
            .in("id", assignedJobs)
            .order("name");
          if (jobsErr) return errorResponse(jobsErr.message, 500);
          jobs = j || [];
        } else {
          // No assignments for PIN employee -> return no jobs
          jobs = [];
        }
      } else {
        // Regular users may see all company jobs per RLS; keep existing behavior
        const { data: j, error: jobsErr } = await supabaseAdmin
          .from("jobs")
          .select("id, name, address, status, company_id")
          .in("status", ["active", "planning"]) 
          .order("name");
        if (jobsErr) return errorResponse(jobsErr.message, 500);
        jobs = j || [];
      }

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

    // New endpoints for PIN-authenticated access
    if (req.method === "GET" && url.pathname.endsWith("/time-cards")) {
      const pin = url.searchParams.get("pin") || "";
      const limitParam = url.searchParams.get("limit");
      const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 100);
      const userRow = await validatePin(supabaseAdmin, pin);
      if (!userRow) return errorResponse("Invalid PIN", 401);

      const { data, error } = await supabaseAdmin
        .from('time_cards')
        .select('*')
        .eq('user_id', userRow.user_id)
        .neq('status', 'deleted')
        .order('punch_in_time', { ascending: false })
        .limit(limit);
      if (error) return errorResponse(error.message, 500);

      return new Response(JSON.stringify(data || []), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    } else if (req.method === "GET" && url.pathname.endsWith("/contacts")) {
      const pin = url.searchParams.get("pin") || "";
      const userRow = await validatePin(supabaseAdmin, pin);
      if (!userRow) return errorResponse("Invalid PIN", 401);

      // Collect assigned jobs for PIN employees
      let assignedJobs: string[] = [];
      if (userRow.is_pin_employee) {
        const { data: allSettings } = await supabaseAdmin
          .from('pin_employee_timecard_settings')
          .select('assigned_jobs')
          .eq('pin_employee_id', userRow.user_id);
        if (allSettings?.length) {
          const set = new Set<string>();
          for (const s of allSettings) (s.assigned_jobs || []).forEach((j: string) => set.add(j));
          assignedJobs = Array.from(set);
        }
      }

      // Load jobs and derive contact user ids
      const { data: jobsData } = await supabaseAdmin
        .from('jobs')
        .select('id, name, project_manager_user_id, created_by')
        .in('id', assignedJobs);

      const userIds = new Set<string>();
      (jobsData || []).forEach((j: any) => {
        if (j.project_manager_user_id) userIds.add(j.project_manager_user_id);
        if (j.created_by) userIds.add(j.created_by);
      });

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .in('user_id', Array.from(userIds));

      const contacts = (profiles || []).map((p: any) => ({
        id: p.user_id,
        name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        title: p.role || 'Manager',
        email: p.email || null,
        phone: p.phone || null,
        department: p.role || null
      }));

      return new Response(JSON.stringify(contacts), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    } else if (req.method === "GET" && url.pathname.endsWith("/change-requests")) {
      const pin = url.searchParams.get("pin") || "";
      const userRow = await validatePin(supabaseAdmin, pin);
      if (!userRow) return errorResponse("Invalid PIN", 401);

      // Company scope not required; return all requests across companies

      const { data, error } = await supabaseAdmin
        .from('time_card_change_requests')
        .select('*')
        .eq('user_id', userRow.user_id)
        .order('requested_at', { ascending: false });
      
      if (error) return errorResponse(error.message, 500);

      return new Response(JSON.stringify(data || []), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    
    // Parse body for all POST requests
    let body: any = null;
    if (req.method === "POST") {
      body = await req.json().catch(() => null);
    }
    
    if (req.method === "POST" && body?.action === "review-change-request") {
      // Handle approval/denial of change requests
      const { request_id, status, review_notes } = body;
      
      if (!request_id || !status || !['approved', 'rejected'].includes(status)) {
        return errorResponse("Invalid request parameters", 400);
      }

      // Get the authenticated user ID from JWT
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return errorResponse("Unauthorized", 401);
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authUser) return errorResponse("Unauthorized", 401);

      // Fetch the change request
      const { data: changeRequest, error: fetchError } = await supabaseAdmin
        .from('time_card_change_requests')
        .select('*, time_cards(*)')
        .eq('id', request_id)
        .single();

      if (fetchError || !changeRequest) {
        return errorResponse("Change request not found", 404);
      }

      // Update the change request
      const { error: updateError } = await supabaseAdmin
        .from('time_card_change_requests')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: authUser.id,
          review_notes: review_notes || null
        })
        .eq('id', request_id);

      if (updateError) {
        return errorResponse(updateError.message, 500);
      }

      // Log to audit trail
      const { error: auditError } = await supabaseAdmin
        .from('time_card_audit_trail')
        .insert({
          time_card_id: changeRequest.time_card_id,
          changed_by: authUser.id,
          change_type: status === 'approved' ? 'change_request_approved' : 'change_request_rejected',
          reason: review_notes || `Change request ${status}`,
          created_at: new Date().toISOString()
        });

      if (auditError) {
        console.error('Audit trail error:', auditError);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    } else if (req.method === "POST" && url.pathname.endsWith("/request-change")) {
      const { pin, time_card_id, reason, proposed_punch_in_time, proposed_punch_out_time, proposed_job_id, proposed_cost_code_id } = body || {};
      if (!pin || !time_card_id || !reason) return errorResponse("Missing required fields", 400);
      const userRow = await validatePin(supabaseAdmin, pin);
      if (!userRow) return errorResponse("Invalid PIN", 401);

      // Determine company id from the time card to satisfy NOT NULL constraint
      const { data: tc, error: tcErr } = await supabaseAdmin
        .from('time_cards')
        .select('company_id, user_id')
        .eq('id', time_card_id)
        .maybeSingle();
      if (tcErr) return errorResponse(tcErr.message, 500);
      if (!tc) return errorResponse('Time card not found', 404);
      if (tc.user_id !== userRow.user_id) return errorResponse('Cannot request changes for another user\'s time card', 403);

      const { error } = await supabaseAdmin
        .from('time_card_change_requests')
        .insert({
          time_card_id,
          user_id: userRow.user_id,
          company_id: tc.company_id,
          reason,
          status: 'pending',
          requested_at: new Date().toISOString(),
          proposed_punch_in_time: proposed_punch_in_time || null,
          proposed_punch_out_time: proposed_punch_out_time || null,
          proposed_job_id: proposed_job_id || null,
          proposed_cost_code_id: proposed_cost_code_id || null
        });
      if (error) return errorResponse(error.message, 500);

      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    } else if (req.method === "POST" && url.pathname.endsWith("/update-profile")) {
      const { pin, email, phone, avatar_url } = body || {};
      if (!pin) return errorResponse("Missing pin", 400);
      const userRow = await validatePin(supabaseAdmin, pin);
      if (!userRow) return errorResponse("Invalid PIN", 401);

      if (userRow.is_pin_employee) {
        const { error: updErr } = await supabaseAdmin
          .from('pin_employees')
          .update({
            email: email ?? null,
            phone: phone ?? null,
            avatar_url: avatar_url ?? null,
          })
          .eq('id', userRow.user_id);
        if (updErr) return errorResponse(updErr.message, 500);
      } else {
        // Regular users: allow updating profile avatar/phone via profiles table
        const updates: Record<string, any> = {};
        if (avatar_url !== undefined) updates.avatar_url = avatar_url ?? null;
        if (phone !== undefined) updates.phone = phone ?? null;
        if (Object.keys(updates).length > 0) {
          const { error: profErr } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('user_id', userRow.user_id);
          if (profErr) return errorResponse(profErr.message, 500);
        }
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    if (req.method === "POST" && url.pathname.endsWith("/upload-photo")) {
      try {
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
      let { pin, action, job_id, cost_code_id, latitude, longitude, photo_url, image, timezone_offset_minutes } = body || {};
      // Normalize empty strings to null for UUID fields
      if (typeof cost_code_id === 'string' && cost_code_id.trim() === '') {
        cost_code_id = null;
      }
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

      const now = new Date().toISOString();

      if (action === "in") {
        // Require job_id always; cost code requirement depends on settings
        if (!job_id) return errorResponse("Missing job_id");

        // Get company_id from the job
        const { data: jobData, error: jobError } = await supabaseAdmin
          .from('jobs')
          .select('company_id')
          .eq('id', job_id)
          .maybeSingle();

        if (jobError || !jobData) return errorResponse("Unable to find job", 400);
        const companyId = jobData.company_id;

        // Resolve timing setting (job overrides company). Default to 'punch_out' so cost code is not required at punch in unless explicitly configured.
        const { data: jobTiming } = await supabaseAdmin
          .from('job_punch_clock_settings')
          .select('cost_code_selection_timing')
          .eq('company_id', companyId)
          .eq('job_id', job_id)
          .maybeSingle();

        const { data: companyTiming } = await supabaseAdmin
          .from('job_punch_clock_settings')
          .select('cost_code_selection_timing')
          .eq('company_id', companyId)
          .is('job_id', null)
          .maybeSingle();

        const timing = jobTiming?.cost_code_selection_timing ?? companyTiming?.cost_code_selection_timing ?? 'punch_out';
        console.log(`Punch IN timing=${timing} company=${companyId} job=${job_id} hasCostCode=${Boolean(cost_code_id)}`);

        // Do not hard-fail on missing cost code at punch in; UI may enforce when required
        if (timing === 'punch_in' && !cost_code_id) {
          console.log('Punch IN without cost code (timing=punch_in). Proceeding; will require at punch out.');
        }

        // Load punch clock settings for this job to check photo requirements and early punch in
        const { data: jobSettings, error: settingsErr } = await supabaseAdmin
          .from("job_punch_clock_settings")
          .select("require_photo, require_location, allow_early_punch_in, scheduled_start_time, early_punch_in_buffer_minutes")
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

        // Check location requirement (warn but do not block)
        let locationWarning: string | null = null;
        if (locationRequired && (!latitude || !longitude)) {
          console.log("Location required by settings but missing; proceeding without location for punch in");
          locationWarning = "Location missing (required by settings)";
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

        // Handle early punch in restriction
        let actualPunchTime = now;
        let earlyPunchWarning = null;
        
        if (jobSettings?.allow_early_punch_in && jobSettings?.scheduled_start_time) {
          const nowUtc = new Date();
          const [startHour, startMinute] = jobSettings.scheduled_start_time.split(':').map(Number);

          // Prefer client-provided timezone offset (in minutes, Date.getTimezoneOffset format)
          const tzOffset = typeof timezone_offset_minutes === 'number' ? timezone_offset_minutes : null;

          let minutesUntilStart = 0;
          let scheduledForBuffer: Date; // date representing the scheduled start corresponding to the comparison window

          if (tzOffset !== null) {
            // Compute in client's local time and choose the next scheduled occurrence (today or tomorrow)
            const nowLocal = new Date(nowUtc.getTime() - tzOffset * 60000);
            const scheduledToday = new Date(nowLocal);
            scheduledToday.setHours(startHour, startMinute, 0, 0);

            const nextScheduledLocal = (scheduledToday.getTime() > nowLocal.getTime())
              ? scheduledToday
              : new Date(scheduledToday.getTime() + 24 * 60 * 60000);

            scheduledForBuffer = nextScheduledLocal;
            minutesUntilStart = Math.floor((nextScheduledLocal.getTime() - nowLocal.getTime()) / 60000);

            console.log(
              `Client tzOffset=${tzOffset} | nowLocal=${nowLocal.toISOString()} | nextScheduledLocal=${nextScheduledLocal.toISOString()} | minutesUntilStart=${minutesUntilStart}`
            );
          } else {
            // Fallback: compute using server UTC and choose next scheduled occurrence
            const scheduledToday = new Date(nowUtc);
            scheduledToday.setHours(startHour, startMinute, 0, 0);
            const nextScheduled = (scheduledToday.getTime() > nowUtc.getTime())
              ? scheduledToday
              : new Date(scheduledToday.getTime() + 24 * 60 * 60000);
            scheduledForBuffer = nextScheduled;
            minutesUntilStart = Math.floor((nextScheduled.getTime() - nowUtc.getTime()) / 60000);

            console.log(
              `Server tz | now=${nowUtc.toISOString()} | nextScheduled=${nextScheduled.toISOString()} | minutesUntilStart=${minutesUntilStart}`
            );
          }

          if (minutesUntilStart > 0) {
            const bufferMinutes = jobSettings.early_punch_in_buffer_minutes || 15;
            if (minutesUntilStart > bufferMinutes) {
              return errorResponse(`Cannot punch in more than ${bufferMinutes} minutes before scheduled start time (${jobSettings.scheduled_start_time}). You are ${minutesUntilStart} minutes early.`, 400);
            }

            // Within buffer: set actual punch time to the scheduled time (convert back to UTC when using client tz)
            if (tzOffset !== null) {
              const scheduledUtc = new Date(scheduledForBuffer.getTime() + tzOffset * 60000);
              actualPunchTime = scheduledUtc.toISOString();
            } else {
              actualPunchTime = scheduledForBuffer.toISOString();
            }

            earlyPunchWarning = `You punched in ${minutesUntilStart} minutes early. Your paid time will begin at ${jobSettings.scheduled_start_time}.`;
          }
        }

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
          punch_time: actualPunchTime,
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
            punch_in_time: actualPunchTime,
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

        return new Response(
          JSON.stringify({ 
            ok: true, 
            current_punch: updatedPunch,
            warning: [earlyPunchWarning, locationWarning].filter(Boolean).join(' | ') || null 
          }), 
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
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

        // Get company_id from the job
        const { data: jobData, error: jobError } = await supabaseAdmin
          .from('jobs')
          .select('company_id')
          .eq('id', currentPunch.job_id)
          .maybeSingle();

        if (jobError || !jobData) return errorResponse("Unable to find job", 400);
        const companyId = jobData.company_id;

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

        // Resolve timing to determine cost code requirement at punch out (job overrides company)
        const { data: jobTimingOut } = await supabaseAdmin
          .from('job_punch_clock_settings')
          .select('cost_code_selection_timing')
          .eq('company_id', companyId)
          .eq('job_id', currentPunch.job_id)
          .maybeSingle();

        const { data: companyTimingOut } = await supabaseAdmin
          .from('job_punch_clock_settings')
          .select('cost_code_selection_timing')
          .eq('company_id', companyId)
          .is('job_id', null)
          .maybeSingle();

        const timingOut = jobTimingOut?.cost_code_selection_timing ?? companyTimingOut?.cost_code_selection_timing ?? 'punch_out';
        console.log(`Punch OUT timing=${timingOut} company=${companyId} job=${currentPunch.job_id} hasCostCodeInBody=${Boolean(cost_code_id)} hasCostCodeCurrent=${Boolean(currentPunch?.cost_code_id)}`);
        console.log(`Received cost_code_id from client:`, cost_code_id);
        console.log(`Current punch cost_code_id:`, currentPunch?.cost_code_id);

        // Determine cost code to use for punch out
        let costCodeToUse = currentPunch?.cost_code_id ?? null;
        // If a cost code is provided at punch out, prefer it regardless of timing
        if (cost_code_id) {
          costCodeToUse = cost_code_id;
          console.log(`Using cost code from client:`, costCodeToUse);
        }
        // Enforce requirement when timing is punch_out
        if (timingOut === 'punch_out' && !costCodeToUse) {
          console.log(`ERROR: Cost code required but not provided for punch out`);
          return errorResponse("Missing cost_code_id for punch out", 400);
        }

        console.log(`Final costCodeToUse for punch out:`, costCodeToUse);

        // If cost code was provided and the punch in had none, backfill it on the punch-in record
        if (cost_code_id && !currentPunch?.cost_code_id) {
          console.log(`Backfilling punch in record with cost_code_id: ${cost_code_id}`);
          
          // Update the current_punch_status with the cost code
          const { error: statusUpdateErr } = await supabaseAdmin
            .from('current_punch_status')
            .update({ cost_code_id: cost_code_id })
            .eq('user_id', userRow.user_id)
            .eq('is_active', true);
          
          if (statusUpdateErr) {
            console.error('Error updating current_punch_status:', statusUpdateErr);
          } else {
            console.log('Successfully updated current_punch_status with cost code');
          }
          
          // Also update the punch in record in punch_records
          const punchInUpdateStart = new Date(new Date(currentPunch.punch_in_time).getTime() - 60000).toISOString();
          const punchInUpdateEnd = new Date(new Date(currentPunch.punch_in_time).getTime() + 60000).toISOString();
          const { error: punchUpdateErr } = await supabaseAdmin
            .from('punch_records')
            .update({ cost_code_id: cost_code_id })
            .eq('user_id', userRow.user_id)
            .eq('job_id', currentPunch.job_id)
            .eq('punch_type', 'punched_in')
            .gte('punch_time', punchInUpdateStart)
            .lte('punch_time', punchInUpdateEnd);
          
          if (punchUpdateErr) {
            console.error('Error updating punch_in record:', punchUpdateErr);
          } else {
            console.log('Successfully updated punch_in record with cost code');
          }
        }

        // Check photo requirement for punch out
        if (photoRequired && !photo_url) {
          return errorResponse("Photo is required for punch out on this job", 400);
        }

        // Check location requirement for punch out (warn but do not block)
        let locationWarningOut: string | null = null;
        if (locationRequired && (!latitude || !longitude)) {
          console.log("Location required by settings but missing; proceeding without location for punch out");
          locationWarningOut = "Location missing (required by settings)";
        }

        // Capture device and network information
        const userAgent = req.headers.get('user-agent') || null;
        const ipAddress = req.headers.get('x-forwarded-for') || 
                         req.headers.get('x-real-ip') || 
                         req.headers.get('cf-connecting-ip') || 
                         null;

        console.log(`Creating punch_out record with cost_code_id:`, costCodeToUse);
        
        // Insert punch out record
        const { error: punchErr } = await supabaseAdmin.from("punch_records").insert({
          user_id: userRow.user_id,
          company_id: companyId,
          job_id: currentPunch?.job_id ?? null,
          cost_code_id: costCodeToUse,
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

        console.log(`Punch out record created successfully with cost_code_id: ${costCodeToUse}`);

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
          let punchInDate = new Date(currentPunch.punch_in_time);
          let punchOutDate = new Date(now);

          // Load job shift time settings
          const { data: jobShiftSettings } = await supabaseAdmin
            .from('jobs')
            .select('shift_start_time, shift_end_time, count_early_punch_in, early_punch_in_grace_minutes, count_late_punch_out, late_punch_out_grace_minutes')
            .eq('id', currentPunch.job_id)
            .maybeSingle();

          // Apply shift time adjustments if configured
          if (jobShiftSettings?.shift_start_time && jobShiftSettings?.shift_end_time) {
            const shiftStart = new Date(punchInDate);
            const [startHours, startMinutes] = jobShiftSettings.shift_start_time.split(':').map(Number);
            shiftStart.setHours(startHours, startMinutes, 0, 0);

            const shiftEnd = new Date(punchOutDate);
            const [endHours, endMinutes] = jobShiftSettings.shift_end_time.split(':').map(Number);
            shiftEnd.setHours(endHours, endMinutes, 0, 0);

            // Handle overnight shifts
            if (shiftEnd < shiftStart) {
              shiftEnd.setDate(shiftEnd.getDate() + 1);
            }

            const earlyGrace = jobShiftSettings.early_punch_in_grace_minutes ?? 0;
            const lateGrace = jobShiftSettings.late_punch_out_grace_minutes ?? 0;
            const countEarly = jobShiftSettings.count_early_punch_in === true;
            const countLate = jobShiftSettings.count_late_punch_out === true;

            // Early punch-in handling:
            // - If early time should NOT be counted, always start at shift start.
            // - If it SHOULD be counted, only allow up to earlyGrace minutes before shift start.
            if (punchInDate < shiftStart) {
              const earliestCountedStart = countEarly
                ? new Date(shiftStart.getTime() - earlyGrace * 60000)
                : shiftStart;

              if (punchInDate < earliestCountedStart) {
                punchInDate = earliestCountedStart;
              } else if (!countEarly) {
                // Within window but early time shouldn't be counted
                punchInDate = shiftStart;
              }
            }

             // Late punch-out handling:
             // - If late time should NOT be counted, always end at shift end.
             // - If it SHOULD be counted, ignore up to lateGrace minutes after shift end;
             //   only time beyond the grace window is counted.
             if (punchOutDate > shiftEnd) {
               const graceEnd = new Date(shiftEnd.getTime() + lateGrace * 60000);
 
               if (!countLate) {
                 punchOutDate = shiftEnd;
               } else if (punchOutDate < graceEnd) {
                 // Within grace window (less than graceEnd): treat as ending at shift end
                 punchOutDate = shiftEnd;
               }
               // If punchOutDate >= graceEnd and countLate is true, keep actual punchOutDate
             }
          }

          // Load punch clock settings for overtime calculation
          const { data: jobOvertimeSettings } = await supabaseAdmin
            .from('job_punch_clock_settings')
            .select('calculate_overtime, overtime_threshold, auto_break_duration, auto_break_wait_hours')
            .eq('company_id', companyId)
            .eq('job_id', currentPunch.job_id)
            .maybeSingle();

          const { data: companyOvertimeSettings } = await supabaseAdmin
            .from('job_punch_clock_settings')
            .select('calculate_overtime, overtime_threshold, auto_break_duration, auto_break_wait_hours')
            .eq('company_id', companyId)
            .is('job_id', null)
            .maybeSingle();

          const overtimeSettings = jobOvertimeSettings || companyOvertimeSettings || {};
          const calculateOvertime = overtimeSettings.calculate_overtime === true;
          const overtimeThreshold = overtimeSettings.overtime_threshold || 8;
          const autoBreakDuration = overtimeSettings.auto_break_duration || 30;
          const autoBreakWaitHours = overtimeSettings.auto_break_wait_hours || 6;

          // Calculate total hours
          let totalHours = Math.max(0, (punchOutDate.getTime() - punchInDate.getTime()) / (1000 * 60 * 60));

          // Apply auto break deduction if over threshold
          const breakMinutes = totalHours > autoBreakWaitHours ? autoBreakDuration : 0;
          totalHours = totalHours - breakMinutes / 60;

          // Calculate overtime only if enabled
          const overtimeHours = calculateOvertime ? Math.max(0, totalHours - overtimeThreshold) : 0;

          console.log(`Creating time card with cost_code_id: ${costCodeToUse}, total_hours: ${totalHours}, overtime: ${overtimeHours}, calculateOvertime: ${calculateOvertime}`);

          // Load punch clock settings to check if time card should be flagged
          const { data: flagSettings } = await supabaseAdmin
            .from("job_punch_clock_settings")
            .select("flag_timecards_over_12hrs, flag_timecards_over_24hrs")
            .eq("company_id", companyId)
            .is("job_id", null)
            .maybeSingle();

          const flagOver12 = flagSettings?.flag_timecards_over_12hrs ?? true;
          const flagOver24 = flagSettings?.flag_timecards_over_24hrs ?? true;

          // Determine status - flag if over threshold
          const shouldFlag = (flagOver24 && totalHours > 24) || (flagOver12 && totalHours > 12);
          const timecardStatus = shouldFlag ? 'pending' : 'approved';

          const { error: tcErr } = await supabaseAdmin
            .from('time_cards')
            .insert({
              user_id: userRow.user_id,
              company_id: companyId,
              job_id: currentPunch.job_id,
              cost_code_id: costCodeToUse,
              punch_in_time: punchInDate.toISOString(),
              punch_out_time: punchOutDate.toISOString(),
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
              status: timecardStatus,
              created_via_punch_clock: true,
              requires_approval: shouldFlag,
              distance_warning: false
            });

          if (tcErr) {
            console.error('Error creating time card:', tcErr);
          } else {
            console.log(`Time card created with status: ${timecardStatus}, cost_code_id: ${costCodeToUse}`);
          }
        } catch (tcCatchErr) {
          console.error('Exception while creating time card:', tcCatchErr);
        }

        return new Response(JSON.stringify({ ok: true, current_punch: null }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      return errorResponse("Invalid action. Use 'in' or 'out'", 400);
    }
    
    // Handle new employee dashboard endpoints
    if (req.method === "POST") {
      const body = await req.json();
      const { action, pin } = body;
      
      if (action === 'init') {
        // Return jobs and cost codes for PIN user
        const userRow = await validatePin(supabaseAdmin, pin);
        if (!userRow) return errorResponse("Invalid PIN", 401);
        
        let assignedJobs: string[] = [];
        let assignedCostCodes: string[] = [];
        
        if (userRow.is_pin_employee) {
          const { data: allSettings } = await supabaseAdmin
            .from('pin_employee_timecard_settings')
            .select('assigned_jobs, assigned_cost_codes')
            .eq('pin_employee_id', userRow.user_id);
          
          if (allSettings && allSettings.length > 0) {
            allSettings.forEach(s => {
              if (s.assigned_jobs) assignedJobs.push(...s.assigned_jobs);
              if (s.assigned_cost_codes) assignedCostCodes.push(...s.assigned_cost_codes);
            });
            assignedJobs = [...new Set(assignedJobs)];
            assignedCostCodes = [...new Set(assignedCostCodes)];
          }
        } else {
          const { data: settings } = await supabaseAdmin
            .from('employee_timecard_settings')
            .select('assigned_jobs, assigned_cost_codes')
            .eq('user_id', userRow.user_id)
            .maybeSingle();
          
          if (settings) {
            assignedJobs = settings.assigned_jobs || [];
            assignedCostCodes = settings.assigned_cost_codes || [];
          }
        }
        
        const { data: jobs } = await supabaseAdmin
          .from('jobs')
          .select('id, name')
          .in('id', assignedJobs)
          .eq('is_active', true);
        
        const { data: costCodes } = await supabaseAdmin
          .from('cost_codes')
          .select('id, code, description')
          .in('id', assignedCostCodes)
          .eq('is_active', true);
        
        return new Response(JSON.stringify({ jobs: jobs || [], cost_codes: costCodes || [] }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      if (action === 'get_time_cards') {
        const userRow = await validatePin(supabaseAdmin, pin);
        if (!userRow) return errorResponse("Invalid PIN", 401);
        
        const { data: timeCards } = await supabaseAdmin
          .from('time_cards')
          .select('*')
          .eq('user_id', userRow.user_id)
          .neq('status', 'deleted')
          .order('punch_in_time', { ascending: false })
          .limit(50);
        
        return new Response(JSON.stringify({ time_cards: timeCards || [] }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      if (action === 'get_contacts') {
        const userRow = await validatePin(supabaseAdmin, pin);
        if (!userRow) return errorResponse("Invalid PIN", 401);
        
        // Get job assignments
        let assignedJobs: string[] = [];
        
        if (userRow.is_pin_employee) {
          const { data: allSettings } = await supabaseAdmin
            .from('pin_employee_timecard_settings')
            .select('assigned_jobs')
            .eq('pin_employee_id', userRow.user_id);
          
          if (allSettings && allSettings.length > 0) {
            allSettings.forEach(s => {
              if (s.assigned_jobs) assignedJobs.push(...s.assigned_jobs);
            });
            assignedJobs = [...new Set(assignedJobs)];
          }
        } else {
          const { data: settings } = await supabaseAdmin
            .from('employee_timecard_settings')
            .select('assigned_jobs')
            .eq('user_id', userRow.user_id)
            .maybeSingle();
          
          if (settings?.assigned_jobs) {
            assignedJobs = settings.assigned_jobs;
          }
        }
        
        if (assignedJobs.length === 0) {
          return new Response(JSON.stringify({ contacts: [] }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        
        // Get job managers
        const { data: jobManagers } = await supabaseAdmin
          .from('jobs')
          .select(`
            project_manager_user_id,
            profiles!jobs_project_manager_user_id_fkey(
              user_id,
              display_name,
              first_name,
              last_name,
              role
            )
          `)
          .in('id', assignedJobs)
          .not('project_manager_user_id', 'is', null);
        
        const contactMap = new Map();
        
        jobManagers?.forEach(jm => {
          if (jm.profiles) {
            const profile = jm.profiles as any;
            if (!contactMap.has(profile.user_id)) {
              contactMap.set(profile.user_id, {
                id: profile.user_id,
                name: profile.display_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
                title: profile.role || 'Project Manager',
                department: profile.role
              });
            }
          }
        });
        
        return new Response(JSON.stringify({ contacts: Array.from(contactMap.values()) }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      
      if (action === 'request_change') {
        const userRow = await validatePin(supabaseAdmin, pin);
        if (!userRow) return errorResponse("Invalid PIN", 401);
        
        const { time_card_id, reason, proposed_punch_in_time, proposed_punch_out_time, proposed_job_id, proposed_cost_code_id } = body;
        
        if (!time_card_id || !reason) {
          return errorResponse("time_card_id and reason are required", 400);
        }
        
        const { error } = await supabaseAdmin
          .from('time_card_change_requests')
          .insert({
            time_card_id,
            user_id: userRow.user_id,
            reason,
            status: 'pending',
            proposed_punch_in_time: proposed_punch_in_time || null,
            proposed_punch_out_time: proposed_punch_out_time || null,
            proposed_job_id: proposed_job_id || null,
            proposed_cost_code_id: proposed_cost_code_id || null
          });
        
        if (error) {
          return errorResponse(error.message, 500);
        }
        
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    return new Response(JSON.stringify({ message: "Punch Clock Function" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    return errorResponse((e as Error).message || "Unexpected error", 500);
  }
});
