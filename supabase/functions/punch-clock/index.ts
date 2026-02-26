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

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function geofenceBlockResponse(params: {
  code: "JOB_LOCATION_MISSING" | "LOCATION_REQUIRED" | "OUT_OF_GEOFENCE_RANGE";
  message: string;
  action: "punch_in" | "punch_out";
  block_reason: "job_missing_coordinates" | "location_unavailable" | "out_of_range";
  distance_from_job_meters?: number | null;
  distance_limit_meters?: number | null;
}) {
  return jsonResponse(
    {
      code: params.code,
      error: params.message,
      message: params.message,
      action: params.action,
      block_reason: params.block_reason,
      distance_from_job_meters: params.distance_from_job_meters ?? null,
      distance_limit_meters: params.distance_limit_meters ?? null,
    },
    422
  );
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isMissingColumnError(err: any, columnName: string) {
  const msg = String(err?.message || "");
  return msg.includes(columnName) || err?.code === "42703";
}

function asFiniteNumber(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function insertPunchAttemptAudit(supabaseAdmin: any, row: Record<string, unknown>) {
  try {
    const { error } = await supabaseAdmin.from("punch_clock_attempt_audit").insert(row);
    if (error) console.warn("punch_clock_attempt_audit insert warning:", error.message);
  } catch (e) {
    console.warn("punch_clock_attempt_audit insert exception:", (e as Error)?.message || e);
  }
}

async function loadEmployeeGeofenceSettings(
  supabaseAdmin: any,
  params: { user_id?: string | null; pin_employee_id?: string | null; company_id?: string | null }
) {
  const { user_id, pin_employee_id, company_id } = params;
  const sortRows = (rows: any[]) => {
    return [...rows].sort((a, b) => {
      const aEnabled = a?.enforce_punch_in_distance === true ? 1 : 0;
      const bEnabled = b?.enforce_punch_in_distance === true ? 1 : 0;
      if (aEnabled !== bEnabled) return bEnabled - aEnabled;
      const aUpdated = new Date(a?.updated_at || a?.created_at || 0).getTime();
      const bUpdated = new Date(b?.updated_at || b?.created_at || 0).getTime();
      return bUpdated - aUpdated;
    });
  };

  if (user_id) {
    try {
      let q = supabaseAdmin
        .from("employee_timecard_settings")
        .select("user_id, company_id, enforce_punch_in_distance, punch_in_distance_limit_meters, updated_at, created_at")
        .eq("user_id", user_id);
      if (company_id) q = q.eq("company_id", company_id);
      const { data, error } = await q.limit(20);
      if (error) {
        if (
          isMissingColumnError(error, "enforce_punch_in_distance") ||
          isMissingColumnError(error, "punch_in_distance_limit_meters")
        ) {
          console.warn("employee geofence columns missing; failing open");
          return { settings: null, columnsMissing: true };
        }
        console.warn("employee geofence settings lookup warning:", error.message);
        return { settings: null, columnsMissing: false };
      }
      const chosen = sortRows(data || [])[0] || null;
      return { settings: chosen, columnsMissing: false };
    } catch (e) {
      console.warn("employee geofence settings lookup exception:", (e as Error)?.message || e);
      return { settings: null, columnsMissing: false };
    }
  }

  if (pin_employee_id) {
    try {
      let q = supabaseAdmin
        .from("pin_employee_timecard_settings")
        .select("pin_employee_id, company_id, enforce_punch_in_distance, punch_in_distance_limit_meters, updated_at, created_at")
        .eq("pin_employee_id", pin_employee_id);
      if (company_id) q = q.eq("company_id", company_id);
      const { data, error } = await q.limit(20);
      if (error) {
        if (
          isMissingColumnError(error, "enforce_punch_in_distance") ||
          isMissingColumnError(error, "punch_in_distance_limit_meters")
        ) {
          console.warn("pin employee geofence columns missing; failing open");
          return { settings: null, columnsMissing: true };
        }
        console.warn("pin employee geofence settings lookup warning:", error.message);
        return { settings: null, columnsMissing: false };
      }
      const chosen = sortRows(data || [])[0] || null;
      return { settings: chosen, columnsMissing: false };
    } catch (e) {
      console.warn("pin employee geofence settings lookup exception:", (e as Error)?.message || e);
      return { settings: null, columnsMissing: false };
    }
  }

  return { settings: null, columnsMissing: false };
}

async function loadCompanyWarningGeofenceSettings(supabaseAdmin: any, company_id: string | null | undefined) {
  if (!company_id) return { settings: null, columnsMissing: false };
  try {
    const { data, error } = await supabaseAdmin
      .from("job_punch_clock_settings")
      .select("company_id, job_id, warn_when_punch_outside_jobsite, outside_jobsite_warning_distance_meters, updated_at, created_at")
      .eq("company_id", company_id)
      .is("job_id", null)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) {
      if (
        isMissingColumnError(error, "warn_when_punch_outside_jobsite") ||
        isMissingColumnError(error, "outside_jobsite_warning_distance_meters")
      ) {
        console.warn("company warning geofence columns missing; failing open");
        return { settings: null, columnsMissing: true };
      }
      console.warn("company warning geofence settings lookup warning:", error.message);
      return { settings: null, columnsMissing: false };
    }
    return { settings: (data || [])[0] || null, columnsMissing: false };
  } catch (e) {
    console.warn("company warning geofence settings lookup exception:", (e as Error)?.message || e);
    return { settings: null, columnsMissing: false };
  }
}

async function enforcePunchDistanceIfRequired(
  supabaseAdmin: any,
  params: {
    action: "in" | "out";
    company_id: string | null;
    user_id: string;
    pin_employee_id?: string | null;
    job_id: string | null;
    latitude?: number | null;
    longitude?: number | null;
    is_pin_employee?: boolean;
  }
) {
  const attemptedAction = params.action === "in" ? "punch_in" : "punch_out";
  const requestLat = asFiniteNumber(params.latitude);
  const requestLng = asFiniteNumber(params.longitude);
  const isPinEmployee = params.is_pin_employee === true;

  const employeeSettingsResult = await loadEmployeeGeofenceSettings(supabaseAdmin, {
    user_id: params.user_id,
    pin_employee_id: params.pin_employee_id ?? null,
    company_id: params.company_id,
  });
  const employeeSettings = employeeSettingsResult.settings;
  const strictEnabled = employeeSettings?.enforce_punch_in_distance === true;
  const strictLimit = [10, 50, 100, 300].includes(Number(employeeSettings?.punch_in_distance_limit_meters))
    ? Number(employeeSettings?.punch_in_distance_limit_meters)
    : null;

  if (!strictEnabled) {
    // Company-level warning-only fallback (non-blocking)
    const companyWarningResult = await loadCompanyWarningGeofenceSettings(supabaseAdmin, params.company_id);
    const warningSettings = companyWarningResult.settings;
    const warningEnabled = warningSettings?.warn_when_punch_outside_jobsite === true;
    const warningLimit = [10, 50, 100, 300].includes(Number(warningSettings?.outside_jobsite_warning_distance_meters))
      ? Number(warningSettings?.outside_jobsite_warning_distance_meters)
      : 100;

    if (!warningEnabled || !params.job_id) {
      return { blockedResponse: null, warning: null };
    }

    const { data: jobCoords, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .select("id, latitude, longitude")
      .eq("id", params.job_id)
      .maybeSingle();
    if (jobErr || !jobCoords) {
      await insertPunchAttemptAudit(supabaseAdmin, {
        app_source: "punch_clock",
        attempted_action: attemptedAction,
        outcome: "allowed",
        block_reason: null,
        company_id: params.company_id,
        user_id: params.user_id,
        pin_employee_id: params.pin_employee_id ?? null,
        is_pin_employee: isPinEmployee,
        job_id: params.job_id,
        distance_limit_meters: warningLimit,
        details: { warning_reason: "outside_jobsite_warning_skipped_job_not_found" },
      });
      return { blockedResponse: null, warning: null };
    }

    const jobLat = asFiniteNumber(jobCoords.latitude);
    const jobLng = asFiniteNumber(jobCoords.longitude);
    if (jobLat == null || jobLng == null) {
      await insertPunchAttemptAudit(supabaseAdmin, {
        app_source: "punch_clock",
        attempted_action: attemptedAction,
        outcome: "allowed",
        block_reason: null,
        company_id: params.company_id,
        user_id: params.user_id,
        pin_employee_id: params.pin_employee_id ?? null,
        is_pin_employee: isPinEmployee,
        job_id: params.job_id,
        distance_limit_meters: warningLimit,
        details: { warning_reason: "outside_jobsite_warning_skipped_job_missing_coordinates" },
      });
      return { blockedResponse: null, warning: null };
    }

    if (requestLat == null || requestLng == null) {
      await insertPunchAttemptAudit(supabaseAdmin, {
        app_source: "punch_clock",
        attempted_action: attemptedAction,
        outcome: "allowed",
        block_reason: null,
        company_id: params.company_id,
        user_id: params.user_id,
        pin_employee_id: params.pin_employee_id ?? null,
        is_pin_employee: isPinEmployee,
        job_id: params.job_id,
        distance_limit_meters: warningLimit,
        job_latitude: jobLat,
        job_longitude: jobLng,
        details: { warning_reason: "outside_jobsite_warning_skipped_location_unavailable" },
      });
      return { blockedResponse: null, warning: null };
    }

    const distance = haversineMeters(requestLat, requestLng, jobLat, jobLng);
    if (distance > warningLimit) {
      const warningPayload = {
        warning_code: "OUTSIDE_JOBSITE_SUPERVISOR_APPROVAL_REQUIRED",
        warning_reason: "outside_jobsite_warning",
        requires_supervisor_approval: true,
        action: attemptedAction,
        distance_from_job_meters: Math.round(distance),
        distance_limit_meters: warningLimit,
        message:
          params.action === "in"
            ? "You are not at the job site. This punch will need to be approved by a supervisor. Please talk to your supervisor."
            : "You are not at the job site. This punch out will need to be approved by a supervisor. Please talk to your supervisor.",
      };

      await insertPunchAttemptAudit(supabaseAdmin, {
        app_source: "punch_clock",
        attempted_action: attemptedAction,
        outcome: "allowed",
        block_reason: null,
        company_id: params.company_id,
        user_id: params.user_id,
        pin_employee_id: params.pin_employee_id ?? null,
        is_pin_employee: isPinEmployee,
        job_id: params.job_id,
        distance_from_job_meters: Math.round(distance),
        distance_limit_meters: warningLimit,
        device_latitude: requestLat,
        device_longitude: requestLng,
        job_latitude: jobLat,
        job_longitude: jobLng,
        details: { warning_reason: "outside_jobsite_warning" },
      });

      return { blockedResponse: null, warning: warningPayload };
    }

    return { blockedResponse: null, warning: null };
  }

  // Strict employee geofence enforcement
  if (!params.job_id) {
    return { blockedResponse: null, warning: null };
  }

  const { data: jobCoords, error: jobErr } = await supabaseAdmin
    .from("jobs")
    .select("id, latitude, longitude")
    .eq("id", params.job_id)
    .maybeSingle();

  if (jobErr || !jobCoords) {
    const resp = geofenceBlockResponse({
      code: "JOB_LOCATION_MISSING",
      message: "This job does not have a job-site location set. Contact your administrator.",
      action: attemptedAction,
      block_reason: "job_missing_coordinates",
      distance_limit_meters: strictLimit,
    });
    await insertPunchAttemptAudit(supabaseAdmin, {
      app_source: "punch_clock",
      attempted_action: attemptedAction,
      outcome: "blocked",
      block_reason: "job_missing_coordinates",
      company_id: params.company_id,
      user_id: params.user_id,
      pin_employee_id: params.pin_employee_id ?? null,
      is_pin_employee: isPinEmployee,
      job_id: params.job_id,
      distance_limit_meters: strictLimit,
      details: { reason: "job_not_found" },
    });
    return { blockedResponse: resp, warning: null };
  }

  const jobLat = asFiniteNumber(jobCoords.latitude);
  const jobLng = asFiniteNumber(jobCoords.longitude);
  if (jobLat == null || jobLng == null) {
    const resp = geofenceBlockResponse({
      code: "JOB_LOCATION_MISSING",
      message: "This job does not have a job-site location set. Contact your administrator.",
      action: attemptedAction,
      block_reason: "job_missing_coordinates",
      distance_limit_meters: strictLimit,
    });
    await insertPunchAttemptAudit(supabaseAdmin, {
      app_source: "punch_clock",
      attempted_action: attemptedAction,
      outcome: "blocked",
      block_reason: "job_missing_coordinates",
      company_id: params.company_id,
      user_id: params.user_id,
      pin_employee_id: params.pin_employee_id ?? null,
      is_pin_employee: isPinEmployee,
      job_id: params.job_id,
      distance_limit_meters: strictLimit,
      job_latitude: jobLat,
      job_longitude: jobLng,
    });
    return { blockedResponse: resp, warning: null };
  }

  if (requestLat == null || requestLng == null) {
    const resp = geofenceBlockResponse({
      code: "LOCATION_REQUIRED",
      message:
        params.action === "in"
          ? "Location is required to punch in for this job."
          : "Location is required to punch out for this job.",
      action: attemptedAction,
      block_reason: "location_unavailable",
      distance_limit_meters: strictLimit,
    });
    await insertPunchAttemptAudit(supabaseAdmin, {
      app_source: "punch_clock",
      attempted_action: attemptedAction,
      outcome: "blocked",
      block_reason: "location_unavailable",
      company_id: params.company_id,
      user_id: params.user_id,
      pin_employee_id: params.pin_employee_id ?? null,
      is_pin_employee: isPinEmployee,
      job_id: params.job_id,
      distance_limit_meters: strictLimit,
      job_latitude: jobLat,
      job_longitude: jobLng,
    });
    return { blockedResponse: resp, warning: null };
  }

  const effectiveLimit = strictLimit ?? 50;
  const distance = haversineMeters(requestLat, requestLng, jobLat, jobLng);
  if (distance > effectiveLimit) {
    const roundedDistance = Math.round(distance);
    const resp = geofenceBlockResponse({
      code: "OUT_OF_GEOFENCE_RANGE",
      message:
        params.action === "in"
          ? "You are not at the job site and cannot punch in."
          : "You are not at the job site and cannot punch out.",
      action: attemptedAction,
      block_reason: "out_of_range",
      distance_from_job_meters: roundedDistance,
      distance_limit_meters: effectiveLimit,
    });
    await insertPunchAttemptAudit(supabaseAdmin, {
      app_source: "punch_clock",
      attempted_action: attemptedAction,
      outcome: "blocked",
      block_reason: "out_of_range",
      company_id: params.company_id,
      user_id: params.user_id,
      pin_employee_id: params.pin_employee_id ?? null,
      is_pin_employee: isPinEmployee,
      job_id: params.job_id,
      distance_from_job_meters: roundedDistance,
      distance_limit_meters: effectiveLimit,
      device_latitude: requestLat,
      device_longitude: requestLng,
      job_latitude: jobLat,
      job_longitude: jobLng,
    });
    return { blockedResponse: resp, warning: null };
  }

  return {
    blockedResponse: null,
    warning: null,
    geofenceDistanceMeters: Math.round(distance),
    geofenceLimitMeters: effectiveLimit,
  };
}

async function validatePin(supabaseAdmin: any, pin: string) {
  if (!pin || pin.trim().length !== 6) return null;
  
  // Normalize PIN to ensure consistent format
  pin = pin.trim();
  
  // Check profiles table (all employees now live here)
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('user_id, first_name, last_name, role, current_company_id, avatar_url, punch_clock_access')
    .eq('pin_code', pin)
    .maybeSingle();

  if (profileData && !profileError) {
    // Check punch_clock_access
    if (profileData.punch_clock_access === false) {
      return null; // User does not have punch clock access
    }
    
    // Get tenant_id from their current company for tenant isolation
    let tenant_id: string | null = null;
    if (profileData.current_company_id) {
      const { data: companyData } = await supabaseAdmin
        .from('companies')
        .select('tenant_id')
        .eq('id', profileData.current_company_id)
        .maybeSingle();
      tenant_id = companyData?.tenant_id || null;
    }
    
    return {
      user_id: profileData.user_id,
      first_name: profileData.first_name,
      last_name: profileData.last_name,
      role: profileData.role,
      is_pin_employee: false, // Legacy field, all employees are now profile-based
      existing_avatar: profileData.avatar_url,
      company_id: profileData.current_company_id,
      tenant_id
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

      // Get tenant-scoped company IDs for filtering
      let tenantCompanyIds: string[] = [];
      if (userRow.tenant_id) {
        const { data: tenantCompanies } = await supabaseAdmin
          .from('companies')
          .select('id')
          .eq('tenant_id', userRow.tenant_id);
        tenantCompanyIds = (tenantCompanies || []).map((c: any) => c.id);
      } else if (userRow.company_id) {
        tenantCompanyIds = [userRow.company_id];
      }

      // Load user's assigned jobs and cost codes - use employee_timecard_settings for all users
      let assignedJobs: string[] = [];
      let assignedCostCodes: string[] = [];
      
      // Check employee_timecard_settings first
      let settingsQuery = supabaseAdmin
        .from('employee_timecard_settings')
        .select('assigned_jobs, assigned_cost_codes')
        .eq('user_id', userRow.user_id);
      
      if (tenantCompanyIds.length > 0) {
        settingsQuery = settingsQuery.in('company_id', tenantCompanyIds);
      }
      
      const { data: empSettings } = await settingsQuery;
      
      if (empSettings && empSettings.length > 0) {
        const allJobs = new Set<string>();
        const allCostCodes = new Set<string>();
        
        for (const setting of empSettings) {
          (setting.assigned_jobs || []).forEach((j: string) => allJobs.add(j));
          (setting.assigned_cost_codes || []).forEach((c: string) => allCostCodes.add(c));
        }
        
        assignedJobs = Array.from(allJobs);
        assignedCostCodes = Array.from(allCostCodes);
      }

      // pin_employee_timecard_settings fallback removed - all settings now in employee_timecard_settings

      // Check global job access
      const { data: profileAccess } = await supabaseAdmin
        .from('profiles')
        .select('has_global_job_access')
        .eq('user_id', userRow.user_id)
        .maybeSingle();
      
      const hasGlobalAccess = profileAccess?.has_global_job_access ?? false;

      // Load jobs - filter by tenant and assignments
      let jobs: any[] = [];
      if (hasGlobalAccess || userRow.role === 'admin' || userRow.role === 'controller' || userRow.role === 'project_manager') {
        // Users with global access or elevated roles see all tenant jobs
        let jobsQuery = supabaseAdmin
          .from("jobs")
          .select("id, name, address, status, company_id")
          .in("status", ["active", "planning"]);
        
        if (tenantCompanyIds.length > 0) {
          jobsQuery = jobsQuery.in("company_id", tenantCompanyIds);
        }
        
        const { data: j, error: jobsErr } = await jobsQuery.order("name");
        if (jobsErr) return errorResponse(jobsErr.message, 500);
        jobs = j || [];
      } else if (assignedJobs.length > 0) {
        const { data: j, error: jobsErr } = await supabaseAdmin
          .from("jobs")
          .select("id, name, address, status, company_id")
          .in("status", ["active", "planning"]) 
          .in("id", assignedJobs)
          .order("name");
        if (jobsErr) return errorResponse(jobsErr.message, 500);
        jobs = j || [];
      }

      // Load cost codes - filter by tenant, assignments and type=labor only
      let costCodesQuery = supabaseAdmin
        .from("cost_codes")
        .select("id, code, description, job_id, company_id")
        .eq("is_active", true)
        .eq("type", "labor");
      
      if (tenantCompanyIds.length > 0) {
        costCodesQuery = costCodesQuery.in("company_id", tenantCompanyIds);
      }
      
      if (assignedCostCodes.length > 0 && !hasGlobalAccess) {
        costCodesQuery = costCodesQuery.in("id", assignedCostCodes);
      }
      
      const { data: costCodes, error: ccErr } = await costCodesQuery.order("code");
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

      // Collect assigned jobs
      let assignedJobs: string[] = [];
      const { data: allSettings } = await supabaseAdmin
        .from('employee_timecard_settings')
        .select('assigned_jobs')
        .eq('user_id', userRow.user_id);
      if (allSettings?.length) {
        const set = new Set<string>();
        for (const s of allSettings) (s.assigned_jobs || []).forEach((j: string) => set.add(j));
        assignedJobs = Array.from(set);
      }

      // pin_employee_timecard_settings fallback removed

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
      const { request_id, status, review_notes } = body;
      
      if (!request_id || !status || !['approved', 'rejected'].includes(status)) {
        return errorResponse("Invalid request parameters", 400);
      }

      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return errorResponse("Unauthorized", 401);
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authUser) return errorResponse("Unauthorized", 401);

      const { data: changeRequest, error: fetchError } = await supabaseAdmin
        .from('time_card_change_requests')
        .select('*, time_cards(*)')
        .eq('id', request_id)
        .single();

      if (fetchError || !changeRequest) {
        return errorResponse("Change request not found", 404);
      }

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

      // All users now use profiles table
      const updates: Record<string, any> = {};
      if (phone !== undefined) updates.phone = phone ?? null;

      // If avatar_url points to punch-photos (private bucket), re-upload to public avatars bucket
      if (avatar_url !== undefined) {
        let finalAvatarUrl = avatar_url ?? null;
        if (avatar_url && avatar_url.includes('/punch-photos/')) {
          try {
            // Extract the file path from the URL
            const pathMatch = avatar_url.match(/\/punch-photos\/(.+)$/);
            if (pathMatch) {
              const filePath = pathMatch[1];
              // Download from private punch-photos bucket using admin client
              const { data: fileData, error: dlErr } = await supabaseAdmin.storage
                .from('punch-photos')
                .download(filePath);
              if (!dlErr && fileData) {
                const newFileName = `users/${userRow.user_id}/${Date.now()}.jpg`;
                const { error: upErr } = await supabaseAdmin.storage
                  .from('avatars')
                  .upload(newFileName, fileData, { contentType: 'image/jpeg', upsert: true });
                if (!upErr) {
                  const { data: pub } = supabaseAdmin.storage.from('avatars').getPublicUrl(newFileName);
                  finalAvatarUrl = pub.publicUrl;
                  console.log('Re-uploaded avatar from punch-photos to avatars:', finalAvatarUrl);
                }
              }
            }
          } catch (e) {
            console.error('Error re-uploading avatar:', e);
            // Fall back to original URL
          }
        }
        updates.avatar_url = finalAvatarUrl;
      }

      if (Object.keys(updates).length > 0) {
        const { error: profErr } = await supabaseAdmin
          .from('profiles')
          .update(updates)
          .eq('user_id', userRow.user_id);
        if (profErr) return errorResponse(profErr.message, 500);
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Upload avatar to the public 'avatars' bucket and update profile
    if (req.method === "POST" && url.pathname.endsWith("/upload-avatar")) {
      try {
        const { pin, image } = body || {};
        if (!pin || !image) return errorResponse("Missing pin or image", 400);

        const userRow = await validatePin(supabaseAdmin, pin);
        if (!userRow) return errorResponse("Invalid PIN", 401);

        const base64 = (typeof image === 'string' && image.includes(',')) ? image.split(',')[1] : image;
        let bytes: Uint8Array;
        try {
          const binary = atob(base64);
          bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        } catch (_e) {
          return errorResponse("Invalid image encoding", 400);
        }

        const fileName = `users/${userRow.user_id}/${Date.now()}.jpg`;
        const fileBlob = new Blob([bytes], { type: 'image/jpeg' });

        const { error: uploadErr } = await supabaseAdmin.storage
          .from('avatars')
          .upload(fileName, fileBlob, { contentType: 'image/jpeg', upsert: true });
        if (uploadErr) {
          console.error('Storage upload error in /upload-avatar:', uploadErr);
          return errorResponse(uploadErr.message, 500);
        }

        const { data: pub } = supabaseAdmin.storage
          .from('avatars')
          .getPublicUrl(fileName);

        // Update profile avatar_url immediately
        await supabaseAdmin
          .from('profiles')
          .update({ avatar_url: pub.publicUrl })
          .eq('user_id', userRow.user_id);

        console.log('Avatar uploaded for', userRow.user_id, '->', pub.publicUrl);
        return new Response(JSON.stringify({ publicUrl: pub.publicUrl }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        return errorResponse((e as Error).message || 'Upload failed', 500);
      }
    }

    // Migrate avatar from punch-photos (private) to avatars (public) bucket
    // Called by DB trigger via pg_net when avatar_url contains punch-photos
    if (req.method === "POST" && url.pathname.endsWith("/migrate-avatar")) {
      try {
        const { user_id, source_url } = body || {};
        if (!user_id || !source_url) return errorResponse("Missing user_id or source_url", 400);

        // Extract the file path from the punch-photos URL
        const pathMatch = source_url.match(/\/punch-photos\/(.+?)(\?|$)/);
        if (!pathMatch) return errorResponse("Invalid source URL", 400);

        const filePath = decodeURIComponent(pathMatch[1]);

        // Download from private punch-photos bucket
        const { data: fileData, error: dlErr } = await supabaseAdmin.storage
          .from('punch-photos')
          .download(filePath);
        if (dlErr || !fileData) {
          console.error('migrate-avatar download error:', dlErr);
          return errorResponse(dlErr?.message || 'Download failed', 500);
        }

        // Upload to public avatars bucket
        const newFileName = `users/${user_id}/${Date.now()}.jpg`;
        const { error: upErr } = await supabaseAdmin.storage
          .from('avatars')
          .upload(newFileName, fileData, { contentType: 'image/jpeg', upsert: true });
        if (upErr) {
          console.error('migrate-avatar upload error:', upErr);
          return errorResponse(upErr.message, 500);
        }

        const { data: pub } = supabaseAdmin.storage.from('avatars').getPublicUrl(newFileName);

        // Update profile with new public URL
        await supabaseAdmin
          .from('profiles')
          .update({ avatar_url: pub.publicUrl, profile_avatar_url: pub.publicUrl })
          .eq('user_id', user_id);

        console.log('Migrated avatar for', user_id, ':', source_url, '->', pub.publicUrl);
        return new Response(JSON.stringify({ ok: true, publicUrl: pub.publicUrl }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        console.error('migrate-avatar error:', e);
        return errorResponse((e as Error).message || 'Migration failed', 500);
      }
    }

    if (req.method === "POST" && url.pathname.endsWith("/upload-photo")) {
      try {
        const { pin, image } = body || {};
        if (!pin || !image) return errorResponse("Missing pin or image", 400);

        const userRow = await validatePin(supabaseAdmin, pin);
        if (!userRow) return errorResponse("Invalid PIN", 401);

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
      if (typeof cost_code_id === 'string' && cost_code_id.trim() === '') {
        cost_code_id = null;
      }
      const userRow = await validatePin(supabaseAdmin, pin);
      if (!userRow) return errorResponse("Invalid PIN", 401);

      // If a base64 image is provided but no photo_url, upload it now
      try {
        if (!photo_url && image) {
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
        if (!job_id) return errorResponse("Missing job_id");

        const { data: jobData, error: jobError } = await supabaseAdmin
          .from('jobs')
          .select('company_id')
          .eq('id', job_id)
          .maybeSingle();

        if (jobError || !jobData) return errorResponse("Unable to find job", 400);
        const companyId = jobData.company_id;

        // ── Geofence enforcement for PUNCH IN ──
        const geofenceBlock = await enforceGeofence(supabaseAdmin, {
          userId: userRow.user_id,
          companyId,
          jobId: job_id,
          action: "in",
          deviceLat: latitude,
          deviceLng: longitude,
        });
        if (geofenceBlock) return geofenceBlock;

        if (cost_code_id) {
          const { data: costCodeData, error: ccError } = await supabaseAdmin
            .from('cost_codes')
            .select('id, job_id')
            .eq('id', cost_code_id)
            .maybeSingle();
          
          if (ccError || !costCodeData) {
            return errorResponse("Invalid cost code", 400);
          }
          
          if (costCodeData.job_id !== job_id) {
            return errorResponse("Cost code does not belong to the selected job", 400);
          }
        }

        // Resolve timing setting
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

        if (timing === 'punch_in' && !cost_code_id) {
          console.log('Punch IN without cost code (timing=punch_in). Proceeding; will require at punch out.');
        }

        // Load punch clock settings
        const { data: jobSettings, error: settingsErr } = await supabaseAdmin
          .from("job_punch_clock_settings")
          .select("require_photo, require_location, allow_early_punch_in, scheduled_start_time, early_punch_in_buffer_minutes")
          .eq("job_id", job_id)
          .maybeSingle();

        const { data: companySettings, error: companySettingsErr } = await supabaseAdmin
          .from("punch_clock_settings")
          .select("require_photo, require_location, company_id")
          .limit(1)
          .maybeSingle();

        if (settingsErr) console.error("Error loading job settings:", settingsErr);
        if (companySettingsErr) console.error("Error loading company settings:", companySettingsErr);

        const photoRequired = jobSettings?.require_photo ?? companySettings?.require_photo ?? false;
        const locationRequired = jobSettings?.require_location ?? companySettings?.require_location ?? false;

        let locationWarning: string | null = null;
        if (locationRequired && (!latitude || !longitude)) {
          console.log("Location required but missing; proceeding for punch in");
          locationWarning = "Location missing (required by settings)";
        }

        // Server-side geofence enforcement / warning fallback (authoritative)
        const geofenceResultIn = await enforcePunchDistanceIfRequired(supabaseAdmin, {
          action: "in",
          company_id: companyId,
          user_id: userRow.user_id,
          pin_employee_id: null,
          job_id,
          latitude,
          longitude,
          is_pin_employee: false,
        });
        if (geofenceResultIn.blockedResponse) return geofenceResultIn.blockedResponse;

        // Check if already punched in
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

          const tzOffset = typeof timezone_offset_minutes === 'number' ? timezone_offset_minutes : null;

          let minutesUntilStart = 0;
          let scheduledForBuffer: Date;

          if (tzOffset !== null) {
            const nowLocal = new Date(nowUtc.getTime() - tzOffset * 60000);
            const scheduledToday = new Date(nowLocal);
            scheduledToday.setHours(startHour, startMinute, 0, 0);

            const nextScheduledLocal = (scheduledToday.getTime() > nowLocal.getTime())
              ? scheduledToday
              : new Date(scheduledToday.getTime() + 24 * 60 * 60000);

            scheduledForBuffer = nextScheduledLocal;
            minutesUntilStart = Math.floor((nextScheduledLocal.getTime() - nowLocal.getTime()) / 60000);
          } else {
            const scheduledToday = new Date(nowUtc);
            scheduledToday.setHours(startHour, startMinute, 0, 0);
            const nextScheduled = (scheduledToday.getTime() > nowUtc.getTime())
              ? scheduledToday
              : new Date(scheduledToday.getTime() + 24 * 60 * 60000);
            scheduledForBuffer = nextScheduled;
            minutesUntilStart = Math.floor((nextScheduled.getTime() - nowUtc.getTime()) / 60000);
          }

          if (minutesUntilStart > 0) {
            const bufferMinutes = jobSettings.early_punch_in_buffer_minutes || 15;
            if (minutesUntilStart > bufferMinutes) {
              return errorResponse(`Cannot punch in more than ${bufferMinutes} minutes before scheduled start time (${jobSettings.scheduled_start_time}). You are ${minutesUntilStart} minutes early.`, 400);
            }

            if (tzOffset !== null) {
              const scheduledUtc = new Date(scheduledForBuffer.getTime() + tzOffset * 60000);
              actualPunchTime = scheduledUtc.toISOString();
            } else {
              actualPunchTime = scheduledForBuffer.toISOString();
            }

            earlyPunchWarning = `You punched in ${minutesUntilStart} minutes early. Your paid time will begin at ${jobSettings.scheduled_start_time}.`;
          }
        }

        const userAgent = req.headers.get('user-agent') || null;
        const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || null;

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
          
        // Update avatar if they don't have one but took a photo
        if (photo_url && !userRow.existing_avatar) {
          await supabaseAdmin
            .from('profiles')
            .update({ avatar_url: photo_url })
            .eq('user_id', userRow.user_id);
        }
        if (statusErr) return errorResponse(statusErr.message, 500);

        const { data: updatedPunch } = await supabaseAdmin
          .from("current_punch_status")
          .select("*")
          .eq("user_id", userRow.user_id)
          .eq("is_active", true)
          .maybeSingle();

        return jsonResponse({
          ok: true,
          current_punch: updatedPunch,
          warning: [earlyPunchWarning, locationWarning].filter(Boolean).join(' | ') || null,
          ...(geofenceResultIn.warning ? { geofence_warning: geofenceResultIn.warning } : {}),
          ...(geofenceResultIn.geofenceDistanceMeters != null
            ? { distance_from_job_meters: geofenceResultIn.geofenceDistanceMeters }
            : {}),
        });
      }

      if (action === "out") {
        console.log(`Punch out attempt for user ${userRow.user_id}`);
        
        const { data: currentPunch, error: curErr } = await supabaseAdmin
          .from("current_punch_status")
          .select("*")
          .eq("user_id", userRow.user_id)
          .eq("is_active", true)
          .maybeSingle();
          
        if (curErr) return errorResponse(curErr.message, 500);
        if (!currentPunch) return errorResponse("User is not currently punched in", 400);

        const { data: jobData, error: jobError } = await supabaseAdmin
          .from('jobs')
          .select('company_id')
          .eq('id', currentPunch.job_id)
          .maybeSingle();

        if (jobError || !jobData) return errorResponse("Unable to find job", 400);
        const companyId = jobData.company_id;

        // ── Geofence enforcement for PUNCH OUT ──
        const geofenceBlock = await enforceGeofence(supabaseAdmin, {
          userId: userRow.user_id,
          companyId,
          jobId: currentPunch.job_id,
          action: "out",
          deviceLat: latitude,
          deviceLng: longitude,
        });
        if (geofenceBlock) return geofenceBlock;

        const { data: jobSettings, error: settingsErr } = await supabaseAdmin
          .from("job_punch_clock_settings")
          .select("require_photo, require_location")
          .eq("job_id", currentPunch.job_id)
          .maybeSingle();

        const { data: companySettings, error: companySettingsErr } = await supabaseAdmin
          .from("punch_clock_settings")
          .select("require_photo, require_location, company_id")
          .limit(1)
          .maybeSingle();

        if (settingsErr) console.error("Error loading job settings:", settingsErr);
        if (companySettingsErr) console.error("Error loading company settings:", companySettingsErr);

        const photoRequired = jobSettings?.require_photo ?? companySettings?.require_photo ?? false;
        const locationRequired = jobSettings?.require_location ?? companySettings?.require_location ?? false;

        // Resolve timing for cost code
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

        let costCodeToUse = currentPunch?.cost_code_id ?? null;
        if (cost_code_id) {
          const { data: costCodeData, error: ccError } = await supabaseAdmin
            .from('cost_codes')
            .select('id, job_id')
            .eq('id', cost_code_id)
            .maybeSingle();
          
          if (ccError || !costCodeData) return errorResponse("Invalid cost code", 400);
          if (costCodeData.job_id !== currentPunch.job_id) return errorResponse("Cost code does not belong to the current job", 400);
          
          costCodeToUse = cost_code_id;
        }

        if (timingOut === 'punch_out' && !costCodeToUse) {
          // Fetch available cost codes for error message
          let costCodesQuery = supabaseAdmin
            .from('cost_codes')
            .select('id, code, description')
            .eq('job_id', currentPunch.job_id)
            .eq('is_active', true)
            .eq('type', 'labor')
            .order('code');
          
          // Check employee assignments for filtering
          const { data: empSettings } = await supabaseAdmin
            .from('employee_timecard_settings')
            .select('assigned_cost_codes')
            .eq('user_id', userRow.user_id);
          
          const assignedCostCodes = new Set<string>();
          (empSettings || []).forEach((s: any) => {
            (s.assigned_cost_codes || []).forEach((c: string) => assignedCostCodes.add(c));
          });
          
          if (assignedCostCodes.size > 0) {
            costCodesQuery = costCodesQuery.in('id', Array.from(assignedCostCodes));
          }
          
          const { data: availableCostCodes } = await costCodesQuery;
          
          let message = "Please select a cost code to complete your punch out.";
          if (availableCostCodes && availableCostCodes.length > 0) {
            const codesList = availableCostCodes
              .map((cc: any) => `${cc.code} - ${cc.description}`)
              .join(', ');
            message = `Please select a cost code to punch out. Available options: ${codesList}`;
          } else {
            message = "A cost code is required to punch out, but no cost codes are available for this job. Please contact your supervisor.";
          }
          
          return new Response(
            JSON.stringify({
              error: message,
              code: 'COST_CODE_REQUIRED',
              available_cost_codes: availableCostCodes || []
            }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Backfill cost code on punch-in record if needed
        if (cost_code_id && !currentPunch?.cost_code_id) {
          const { error: statusUpdateErr } = await supabaseAdmin
            .from('current_punch_status')
            .update({ cost_code_id: cost_code_id })
            .eq('user_id', userRow.user_id)
            .eq('is_active', true);
          
          if (statusUpdateErr) console.error('Error updating current_punch_status:', statusUpdateErr);
          
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
          
          if (punchUpdateErr) console.error('Error updating punch_in record:', punchUpdateErr);
        }

        if (photoRequired && !photo_url) {
          return errorResponse("Photo is required for punch out on this job", 400);
        }

        let locationWarningOut: string | null = null;
        if (locationRequired && (!latitude || !longitude)) {
          locationWarningOut = "Location missing (required by settings)";
        }

        // Server-side geofence enforcement / warning fallback (authoritative)
        const geofenceResultOut = await enforcePunchDistanceIfRequired(supabaseAdmin, {
          action: "out",
          company_id: companyId,
          user_id: userRow.user_id,
          pin_employee_id: null,
          job_id: currentPunch.job_id ?? null,
          latitude,
          longitude,
          is_pin_employee: false,
        });
        if (geofenceResultOut.blockedResponse) return geofenceResultOut.blockedResponse;

        const userAgent = req.headers.get('user-agent') || null;
        const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || null;

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
        
        if (punchErr) return errorResponse(punchErr.message, 500);

        const { error: statusErr } = await supabaseAdmin
          .from("current_punch_status")
          .update({ is_active: false })
          .eq("user_id", userRow.user_id)
          .eq("is_active", true);
          
        if (statusErr) return errorResponse(statusErr.message, 500);

        // Create time card
        try {
          let punchInDate = new Date(currentPunch.punch_in_time);
          let punchOutDate = new Date(now);

          const { data: jobShiftSettings } = await supabaseAdmin
            .from('jobs')
            .select('shift_start_time, shift_end_time, count_early_punch_in, early_punch_in_grace_minutes, count_late_punch_out, late_punch_out_grace_minutes')
            .eq('id', currentPunch.job_id)
            .maybeSingle();

          if (jobShiftSettings?.shift_start_time && jobShiftSettings?.shift_end_time) {
            const TIMEZONE_OFFSET_HOURS = 5;
            
            const localPunchIn = new Date(punchInDate.getTime() - TIMEZONE_OFFSET_HOURS * 3600000);
            const localPunchOut = new Date(punchOutDate.getTime() - TIMEZONE_OFFSET_HOURS * 3600000);
            
            const shiftStart = new Date(localPunchIn);
            const [startHours, startMinutes] = jobShiftSettings.shift_start_time.split(':').map(Number);
            shiftStart.setHours(startHours, startMinutes, 0, 0);

            const shiftEnd = new Date(localPunchOut);
            const [endHours, endMinutes] = jobShiftSettings.shift_end_time.split(':').map(Number);
            shiftEnd.setHours(endHours, endMinutes, 0, 0);

            if (shiftEnd < shiftStart) {
              shiftEnd.setDate(shiftEnd.getDate() + 1);
            }

            const earlyGrace = jobShiftSettings.early_punch_in_grace_minutes ?? 0;
            const lateGrace = jobShiftSettings.late_punch_out_grace_minutes ?? 0;
            const countEarly = jobShiftSettings.count_early_punch_in === true;
            const countLate = jobShiftSettings.count_late_punch_out === true;

            if (localPunchIn < shiftStart) {
              const earliestCountedStart = countEarly
                ? new Date(shiftStart.getTime() - earlyGrace * 60000)
                : shiftStart;

              if (localPunchIn < earliestCountedStart) {
                punchInDate = new Date(earliestCountedStart.getTime() + TIMEZONE_OFFSET_HOURS * 3600000);
              } else if (!countEarly) {
                punchInDate = new Date(shiftStart.getTime() + TIMEZONE_OFFSET_HOURS * 3600000);
              }
            }

            if (localPunchOut > shiftEnd) {
              const graceEnd = new Date(shiftEnd.getTime() + lateGrace * 60000);

              if (!countLate) {
                punchOutDate = new Date(shiftEnd.getTime() + TIMEZONE_OFFSET_HOURS * 3600000);
              } else if (localPunchOut < graceEnd) {
                punchOutDate = new Date(shiftEnd.getTime() + TIMEZONE_OFFSET_HOURS * 3600000);
              }
            }
          }

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

          let totalHours = Math.max(0, (punchOutDate.getTime() - punchInDate.getTime()) / (1000 * 60 * 60));
          const breakMinutes = totalHours > autoBreakWaitHours ? autoBreakDuration : 0;
          totalHours = totalHours - breakMinutes / 60;
          const overtimeHours = calculateOvertime ? Math.max(0, totalHours - overtimeThreshold) : 0;

          const { data: flagSettings } = await supabaseAdmin
            .from("job_punch_clock_settings")
            .select("flag_timecards_over_12hrs, flag_timecards_over_24hrs")
            .eq("company_id", companyId)
            .is("job_id", null)
            .maybeSingle();

          const flagOver12 = flagSettings?.flag_timecards_over_12hrs ?? true;
          const flagOver24 = flagSettings?.flag_timecards_over_24hrs ?? true;

          const calculateDistanceMeters = (
            lat1: number | null, lng1: number | null,
            lat2: number | null, lng2: number | null
          ): number | null => {
            if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
            return haversineDistanceMeters(lat1, lng1, lat2, lng2);
          };

          const punchInLat = currentPunch.punch_in_location_lat ?? null;
          const punchInLng = currentPunch.punch_in_location_lng ?? null;
          const punchOutLat = latitude ?? null;
          const punchOutLng = longitude ?? null;
          
          const distanceMeters = calculateDistanceMeters(punchInLat, punchInLng, punchOutLat, punchOutLng);
          const LOCATION_THRESHOLD_METERS = 500;
          const locationsDiffer = distanceMeters !== null && distanceMeters > LOCATION_THRESHOLD_METERS;
          
          const shouldFlagHours = (flagOver24 && totalHours > 24) || (flagOver12 && totalHours > 12);
          const geofenceWarningTriggered = geofenceResultOut.warning?.warning_reason === 'outside_jobsite_warning';
          const shouldFlag = shouldFlagHours || locationsDiffer || geofenceWarningTriggered;
          const timecardStatus = shouldFlag ? 'pending' : 'approved';
          
          const flagReason = locationsDiffer 
            ? `Punch-out location differs from punch-in (${distanceMeters?.toFixed(0)}m apart)`
            : shouldFlagHours 
              ? `Time card exceeds ${totalHours > 24 ? '24' : '12'} hours`
              : geofenceWarningTriggered
                ? `Punched outside jobsite warning distance (${geofenceResultOut.warning?.distance_from_job_meters}m > ${geofenceResultOut.warning?.distance_limit_meters}m)`
                : null;

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
              punch_in_location_lat: punchInLat,
              punch_in_location_lng: punchInLng,
              punch_out_location_lat: punchOutLat,
              punch_out_location_lng: punchOutLng,
              punch_in_photo_url: currentPunch.punch_in_photo_url ?? null,
              punch_out_photo_url: photo_url ?? null,
              notes: locationsDiffer ? (body?.notes ? `${body.notes} | ${flagReason}` : flagReason) : (body?.notes ?? null),
              status: timecardStatus,
              created_via_punch_clock: true,
              requires_approval: shouldFlag,
              distance_warning: locationsDiffer
            });

          if (tcErr) {
            console.error('Error creating time card:', tcErr);
          }
        } catch (tcCatchErr) {
          console.error('Exception while creating time card:', tcCatchErr);
        }

        return jsonResponse({
          ok: true,
          current_punch: null,
          warning: locationWarningOut,
          ...(geofenceResultOut.warning ? { geofence_warning: geofenceResultOut.warning } : {}),
          ...(geofenceResultOut.geofenceDistanceMeters != null
            ? { distance_from_job_meters: geofenceResultOut.geofenceDistanceMeters }
            : {}),
        });
      }

      return errorResponse("Invalid action. Use 'in' or 'out'", 400);
    }
    
    // Handle new employee dashboard endpoints
    if (req.method === "POST") {
      const body = await req.json();
      const { action, pin } = body;
      
      if (action === 'init') {
        const userRow = await validatePin(supabaseAdmin, pin);
        if (!userRow) return errorResponse("Invalid PIN", 401);
        
        let assignedJobs: string[] = [];
        let assignedCostCodes: string[] = [];
        
        // Use employee_timecard_settings for all users
        const { data: settings } = await supabaseAdmin
          .from('employee_timecard_settings')
          .select('assigned_jobs, assigned_cost_codes')
          .eq('user_id', userRow.user_id)
          .maybeSingle();
        
        if (settings) {
          assignedJobs = settings.assigned_jobs || [];
          assignedCostCodes = settings.assigned_cost_codes || [];
        }

        // pin_employee_timecard_settings fallback removed
        
        const { data: jobs } = await supabaseAdmin
          .from('jobs')
          .select('id, name')
          .in('id', assignedJobs.length > 0 ? assignedJobs : ['00000000-0000-0000-0000-000000000000'])
          .eq('is_active', true);
        
        const { data: costCodes } = await supabaseAdmin
          .from('cost_codes')
          .select('id, code, description')
          .in('id', assignedCostCodes.length > 0 ? assignedCostCodes : ['00000000-0000-0000-0000-000000000000'])
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
        
        let assignedJobs: string[] = [];
        
        const { data: settings } = await supabaseAdmin
          .from('employee_timecard_settings')
          .select('assigned_jobs')
          .eq('user_id', userRow.user_id)
          .maybeSingle();
        
        if (settings?.assigned_jobs) {
          assignedJobs = settings.assigned_jobs;
        }

        // pin_employee_timecard_settings fallback removed
        
        if (assignedJobs.length === 0) {
          return new Response(JSON.stringify({ contacts: [] }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        
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
