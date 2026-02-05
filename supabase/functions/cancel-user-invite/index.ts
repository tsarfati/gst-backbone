import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CancelInviteRequest = {
  invitationId: string;
  companyId: string;
};

const handler = async (req: Request): Promise<Response> => {
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
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { invitationId, companyId }: CancelInviteRequest = await req.json();
    if (!invitationId || !companyId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Authorization: allow only admin/controller/company_admin on the company
    const { data: access, error: accessError } = await supabaseAuthed
      .from("user_company_access")
      .select("role, is_active")
      .eq("company_id", companyId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (accessError) throw accessError;

    const role = (access?.role ?? "").toLowerCase();
    const isActive = access?.is_active === true;
    const canManage = isActive && ["admin", "company_admin", "controller", "owner"].includes(role);

    if (!canManage) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch invitation email (used to remove tokens from pending_user_invites)
    const { data: inviteRow, error: inviteError } = await supabaseAuthed
      .from("user_invitations")
      .select("email")
      .eq("id", invitationId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!inviteRow?.email) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const nowIso = new Date().toISOString();

    // Cancel invite
    const { error: cancelError } = await supabaseAuthed
      .from("user_invitations")
      .update({ status: "cancelled", updated_at: nowIso })
      .eq("id", invitationId)
      .eq("company_id", companyId)
      .eq("status", "pending");

    if (cancelError) throw cancelError;

    // Remove any pending auth-flow invites for this email/company
    const { error: pendingDeleteError } = await supabaseAuthed
      .from("pending_user_invites")
      .delete()
      .eq("company_id", companyId)
      .eq("email", inviteRow.email);

    if (pendingDeleteError) {
      // don't fail the request; cancellation already succeeded
      console.warn("Failed to delete pending_user_invites:", pendingDeleteError);
    }

    console.log("Cancelled invitation", { invitationId, companyId, cancelledBy: userData.user.id });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in cancel-user-invite:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
