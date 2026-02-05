 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { Resend } from "https://esm.sh/resend@4.0.0";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
 
 const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type",
 };
 
 interface InviteRequest {
   email: string;
   firstName?: string;
   lastName?: string;
   role: string;
   companyId: string;
   companyName: string;
   companyLogo?: string;
   invitedBy: string;
 }
 
 const handler = async (req: Request): Promise<Response> => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     const { email, firstName, lastName, role, companyId, companyName, companyLogo, invitedBy }: InviteRequest = await req.json();
 
     if (!email || !companyId || !companyName) {
       throw new Error("Missing required fields: email, companyId, companyName");
     }
 
     // Generate a unique invite token
     const inviteToken = crypto.randomUUID();
     const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
 
     // Store the pending invitation
     const { error: insertError } = await supabase
       .from('pending_user_invites')
       .insert({
         email,
         first_name: firstName || null,
         last_name: lastName || null,
         role,
         company_id: companyId,
         invite_token: inviteToken,
         expires_at: expiresAt.toISOString(),
         invited_by: invitedBy,
       });
 
     if (insertError) {
       console.error("Error storing invitation:", insertError);
       throw new Error("Failed to create invitation");
     }
 
     // Build the invitation URL
     const baseUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://builderlynk.lovable.app";
     const inviteUrl = `${baseUrl}/auth?invite=${inviteToken}`;
 
     // BuilderLynk branding colors
     const brandOrange = "#E88A2D";
     const brandNavy = "#1e3a5f";
 
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
                   <td style="background-color: ${brandNavy}; padding: 30px; text-align: center;">
                     <img src="https://builderlynk.lovable.app/email-assets/builderlynk-logo.png?v=1" alt="BuilderLYNK" style="height: 50px; width: auto;" />
                   </td>
                 </tr>
                 
                 <!-- Main Content -->
                 <tr>
                   <td style="padding: 40px 30px;">
                     ${companyLogo ? `
                       <div style="text-align: center; margin-bottom: 30px;">
                         <img src="${companyLogo}" alt="${companyName}" style="max-height: 60px; max-width: 200px;" />
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
                       You've been assigned the role of <strong style="color: ${brandOrange};">${role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong>.
                     </p>
                     
                     <!-- CTA Button -->
                     <table width="100%" cellpadding="0" cellspacing="0">
                       <tr>
                         <td align="center">
                           <a href="${inviteUrl}" style="display: inline-block; background-color: ${brandOrange}; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
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
                       <a href="${inviteUrl}" style="color: ${brandOrange}; word-break: break-all;">${inviteUrl}</a>
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
     const emailResponse = await resend.emails.send({
       from: "BuilderLYNK <invites@greenstarteam.com>",
       to: [email],
       subject: `${companyName} has invited you to join BuilderLYNK`,
       html: emailHtml,
     });
 
     console.log("Invitation email sent successfully:", emailResponse);
 
     return new Response(JSON.stringify({ success: true, inviteToken }), {
       status: 200,
       headers: { "Content-Type": "application/json", ...corsHeaders },
     });
   } catch (error: any) {
     console.error("Error in send-user-invite function:", error);
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