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

    if (dbError) {
      console.error('DB error storing tokens:', dbError);
      return new Response(redirectHtml('error', 'Failed to store authorization'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return new Response(redirectHtml('success', 'Google Drive connected successfully!'), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Error in google-drive-callback:', error);
    return new Response(redirectHtml('error', error.message), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
});

function redirectHtml(status: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Google Drive Connection</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'google-drive-auth', status: '${status}', message: '${message.replace(/'/g, "\\'")}' }, '*');
    window.close();
  } else {
    document.body.innerHTML = '<h2>${status === 'success' ? '✅' : '❌'} ${message.replace(/'/g, "\\'")}</h2><p>You can close this window.</p>';
  }
</script>
</body>
</html>`;
}
