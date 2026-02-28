 import React from 'npm:react@18.3.1'
 import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
 import { Resend } from 'npm:resend@4.0.0'
 import { renderAsync } from 'npm:@react-email/components@0.0.22'
 import { ConfirmationEmail } from './_templates/confirmation.tsx'
 import { MagicLinkEmail } from './_templates/magic-link.tsx'
 
 const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
 const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string
 
 interface AuthEmailPayload {
   user: {
     id: string
     email: string
     user_metadata?: {
       first_name?: string
       last_name?: string
     }
   }
   email_data: {
     token: string
     token_hash: string
     redirect_to: string
     email_action_type: string
     site_url: string
     token_new?: string
     token_hash_new?: string
   }
 }
 
 Deno.serve(async (req) => {
   if (req.method !== 'POST') {
     return new Response('Method not allowed', { status: 405 })
   }
 
   const payload = await req.text()
   const headers = Object.fromEntries(req.headers)
   
   // Verify the webhook signature
   const wh = new Webhook(hookSecret)
   let data: AuthEmailPayload
   
   try {
     data = wh.verify(payload, headers) as AuthEmailPayload
   } catch (error) {
     console.error('Webhook verification failed:', error)
     return new Response(
       JSON.stringify({ error: { http_code: 401, message: 'Invalid signature' } }),
       { status: 401, headers: { 'Content-Type': 'application/json' } }
     )
   }
 
   const { user, email_data } = data
   const { token, token_hash, redirect_to, email_action_type, site_url } = email_data
   
   console.log('Processing auth email:', { 
     email: user.email, 
     type: email_action_type,
     redirect_to,
     site_url 
   })
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
     let html: string
     let subject: string
 
     // Build the verification URL
     const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`
 
     switch (email_action_type) {
       case 'signup':
       case 'confirmation':
       case 'email_change':
         html = await renderAsync(
           React.createElement(ConfirmationEmail, {
             confirmUrl: verifyUrl,
             userEmail: user.email,
           })
         )
         subject = email_action_type === 'email_change' 
           ? 'Confirm Your New Email Address - BuilderLYNK'
           : 'Confirm Your BuilderLYNK Account'
         break
 
       case 'magiclink':
         html = await renderAsync(
           React.createElement(MagicLinkEmail, {
             magicLinkUrl: verifyUrl,
             token: token,
           })
         )
         subject = 'Your BuilderLYNK Login Link'
         break
 
       case 'recovery':
         // Use existing password reset template styling
         html = `
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
                     <tr>
                       <td style="background-color: #1e3a5f; padding: 30px; text-align: center;">
                         <img src="https://builderlynk.lovable.app/email-assets/builderlynk-logo.png?v=2" alt="BuilderLYNK" style="height: 50px; width: auto;" />
                       </td>
                     </tr>
                     <tr>
                       <td style="padding: 40px 30px;">
                         <h1 style="color: #1e3a5f; font-size: 24px; font-weight: 700; margin: 0 0 20px 0; text-align: center;">
                           Reset Your Password
                         </h1>
                         <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                           We received a request to reset your password. Click the button below to create a new password:
                         </p>
                         <table width="100%" cellpadding="0" cellspacing="0">
                           <tr>
                             <td align="center" style="padding: 30px 0;">
                               <a href="${verifyUrl}" style="display: inline-block; background-color: #E88A2D; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                                 Reset Password
                               </a>
                             </td>
                           </tr>
                         </table>
                         <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                           This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                         </p>
                       </td>
                     </tr>
                     <tr>
                       <td style="background-color: #1e3a5f; padding: 20px 30px; text-align: center;">
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
         `
         subject = 'Reset Your BuilderLYNK Password'
         break
 
       case 'invite':
         html = await renderAsync(
           React.createElement(ConfirmationEmail, {
             confirmUrl: verifyUrl,
             userEmail: user.email,
           })
         )
         subject = 'You\'ve Been Invited to BuilderLYNK'
         break
 
       default:
         console.log('Unhandled email action type:', email_action_type)
         // Return success so Supabase doesn't retry
         return new Response(JSON.stringify({}), {
           status: 200,
           headers: { 'Content-Type': 'application/json' },
         })
     }
 
     // Send the branded email via Resend
     const { error } = await resend.emails.send({
       from: 'BuilderLYNK <noreply@builderlynk.com>',
       to: [user.email],
       subject,
       html,
     })
 
     if (error) {
       console.error('Resend error:', error)
       return new Response(
         JSON.stringify({ error: { http_code: 500, message: error.message } }),
         { status: 500, headers: { 'Content-Type': 'application/json' } }
       )
     }
 
     console.log('Branded auth email sent successfully:', { email: user.email, type: email_action_type })
 
     return new Response(JSON.stringify({}), {
       status: 200,
       headers: { 'Content-Type': 'application/json' },
     })
 
   } catch (error) {
     console.error('Error sending auth email:', error)
     return new Response(
       JSON.stringify({ error: { http_code: 500, message: error.message } }),
       { status: 500, headers: { 'Content-Type': 'application/json' } }
     )
   }
 })