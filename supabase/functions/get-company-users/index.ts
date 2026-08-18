import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MANAGER_ROLES = new Set(["owner", "admin", "company_admin", "controller"]);
const EXTERNAL_ROLES = new Set(["vendor", "design_professional"]);

const normalizeRole = (value: unknown) => String(value || "").trim().toLowerCase();

const getRolePriority = (role: string) => {
  switch (role) {
    case "owner":
      return 100;
    case "company_admin":
    case "admin":
      return 90;
    case "controller":
      return 80;
    case "project_manager":
      return 70;
    case "employee":
      return 60;
    case "view_only":
      return 50;
    case "design_professional":
      return 40;
    case "vendor":
      return 30;
    default:
      return 0;
  }
};

type RequestBody = {
  companyId?: string;
  includeExternal?: boolean;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await authed.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { companyId, includeExternal = false }: RequestBody = await req.json();
    const normalizedCompanyId = String(companyId || "").trim();
    if (!normalizedCompanyId) {
      return new Response(JSON.stringify({ error: "companyId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const requesterUserId = authData.user.id;
    const { data: requesterAccessRows, error: requesterAccessError } = await admin
      .from("user_company_access")
      .select("role, is_active")
      .eq("company_id", normalizedCompanyId)
      .eq("user_id", requesterUserId);

    if (requesterAccessError) throw requesterAccessError;

    const canManageUsers = (requesterAccessRows || []).some((row: any) => {
      const role = normalizeRole(row.role);
      return row.is_active !== false && MANAGER_ROLES.has(role);
    });

    if (!canManageUsers) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: accessRows, error: accessError } = await admin
      .from("user_company_access")
      .select("user_id, role, is_active")
      .eq("company_id", normalizedCompanyId)
      .or("is_active.eq.true,is_active.is.null");

    if (accessError) throw accessError;

    const dedupedAccessByUserId = new Map<string, { user_id: string; company_role: string }>();
    for (const row of accessRows || []) {
      const userId = String((row as any).user_id || "").trim();
      const companyRole = normalizeRole((row as any).role);
      if (!userId || !companyRole) continue;
      if (!includeExternal && EXTERNAL_ROLES.has(companyRole)) continue;

      const existing = dedupedAccessByUserId.get(userId);
      if (!existing || getRolePriority(companyRole) >= getRolePriority(existing.company_role)) {
        dedupedAccessByUserId.set(userId, { user_id: userId, company_role: companyRole });
      }
    }

    const userIds = Array.from(dedupedAccessByUserId.keys());
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, user_id, first_name, last_name, display_name, avatar_url, created_at, pin_code, has_global_job_access, status, phone, punch_clock_access, pm_lynk_access, custom_role_id, role, vendor_id, current_company_id")
      .in("user_id", userIds)
      .order("created_at", { ascending: false });

    if (profilesError) throw profilesError;

    const users = (profiles || []).map((profile: any) => ({
      ...profile,
      company_role: dedupedAccessByUserId.get(String(profile.user_id || "").trim())?.company_role || normalizeRole(profile.role) || "employee",
    }));

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("get-company-users error", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
