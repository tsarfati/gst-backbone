import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";

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

    const { to, subject, body, file_name, file_url, attachments, user_id, pdf_attachment } = await req.json();

    // Get user's SMTP settings
    const { data: emailSettings, error: settingsError } = await supabase
      .from("user_email_settings")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (settingsError || !emailSettings?.is_configured) {
      return new Response(
        JSON.stringify({ error: "Email settings not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    for (const f of fileList) {
      try {
        const response = await fetch(f.file_url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          emailAttachments.push({
            filename: f.file_name,
            content: Buffer.from(arrayBuffer),
          });
        } else {
          console.warn(`Failed to download file ${f.file_name}: ${response.status}`);
        }
      } catch (dlErr) {
        console.warn(`Error downloading file ${f.file_name}:`, dlErr);
      }
    }

    if (fileList.length > 0 && emailAttachments.length === 0) {
      // Fallback to links if downloads failed
      const attachmentHtml = fileList.map((f: any) =>
        `<p>📎 <a href="${f.file_url}" style="color: #2563eb;">${f.file_name}</a></p>`
      ).join('');

      emailHtml += `
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        <div style="color: #666; font-size: 14px;">
          ${attachmentHtml}
          <small>These links expire in 7 days.</small>
        </div>
      `;
    } else if (emailAttachments.length > 0) {
      emailHtml += `
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        <div style="color: #666; font-size: 14px;">
          <p>📎 ${emailAttachments.length} file(s) attached</p>
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

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: emailSettings.smtp_host,
      port: emailSettings.smtp_port,
      secure: emailSettings.use_ssl,
      auth: {
        user: emailSettings.smtp_username,
        pass: emailSettings.smtp_password_encrypted,
      },
    });

    const recipients = Array.isArray(to) ? to.join(", ") : to;

    // Build mail options
    const mailOptions: any = {
      from: emailSettings.from_email && emailSettings.from_email.includes('@')
        ? emailSettings.from_email
        : emailSettings.from_email
          ? `${emailSettings.from_email} <${emailSettings.smtp_username}>`
          : emailSettings.smtp_username,
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
      mailOptions.attachments.push({
        filename: pdf_attachment.filename || 'report.pdf',
        content: Buffer.from(pdf_attachment.content, 'base64'),
        contentType: 'application/pdf',
      });
    }

    await transporter.sendMail(mailOptions);

    return new Response(
      JSON.stringify({ success: true }),
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
