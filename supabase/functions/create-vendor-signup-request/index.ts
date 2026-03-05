import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";
import { sendTransactionalEmailWithFallback } from "../_shared/transactionalEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestedRole = "vendor" | "design_professional";

type RequestPayload = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  companyId: string;
  requestedRole: RequestedRole;
  businessName?: string | null;
  jobInviteToken?: string | null;
};

const safeString = (value: unknown) => String(value || "").trim();
const builderLynkLogo = "https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/company-logos/builder%20lynk.png";
const ADMIN_ROLES = new Set(["admin", "company_admin", "controller", "owner"]);

const resolveCompanyLogoUrl = (logoUrl?: string | null): string | null => {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  const cleaned = String(logoUrl).replace(/^company-logos\//, "").replace(/^\/+/, "");
  return `https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/company-logos/${cleaned}`;
};

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

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestPayload;
    const userId = safeString(body.userId);
    const email = safeString(body.email).toLowerCase();
    const firstName = safeString(body.firstName);
    const lastName = safeString(body.lastName);
    const companyId = safeString(body.companyId);
    const requestedRole = body.requestedRole === "design_professional" ? "design_professional" : "vendor";
    const businessName = safeString(body.businessName || "");
    const phone = safeString(body.phone || "");
    const jobInviteToken = safeString(body.jobInviteToken || "");

    if (!userId || !email || !firstName || !lastName || !companyId) {
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

    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !authUser?.user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const authEmail = safeString(authUser.user.email).toLowerCase();
    if (authEmail !== email) {
      return new Response(JSON.stringify({ error: "User/email mismatch" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id,name,display_name,is_active")
      .eq("id", companyId)
      .single();
    if (companyError || !company || !company.is_active) {
      return new Response(JSON.stringify({ error: "Company not found or inactive" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let invitedJobId: string | null = null;
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
      if (inviteRow.company_id !== companyId) {
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
      invitedJobId = inviteRow.job_id;
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
          current_company_id: companyId,
          default_company_id: companyId,
          role: requestedRole,
          status: "pending",
          approved_at: null,
          approved_by: null,
        },
        { onConflict: "user_id" },
      );
    if (profileError) throw profileError;

    const { data: existingAccessRows, error: existingAccessError } = await supabase
      .from("user_company_access")
      .select("user_id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .limit(1);
    if (existingAccessError) throw existingAccessError;

    if ((existingAccessRows || []).length > 0) {
      const { error: updateAccessError } = await supabase
        .from("user_company_access")
        .update({
          role: requestedRole,
          is_active: false,
          granted_by: null,
        })
        .eq("user_id", userId)
        .eq("company_id", companyId);
      if (updateAccessError) throw updateAccessError;
    } else {
      const { error: insertAccessError } = await supabase
        .from("user_company_access")
        .insert({
          user_id: userId,
          company_id: companyId,
          role: requestedRole,
          is_active: false,
          granted_by: null,
        });
      if (insertAccessError) throw insertAccessError;
    }

    const notesPayload = {
      requestType: "vendor_self_signup",
      requestedRole,
      businessName: businessName || null,
      invitedJobId: invitedJobId || null,
      jobInviteToken: jobInviteToken || null,
      requestedAt: new Date().toISOString(),
      email,
    };

    const { data: existingPendingRequest, error: existingPendingRequestError } = await supabase
      .from("company_access_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingPendingRequestError) throw existingPendingRequestError;

    if (existingPendingRequest?.id) {
      const { error: updateRequestError } = await supabase
        .from("company_access_requests")
        .update({
          notes: JSON.stringify(notesPayload),
          reviewed_at: null,
          reviewed_by: null,
          requested_at: new Date().toISOString(),
        })
        .eq("id", existingPendingRequest.id);
      if (updateRequestError) throw updateRequestError;
    } else {
      const { error: requestError } = await supabase.from("company_access_requests").insert({
        user_id: userId,
        company_id: companyId,
        status: "pending",
        requested_at: new Date().toISOString(),
        notes: JSON.stringify(notesPayload),
      });
      if (requestError) throw requestError;
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
        .eq("company_id", companyId)
        .eq("status", "pending");
      if (inviteUpdateError) {
        console.warn("Failed to mark design professional invite accepted:", inviteUpdateError);
      }
    }

    try {
      const { data: adminAccessRows, error: adminAccessError } = await supabase
        .from("user_company_access")
        .select("user_id, role")
        .eq("company_id", companyId)
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
          .eq("company_id", companyId)
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
              type: "intake_queue",
              read: false,
            })),
          );
        }
      }

      const finalRecipients = Array.from(notificationRecipients);
      if (finalRecipients.length > 0) {
        const companyName = String(company.display_name || company.name || "Company").trim();
        const companyLogoUrl = resolveCompanyLogoUrl((company as any)?.logo_url);
        const applicantName = `${firstName} ${lastName}`.trim();
        const reviewUrl = `${Deno.env.get("PUBLIC_SITE_URL") || "https://builderlynk.com"}/settings/users`;

        await sendTransactionalEmailWithFallback({
          supabaseUrl,
          serviceRoleKey: supabaseServiceKey,
          resend,
          companyId,
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
      console.warn("Failed to send admin signup notification email:", notifyError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        companyName: company.display_name || company.name,
        requestedRole,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("Error in create-vendor-signup-request:", error);
    return new Response(JSON.stringify({
      error: error?.message || "Failed to create signup request",
      code: error?.code || null,
      details: error?.details || null,
      hint: error?.hint || null,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
