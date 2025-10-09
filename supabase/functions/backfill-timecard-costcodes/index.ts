import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const supabaseUser = createClient(SUPABASE_URL, ANON_KEY!, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    auth: { persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({})) as {
      company_id?: string;
      days?: number;
      from?: string;
      to?: string;
      limit?: number;
    };

    const companyId = body.company_id;
    if (!companyId) {
      return new Response(JSON.stringify({ error: "Missing company_id" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Auth: require logged-in user and ensure they have elevated role for this company
    const { data: userRes, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const userId = userRes.user.id;
    const { data: access } = await supabaseAdmin
      .from('user_company_access')
      .select('role')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle();

    const allowedRoles = new Set(['admin','controller','project_manager','manager']);
    if (!access || !allowedRoles.has((access as any).role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const nowIso = new Date().toISOString();
    const days = typeof body.days === 'number' && body.days > 0 ? body.days : 60;
    const fromIso = body.from || new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const toIso = body.to || nowIso;
    const limit = Math.min(Math.max(body.limit || 1000, 1), 5000);

    // Find time cards missing cost_code_id in the range
    const { data: timeCards, error: tcErr } = await supabaseAdmin
      .from('time_cards')
      .select('id, user_id, job_id, punch_in_time, punch_out_time, cost_code_id')
      .eq('company_id', companyId)
      .is('cost_code_id', null)
      .neq('status', 'deleted')
      .gte('punch_in_time', fromIso)
      .lte('punch_in_time', toIso)
      .order('punch_in_time', { ascending: true })
      .limit(limit);

    if (tcErr) {
      return new Response(JSON.stringify({ error: tcErr.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    let processed = 0;
    let updated = 0;
    let skipped = 0;

    for (const tc of (timeCards || [])) {
      processed++;
      try {
        const inTime = new Date(tc.punch_in_time);
        const outTime = tc.punch_out_time ? new Date(tc.punch_out_time) : new Date(inTime.getTime() + 12 * 60 * 60 * 1000);
        const windowStart = new Date(inTime.getTime() - 60 * 60 * 1000).toISOString();
        const windowEnd = new Date(outTime.getTime() + 60 * 60 * 1000).toISOString();

        const { data: punches } = await supabaseAdmin
          .from('punch_records')
          .select('id, punch_type, punch_time, cost_code_id')
          .eq('user_id', tc.user_id)
          .eq('job_id', tc.job_id)
          .gte('punch_time', windowStart)
          .lte('punch_time', windowEnd)
          .order('punch_time', { ascending: true });

        const punchOutWithCode = (punches || []).filter(p => p.punch_type === 'punched_out' && p.cost_code_id).pop();
        const anyWithCode = (punches || []).find(p => p.cost_code_id);
        const codeId = (punchOutWithCode?.cost_code_id as string) || (anyWithCode?.cost_code_id as string) || null;

        if (!codeId) {
          skipped++;
          continue;
        }

        // Update time card
        await supabaseAdmin
          .from('time_cards')
          .update({ cost_code_id: codeId })
          .eq('id', tc.id);

        // Update punch-in near the punch_in_time if missing
        const inStart = new Date(inTime.getTime() - 2 * 60 * 1000).toISOString();
        const inEnd = new Date(inTime.getTime() + 2 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from('punch_records')
          .update({ cost_code_id: codeId })
          .eq('user_id', tc.user_id)
          .eq('job_id', tc.job_id)
          .eq('punch_type', 'punched_in')
          .gte('punch_time', inStart)
          .lte('punch_time', inEnd)
          .is('cost_code_id', null);

        // Update punch-out in the window if missing
        await supabaseAdmin
          .from('punch_records')
          .update({ cost_code_id: codeId })
          .eq('user_id', tc.user_id)
          .eq('job_id', tc.job_id)
          .eq('punch_type', 'punched_out')
          .gte('punch_time', windowStart)
          .lte('punch_time', windowEnd)
          .is('cost_code_id', null);

        updated++;
      } catch (_e) {
        skipped++;
      }
    }

    const result = { processed, updated_time_cards: updated, skipped };
    console.log('Backfill result:', result);
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || 'Unexpected error' }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});