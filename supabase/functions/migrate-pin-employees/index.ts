import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const emailDomain = body.email_domain || "greenstarteam.com";
    const dryRun = body.dry_run === true;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all active pin_employees
    const { data: pinEmployees, error: fetchError } = await adminClient
      .from("pin_employees")
      .select("*")
      .eq("is_active", true);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const pe of pinEmployees || []) {
      const firstName = (pe.first_name || "").trim();
      const lastName = (pe.last_name || "").trim();
      
      // Generate email if missing
      let email = pe.email?.trim().toLowerCase();
      if (!email) {
        const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, "");
        const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, "");
        email = `${cleanFirst}.${cleanLast}@${emailDomain}`;
      }

      const companyId = pe.company_id;
      if (!companyId) {
        results.push({ pin_employee_id: pe.id, name: `${firstName} ${lastName}`, status: "skipped", reason: "no company_id" });
        continue;
      }

      if (dryRun) {
        results.push({ pin_employee_id: pe.id, name: `${firstName} ${lastName}`, email, company_id: companyId, pin_code: pe.pin_code, status: "would_migrate" });
        continue;
      }

      try {
        // Check if auth user with this email exists
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === email);

        let userId: string;

        if (existingUser) {
          userId = existingUser.id;
        } else {
          // Create auth user
          const tempPassword = crypto.randomUUID() + "Aa1!";
          const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`.trim(),
            },
          });

          if (createError) {
            results.push({ pin_employee_id: pe.id, name: `${firstName} ${lastName}`, email, status: "error", reason: createError.message });
            continue;
          }
          userId = newUser.user.id;
        }

        // Upsert profile
        await adminClient.from("profiles").upsert({
          user_id: userId,
          first_name: firstName,
          last_name: lastName,
          display_name: pe.display_name || `${firstName} ${lastName}`.trim(),
          role: "employee",
          pin_code: pe.pin_code || null,
          phone: pe.phone || null,
          punch_clock_access: true,
          current_company_id: companyId,
        }, { onConflict: "user_id" });

        // Grant company access
        const { error: accessError } = await adminClient.rpc("admin_grant_company_access", {
          p_user_id: userId,
          p_company_id: companyId,
          p_role: "employee",
          p_granted_by: caller.id,
          p_is_active: true,
        });

        if (accessError) {
          console.error("Access grant warning for", email, accessError);
        }

        // Migrate timecard settings if they exist
        const { data: tcSettings } = await adminClient
          .from("pin_employee_timecard_settings")
          .select("*")
          .eq("pin_employee_id", pe.id);

        if (tcSettings && tcSettings.length > 0) {
          for (const setting of tcSettings) {
            await adminClient.from("employee_timecard_settings").upsert({
              user_id: userId,
              company_id: companyId,
              job_id: setting.job_id,
              cost_code_id: setting.cost_code_id,
              created_by: caller.id,
            }, { onConflict: "user_id,job_id" }).then(() => {});
          }
        }

        results.push({
          pin_employee_id: pe.id,
          new_user_id: userId,
          name: `${firstName} ${lastName}`,
          email,
          pin_code: pe.pin_code,
          status: existingUser ? "linked_existing" : "created",
        });

      } catch (err: any) {
        results.push({ pin_employee_id: pe.id, name: `${firstName} ${lastName}`, email, status: "error", reason: err.message });
      }
    }

    const migrated = results.filter(r => r.status === "created" || r.status === "linked_existing").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    const errors = results.filter(r => r.status === "error").length;

    return new Response(
      JSON.stringify({
        summary: { total: results.length, migrated, skipped, errors, dry_run: dryRun },
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Migration error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
