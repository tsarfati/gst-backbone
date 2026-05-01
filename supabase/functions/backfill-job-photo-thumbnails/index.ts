import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET_NAME = "punch-photos";
const MAX_DIMENSION = 640;
const JPEG_QUALITY = 72;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const safeString = (value: unknown) => String(value ?? "").trim();

function extractStoragePath(bucketName: string, urlOrPath: string): string {
  if (!urlOrPath.startsWith("http")) {
    const bucketPrefix = `${bucketName}/`;
    return urlOrPath.startsWith(bucketPrefix) ? urlOrPath.slice(bucketPrefix.length) : urlOrPath;
  }

  const patterns = [
    `/storage/v1/object/public/${bucketName}/`,
    `/storage/v1/object/sign/${bucketName}/`,
    `/storage/v1/object/authenticated/${bucketName}/`,
  ];

  for (const pattern of patterns) {
    const idx = urlOrPath.indexOf(pattern);
    if (idx !== -1) {
      const pathWithQuery = urlOrPath.slice(idx + pattern.length);
      const qIndex = pathWithQuery.indexOf("?");
      return decodeURIComponent(qIndex === -1 ? pathWithQuery : pathWithQuery.slice(0, qIndex));
    }
  }

  return urlOrPath;
}

function getThumbnailPath(jobId: string, photoId: string): string {
  return `job-${jobId}/thumbnails/${photoId}.jpg`;
}

async function buildThumbnailBytes(originalBytes: Uint8Array): Promise<Uint8Array> {
  const image = await Image.decode(originalBytes);
  const longestSide = Math.max(image.width, image.height);
  const scale = longestSide > MAX_DIMENSION ? MAX_DIMENSION / longestSide : 1;
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  image.resize(targetWidth, targetHeight);
  return await image.encodeJPEG(JPEG_QUALITY);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(500, { error: "Missing Supabase environment variables" });
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return json(401, { error: "Missing authorization header" });
    }
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    const body = await req.json().catch(() => ({}));
    const companyId = safeString(body?.companyId);
    const limit = Math.max(1, Math.min(Number(body?.limit) || 100, 500));

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    let isSuperAdmin = false;
    let targetCompanyIds: string[] = [];

    if (bearerToken === serviceRoleKey) {
      isSuperAdmin = true;
      targetCompanyIds = companyId ? [companyId] : [];
    } else {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: authData, error: authError } = await userClient.auth.getUser();
      if (authError || !authData?.user?.id) {
        return json(401, { error: "Unauthorized" });
      }

      const actorUserId = String(authData.user.id);
      const { data: actorProfile, error: actorProfileError } = await admin
        .from("profiles")
        .select("role")
        .eq("user_id", actorUserId)
        .maybeSingle();
      if (actorProfileError) throw actorProfileError;

      const { data: actorAccessRows, error: actorAccessError } = await admin
        .from("user_company_access")
        .select("company_id, role, is_active")
        .eq("user_id", actorUserId)
        .eq("is_active", true);
      if (actorAccessError) throw actorAccessError;

      const companyAccessRows = (actorAccessRows || []).filter((row: any) =>
        !companyId || safeString(row.company_id) === companyId,
      );
      const canManageCompanies = new Set(
        companyAccessRows
          .filter((row: any) => ["admin", "controller"].includes(safeString(row.role).toLowerCase()))
          .map((row: any) => safeString(row.company_id)),
      );

      isSuperAdmin = safeString(actorProfile?.role).toLowerCase() === "super_admin";
      if (!isSuperAdmin && canManageCompanies.size === 0) {
        return json(403, { error: "Admin, controller, or super admin access is required." });
      }

      targetCompanyIds = isSuperAdmin
        ? (companyId ? [companyId] : [])
        : Array.from(canManageCompanies);
    }

    let query = admin
      .from("job_photos")
      .select("id, job_id, photo_url, thumbnail_url, jobs!inner(company_id)")
      .is("thumbnail_url", null)
      .not("photo_url", "is", null)
      .limit(limit);

    if (companyId) {
      query = query.eq("jobs.company_id", companyId);
    } else if (!isSuperAdmin) {
      query = query.in("jobs.company_id", targetCompanyIds);
    }

    const { data: rows, error: rowsError } = await query.order("created_at", { ascending: true });
    if (rowsError) throw rowsError;

    const processed: Array<{ id: string; thumbnailPath: string }> = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const row of rows || []) {
      const photoId = safeString((row as any).id);
      const jobId = safeString((row as any).job_id);
      const photoPath = extractStoragePath(BUCKET_NAME, safeString((row as any).photo_url));
      const thumbnailPath = getThumbnailPath(jobId, photoId);

      try {
        const { data: fileBlob, error: downloadError } = await admin.storage
          .from(BUCKET_NAME)
          .download(photoPath);
        if (downloadError || !fileBlob) {
          throw new Error(downloadError?.message || "Could not download source image");
        }

        const originalBytes = new Uint8Array(await fileBlob.arrayBuffer());
        const thumbnailBytes = await buildThumbnailBytes(originalBytes);

        const { error: uploadError } = await admin.storage
          .from(BUCKET_NAME)
          .upload(thumbnailPath, thumbnailBytes, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: true,
          });
        if (uploadError) throw uploadError;

        const { error: updateError } = await admin
          .from("job_photos")
          .update({ thumbnail_url: thumbnailPath })
          .eq("id", photoId);
        if (updateError) throw updateError;

        processed.push({ id: photoId, thumbnailPath });
      } catch (error) {
        failed.push({
          id: photoId,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return json(200, {
      success: true,
      requestedLimit: limit,
      companyId: companyId || null,
      processedCount: processed.length,
      failedCount: failed.length,
      remainingEstimate: Math.max(0, (rows?.length || 0) - processed.length - failed.length),
      processed,
      failed,
    });
  } catch (error) {
    console.error("backfill-job-photo-thumbnails error", error);
    return json(500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
