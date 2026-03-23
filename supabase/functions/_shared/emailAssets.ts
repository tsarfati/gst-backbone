const STORAGE_PUBLIC_PATH = "/storage/v1/object/public/";

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/g, "");
const trimLeadingSlashes = (value: string): string => value.replace(/^\/+/g, "");

const encodeObjectPath = (path: string): string =>
  path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const getConfiguredAssetBaseUrl = (): string => {
  const raw =
    Deno.env.get("EMAIL_ASSET_BASE_URL") ||
    Deno.env.get("PUBLIC_ASSET_BASE_URL") ||
    "";
  return trimTrailingSlashes(String(raw).trim());
};

const getSupabaseStorageBaseUrl = (): string => {
  const supabaseUrl = trimTrailingSlashes(Deno.env.get("SUPABASE_URL") || "");
  return supabaseUrl ? `${supabaseUrl}${STORAGE_PUBLIC_PATH}` : STORAGE_PUBLIC_PATH;
};

const parseSupabaseStorageUrl = (
  rawUrl: string,
): { bucket: string; objectPath: string } | null => {
  try {
    const parsed = new URL(rawUrl);
    const markerIndex = parsed.pathname.indexOf(STORAGE_PUBLIC_PATH);
    if (markerIndex === -1) return null;
    const remainder = parsed.pathname.slice(markerIndex + STORAGE_PUBLIC_PATH.length);
    const [bucket, ...pathParts] = remainder.split("/").filter(Boolean);
    if (!bucket || pathParts.length === 0) return null;
    return {
      bucket: decodeURIComponent(bucket),
      objectPath: pathParts.map((part) => decodeURIComponent(part)).join("/"),
    };
  } catch {
    return null;
  }
};

export const resolveEmailAssetUrl = (bucket: string, objectPath: string): string => {
  const safeBucket = trimLeadingSlashes(trimTrailingSlashes(bucket));
  const safeObjectPath = trimLeadingSlashes(objectPath);
  const encodedObjectPath = encodeObjectPath(safeObjectPath);
  const assetBaseUrl = getConfiguredAssetBaseUrl();

  if (assetBaseUrl) {
    return `${assetBaseUrl}/${safeBucket}/${encodedObjectPath}`;
  }

  return `${getSupabaseStorageBaseUrl()}${safeBucket}/${encodedObjectPath}`;
};

export const resolveCompanyLogoEmailUrl = (logoUrl?: string | null): string | null => {
  if (!logoUrl) return null;
  const trimmed = String(logoUrl).trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    const storageAsset = parseSupabaseStorageUrl(trimmed);
    return storageAsset
      ? resolveEmailAssetUrl(storageAsset.bucket, storageAsset.objectPath)
      : trimmed;
  }

  const cleaned = trimmed.replace(/^company-logos\//, "").replace(/^\/+/, "");
  return resolveEmailAssetUrl("company-logos", cleaned);
};

export const BUILDERLYNK_EMAIL_LOGO_URL = resolveEmailAssetUrl(
  "company-logos",
  "builder lynk.png",
);
