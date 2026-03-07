import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Provider = "builderlink" | "google_drive" | "onedrive" | "ftp";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return json(401, { error: "Unauthorized" });
    }

    const body = await req.json().catch(() => ({}));
    const companyId = String(body?.company_id || "").trim();
    const provider = String(body?.provider || "").trim() as Provider;
    const settings = (body?.settings || {}) as Record<string, unknown>;

    if (!companyId || !provider) {
      return json(400, { error: "company_id and provider are required" });
    }

    if (!["builderlink", "google_drive", "onedrive", "ftp"].includes(provider)) {
      return json(400, { error: "Unsupported provider" });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: requesterAccess, error: accessError } = await admin
      .from("user_company_access")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();

    if (accessError || !requesterAccess) {
      return json(403, { error: "Insufficient permissions" });
    }

    const role = String((requesterAccess as any)?.role || "").toLowerCase();
    if (!["admin", "company_admin", "controller", "owner"].includes(role)) {
      return json(403, { error: "Insufficient permissions" });
    }

    let status: "success" | "warning" | "failed" = "success";
    let message = "Connection test passed.";

    if (provider === "builderlink") {
      message = "BuilderLink storage is available.";
    } else if (provider === "google_drive") {
      const { data: tokenRow } = await admin
        .from("google_drive_tokens")
        .select("id, folder_id")
        .eq("company_id", companyId)
        .maybeSingle();

      if (!tokenRow) {
        status = "failed";
        message = "Google Drive is not connected for this company.";
      } else if (!tokenRow.folder_id) {
        status = "warning";
        message = "Google Drive connected, but no root folder is selected.";
      } else {
        status = "success";
        message = "Google Drive token and folder configuration are present.";
      }
    } else if (provider === "onedrive") {
      const folderId = String(settings?.onedrive_folder_id || "").trim();
      if (!folderId) {
        status = "failed";
        message = "OneDrive folder ID is required.";
      } else {
        status = "warning";
        message = "OneDrive configuration looks valid. Live API handshake is not enabled yet in Phase 1.";
      }
    } else if (provider === "ftp") {
      const host = String(settings?.ftp_host || "").trim();
      const username = String(settings?.ftp_username || "").trim();
      const port = Number(settings?.ftp_port || 21);
      if (!host || !username || !Number.isFinite(port) || port <= 0) {
        status = "failed";
        message = "FTP host, username, and a valid port are required.";
      } else {
        status = "warning";
        message = "FTP configuration is present. Live socket/auth probe is not enabled yet in Phase 1.";
      }
    }

    const { data: existingRow } = await admin
      .from("file_upload_settings")
      .select("id, storage_test_results")
      .eq("company_id", companyId)
      .maybeSingle();

    const previousResults = (existingRow as any)?.storage_test_results || {};
    const nextResults = {
      ...previousResults,
      [provider]: {
        status,
        message,
        tested_at: new Date().toISOString(),
      },
    };

    await admin
      .from("file_upload_settings")
      .upsert(
        {
          id: (existingRow as any)?.id,
          company_id: companyId,
          created_by: user.id,
          last_storage_test_provider: provider,
          last_storage_test_status: status,
          last_storage_test_message: message,
          last_storage_tested_at: new Date().toISOString(),
          storage_test_results: nextResults,
        } as any,
        { onConflict: "company_id" },
      );

    return json(200, {
      provider,
      status,
      message,
      tested_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[test-storage-connection] error", error);
    return json(500, { error: error?.message || "Failed to test storage connection" });
  }
});
