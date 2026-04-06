import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const safeParseNotes = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const isMissingRelationError = (error: unknown, relationName: string): boolean => {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return message.includes(relationName.toLowerCase()) && (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("relation")
  );
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

    const { companyId, jobId, inviteToken } = await req.json().catch(() => ({}));
    if (!companyId || !jobId) {
      return new Response(JSON.stringify({ error: "companyId and jobId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: requestRow, error: requestError } = await admin
      .from("company_access_requests")
      .select("id, status, notes")
      .eq("user_id", authData.user.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (requestError || !requestRow) {
      throw requestError || new Error("Invitation request not found");
    }

    const notes = safeParseNotes(requestRow.notes);
    const pendingJobInvites = Array.isArray(notes.pendingJobInvites)
      ? notes.pendingJobInvites.filter(Boolean)
      : [];

    const legacyInvite =
      notes.invitedJobId && notes.externalCompanyId
        ? {
            inviteToken: notes.jobInviteToken || null,
            jobId: notes.invitedJobId,
            companyId: notes.externalCompanyId,
            invitedAt: notes.requestedAt || null,
          }
        : null;

    const inviteCandidates = [
      ...pendingJobInvites,
      ...(legacyInvite ? [legacyInvite] : []),
    ];

    const matchingInvite = inviteCandidates.find((row: any) => {
      const rowJobId = String(row?.jobId || "");
      const rowCompanyId = String(row?.companyId || "");
      const rowInviteToken = String(row?.inviteToken || "");
      return rowJobId === String(jobId)
        && rowCompanyId === String(companyId)
        && (!inviteToken || rowInviteToken === String(inviteToken));
    });

    if (!matchingInvite) {
      const [{ data: existingCompanyAccess, error: existingCompanyAccessError }, { data: existingJobAccess, error: existingJobAccessError }] = await Promise.all([
        admin
          .from("user_company_access")
          .select("user_id, role, is_active")
          .eq("user_id", authData.user.id)
          .eq("company_id", companyId)
          .maybeSingle(),
        admin
          .from("user_job_access")
          .select("id")
          .eq("user_id", authData.user.id)
          .eq("job_id", jobId)
          .maybeSingle(),
      ]);

      if (existingCompanyAccessError) throw existingCompanyAccessError;
      if (existingJobAccessError) throw existingJobAccessError;

      const alreadyProvisioned =
        existingCompanyAccess?.user_id &&
        existingCompanyAccess?.is_active === true &&
        String(existingCompanyAccess?.role || "").toLowerCase() === "design_professional" &&
        existingJobAccess?.id;

      if (alreadyProvisioned) {
        await admin
          .from("notifications")
          .update({ read: true })
          .eq("user_id", authData.user.id)
          .eq("type", `design_pro_job_invite:${jobId}`);

        return new Response(JSON.stringify({ success: true, alreadyAccepted: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Pending invitation not found for this job" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const grantedBy = String(matchingInvite?.invitedBy || authData.user.id);

    const { data: existingCompanyAccess, error: existingCompanyAccessError } = await admin
      .from("user_company_access")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (existingCompanyAccessError) throw existingCompanyAccessError;

    if (existingCompanyAccess?.user_id) {
      const { error: updateCompanyAccessError } = await admin
        .from("user_company_access")
        .update({
          role: "design_professional",
          is_active: true,
          granted_by: grantedBy,
        })
        .eq("user_id", authData.user.id)
        .eq("company_id", companyId);
      if (updateCompanyAccessError) throw updateCompanyAccessError;
    } else {
      const { error: insertCompanyAccessError } = await admin
        .from("user_company_access")
        .insert({
          user_id: authData.user.id,
          company_id: companyId,
          role: "design_professional",
          is_active: true,
          granted_by: grantedBy,
        });
      if (insertCompanyAccessError) throw insertCompanyAccessError;
    }

    const { data: existingJobAccess, error: existingJobAccessError } = await admin
      .from("user_job_access")
      .select("id")
      .eq("user_id", authData.user.id)
      .eq("job_id", jobId)
      .maybeSingle();
    if (existingJobAccessError) throw existingJobAccessError;

    if (!existingJobAccess?.id) {
      const { error: insertJobAccessError } = await admin
        .from("user_job_access")
        .insert({
          user_id: authData.user.id,
          job_id: jobId,
          granted_by: grantedBy,
        });
      if (insertJobAccessError) throw insertJobAccessError;
    }

    const remainingPendingJobInvites = inviteCandidates.filter((row: any) => {
      const sameJob = String(row?.jobId || "") === String(jobId);
      const sameCompany = String(row?.companyId || "") === String(companyId);
      const sameToken = !inviteToken || String(row?.inviteToken || "") === String(inviteToken);
      return !(sameJob && sameCompany && sameToken);
    });

    const nextNotes = {
      ...notes,
      invitedJobId: remainingPendingJobInvites[0]?.jobId || null,
      jobInviteToken: remainingPendingJobInvites[0]?.inviteToken || null,
      externalCompanyId: remainingPendingJobInvites[0]?.companyId || notes.externalCompanyId || null,
      pendingJobInvites: remainingPendingJobInvites,
      lastAcceptedJobInviteAt: new Date().toISOString(),
    };

    const { error: requestUpdateError } = await admin
      .from("company_access_requests")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: authData.user.id,
        notes: JSON.stringify(nextNotes),
      })
      .eq("id", requestRow.id);
    if (requestUpdateError) throw requestUpdateError;

    const { error: notificationUpdateError } = await admin
      .from("notifications")
      .update({ read: true })
      .eq("user_id", authData.user.id)
      .eq("type", `design_pro_job_invite:${jobId}`);
    if (notificationUpdateError) {
      console.warn("Failed to mark design pro invite notifications as read:", notificationUpdateError);
    }

    const { error: inviteTableUpdateError } = await admin
      .from("design_professional_job_invites")
      .update({
        status: "accepted",
        accepted_by_user_id: authData.user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("job_id", jobId)
      .eq("email", String(authData.user.email || "").trim().toLowerCase())
      .eq("status", "pending");
    if (inviteTableUpdateError && !isMissingRelationError(inviteTableUpdateError, "design_professional_job_invites")) {
      throw inviteTableUpdateError;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in accept-design-professional-job-invite:", error);
    return new Response(JSON.stringify({ error: error?.message || "Failed to accept invitation" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
