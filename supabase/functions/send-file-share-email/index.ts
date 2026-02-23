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

    const { to, subject, body, file_name, file_url, attachments, user_id } = await req.json();

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

    // Build file list from attachments array or legacy single file
    const fileList = attachments && attachments.length > 0
      ? attachments
      : [{ file_name, file_url }];

    // Build attachment links HTML
    const attachmentHtml = fileList.map((f: any) =>
      `<p>📎 <a href="${f.file_url}" style="color: #2563eb;">${f.file_name}</a></p>`
    ).join('');

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="white-space: pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        <div style="color: #666; font-size: 14px;">
          ${attachmentHtml}
          <small>These links expire in 7 days.</small>
        </div>
        ${emailSettings.email_signature ? `<hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" /><div style="white-space: pre-wrap; color: #666; font-size: 13px;">${emailSettings.email_signature.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
      </div>
    `;

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

    await transporter.sendMail({
      from: emailSettings.from_email || emailSettings.smtp_username,
      to: recipients,
      subject: subject,
      text: body,
      html: emailHtml,
    });

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
