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

    // Fetch from profiles
    const { data: profs, error: profErr } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, display_name, avatar_url')
      .in('user_id', user_ids);

    if (profErr) {
      console.error('profiles error', profErr);
    }

    const profilesMap = new Map<string, any>();
    for (const p of profs || []) {
      profilesMap.set(p.user_id, p);
    }

    // For missing, try pin_employees
    const missing = user_ids.filter((id) => !profilesMap.has(id));
    if (missing.length > 0) {
      const { data: pins, error: pinErr } = await supabase
        .from('pin_employees')
        .select('id, first_name, last_name, display_name')
        .in('id', missing);
      if (pinErr) {
        console.error('pin_employees error', pinErr);
      }
      for (const p of pins || []) {
        profilesMap.set(p.id, {
          user_id: p.id,
          first_name: p.first_name || 'Unknown',
          last_name: p.last_name || 'Employee',
          display_name: p.display_name,
          avatar_url: null,
        });
      }
    }

    const profiles = user_ids
      .map((id) => profilesMap.get(id))
      .filter(Boolean);

    return new Response(JSON.stringify({ profiles }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    console.error('get-employee-profiles error', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});