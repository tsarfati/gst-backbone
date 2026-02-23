import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { to, subject, body, file_name, file_url, user_id } = await req.json();

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

    // Build email HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="white-space: pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
        <p style="color: #666; font-size: 14px;">
          📎 <a href="${file_url}" style="color: #2563eb;">${file_name}</a>
          <br/><small>This link expires in 7 days.</small>
        </p>
      </div>
    `;

    // Use Deno's SMTP to send via user's SMTP server
    // For now, we'll use a simple fetch-based approach with the nodemailer-compatible endpoint
    // In production, you'd want proper SMTP library support

    // Since Deno edge functions have limited SMTP support,
    // we'll use the built-in Resend or similar service as a relay
    // For MVP, store the message and provide the download link

    // Try using built-in SMTP via Deno
    const { SmtpClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const client = new SmtpClient();

    const connectConfig: any = {
      hostname: emailSettings.smtp_host,
      port: emailSettings.smtp_port,
      username: emailSettings.smtp_username,
      password: emailSettings.smtp_password_encrypted,
    };

    if (emailSettings.use_ssl) {
      await client.connectTLS(connectConfig);
    } else {
      await client.connect(connectConfig);
    }

    await client.send({
      from: emailSettings.from_email || emailSettings.smtp_username,
      to: Array.isArray(to) ? to.join(",") : to,
      subject: subject,
      content: body,
      html: emailHtml,
    });

    await client.close();

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
