import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProfilesRequest { user_ids: string[] }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { user_ids }: ProfilesRequest = await req.json();
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ profiles: [] }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Fetch from profiles - all employees are now in profiles table
    const { data: profs, error: profErr } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, display_name, avatar_url')
      .in('user_id', user_ids);

    if (profErr) {
      console.error('profiles error', profErr);
    }

    const profiles = (profs || []).map((p: any) => ({
      user_id: p.user_id,
      first_name: p.first_name || 'Unknown',
      last_name: p.last_name || 'Employee',
      display_name: p.display_name,
      avatar_url: p.avatar_url,
    }));

    return new Response(JSON.stringify({ profiles }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    console.error('get-employee-profiles error', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
