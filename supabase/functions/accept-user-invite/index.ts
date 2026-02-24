import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AcceptInviteRequest = {
  inviteToken: string;
};

const ALLOWED_BASE_ROLES = new Set([
  "admin",
  "company_admin",
  "controller",
  "project_manager",
  "employee",
  "view_only",
  "vendor",
]);

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAuthed = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { inviteToken }: AcceptInviteRequest = await req.json();
    if (!inviteToken) {
      return new Response(JSON.stringify({ error: "Missing inviteToken" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const normalizedEmail = (userData.user.email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return new Response(JSON.stringify({ error: "Authenticated user has no email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: pendingInvite, error: pendingError } = await supabaseAuthed
      .from("pending_user_invites")
      .select("id, email, company_id, role, custom_role_id, invited_by, expires_at, accepted_at")
      .eq("invite_token", inviteToken)
      .maybeSingle();

    if (pendingError) throw pendingError;
    if (!pendingInvite) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (pendingInvite.accepted_at) {
      return new Response(JSON.stringify({ success: true, alreadyAccepted: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (new Date(pendingInvite.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Invitation has expired" }), {
        status: 410,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const inviteEmail = String(pendingInvite.email || "").trim().toLowerCase();
    if (inviteEmail !== normalizedEmail) {
      return new Response(JSON.stringify({ error: "This invite is for a different email address" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const baseRole = ALLOWED_BASE_ROLES.has(String(pendingInvite.role || "").toLowerCase())
      ? String(pendingInvite.role).toLowerCase()
      : "employee";

    const nowIso = new Date().toISOString();

    // Grant/activate company access
    const { data: existingAccess, error: existingAccessError } = await supabaseAuthed
      .from("user_company_access")
      .select("id")
      .eq("company_id", pendingInvite.company_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (existingAccessError) throw existingAccessError;

    if (existingAccess?.id) {
      const { error: updateAccessError } = await supabaseAuthed
        .from("user_company_access")
        .update({
          is_active: true,
          role: baseRole as any,
          granted_by: pendingInvite.invited_by,
        })
        .eq("id", existingAccess.id);
      if (updateAccessError) throw updateAccessError;
    } else {
      const { error: insertAccessError } = await supabaseAuthed
        .from("user_company_access")
        .insert({
          company_id: pendingInvite.company_id,
          user_id: userData.user.id,
          role: baseRole as any,
          is_active: true,
          granted_by: pendingInvite.invited_by,
        });
      if (insertAccessError) throw insertAccessError;
    }

    // Apply custom role to profile (if present on invite)
    const profilePatch: Record<string, unknown> = {
      custom_role_id: pendingInvite.custom_role_id ?? null,
      status: "approved",
      approved_at: nowIso,
      approved_by: pendingInvite.invited_by,
      current_company_id: pendingInvite.company_id,
    };
    if (pendingInvite.custom_role_id) {
      // Keep base profile role neutral and rely on company access + custom role permissions
      profilePatch.role = "employee";
    }

    const { error: profileUpdateError } = await supabaseAuthed
      .from("profiles")
      .update(profilePatch)
      .eq("user_id", userData.user.id);
    if (profileUpdateError) throw profileUpdateError;

    // Mark invitation accepted in both tracking tables
    await supabaseAuthed
      .from("pending_user_invites")
      .update({ accepted_at: nowIso, updated_at: nowIso })
      .eq("id", pendingInvite.id);

    await supabaseAuthed
      .from("user_invitations")
      .update({
        status: "accepted",
        accepted_at: nowIso,
        accepted_by: userData.user.id,
        updated_at: nowIso,
      })
      .eq("company_id", pendingInvite.company_id)
      .eq("email", pendingInvite.email)
      .eq("status", "pending");

    return new Response(
      JSON.stringify({
        success: true,
        companyId: pendingInvite.company_id,
        role: baseRole,
        customRoleId: pendingInvite.custom_role_id ?? null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("Error in accept-user-invite:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
