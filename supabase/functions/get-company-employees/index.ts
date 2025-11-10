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
      .select('user_id, role, is_active')
      .eq('company_id', company_id)
      .or('is_active.eq.true,is_active.is.null');

    if (accessErr) throw accessErr;

    const userIds = (accessRows || []).map((r: any) => r.user_id);

    // Load profiles for users with explicit access
    let regularEmployees: any[] = [];
    if (userIds.length) {
      const { data: profs, error: profErr } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, display_name, role, current_company_id')
        .in('user_id', userIds);
      if (profErr) throw profErr;

      const roleMap = new Map((accessRows || []).map((r: any) => [r.user_id, r.role]));
      regularEmployees = (profs || []).map((p: any) => ({
        id: p.user_id,
        user_id: p.user_id,
        display_name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Employee',
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        role: roleMap.get(p.user_id) || p.role || 'employee',
        is_pin: false,
      }));
    }

    // ALSO include profiles whose current_company_id matches but who may not have explicit access rows yet
    const { data: companyProfiles, error: companyProfilesErr } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, display_name, role, current_company_id')
      .eq('current_company_id', company_id);
    if (companyProfilesErr) throw companyProfilesErr;

    const byId: Record<string, any> = {};
    for (const emp of regularEmployees) byId[emp.user_id] = emp;
    for (const p of companyProfiles || []) {
      if (!byId[p.user_id]) {
        byId[p.user_id] = {
          id: p.user_id,
          user_id: p.user_id,
          display_name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Employee',
          first_name: p.first_name || null,
          last_name: p.last_name || null,
          role: p.role || 'employee',
          is_pin: false,
        };
      }
    }

    // PIN employees for this company via settings and activity (do not rely on pin_employees.company_id)
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 60);
    const sinceISO = since.toISOString();

    const [pinSettingsRes, tcUsersRes, punchPinsRes] = await Promise.all([
      supabase.from('pin_employee_timecard_settings').select('pin_employee_id').eq('company_id', company_id),
      supabase.from('time_cards').select('user_id').eq('company_id', company_id).gte('punch_in_time', sinceISO),
      supabase.from('punch_records').select('pin_employee_id').eq('company_id', company_id).gte('punch_time', sinceISO),
    ]);

    const pinFromSettings: string[] = (pinSettingsRes.data || []).map((r: any) => r.pin_employee_id).filter(Boolean);
    const pinFromTimeCards: string[] = (tcUsersRes.data || []).map((r: any) => r.user_id).filter(Boolean);
    const pinFromPunches: string[] = (punchPinsRes.data || []).map((r: any) => r.pin_employee_id).filter(Boolean);
    const candidatePinIds = Array.from(new Set([...pinFromSettings, ...pinFromTimeCards, ...pinFromPunches]));

    let pinEmployees: any[] = [];
    if (candidatePinIds.length > 0) {
      const { data: pins, error: pinErr } = await supabase
        .from('pin_employees')
        .select('id, first_name, last_name, display_name, is_active')
        .in('id', candidatePinIds);
      if (pinErr) throw pinErr;

      pinEmployees = (pins || [])
        .filter((p: any) => p.is_active !== false)
        .map((p: any) => ({
          id: p.id,
          user_id: p.id,
          display_name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Employee',
          first_name: p.first_name || null,
          last_name: p.last_name || null,
          role: 'employee',
          is_pin: true,
        }));
    }


    const mergedRegulars = Object.values(byId);

    const employees = [...mergedRegulars, ...pinEmployees]
      .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));

    return new Response(JSON.stringify({ employees }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    console.error('get-company-employees error', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});