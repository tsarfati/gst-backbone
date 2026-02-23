import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return new Response(redirectHtml('error', `Google authorization failed: ${error}`), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (!code || !stateParam) {
      return new Response(redirectHtml('error', 'Missing authorization code or state'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Decode state to get company_id
    let state: { company_id: string };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return new Response(redirectHtml('error', 'Invalid state parameter'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redirectUri = `${supabaseUrl}/functions/v1/google-drive-callback`;

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      return new Response(redirectHtml('error', `Token exchange failed: ${tokenData.error_description || tokenData.error}`), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Store tokens in database using service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error: dbError } = await supabase
      .from('google_drive_tokens')
      .upsert({
        company_id: state.company_id,
        access_token,
        refresh_token,
        token_expires_at: tokenExpiresAt,
        connected_by: '00000000-0000-0000-0000-000000000000', // Will be updated by the frontend
      }, { onConflict: 'company_id' });

    // Redirect back to the app's settings page
    const appUrl = Deno.env.get('APP_URL') || req.headers.get('origin') || '';
    return new Response(redirectHtml('success', 'Google Drive connected successfully!', appUrl), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Error in google-drive-callback:', error);
    const appUrl = Deno.env.get('APP_URL') || '';
    return new Response(redirectHtml('error', error.message, appUrl), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
});

function redirectHtml(status: string, message: string, appUrl: string): string {
  const escapedMessage = message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const redirectUrl = appUrl ? `${appUrl}/settings/security` : '';
  const icon = status === 'success' ? '&#10004;' : '&#10006;';
  const color = status === 'success' ? '#16a34a' : '#dc2626';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Google Drive Connection</title>
  ${redirectUrl ? `<meta http-equiv="refresh" content="2;url=${redirectUrl}">` : ''}
</head>
<body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;">
  <h2 style="color:${color}">${icon} ${escapedMessage}</h2>
  <p>${redirectUrl ? 'Redirecting back to settings...' : 'You can close this window.'}</p>
</body>
</html>`;
}
