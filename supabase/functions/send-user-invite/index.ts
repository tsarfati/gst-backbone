import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";
import { sendTransactionalEmailWithFallback } from "../_shared/transactionalEmail.ts";
 
 const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
 
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const buildCorsHeaders = (req: Request) => ({
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    req.headers.get("Access-Control-Request-Headers") || corsHeaders["Access-Control-Allow-Headers"],
});
const inviteEmailFrom = resolveBuilderlynkFrom(
  Deno.env.get("INVITE_EMAIL_FROM") || Deno.env.get("AUTH_EMAIL_FROM"),
  EMAIL_FROM.INVITE,
  "send-user-invite",
);
 
interface InviteRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  customRoleId?: string;
  customRoleName?: string;
  companyId: string;
   companyName: string;
   companyLogo?: string;
   primaryColor?: string;
   invitedBy: string;
   resendInvitationId?: string; // If provided, this is a resend
 }
 
// Convert HSL string "H S% L%" to hex color
function hslToHex(hsl: string): string {
  if (!hsl) return "#E88A2D"; // default orange
  
  try {
    const parts = hsl.trim().split(/\s+/);
    if (parts.length !== 3) return "#E88A2D";
    
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1].replace('%', '')) / 100;
    const l = parseFloat(parts[2].replace('%', '')) / 100;
    
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch {
    return "#E88A2D";
  }
}

  const handler = async (req: Request): Promise<Response> => {
   const responseCorsHeaders = buildCorsHeaders(req);
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: responseCorsHeaders });
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
         headers: { "Content-Type": "application/json", ...responseCorsHeaders },
       });
     }

     const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
       global: { headers: { Authorization: authHeader } },
     });
     const token = authHeader.replace("Bearer ", "");
     const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
     if (userError || !userData?.user) {
       return new Response(JSON.stringify({ error: "Unauthorized" }), {
         status: 401,
         headers: { "Content-Type": "application/json", ...responseCorsHeaders },
       });
     }

     const { email, firstName, lastName, role, customRoleId, customRoleName, companyId, companyName, companyLogo, primaryColor, invitedBy, resendInvitationId }: InviteRequest = await req.json();

     if (!email || !companyId || !companyName) {
       throw new Error("Missing required fields: email, companyId, companyName");
     }

     const requesterUserId = userData.user.id;
     const effectiveInvitedBy = invitedBy || requesterUserId;
     if (effectiveInvitedBy !== requesterUserId) {
       return new Response(JSON.stringify({ error: "invitedBy must match authenticated user" }), {
         status: 403,
         headers: { "Content-Type": "application/json", ...responseCorsHeaders },
       });
     }

     const { data: accessRows, error: accessError } = await supabase
       .from("user_company_access")
       .select("role, is_active")
       .eq("company_id", companyId)
       .eq("user_id", requesterUserId);
     if (accessError) throw accessError;

     const canManageFromCompanyRole = (accessRows || []).some((row: any) => {
       const normalizedRole = String(row.role || "").toLowerCase();
       return row.is_active === true && ["admin", "company_admin", "controller", "owner"].includes(normalizedRole);
     });

     let canManageUsers = canManageFromCompanyRole;
     if (!canManageUsers) {
       const { data: profileRow, error: profileError } = await supabase
         .from("profiles")
         .select("role")
         .eq("user_id", requesterUserId)
         .maybeSingle();
       if (profileError) throw profileError;
       const profileRole = String(profileRow?.role || "").toLowerCase();
       canManageUsers = ["super_admin", "admin", "controller", "owner"].includes(profileRole);
     }

     if (!canManageUsers) {
       return new Response(JSON.stringify({ error: "Forbidden" }), {
         status: 403,
         headers: { "Content-Type": "application/json", ...responseCorsHeaders },
       });
     }

     // Generate a unique invite token
     const inviteToken = crypto.randomUUID();
     const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
 
     // Build the invitation URL
     const baseUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://builderlynk.lovable.app";
     const inviteUrl = `${baseUrl}/auth?invite=${inviteToken}`;
     const displayRoleName = (customRoleName && customRoleName.trim())
       ? customRoleName.trim()
       : role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
 
    // Use company's primary color or fallback to BuilderLynk orange
    const brandPrimary = primaryColor ? hslToHex(primaryColor) : "#E88A2D";
     const brandNavy = "#1e3a5f";
 
    // BuilderLYNK logo URL (new brand mark)
    const builderLynkLogo = "https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/company-logos/builder%20lynk.png";

     // Build branded email HTML
     const emailHtml = `
       <!DOCTYPE html>
       <html>
       <head>
         <meta charset="utf-8">
         <meta name="viewport" content="width=device-width, initial-scale=1.0">
       </head>
       <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
         <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
           <tr>
             <td align="center">
               <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                 <!-- Header with BuilderLynk branding -->
                 <tr>
                  <td style="background-color: ${brandNavy}; padding: 16px 20px; text-align: center;">
                    <img src="${builderLynkLogo}" alt="BuilderLYNK" style="display:block; margin:0 auto; height: 220px; width: auto; max-width: 520px;" />
                  </td>
                </tr>
                 
                 <!-- Main Content -->
                 <tr>
                   <td style="padding: 40px 30px;">
                     ${companyLogo ? `
                       <div style="text-align: center; margin-bottom: 30px;">
                        <img src="${companyLogo}" alt="${companyName}" style="max-height: 80px; max-width: 250px; object-fit: contain;" />
                       </div>
                     ` : ''}
                     
                     <h1 style="color: ${brandNavy}; font-size: 24px; font-weight: 700; margin: 0 0 20px 0; text-align: center;">
                       You've Been Invited!
                     </h1>
                     
                     <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                       Hi${firstName ? ` ${firstName}` : ''},
                     </p>
                     
                     <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                       <strong>${companyName}</strong> has invited you to join their team on BuilderLYNK, the construction management platform that helps teams stay connected and productive.
                     </p>
                     
                     <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      You've been assigned the role of <strong style="color: ${brandPrimary};">${displayRoleName}</strong>.
                     </p>
                     
                     <!-- CTA Button -->
                     <table width="100%" cellpadding="0" cellspacing="0">
                       <tr>
                         <td align="center">
                          <a href="${inviteUrl}" style="display: inline-block; background-color: ${brandPrimary}; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                             Accept Invitation & Create Account
                           </a>
                         </td>
                       </tr>
                     </table>
                     
                     <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                       This invitation will expire in 7 days.
                     </p>
                     
                     <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                       If the button doesn't work, copy and paste this link:<br/>
                      <a href="${inviteUrl}" style="color: ${brandPrimary}; word-break: break-all;">${inviteUrl}</a>
                     </p>
                   </td>
                 </tr>
                 
                 <!-- Footer -->
                 <tr>
                   <td style="background-color: ${brandNavy}; padding: 20px 30px; text-align: center;">
                     <p style="color: #ffffff; font-size: 12px; margin: 0;">
                       © ${new Date().getFullYear()} BuilderLYNK. All rights reserved.
                     </p>
                   </td>
                 </tr>
               </table>
             </td>
           </tr>
         </table>
       </body>
       </html>
     `;
 
     // Send the invitation email
     const emailResponse = await sendTransactionalEmailWithFallback({
       supabaseUrl,
       serviceRoleKey: supabaseServiceKey,
       resend,
       companyId,
       defaultFrom: inviteEmailFrom,
       to: [email],
       subject: `${companyName} has invited you to join BuilderLYNK`,
       html: emailHtml,
       context: "send-user-invite",
     });
 
     console.log("Invitation email sent successfully:", emailResponse);
 
     // Get Resend message ID
     const resendMessageId = emailResponse?.providerMessageId || null;
 
     // If this is a resend, update the existing invitation
     if (resendInvitationId) {
       const { error: updateError } = await supabase
         .from('user_invitations')
         .update({
            expires_at: expiresAt.toISOString(),
            role,
            custom_role_id: customRoleId ?? null,
            first_name: firstName || null,
            last_name: lastName || null,
            status: 'pending',
            invited_by: effectiveInvitedBy,
           email_status: 'sent',
           email_delivered_at: null,
           email_opened_at: null,
           email_bounced_at: null,
           resend_message_id: resendMessageId,
           updated_at: new Date().toISOString(),
         })
         .eq('id', resendInvitationId);
 
       if (updateError) {
         console.error("Error updating invitation:", updateError);
         // Don't throw - email was already sent successfully
       }
     } else {
       // Store new invitation in user_invitations table
       const { error: insertError } = await supabase
         .from('user_invitations')
         .insert({
           email,
           first_name: firstName || null,
           last_name: lastName || null,
           role,
           custom_role_id: customRoleId ?? null,
           company_id: companyId,
           invited_by: effectiveInvitedBy,
           expires_at: expiresAt.toISOString(),
           status: 'pending',
           email_status: 'sent',
           resend_message_id: resendMessageId,
         });
 
       if (insertError) {
         console.error("Error storing invitation:", insertError);
         // Don't throw - email was already sent successfully
       }
 
     }

     // Always refresh pending_user_invites with a token matching the email we just sent.
     // This prevents stale/invalid token loops after resend/cancel flows.
     const { error: pendingDeleteError } = await supabase
       .from('pending_user_invites')
       .delete()
       .eq('company_id', companyId)
       .eq('email', email);
     if (pendingDeleteError) {
       console.warn("Error deleting stale pending invites:", pendingDeleteError);
     }

     const { error: pendingInsertError } = await supabase
       .from('pending_user_invites')
       .insert({
         email,
         first_name: firstName || null,
         last_name: lastName || null,
         role,
         custom_role_id: customRoleId ?? null,
         company_id: companyId,
         invite_token: inviteToken,
         expires_at: expiresAt.toISOString(),
         invited_by: effectiveInvitedBy,
         accepted_at: null,
       });
     if (pendingInsertError) {
       console.error("Error storing pending invite:", pendingInsertError);
     }
 
     return new Response(JSON.stringify({ success: true, inviteToken }), {
       status: 200,
       headers: { "Content-Type": "application/json", ...responseCorsHeaders },
     });
   } catch (error: any) {
     console.error("Error in send-user-invite function:", error);
     return new Response(
       JSON.stringify({ error: error.message }),
       {
         status: 500,
         headers: { "Content-Type": "application/json", ...responseCorsHeaders },
       }
     );
   }
 };
 
serve(handler);
