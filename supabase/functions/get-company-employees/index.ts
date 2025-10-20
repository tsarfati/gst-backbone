import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(JSON.stringify({ error: 'company_id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Regular users via user_company_access
    const { data: accessRows, error: accessErr } = await supabase
      .from('user_company_access')
      .select('user_id, role')
      .eq('company_id', company_id)
      .eq('is_active', true);

    if (accessErr) throw accessErr;

    const userIds = (accessRows || []).map((r: any) => r.user_id);

    let regularEmployees: any[] = [];
    if (userIds.length) {
      const { data: profs, error: profErr } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, display_name')
        .in('user_id', userIds);
      if (profErr) throw profErr;

      const roleMap = new Map((accessRows || []).map((r: any) => [r.user_id, r.role]));
      regularEmployees = (profs || []).map((p: any) => ({
        id: p.user_id,
        user_id: p.user_id,
        display_name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Employee',
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        role: roleMap.get(p.user_id) || 'employee',
        is_pin: false,
      }));
    }

    // PIN employees for this company
    const { data: pins, error: pinErr } = await supabase
      .from('pin_employees')
      .select('id, first_name, last_name, display_name, is_active')
      .eq('company_id', company_id);
    if (pinErr) throw pinErr;

    const pinEmployees = (pins || [])
      .filter((p: any) => p.is_active !== false) // default to include if null
      .map((p: any) => ({
        id: p.id,
        user_id: p.id,
        display_name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Employee',
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        role: 'employee',
        is_pin: true,
      }));

    const employees = [...regularEmployees, ...pinEmployees]
      .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));

    return new Response(JSON.stringify({ employees }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    console.error('get-company-employees error', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});