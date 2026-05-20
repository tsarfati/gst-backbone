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

    // Verify the caller is authenticated and is an admin/controller
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

    const { data: { user: callerUser }, error: authError } = await anonClient.auth.getUser();
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, first_name, last_name, display_name, pin_code, phone, company_id, department, group_id } = body;

    if (!email || !first_name || !last_name || !company_id) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, first_name, last_name, company_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller has admin/controller access to the company
    const { data: callerAccess } = await anonClient
      .from("user_company_access")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("company_id", company_id)
      .eq("is_active", true)
      .single();

    if (!callerAccess || !["admin", "controller"].includes(callerAccess.role)) {
      return new Response(JSON.stringify({ error: "Not authorized to create employees for this company" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to create auth user
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if user with this email already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email.toLowerCase());

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      if (pin_code) {
        const normalizedPin = String(pin_code).trim();
        const { data: duplicateProfiles, error: duplicatePinError } = await adminClient
          .from("profiles")
          .select("user_id, display_name, first_name, last_name")
          .eq("pin_code", normalizedPin)
          .neq("user_id", userId)
          .limit(1);

        if (duplicatePinError) {
          return new Response(JSON.stringify({ error: duplicatePinError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if ((duplicateProfiles || []).length > 0) {
          const duplicateProfile = (duplicateProfiles || [])[0] as any;
          const duplicateName =
            duplicateProfile?.display_name
            || `${duplicateProfile?.first_name || ""} ${duplicateProfile?.last_name || ""}`.trim()
            || "another user";

          return new Response(JSON.stringify({ error: `PIN already in use by ${duplicateName}` }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      
      // Check if profile already exists
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingProfile) {
        const { error: updateProfileError } = await adminClient
          .from("profiles")
          .update({
            first_name,
            last_name,
            display_name: display_name || `${first_name} ${last_name}`.trim(),
            role: "employee",
            custom_role_id: null,
            pin_code: pin_code || null,
            phone: phone || null,
            punch_clock_access: !!pin_code,
            current_company_id: company_id,
            default_company_id: company_id,
            group_id: group_id || null,
          })
          .eq("user_id", userId);

        if (updateProfileError) {
          return new Response(JSON.stringify({ error: updateProfileError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        const { error: createProfileError } = await adminClient
          .from("profiles")
          .insert({
            user_id: userId,
            first_name,
            last_name,
            display_name: display_name || `${first_name} ${last_name}`.trim(),
            role: "employee",
            custom_role_id: null,
            pin_code: pin_code || null,
            phone: phone || null,
            punch_clock_access: !!pin_code,
            current_company_id: company_id,
            default_company_id: company_id,
            group_id: group_id || null,
          });

        if (createProfileError) {
          return new Response(JSON.stringify({ error: createProfileError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else {
      if (pin_code) {
        const normalizedPin = String(pin_code).trim();
        const { data: duplicateProfiles, error: duplicatePinError } = await adminClient
          .from("profiles")
          .select("user_id, display_name, first_name, last_name")
          .eq("pin_code", normalizedPin)
          .limit(1);

        if (duplicatePinError) {
          return new Response(JSON.stringify({ error: duplicatePinError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if ((duplicateProfiles || []).length > 0) {
          const duplicateProfile = (duplicateProfiles || [])[0] as any;
          const duplicateName =
            duplicateProfile?.display_name
            || `${duplicateProfile?.first_name || ""} ${duplicateProfile?.last_name || ""}`.trim()
            || "another user";

          return new Response(JSON.stringify({ error: `PIN already in use by ${duplicateName}` }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Create new auth user with a random password (they'll use PIN to login)
      const tempPassword = crypto.randomUUID() + "Aa1!";
      
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: email.toLowerCase(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name,
          last_name,
          full_name: `${first_name} ${last_name}`.trim(),
        },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;

      // Create profile
      await adminClient.from("profiles").upsert({
        user_id: userId,
        first_name,
        last_name,
        display_name: display_name || `${first_name} ${last_name}`.trim(),
        role: "employee",
        custom_role_id: null,
        pin_code: pin_code || null,
        phone: phone || null,
        punch_clock_access: !!pin_code,
        current_company_id: company_id,
        default_company_id: company_id,
        group_id: group_id || null,
      });
    }

    // Grant company access using the authenticated caller context so the RPC authorization
    // check sees the real admin/controller auth.uid().
    const { error: accessError } = await anonClient.rpc("admin_grant_company_access", {
      p_user_id: userId,
      p_company_id: company_id,
      p_role: "employee",
      p_granted_by: callerUser.id,
      p_is_active: true,
    });

    if (accessError) {
      console.error("Access grant error:", accessError);
      return new Response(JSON.stringify({ error: accessError.message || "Failed to grant company access" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userId,
        message: existingUser ? "Existing user linked to company" : "New employee created" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating employee:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
