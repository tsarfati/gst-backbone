import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { BUILDERLYNK_EMAIL_LOGO_URL, resolveCompanyLogoEmailUrl } from "../_shared/emailAssets.ts";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";
import { sendTransactionalEmailWithFallback } from "../_shared/transactionalEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestedRole = "vendor" | "design_professional";

type RequestPayload = {
  userId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  companyId?: string | null;
  requestedRole: RequestedRole;
  businessName?: string | null;
  jobInviteToken?: string | null;
  password?: string | null;
};

const safeString = (value: unknown) => String(value || "").trim();
const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
const builderLynkLogo = BUILDERLYNK_EMAIL_LOGO_URL;
const ADMIN_ROLES = new Set(["admin", "company_admin", "controller", "owner"]);

const buildAdminIntakeEmailHtml = ({
  companyName,
  companyLogoUrl,
  applicantName,
  applicantEmail,
  requestedRole,
  businessName,
  reviewUrl,
}: {
  companyName: string;
  companyLogoUrl?: string | null;
  applicantName: string;
  applicantEmail: string;
  requestedRole: RequestedRole;
  businessName?: string | null;
  reviewUrl: string;
}) => {
  const roleLabel = requestedRole === "design_professional" ? "Design Professional" : "Vendor";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <tr><td style="background-color:#1e3a5f;padding:16px 20px;text-align:center;">
          <img src="${builderLynkLogo}" alt="BuilderLYNK" style="display:block;margin:0 auto;height:150px;width:auto;max-width:420px;" />
        </td></tr>
        <tr><td style="padding:32px 28px;">
          ${companyLogoUrl ? `<div style="text-align:center;margin-bottom:24px;"><img src="${companyLogoUrl}" alt="Company logo" style="max-height:72px;max-width:240px;object-fit:contain;" /></div>` : ""}
          <h1 style="color:#1e3a5f;font-size:24px;font-weight:700;margin:0 0 16px 0;text-align:center;">New ${roleLabel} Signup Request</h1>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 12px 0;">
            A new ${roleLabel.toLowerCase()} signup request was submitted for <strong>${companyName}</strong>.
          </p>
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 8px 0;"><strong>Name:</strong> ${applicantName}</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 8px 0;"><strong>Email:</strong> ${applicantEmail}</p>
          ${businessName ? `<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 8px 0;"><strong>Business:</strong> ${businessName}</p>` : ""}
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px 0;"><strong>Role Requested:</strong> ${roleLabel}</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${reviewUrl}" style="display:inline-block;background-color:#E88A2D;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:12px 26px;border-radius:8px;">Review Request</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background-color:#1e3a5f;padding:18px 24px;text-align:center;">
          <p style="color:#ffffff;font-size:12px;margin:0;">© ${new Date().getFullYear()} BuilderLYNK. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

const buildVendorConfirmationEmailHtml = ({
  companyName,
  companyLogoUrl,
  recipientName,
  confirmUrl,
}: {
  companyName?: string | null;
  companyLogoUrl?: string | null;
  recipientName: string;
  confirmUrl: string;
}) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <tr><td style="background-color:#1e3a5f;padding:16px 20px;text-align:center;">
          <img src="${builderLynkLogo}" alt="BuilderLYNK" style="display:block;margin:0 auto;height:150px;width:auto;max-width:420px;" />
        </td></tr>
        <tr><td style="padding:32px 28px;">
          ${companyLogoUrl ? `<div style="text-align:center;margin-bottom:24px;"><img src="${companyLogoUrl}" alt="Company logo" style="max-height:72px;max-width:240px;object-fit:contain;" /></div>` : ""}
          <h1 style="color:#1e3a5f;font-size:24px;font-weight:700;margin:0 0 16px 0;text-align:center;">Confirm Your Vendor Account</h1>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 12px 0;">Hi ${recipientName},</p>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 12px 0;">
            Your vendor account has been created${companyName ? ` for <strong>${companyName}</strong>` : ""}. Click the button below to confirm your email address and finish setup.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:12px 0 20px 0;">
            <a href="${confirmUrl}" style="display:inline-block;background-color:#E88A2D;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:12px 26px;border-radius:8px;">Confirm My Email</a>
          </td></tr></table>
          <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;text-align:center;">
            If the button doesn't work, copy and paste this link into your browser:<br />
            <a href="${confirmUrl}" style="color:#1e3a5f;word-break:break-all;">${confirmUrl}</a>
          </p>
        </td></tr>
        <tr><td style="background-color:#1e3a5f;padding:18px 24px;text-align:center;">
          <p style="color:#ffffff;font-size:12px;margin:0;">© ${new Date().getFullYear()} BuilderLYNK. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestPayload;
    let userId = safeString(body.userId);
    const email = safeString(body.email).toLowerCase();
    const firstName = safeString(body.firstName);
    const lastName = safeString(body.lastName);
    const companyId = safeString(body.companyId);
    const requestedRole = body.requestedRole === "design_professional" ? "design_professional" : "vendor";
    const businessName = safeString(body.businessName || "");
    const phone = safeString(body.phone || "");
    const jobInviteToken = safeString(body.jobInviteToken || "");
    const password = safeString(body.password || "");

    if (!email || !firstName || !lastName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const inviteEmailFrom = resolveBuilderlynkFrom(
      Deno.env.get("INVITE_EMAIL_FROM") || Deno.env.get("AUTH_EMAIL_FROM"),
      EMAIL_FROM.INVITE,
      "create-vendor-signup-request",
    );
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    let authUser:
      | {
          user: {
            id: string;
            email?: string | null;
          } | null;
        }
      | null = null;
    let confirmationUrl: string | null = null;

    if (userId) {
      const { data, error: authError } = await supabase.auth.admin.getUserById(userId);
      if (authError || !data?.user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      authUser = data as any;
    } else {
      if (!password || password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters." }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const normalizedEmail = email.toLowerCase();
      let existingUserId: string | null = null;
      let page = 1;

      while (!existingUserId) {
        const { data: userList, error: listUsersError } = await supabase.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (listUsersError) throw listUsersError;

        const matchedUser = (userList?.users || []).find(
          (candidate) => safeString(candidate.email).toLowerCase() === normalizedEmail,
        );
        if (matchedUser) {
          existingUserId = matchedUser.id;
          break;
        }

        if (!userList?.users?.length || userList.users.length < 1000) break;
        page += 1;
      }

      if (existingUserId) {
        return new Response(JSON.stringify({
          error: "An account with this email already exists. Sign in instead, or use password reset if needed.",
          code: "email_already_registered",
        }), {
          status: 409,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: false,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          business_name: businessName || null,
          requested_role: requestedRole,
          requested_company_id: companyId || null,
        },
      });

      if (createUserError || !createdUser?.user?.id) {
        throw createUserError || new Error("Failed to create user account");
      }

      userId = createdUser.user.id;
      authUser = { user: createdUser.user as any };

      const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://builderlynk.com";
      const redirectUrl = new URL("/vendor-signup", publicSiteUrl);
      if (companyId) redirectUrl.searchParams.set("company", companyId);
      redirectUrl.searchParams.set("confirmed", "1");
      const redirectTo = redirectUrl.toString();
      const { data: confirmationLinkData, error: confirmationLinkError } = await supabase.auth.admin.generateLink({
        type: "signup",
        email: normalizedEmail,
        password,
        options: {
          redirectTo,
        },
      });
      if (confirmationLinkError) throw confirmationLinkError;
      confirmationUrl = confirmationLinkData?.properties?.action_link || null;
    }

    const authEmail = safeString(authUser?.user?.email).toLowerCase();
    if (authEmail !== email) {
      return new Response(JSON.stringify({ error: "User/email mismatch" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let invitedJobId: string | null = null;
    let externalCompanyId = companyId || null;
    let externalCompany: any = null;

    // Design professionals can only be linked to external companies/jobs via invite token.
    if (requestedRole === "design_professional" && !jobInviteToken) {
      externalCompanyId = null;
    }

    if (requestedRole === "design_professional" && jobInviteToken) {
      const { data: inviteRow, error: inviteError } = await supabase
        .from("design_professional_job_invites")
        .select("id, company_id, job_id, email, status, expires_at")
        .eq("invite_token", jobInviteToken)
        .maybeSingle();
      if (inviteError) throw inviteError;
      if (!inviteRow) {
        return new Response(JSON.stringify({ error: "Invalid design professional invite token" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (externalCompanyId && inviteRow.company_id !== externalCompanyId) {
        return new Response(JSON.stringify({ error: "Invite token company mismatch" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (String(inviteRow.status || "").toLowerCase() !== "pending") {
        return new Response(JSON.stringify({ error: "This invite has already been used or is inactive" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (new Date(inviteRow.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: "This invite has expired" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      if (safeString(inviteRow.email).toLowerCase() !== email) {
        return new Response(JSON.stringify({ error: "Invite email does not match signup email" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      externalCompanyId = String(inviteRow.company_id);
      invitedJobId = inviteRow.job_id;
    }

    if (externalCompanyId) {
      const { data: companyRow, error: companyError } = await supabase
        .from("companies")
        .select("id,name,display_name,is_active,logo_url")
        .eq("id", externalCompanyId)
        .single();
      if (companyError || !companyRow || !companyRow.is_active) {
        return new Response(JSON.stringify({ error: "Company not found or inactive" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      externalCompany = companyRow;
    }

    // Always provision/resolve an independent "home" workspace for vendor/design professional users.
    // External company/job links are granted separately and never become the user's default workspace.
    let homeCompany: any = null;
    const { data: existingHomeCompany, error: existingHomeCompanyError } = await supabase
      .from("companies")
      .select("id,name,display_name,is_active,logo_url")
      .eq("created_by", userId)
      .eq("company_type", requestedRole)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existingHomeCompanyError) throw existingHomeCompanyError;
    homeCompany = existingHomeCompany || null;

    if (!homeCompany) {
      const workspaceName =
        businessName ||
        `${firstName} ${lastName}`.trim() ||
        `${email.split("@")[0]} ${requestedRole === "design_professional" ? "Design" : "Vendor"}`;
      const slugPrefix = requestedRole === "design_professional" ? "design-pro" : "vendor";
      const tenantSlug = `${toSlug(workspaceName) || slugPrefix}-${Date.now().toString(36)}`;

      const { data: tenantRow, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          name: workspaceName,
          slug: tenantSlug,
          owner_id: userId,
          is_active: true,
        })
        .select("id, name")
        .single();
      if (tenantError || !tenantRow) throw tenantError || new Error("Failed to create tenant workspace");

      const { error: tenantMemberError } = await supabase
        .from("tenant_members")
        .insert({
          tenant_id: tenantRow.id,
          user_id: userId,
          role: "owner",
          invited_by: userId,
        });
      if (tenantMemberError) throw tenantMemberError;

      const { data: companyRow, error: companyCreateError } = await supabase
        .from("companies")
        .insert({
          name: workspaceName,
          display_name: workspaceName,
          email,
          tenant_id: tenantRow.id,
          created_by: userId,
          company_type: requestedRole,
          is_active: true,
        } as any)
        .select("id,name,display_name,is_active,logo_url")
        .single();
      if (companyCreateError || !companyRow) throw companyCreateError || new Error("Failed to create home company");
      homeCompany = companyRow;
    }

    const homeCompanyId = String(homeCompany.id);

    const externalAccessNeedsApproval = false;
    const externalAccessAutoApprove = Boolean(externalCompanyId) && !externalAccessNeedsApproval;

    let vendorRecordId: string | null = null;
    if (requestedRole === "vendor") {
      const { data: existingVendorRecord, error: existingVendorError } = await supabase
        .from("vendors")
        .select("id")
        .eq("company_id", homeCompanyId)
        .eq("email", email)
        .maybeSingle();
      if (existingVendorError) throw existingVendorError;

      if (existingVendorRecord?.id) {
        vendorRecordId = String(existingVendorRecord.id);
        const { error: updateVendorError } = await supabase
          .from("vendors")
          .update({
            name: businessName || `${firstName} ${lastName}`.trim() || email,
            contact_person: `${firstName} ${lastName}`.trim(),
            phone: phone || null,
            email,
            is_active: true,
          } as any)
          .eq("id", vendorRecordId);
        if (updateVendorError) throw updateVendorError;
      } else {
        const { data: vendorRecord, error: createVendorError } = await supabase
          .from("vendors")
          .insert({
            company_id: homeCompanyId,
            name: businessName || `${firstName} ${lastName}`.trim() || email,
            contact_person: `${firstName} ${lastName}`.trim() || null,
            email,
            phone: phone || null,
            is_active: true,
            vendor_type: "Other",
          } as any)
          .select("id")
          .single();
        if (createVendorError || !vendorRecord?.id) throw createVendorError || new Error("Failed to create vendor record");
        vendorRecordId = String(vendorRecord.id);
      }
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          email,
          first_name: firstName,
          last_name: lastName,
          display_name: `${firstName} ${lastName}`.trim(),
          phone: phone || null,
          current_company_id: homeCompanyId,
          default_company_id: homeCompanyId,
          role: requestedRole,
          vendor_id: vendorRecordId,
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: userId,
        },
        { onConflict: "user_id" },
      );
    if (profileError) throw profileError;

    const { data: existingHomeAccessRows, error: existingHomeAccessError } = await supabase
      .from("user_company_access")
      .select("user_id")
      .eq("user_id", userId)
      .eq("company_id", homeCompanyId)
      .limit(1);
    if (existingHomeAccessError) throw existingHomeAccessError;

    if ((existingHomeAccessRows || []).length > 0) {
      const { error: updateHomeAccessError } = await supabase
        .from("user_company_access")
        .update({
          role: requestedRole,
          is_active: true,
          granted_by: userId,
        })
        .eq("user_id", userId)
        .eq("company_id", homeCompanyId);
      if (updateHomeAccessError) throw updateHomeAccessError;
    } else {
      const { error: insertHomeAccessError } = await supabase
        .from("user_company_access")
        .insert({
          user_id: userId,
          company_id: homeCompanyId,
          role: requestedRole,
          is_active: true,
          granted_by: userId,
        });
      if (insertHomeAccessError) throw insertHomeAccessError;
    }

    const notesPayload = {
      requestType: "external_access_signup",
      requestedRole,
      businessName: businessName || null,
      invitedJobId: invitedJobId || null,
      jobInviteToken: jobInviteToken || null,
      homeCompanyId,
      homeCompanyName: homeCompany?.display_name || homeCompany?.name || null,
      externalCompanyId: externalCompanyId || null,
      requestedAt: new Date().toISOString(),
      email,
    };

    if (externalCompanyId && externalCompanyId !== homeCompanyId) {
      const { data: existingExternalAccessRows, error: existingExternalAccessError } = await supabase
        .from("user_company_access")
        .select("user_id")
        .eq("user_id", userId)
        .eq("company_id", externalCompanyId)
        .limit(1);
      if (existingExternalAccessError) throw existingExternalAccessError;

      if ((existingExternalAccessRows || []).length > 0) {
        const { error: updateExternalAccessError } = await supabase
          .from("user_company_access")
          .update({
            role: requestedRole,
            is_active: externalAccessAutoApprove,
            granted_by: externalAccessAutoApprove ? userId : null,
          })
          .eq("user_id", userId)
          .eq("company_id", externalCompanyId);
        if (updateExternalAccessError) throw updateExternalAccessError;
      } else {
        const { error: insertExternalAccessError } = await supabase
          .from("user_company_access")
          .insert({
            user_id: userId,
            company_id: externalCompanyId,
            role: requestedRole,
            is_active: externalAccessAutoApprove,
            granted_by: externalAccessAutoApprove ? userId : null,
          });
        if (insertExternalAccessError) throw insertExternalAccessError;
      }

      const approvedOrPendingStatus = externalAccessNeedsApproval ? "pending" : "approved";
      const reviewedAt = externalAccessNeedsApproval ? null : new Date().toISOString();
      const reviewedBy = externalAccessNeedsApproval ? null : userId;

      const { data: existingExternalRequest, error: existingExternalRequestError } = await supabase
        .from("company_access_requests")
        .select("id, status")
        .eq("user_id", userId)
        .eq("company_id", externalCompanyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingExternalRequestError) throw existingExternalRequestError;

      if (existingExternalRequest?.id) {
        const { error: updateRequestError } = await supabase
          .from("company_access_requests")
          .update({
            status: approvedOrPendingStatus,
            notes: JSON.stringify(notesPayload),
            reviewed_at: reviewedAt,
            reviewed_by: reviewedBy,
            requested_at: new Date().toISOString(),
          })
          .eq("id", existingExternalRequest.id);
        if (updateRequestError) throw updateRequestError;
      } else {
        const { error: requestError } = await supabase.from("company_access_requests").insert({
          user_id: userId,
          company_id: externalCompanyId,
          status: approvedOrPendingStatus,
          requested_at: new Date().toISOString(),
          reviewed_at: reviewedAt,
          reviewed_by: reviewedBy,
          notes: JSON.stringify(notesPayload),
        });
        if (requestError) throw requestError;
      }
    }

    if (confirmationUrl) {
      const recipientName = `${firstName} ${lastName}`.trim() || email;
      const companyName = externalCompany?.display_name || externalCompany?.name || homeCompany?.display_name || homeCompany?.name || null;
      const companyLogoUrl = resolveCompanyLogoEmailUrl((externalCompany as any)?.logo_url || (homeCompany as any)?.logo_url || null);
      await sendTransactionalEmailWithFallback({
        supabaseUrl,
        serviceRoleKey: supabaseServiceKey,
        resend,
        companyId: externalCompanyId || homeCompanyId,
        defaultFrom: inviteEmailFrom,
        to: [email],
        subject: `Confirm your BuilderLYNK vendor account`,
        html: buildVendorConfirmationEmailHtml({
          companyName,
          companyLogoUrl,
          recipientName,
          confirmUrl: confirmationUrl,
        }),
        context: "create-vendor-signup-request-confirmation",
      });
    }

    if (requestedRole === "design_professional" && jobInviteToken) {
      const { error: inviteUpdateError } = await supabase
        .from("design_professional_job_invites")
        .update({
          status: "accepted",
          accepted_by_user_id: userId,
          accepted_at: new Date().toISOString(),
        })
        .eq("invite_token", jobInviteToken)
        .eq("company_id", externalCompanyId)
        .eq("status", "pending");
      if (inviteUpdateError) {
        console.warn("Failed to mark design professional invite accepted:", inviteUpdateError);
      }
    }

    try {
      if (!externalCompanyId || !externalAccessNeedsApproval) {
        throw new Error("skip_external_approval_notifications");
      }

      const { data: adminAccessRows, error: adminAccessError } = await supabase
        .from("user_company_access")
        .select("user_id, role")
        .eq("company_id", externalCompanyId)
        .eq("is_active", true);
      if (adminAccessError) throw adminAccessError;

      const adminUserIds = Array.from(
        new Set(
          (adminAccessRows || [])
            .filter((row: any) => ADMIN_ROLES.has(String(row.role || "").toLowerCase()))
            .map((row: any) => String(row.user_id || "").trim())
            .filter(Boolean),
        ),
      );
      const recipientUserIds = new Set(adminUserIds.filter((id) => id !== userId));

      const adminEmails: string[] = [];
      for (const adminUserId of adminUserIds) {
        const { data: adminAuthData, error: adminAuthError } = await supabase.auth.admin.getUserById(adminUserId);
        if (!adminAuthError) {
          const emailValue = String(adminAuthData?.user?.email || "").trim().toLowerCase();
          if (emailValue) adminEmails.push(emailValue);
        }
      }

      const uniqueAdminEmails = Array.from(new Set(adminEmails)).filter((e) => e !== email);
      const notificationRecipients = new Set(uniqueAdminEmails);

      if (invitedJobId) {
        const { data: jobRow, error: jobError } = await supabase
          .from("jobs")
          .select("id, project_manager_user_id")
          .eq("id", invitedJobId)
          .maybeSingle();
        if (jobError) throw jobError;
        const pmUserIds = new Set<string>();
        if (jobRow?.project_manager_user_id) pmUserIds.add(String(jobRow.project_manager_user_id));

        const { data: assistantRows, error: assistantError } = await supabase
          .from("job_assistant_managers")
          .select("user_id")
          .eq("job_id", invitedJobId);
        if (assistantError) throw assistantError;
        (assistantRows || []).forEach((row: any) => {
          if (row?.user_id) pmUserIds.add(String(row.user_id));
        });

        for (const pmUserId of pmUserIds) {
          recipientUserIds.add(pmUserId);
          const { data: pmAuthData, error: pmAuthError } = await supabase.auth.admin.getUserById(pmUserId);
          if (!pmAuthError) {
            const pmEmail = safeString(pmAuthData?.user?.email).toLowerCase();
            if (pmEmail && pmEmail !== email) notificationRecipients.add(pmEmail);
          }
        }
      }

      const intakeRecipients = Array.from(recipientUserIds).filter((id) => Boolean(id) && id !== userId);
      if (intakeRecipients.length > 0) {
        const { data: notifRows } = await supabase
          .from("notification_settings")
          .select("user_id, in_app_enabled, intake_queue_requests")
          .eq("company_id", externalCompanyId)
          .in("user_id", intakeRecipients);

        const notifMap = new Map<string, any>((notifRows || []).map((row: any) => [String(row.user_id), row]));
        const allowedRecipients = intakeRecipients.filter((recipientId) => {
          const row = notifMap.get(recipientId);
          if (!row) return true;
          return row.in_app_enabled !== false && row.intake_queue_requests !== false;
        });

        if (allowedRecipients.length > 0) {
          const roleLabel = requestedRole === "design_professional" ? "Design Professional" : "Vendor";
          const intakeMessage = `${firstName} ${lastName} is pending approval for ${roleLabel}${businessName ? ` (${businessName})` : ""}.`;
          await supabase.from("notifications").insert(
            allowedRecipients.map((recipientId) => ({
              user_id: recipientId,
              title: "New Intake Queue Request",
              message: intakeMessage,
              type: `intake_queue:${userId}`,
              read: false,
            })),
          );
        }
      }

      const finalRecipients = Array.from(notificationRecipients);
      if (finalRecipients.length > 0) {
        const companyName = String(externalCompany.display_name || externalCompany.name || "Company").trim();
        const companyLogoUrl = resolveCompanyLogoEmailUrl((externalCompany as any)?.logo_url);
        const applicantName = `${firstName} ${lastName}`.trim();
        const reviewUrl = `${Deno.env.get("PUBLIC_SITE_URL") || "https://builderlynk.com"}/settings/users`;

        await sendTransactionalEmailWithFallback({
          supabaseUrl,
          serviceRoleKey: supabaseServiceKey,
          resend,
          companyId: externalCompanyId,
          defaultFrom: inviteEmailFrom,
          to: finalRecipients,
          subject: `New ${requestedRole === "design_professional" ? "Design Professional" : "Vendor"} signup request for ${companyName}`,
          html: buildAdminIntakeEmailHtml({
            companyName,
            companyLogoUrl,
            applicantName,
            applicantEmail: email,
            requestedRole,
            businessName: businessName || null,
            reviewUrl,
          }),
          context: "create-vendor-signup-request",
        });
      }
    } catch (notifyError) {
      if (String((notifyError as any)?.message || "") !== "skip_external_approval_notifications") {
        console.warn("Failed to send admin signup notification email:", notifyError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        homeCompanyId,
        homeCompanyName: homeCompany?.display_name || homeCompany?.name,
        linkedCompanyId: externalCompanyId || null,
        linkedCompanyName: externalCompany?.display_name || externalCompany?.name || null,
        externalApprovalRequired: externalAccessNeedsApproval,
        externalAccessAutoApproved: externalAccessAutoApprove,
        requestedRole,
        requiresEmailConfirmation: Boolean(confirmationUrl),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("Error in create-vendor-signup-request:", error);
    const rawMessage = String(error?.message || "");
    const normalizedMessage = rawMessage.toLowerCase();
    const enumRoleError =
      normalizedMessage.includes("invalid input value for enum user_role") &&
      normalizedMessage.includes("design_professional");

    return new Response(JSON.stringify({
      error: enumRoleError
        ? "The database is missing the design_professional role enum value. Apply the latest Supabase migrations, then try signup again."
        : (error?.message || "Failed to create signup request"),
      code: enumRoleError ? "missing_design_professional_role_enum" : (error?.code || null),
      details: error?.details || null,
      hint: enumRoleError
        ? "Run the migration that adds 'design_professional' to public.user_role before using the Design Professional signup flow."
        : (error?.hint || null),
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
