import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { BUILDERLYNK_EMAIL_LOGO_URL, resolveCompanyLogoEmailUrl } from "../_shared/emailAssets.ts";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";
import { sendTransactionalEmailWithFallback } from "../_shared/transactionalEmail.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const inviteFrom = resolveBuilderlynkFrom(
  Deno.env.get("INVITE_EMAIL_FROM") || Deno.env.get("AUTH_EMAIL_FROM"),
  EMAIL_FROM.INVITE,
  "send-vendor-invite",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VendorInviteRequest {
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  companyId: string;
  companyName: string;
  invitedBy?: string;
  baseUrl: string;
  vendorPortalRole?: string;
  replaceInviteId?: string | null;
}

const BUILDERLYNK_EMAIL_LOGO = BUILDERLYNK_EMAIL_LOGO_URL;

const escapeHtml = (value: string): string =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isInternalRole = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  return !!normalized && normalized !== "vendor" && normalized !== "design_professional" && normalized !== "employee";
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: authData, error: authError } = await authed.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { vendorId, vendorName, vendorEmail, companyId, companyName, baseUrl, vendorPortalRole, replaceInviteId }: VendorInviteRequest = await req.json();

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "Company is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!vendorEmail) {
      return new Response(
        JSON.stringify({ error: "Vendor email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const normalizedRole = (() => {
      const normalized = String(vendorPortalRole || "").trim().toLowerCase();
      return normalized === "owner" ? "owner" : "basic_user";
    })();

    const { data: requesterProfile, error: requesterProfileError } = await supabase
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (requesterProfileError) throw requesterProfileError;

    const requesterRole = String(requesterProfile?.role || "").trim().toLowerCase();
    const { data: requesterVendorMembership, error: requesterVendorMembershipError } = await supabase
      .from("vendor_invitations")
      .select("vendor_id, vendor_portal_role, created_user_id, status")
      .eq("vendor_id", String(vendorId || "").trim())
      .eq("created_user_id", authData.user.id)
      .eq("status", "accepted")
      .order("accepted_at", { ascending: false, nullsFirst: false })
      .order("invited_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (requesterVendorMembershipError) throw requesterVendorMembershipError;

    const isVendorOwner =
      requesterRole === "vendor" &&
      String(requesterVendorMembership?.vendor_id || "").trim() === String(vendorId || "").trim() &&
      String(requesterVendorMembership?.vendor_portal_role || "").trim().toLowerCase() === "owner";

    const { data: builderAccessRows, error: builderAccessError } = await supabase
      .from("user_company_access")
      .select("company_id, role, is_active")
      .eq("user_id", authData.user.id)
      .eq("company_id", companyId)
      .or("is_active.eq.true,is_active.is.null");
    if (builderAccessError) throw builderAccessError;

    const isInternalBuilderUser = ((builderAccessRows || []) as any[]).some((row) => {
      return isInternalRole(row.role);
    });

    const { data: targetCompany, error: targetCompanyError } = await supabase
      .from("companies")
      .select("id, tenant_id, logo_url")
      .eq("id", companyId)
      .maybeSingle();
    if (targetCompanyError) throw targetCompanyError;

    let isTenantInternalBuilderUser = false;
    if (!isInternalBuilderUser && isInternalRole(requesterRole) && targetCompany?.tenant_id) {
      const { data: tenantMembership, error: tenantMembershipError } = await supabase
        .from("tenant_members" as any)
        .select("tenant_id, user_id, role")
        .eq("tenant_id", targetCompany.tenant_id)
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (tenantMembershipError) throw tenantMembershipError;
      isTenantInternalBuilderUser = !!tenantMembership;
    }

    if (!isVendorOwner && !isInternalBuilderUser && !isTenantInternalBuilderUser) {
      return new Response(JSON.stringify({ error: "Only the vendor company owner or an internal BuilderLYNK user can invite coworkers." }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (replaceInviteId) {
      const { error: revokePriorInviteError } = await supabase
        .from("vendor_invitations")
        .update({ status: "revoked" })
        .eq("id", replaceInviteId)
        .eq("vendor_id", vendorId)
        .eq("status", "pending");
      if (revokePriorInviteError) {
        console.error("Error revoking prior invite before resend:", revokePriorInviteError);
        return new Response(
          JSON.stringify({ error: "Failed to resend invitation" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    let resolvedInviteRole = (isInternalBuilderUser || isTenantInternalBuilderUser) ? normalizedRole : "basic_user";
    if (!vendorPortalRole) {
      const [{ count: existingVendorUserCount, error: existingVendorUserError }, { count: pendingInviteCount, error: pendingInviteError }] = await Promise.all([
        supabase
          .from("vendor_invitations")
          .select("id", { count: "exact", head: true })
          .eq("vendor_id", vendorId)
          .eq("status", "accepted")
          .not("created_user_id", "is", null),
        supabase
          .from("vendor_invitations")
          .select("id", { count: "exact", head: true })
          .eq("vendor_id", vendorId)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString()),
      ]);
      if (existingVendorUserError) throw existingVendorUserError;
      if (pendingInviteError) throw pendingInviteError;
      const existingCount = Number(existingVendorUserCount || 0);
      const activePendingCount = Number(pendingInviteCount || 0);
      resolvedInviteRole = existingCount === 0 && activePendingCount === 0 ? "owner" : "basic_user";
    }

    // Check if there's already a pending invitation
    const { data: existingInvite, error: existingInviteError } = await supabase
      .from('vendor_invitations')
      .select('id, status, expires_at')
      .eq('vendor_id', vendorId)
      .eq('email', vendorEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingInviteError) {
      console.error("Error checking for existing vendor invitation:", existingInviteError);
      return new Response(
        JSON.stringify({ error: "Failed to validate existing invitations" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let invitation = existingInvite;

    if (existingInvite) {
      const { data: refreshedInvite, error: refreshedInviteError } = await supabase
        .from('vendor_invitations')
        .update({
          invited_by: authData.user.id,
          vendor_portal_role: resolvedInviteRole,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', existingInvite.id)
        .select()
        .single();

      if (refreshedInviteError) {
        console.error("Error refreshing existing invitation:", refreshedInviteError);
        return new Response(
          JSON.stringify({ error: "Failed to refresh the existing invitation" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      invitation = refreshedInvite;
    } else {
      const { data: createdInvitation, error: insertError } = await supabase
        .from('vendor_invitations')
        .insert({
          vendor_id: vendorId,
          company_id: companyId,
          email: vendorEmail,
          invited_by: authData.user.id,
          status: 'pending',
          vendor_portal_role: resolvedInviteRole,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating invitation:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create invitation" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      invitation = createdInvitation;
    }

    // Create the invitation link
    const inviteLink = `${baseUrl}/vendor-register?token=${invitation.token}`;
    const escapedCompanyName = escapeHtml(companyName);
    const escapedVendorName = escapeHtml(vendorName || vendorEmail);

    const companyLogo = resolveCompanyLogoEmailUrl((targetCompany as any)?.logo_url);

    // Send the email
    const emailResponse = await sendTransactionalEmailWithFallback({
      supabaseUrl,
      serviceRoleKey: supabaseServiceKey,
      resend,
      senderUserId: authData.user.id,
      companyId,
      defaultFrom: inviteFrom,
      to: [vendorEmail],
      subject: `${companyName} invited you to join BuilderLYNK`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#030B20;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#ffffff;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#030B20;padding:24px 0;">
            <tr>
              <td align="center">
                <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:94%;background:#071231;border:1px solid #1f2a44;border-radius:14px;overflow:hidden;">
                  <tr>
                    <td style="padding:22px 20px 8px;text-align:center;">
                      <img src="${BUILDERLYNK_EMAIL_LOGO}" alt="BuilderLYNK" style="display:block;margin:0 auto;height:130px;width:auto;max-width:360px;" />
                    </td>
                  </tr>
                  ${
                    companyLogo
                      ? `
                  <tr>
                    <td style="padding:0 20px 14px;text-align:center;">
                      <img src="${companyLogo}" alt="${escapedCompanyName} logo" style="display:block;margin:0 auto;height:64px;width:auto;max-width:280px;background:#ffffff;border-radius:8px;padding:6px 10px;" />
                    </td>
                  </tr>`
                      : ""
                  }
                  <tr>
                    <td style="padding:0 28px 22px;">
                      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;font-weight:700;color:#ffffff;text-align:center;">You're Invited</h1>
                      <p style="margin:0 0 10px;color:#dbe5ff;font-size:16px;text-align:center;">Hello <strong>${escapedVendorName}</strong>,</p>
                      <p style="margin:0 0 18px;color:#dbe5ff;font-size:16px;line-height:1.6;text-align:center;">
                        <strong style="color:#ffffff;">${escapedCompanyName}</strong> invited you to join BuilderLYNK as a vendor partner.
                        Create your account to submit bids, collaborate, and manage project work.
                      </p>
                      <div style="text-align:center;margin:20px 0 16px;">
                        <a href="${inviteLink}" style="display:inline-block;background-color:#E88A2D;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:8px;">
                          Accept Invitation
                        </a>
                      </div>
                      <p style="margin:0;color:#9fb0d3;font-size:13px;line-height:1.5;text-align:center;">
                        This invitation expires in 7 days. If you weren't expecting this invite, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 28px 22px;">
                      <div style="border-top:1px solid #1f2a44;padding-top:14px;text-align:center;">
                        <p style="margin:0;color:#6f83ad;font-size:12px;">© ${new Date().getFullYear()} BuilderLYNK. All rights reserved.</p>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `${companyName} invited ${vendorName || vendorEmail} to join BuilderLYNK. Accept the invitation here: ${inviteLink}`,
      context: "send-vendor-invite",
    });

    console.log("Vendor invite email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitationId: invitation.id,
        message: "Invitation sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-vendor-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
