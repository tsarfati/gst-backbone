import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MANAGER_ROLES = new Set(["owner", "admin", "company_admin", "controller"]);

const normalizeRole = (value: unknown) => String(value || "").trim().toLowerCase();

type RequestBody = {
  userId?: string;
  contextCompanyId?: string;
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

    const { userId, contextCompanyId }: RequestBody = await req.json();
    const normalizedUserId = String(userId || "").trim();
    const normalizedContextCompanyId = String(contextCompanyId || "").trim();

    if (!normalizedUserId || !normalizedContextCompanyId) {
      return new Response(JSON.stringify({ error: "userId and contextCompanyId are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const requesterUserId = authData.user.id;
    const { data: requesterAccessRows, error: requesterAccessError } = await admin
      .from("user_company_access")
      .select("role, is_active")
      .eq("company_id", normalizedContextCompanyId)
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
      .select("id, company_id, role, is_active, granted_at")
      .eq("user_id", normalizedUserId)
      .order("granted_at", { ascending: false });

    if (accessError) throw accessError;

    const activeRows = (accessRows || []).filter((row: any) => row.is_active !== false);
    const companyIds = Array.from(
      new Set(activeRows.map((row: any) => String(row.company_id || "").trim()).filter(Boolean)),
    );

    const { data: companyRows, error: companyError } = companyIds.length > 0
      ? await admin
          .from("companies")
          .select("id, name, display_name")
          .in("id", companyIds)
      : { data: [], error: null };

    if (companyError) throw companyError;

    const companyById = new Map((companyRows || []).map((company: any) => [String(company.id), company]));

    return new Response(
      JSON.stringify({
        accesses: activeRows.map((row: any) => ({
          ...row,
          company: companyById.get(String(row.company_id || "").trim()) || null,
        })),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("get-user-company-access error", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
