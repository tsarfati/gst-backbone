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
      
      // Check if profile already exists
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingProfile) {
        // Update existing profile with PIN if provided
        if (pin_code) {
          await adminClient
            .from("profiles")
            .update({
              pin_code,
              punch_clock_access: true,
              phone: phone || undefined,
            })
            .eq("user_id", userId);
        }
      }
    } else {
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
        pin_code: pin_code || null,
        phone: phone || null,
        punch_clock_access: !!pin_code,
        current_company_id: company_id,
      });
    }

    // Grant company access
    const { error: accessError } = await adminClient.rpc("admin_grant_company_access", {
      p_user_id: userId,
      p_company_id: company_id,
      p_role: "employee",
      p_granted_by: callerUser.id,
      p_is_active: true,
    });

    // Ignore access errors if already granted (the RPC handles upsert)
    if (accessError) {
      console.error("Access grant warning:", accessError);
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
