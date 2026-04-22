import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const safeString = (value: unknown) => String(value ?? "").trim();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Missing Supabase service role configuration." });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";
    if (!bearerToken) {
      return json(401, { error: "Missing bearer token." });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authUserData, error: authUserError } = await admin.auth.getUser(bearerToken);
    if (authUserError || !authUserData?.user?.id) {
      return json(401, { error: "Invalid user token." });
    }

    const actorUserId = String(authUserData.user.id);
    const { data: superAdminRow, error: superAdminError } = await admin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", actorUserId)
      .maybeSingle();
    if (superAdminError) throw superAdminError;
    if (!superAdminRow?.user_id) {
      return json(403, { error: "Super admin access is required." });
    }

    const body = await req.json().catch(() => ({}));
    const email = safeString(body?.email).toLowerCase();
    const requestedRole = safeString(body?.requestedRole).toLowerCase() === "design_professional"
      ? "design_professional"
      : "vendor";
    let companyId = safeString(body?.companyId);
    const companyName = safeString(body?.companyName);

    if (!email) {
      return json(400, { error: "Email is required." });
    }

    let matchedUser: any = null;
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      matchedUser = (data?.users || []).find((user: any) => safeString(user?.email).toLowerCase() === email) || null;
      if (matchedUser || (data?.users || []).length < 1000) break;
    }

    if (!matchedUser?.id) {
      return json(404, { error: "No auth user found for that email.", email });
    }

    const userId = String(matchedUser.id);

    if (!companyId && companyName) {
      const normalizedCompanyName = companyName.replace(/[%_,]/g, " ").trim();
      const { data: matchedCompanies, error: companyLookupError } = await admin
        .from("companies")
        .select("id, name, display_name")
        .or(`name.ilike.%${normalizedCompanyName}%,display_name.ilike.%${normalizedCompanyName}%`)
        .limit(5);
      if (companyLookupError) throw companyLookupError;
      companyId = safeString(matchedCompanies?.[0]?.id);
    }

    if (!companyId) {
      const { data: latestRequest, error: latestRequestError } = await admin
        .from("company_access_requests")
        .select("company_id, notes, requested_at")
        .eq("user_id", userId)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestRequestError) throw latestRequestError;
      companyId = safeString(latestRequest?.company_id);
    }

    if (!companyId) {
      return json(400, {
        error: "Could not resolve a target company for this signup.",
        email,
        userId,
      });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("user_id, role, status, first_name, last_name, display_name, vendor_id, custom_role_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) throw profileError;

    const { data: targetCompany, error: targetCompanyError } = await admin
      .from("companies")
      .select("id, name, display_name")
      .eq("id", companyId)
      .maybeSingle();
    if (targetCompanyError) throw targetCompanyError;

    let businessName: string | null = null;

    const { data: existingRequest, error: existingRequestError } = await admin
      .from("company_access_requests")
      .select("id, status, notes")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingRequestError) throw existingRequestError;

    try {
      const parsed = existingRequest?.notes ? JSON.parse(existingRequest.notes) : null;
      const existingBusinessName = safeString(parsed?.businessName);
      if (!businessName && existingBusinessName) businessName = existingBusinessName;
    } catch {
      // ignore malformed notes payloads; we will overwrite with clean notes below
    }

    const notesPayload = {
      requestType: "external_access_signup",
      requestedRole,
      businessName,
      customRoleId: profile?.custom_role_id || null,
      homeCompanyId: null,
      homeCompanyName: businessName,
      externalCompanyId: companyId,
      externalCompanyName: safeString(targetCompany?.display_name || targetCompany?.name) || null,
      requestedAt: new Date().toISOString(),
      email,
    };

    if (existingRequest?.id) {
      const { error: requestUpdateError } = await admin
        .from("company_access_requests")
        .update({
          status: "pending",
          notes: JSON.stringify(notesPayload),
          requested_at: new Date().toISOString(),
          reviewed_at: null,
          reviewed_by: null,
        })
        .eq("id", existingRequest.id);
      if (requestUpdateError) throw requestUpdateError;
    } else {
      const { error: requestInsertError } = await admin
        .from("company_access_requests")
        .insert({
          user_id: userId,
          company_id: companyId,
          status: "pending",
          requested_at: new Date().toISOString(),
          notes: JSON.stringify(notesPayload),
        });
      if (requestInsertError) throw requestInsertError;
    }

    const { data: accessRow, error: accessLookupError } = await admin
      .from("user_company_access")
      .select("id, is_active, role")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (accessLookupError) throw accessLookupError;

    if (accessRow?.id) {
      const { error: accessUpdateError } = await admin
        .from("user_company_access")
        .update({
          role: requestedRole,
          is_active: true,
          granted_by: userId,
        })
        .eq("id", accessRow.id);
      if (accessUpdateError) throw accessUpdateError;
    } else {
      const { error: accessInsertError } = await admin
        .from("user_company_access")
        .insert({
          user_id: userId,
          company_id: companyId,
          role: requestedRole,
          is_active: true,
          granted_by: userId,
          granted_at: new Date().toISOString(),
        });
      if (accessInsertError) throw accessInsertError;
    }

    const profilePatch: Record<string, unknown> = {
      role: requestedRole,
    };
    if (safeString(profile?.status).toLowerCase() !== "approved") {
      profilePatch.status = "pending";
      profilePatch.approved_at = null;
      profilePatch.approved_by = null;
    }

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("user_id", userId);
    if (profileUpdateError) throw profileUpdateError;

    return json(200, {
      success: true,
      email,
      userId,
      companyId,
      companyName: safeString(targetCompany?.display_name || targetCompany?.name) || null,
      requestedRole,
      repaired: {
        companyAccessRequest: true,
        userCompanyAccess: true,
        profileRole: true,
      },
      repairedBy: actorUserId,
    });
  } catch (error: any) {
    console.error("repair-stuck-vendor-signup failed:", error);
    return json(500, {
      error: safeString(error?.message) || "Repair failed.",
      details: error?.details || null,
      hint: error?.hint || null,
      code: error?.code || null,
    });
  }
});
