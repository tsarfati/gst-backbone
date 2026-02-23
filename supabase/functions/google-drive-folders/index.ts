import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id, parent_folder_id, action, folder_name } = await req.json();

    if (!company_id) {
      return new Response(JSON.stringify({ error: 'company_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get stored tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('google_drive_tokens')
      .select('*')
      .eq('company_id', company_id)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Google Drive not connected' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let accessToken = tokenData.access_token;

    // Refresh token if expired
    if (new Date(tokenData.token_expires_at) <= new Date()) {
      const refreshed = await refreshAccessToken(tokenData.refresh_token);
      if (!refreshed) {
        return new Response(JSON.stringify({ error: 'Failed to refresh token. Please reconnect Google Drive.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      accessToken = refreshed.access_token;
      await supabase
        .from('google_drive_tokens')
        .update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq('company_id', company_id);
    }

    // CREATE FOLDER
    if (action === 'create') {
      if (!folder_name) {
        return new Response(JSON.stringify({ error: 'folder_name is required for create action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const metadata: Record<string, unknown> = {
        name: folder_name,
        mimeType: 'application/vnd.google-apps.folder',
      };
      if (parent_folder_id) {
        metadata.parents = [parent_folder_id];
      }

      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });

      const created = await createRes.json();
      if (!createRes.ok) {
        return new Response(JSON.stringify({ error: created.error?.message || 'Failed to create folder' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ folder: { id: created.id, name: created.name } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // LIST FOLDERS
    const parentQuery = parent_folder_id
      ? `'${parent_folder_id}' in parents`
      : `'root' in parents`;

    const query = `${parentQuery} and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name&pageSize=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const listData = await listRes.json();
    if (!listRes.ok) {
      return new Response(JSON.stringify({ error: listData.error?.message || 'Failed to list folders' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      folders: listData.files || [],
      current_folder_id: parent_folder_id || 'root',
      selected_folder_id: tokenData.folder_id,
      selected_folder_name: tokenData.folder_name,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in google-drive-folders:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function refreshAccessToken(refreshToken: string) {
  const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET')!;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    console.error('Token refresh failed:', await response.text());
    return null;
  }

  return await response.json();
}
