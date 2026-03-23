import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { resolveCompanyLogoEmailUrl } from "../_shared/emailAssets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonResponse = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  try {
    const { inviteToken } = await req.json().catch(() => ({} as { inviteToken?: string }));
    const normalizedToken = String(inviteToken || "").trim();
    if (!normalizedToken) {
      return jsonResponse(400, { error: "Missing inviteToken" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: inviteRow, error: inviteError } = await supabase
      .from("pending_user_invites")
      .select("company_id, expires_at, accepted_at")
      .eq("invite_token", normalizedToken)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!inviteRow) return jsonResponse(404, { error: "Invitation not found" });

    if (inviteRow.accepted_at) {
      return jsonResponse(410, { error: "Invitation already accepted" });
    }

    if (new Date(inviteRow.expires_at).getTime() < Date.now()) {
      return jsonResponse(410, { error: "Invitation expired" });
    }

    const { data: companyRow, error: companyError } = await supabase
      .from("companies")
      .select("name, display_name, logo_url")
      .eq("id", inviteRow.company_id)
      .maybeSingle();

    if (companyError) throw companyError;
    if (!companyRow) return jsonResponse(404, { error: "Company not found" });

    return jsonResponse(200, {
      companyName: companyRow.display_name || companyRow.name,
      companyLogoUrl: resolveCompanyLogoEmailUrl(companyRow.logo_url),
    });
  } catch (error: any) {
    console.error("[get-invite-preview] error", error);
    return jsonResponse(500, { error: error?.message || "Failed to load invite preview" });
  }
});
