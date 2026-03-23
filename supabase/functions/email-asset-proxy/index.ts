import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

const ALLOWED_BUCKETS = new Set(["company-logos"]);
const DEFAULT_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";

const buildStoragePublicUrl = (bucket: string, objectPath: string): string => {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/g, "");
  const encodedPath = objectPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
};

const getAssetRequest = (url: URL): { bucket: string; objectPath: string } | null => {
  const queryBucket = String(url.searchParams.get("bucket") || "").trim();
  const queryPath = String(url.searchParams.get("path") || "").trim().replace(/^\/+/, "");
  if (queryBucket && queryPath) {
    return { bucket: queryBucket, objectPath: queryPath };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const fnIndex = segments.lastIndexOf("email-asset-proxy");
  if (fnIndex === -1 || fnIndex >= segments.length - 2) return null;

  const bucket = segments[fnIndex + 1];
  const objectPath = segments.slice(fnIndex + 2).map((segment) => decodeURIComponent(segment)).join("/");
  if (!bucket || !objectPath) return null;
  return { bucket, objectPath };
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const assetRequest = getAssetRequest(new URL(req.url));
    if (!assetRequest) {
      return new Response(JSON.stringify({ error: "Missing asset path" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const bucket = String(assetRequest.bucket || "").trim();
    const objectPath = String(assetRequest.objectPath || "").trim().replace(/^\/+/, "");
    if (!bucket || !objectPath) {
      return new Response(JSON.stringify({ error: "Invalid asset path" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!ALLOWED_BUCKETS.has(bucket)) {
      return new Response(JSON.stringify({ error: "Bucket not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const upstreamResponse = await fetch(buildStoragePublicUrl(bucket, objectPath), {
      method: req.method,
      headers: req.method === "HEAD" ? undefined : { Accept: req.headers.get("Accept") || "*/*" },
    });

    if (!upstreamResponse.ok) {
      return new Response(
        upstreamResponse.body,
        {
          status: upstreamResponse.status,
          headers: {
            "Content-Type": upstreamResponse.headers.get("content-type") || "application/json",
            "Cache-Control": "public, max-age=60",
            ...corsHeaders,
          },
        },
      );
    }

    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set(
      "Content-Type",
      upstreamResponse.headers.get("content-type") || "application/octet-stream",
    );
    responseHeaders.set(
      "Cache-Control",
      upstreamResponse.headers.get("cache-control") || DEFAULT_CACHE_CONTROL,
    );
    const etag = upstreamResponse.headers.get("etag");
    if (etag) responseHeaders.set("ETag", etag);
    const lastModified = upstreamResponse.headers.get("last-modified");
    if (lastModified) responseHeaders.set("Last-Modified", lastModified);
    const contentLength = upstreamResponse.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);

    return new Response(req.method === "HEAD" ? null : upstreamResponse.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("email-asset-proxy error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
