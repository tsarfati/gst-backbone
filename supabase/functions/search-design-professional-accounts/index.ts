import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const normalize = (value: unknown) => String(value || "").trim().toLowerCase();

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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await authed.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const query = normalize(body.query);
    const companyId = String(body.companyId || "").trim();

    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: accessRows, error: accessError } = await admin
      .from("user_company_access")
      .select("role, is_active")
      .eq("company_id", companyId)
      .eq("user_id", authData.user.id);
    if (accessError) throw accessError;

    const canSearch = (accessRows || []).some((row: any) => {
      const role = String(row.role || "").toLowerCase();
      return row.is_active === true && ["admin", "company_admin", "controller", "owner", "project_manager"].includes(role);
    });

    if (!canSearch) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const like = `%${query}%`;

    const [profileRes, companyRes] = await Promise.all([
      admin
        .from("profiles")
        .select("user_id, first_name, last_name, display_name, email, avatar_url, role, status, current_company_id")
        .eq("role", "design_professional")
        .eq("status", "approved")
        .or(`email.ilike.${like},display_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`)
        .limit(20),
      admin
        .from("companies")
        .select("id, name, display_name, email, logo_url, created_by, company_type")
        .eq("company_type", "design_professional")
        .or(`name.ilike.${like},display_name.ilike.${like},email.ilike.${like}`)
        .limit(20),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (companyRes.error) throw companyRes.error;

    const profileRows = profileRes.data || [];
    const companyRows = companyRes.data || [];

    const companyIdsFromProfiles = Array.from(new Set(
      profileRows.map((row: any) => String(row.current_company_id || "").trim()).filter(Boolean),
    ));
    const creatorUserIds = Array.from(new Set(
      companyRows.map((row: any) => String(row.created_by || "").trim()).filter(Boolean),
    ));

    const [linkedCompaniesRes, linkedProfilesRes] = await Promise.all([
      companyIdsFromProfiles.length > 0
        ? admin
            .from("companies")
            .select("id, name, display_name, email, logo_url, created_by, company_type")
            .in("id", companyIdsFromProfiles)
        : Promise.resolve({ data: [], error: null }),
      creatorUserIds.length > 0
        ? admin
            .from("profiles")
            .select("user_id, first_name, last_name, display_name, email, avatar_url, role, status, current_company_id")
            .in("user_id", creatorUserIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if ((linkedCompaniesRes as any).error) throw (linkedCompaniesRes as any).error;
    if ((linkedProfilesRes as any).error) throw (linkedProfilesRes as any).error;

    const allCompanies = [...companyRows, ...(((linkedCompaniesRes as any).data || []) as any[])];
    const allProfiles = [...profileRows, ...(((linkedProfilesRes as any).data || []) as any[])];

    const companyMap = new Map<string, any>();
    allCompanies.forEach((company: any) => {
      if (company?.id) companyMap.set(String(company.id), company);
    });

    const profileMap = new Map<string, any>();
    allProfiles.forEach((profile: any) => {
      if (profile?.user_id) profileMap.set(String(profile.user_id), profile);
    });

    const resultsMap = new Map<string, any>();

    allProfiles.forEach((profile: any) => {
      const company = companyMap.get(String(profile.current_company_id || ""));
      const key = String(profile.user_id);
      resultsMap.set(key, {
        userId: key,
        companyId: company?.id ? String(company.id) : null,
        companyName: String(company?.display_name || company?.name || ""),
        companyLogoUrl: company?.logo_url ? String(company.logo_url) : null,
        firstName: profile?.first_name ? String(profile.first_name) : "",
        lastName: profile?.last_name ? String(profile.last_name) : "",
        displayName: String(
          profile?.display_name
            || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
            || profile?.email
            || "Design Professional",
        ),
        email: String(profile?.email || ""),
        avatarUrl: profile?.avatar_url ? String(profile.avatar_url) : null,
        hasAccount: true,
      });
    });

    companyRows.forEach((company: any) => {
      const creatorId = String(company?.created_by || "");
      const profile = profileMap.get(creatorId);
      const key = creatorId || `company:${company.id}`;
      resultsMap.set(key, {
        userId: creatorId || null,
        companyId: String(company.id),
        companyName: String(company.display_name || company.name || ""),
        companyLogoUrl: company?.logo_url ? String(company.logo_url) : null,
        firstName: profile?.first_name ? String(profile.first_name) : "",
        lastName: profile?.last_name ? String(profile.last_name) : "",
        displayName: String(
          profile?.display_name
            || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
            || company.display_name
            || company.name
            || "Design Professional",
        ),
        email: String(profile?.email || company?.email || ""),
        avatarUrl: profile?.avatar_url ? String(profile.avatar_url) : null,
        hasAccount: true,
      });
    });

    const results = Array.from(resultsMap.values())
      .filter((row) => row.email || row.companyName || row.displayName)
      .sort((a, b) => {
        const aExact = [a.email, a.displayName, a.companyName].some((value) => normalize(value) === query) ? 1 : 0;
        const bExact = [b.email, b.displayName, b.companyName].some((value) => normalize(value) === query) ? 1 : 0;
        return bExact - aExact || a.displayName.localeCompare(b.displayName);
      })
      .slice(0, 12);

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in search-design-professional-accounts:", error);
    return new Response(JSON.stringify({ error: error?.message || "Failed to search design professional accounts" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
