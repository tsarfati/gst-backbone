import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { EMAIL_FROM, resolveBuilderlynkFrom } from "../_shared/emailFrom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, subject, body, file_name, file_url, attachments, user_id, pdf_attachment, binary_attachment } = await req.json();
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const resend = resendApiKey ? new Resend(resendApiKey) : null;
    const defaultFrom = resolveBuilderlynkFrom(
      Deno.env.get("SYSTEM_EMAIL_FROM"),
      EMAIL_FROM.SYSTEM,
      "send-file-share-email",
    );

    // Get user's SMTP settings
    const { data: emailSettings, error: settingsError } = await supabase
      .from("user_email_settings")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (settingsError) {
      console.warn("Error loading user email settings:", settingsError);
    }

    let activeMailer: any = null;
    let mailerSource: "user" | "company" | "builderlynk" = "builderlynk";

    if (emailSettings?.is_configured && emailSettings?.smtp_host && emailSettings?.smtp_username) {
      activeMailer = emailSettings;
      mailerSource = "user";
    } else {
      // Fallback to company email settings (if available)
      try {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("current_company_id")
          .eq("user_id", user.id)
          .maybeSingle();
        const companyId = profileRow?.current_company_id;
        if (companyId) {
          const { data: companyMailerRow } = await (supabase as any)
            .from("company_email_settings")
            .select("*")
            .eq("company_id", companyId)
            .maybeSingle();

          if (
            companyMailerRow?.is_configured &&
            companyMailerRow?.smtp_host &&
            companyMailerRow?.smtp_username
          ) {
            activeMailer = {
              ...companyMailerRow,
              smtp_password_encrypted: companyMailerRow.smtp_password_encrypted,
            };
            mailerSource = "company";
          }
        }
      } catch (companyMailerError) {
        console.warn("Company email settings fallback unavailable:", companyMailerError);
      }
    }

    // Get user's profile for sender name
    const { data: profileData } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", user_id)
      .single();

    const senderName = profileData?.first_name && profileData?.last_name
      ? `${profileData.first_name} ${profileData.last_name}`
      : activeMailer?.from_email || null;
    const senderEmail = activeMailer?.smtp_username || activeMailer?.from_email || null;
    const fromField = senderEmail ? (senderName ? `${senderName} <${senderEmail}>` : senderEmail) : defaultFrom;

    // Build email HTML body
    let emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="white-space: pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    `;

    // Build file list
    const fileList = attachments && attachments.length > 0
      ? attachments
      : file_name && file_url
        ? [{ file_name, file_url }]
        : [];

    // Download files and create real email attachments
    const emailAttachments: any[] = [];
    const explicitLinkFiles: any[] = [];
    const fallbackLinkFiles: any[] = [];

    for (const f of fileList) {
      const deliveryMethod = f.delivery_method === "link" ? "link" : "attachment";

      if (deliveryMethod === "link") {
        explicitLinkFiles.push(f);
        continue;
      }

      try {
        const response = await fetch(f.file_url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          emailAttachments.push({
            filename: f.file_name,
            content: new Uint8Array(arrayBuffer),
          });
        } else {
          console.warn(`Failed to download file ${f.file_name}: ${response.status}`);
          fallbackLinkFiles.push(f);
        }
      } catch (dlErr) {
        console.warn(`Error downloading file ${f.file_name}:`, dlErr);
        fallbackLinkFiles.push(f);
      }
    }

    if (emailAttachments.length > 0) {
      emailHtml += `
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        <div style="color: #666; font-size: 14px;">
          <p>📎 ${emailAttachments.length} file(s) attached</p>
        </div>
      `;
    }

    const linkFiles = [...explicitLinkFiles, ...fallbackLinkFiles];
    if (linkFiles.length > 0) {
      const attachmentHtml = linkFiles.map((f: any) => {
        const expiryText = f.link_expires_label
          ? ` <span style="color: #888;">(expires in ${f.link_expires_label})</span>`
          : '';
        const fallbackText = fallbackLinkFiles.includes(f)
          ? ` <span style="color: #b45309;">(sent as link because attachment could not be fetched)</span>`
          : '';
        return `<p>🔗 <a href="${f.file_url}" style="color: #2563eb;">${f.file_name}</a>${expiryText}${fallbackText}</p>`;
      }).join('');

      emailHtml += `
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        <div style="color: #666; font-size: 14px;">
          <p style="margin: 0 0 8px 0;">Secure file links:</p>
          ${attachmentHtml}
        </div>
      `;
    }

    // Add signature if available
    if (emailSettings.email_signature) {
      emailHtml += `
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        <div style="white-space: pre-wrap; color: #666; font-size: 13px;">${emailSettings.email_signature.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      `;
    }

    emailHtml += '</div>';

    const recipients = Array.isArray(to) ? to.join(", ") : to;

    // Build mail options
    const mailOptions: any = {
      from: fromField,
      to: recipients,
      subject: subject,
      text: body,
      html: emailHtml,
    };

    // Add file attachments
    if (emailAttachments.length > 0) {
      mailOptions.attachments = [...emailAttachments];
    }

    // Handle PDF attachment (base64 encoded)
    if (pdf_attachment && pdf_attachment.content) {
      if (!mailOptions.attachments) mailOptions.attachments = [];
      // Decode base64 to Uint8Array for Deno compatibility
      const binaryStr = atob(pdf_attachment.content);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      mailOptions.attachments.push({
        filename: pdf_attachment.filename || 'report.pdf',
        content: bytes,
        contentType: 'application/pdf',
      });
    }

    // Handle generic binary attachment (base64 encoded)
    if (binary_attachment && binary_attachment.content) {
      if (!mailOptions.attachments) mailOptions.attachments = [];
      const binaryStr = atob(binary_attachment.content);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      mailOptions.attachments.push({
        filename: binary_attachment.filename || "attachment.bin",
        content: bytes,
        contentType: binary_attachment.contentType || "application/octet-stream",
      });
    }

    if (activeMailer?.smtp_host && activeMailer?.smtp_username && activeMailer?.smtp_password_encrypted) {
      const transporter = nodemailer.createTransport({
        host: activeMailer.smtp_host,
        port: activeMailer.smtp_port || 587,
        secure: activeMailer.use_ssl !== false,
        auth: {
          user: activeMailer.smtp_username,
          pass: activeMailer.smtp_password_encrypted,
        },
      });
      await transporter.sendMail(mailOptions);
    } else {
      if (!resend) {
        return new Response(
          JSON.stringify({ error: "No configured SMTP server and BuilderLYNK mailer is unavailable." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const resendAttachments = (mailOptions.attachments || []).map((att: any) => {
        const bytes = att?.content instanceof Uint8Array ? att.content : new Uint8Array();
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return {
          filename: att.filename,
          content: btoa(binary),
          content_type: att.contentType || "application/octet-stream",
        };
      });

      await resend.emails.send({
        from: defaultFrom,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: emailHtml,
        text: body,
        attachments: resendAttachments,
      });
    }

    return new Response(
      JSON.stringify({ success: true, mailer_source: mailerSource }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
