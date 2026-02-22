import { supabase } from "@/integrations/supabase/client";

/**
 * Private buckets that require signed URLs for access.
 * These buckets contain sensitive data and are not publicly accessible.
 */
const PRIVATE_BUCKETS = ['receipts', 'punch-photos', 'credit-card-attachments'];

/**
 * Extracts the storage path from a full Supabase storage URL.
 * Handles both public URLs and already-extracted paths.
 */
function extractStoragePath(bucketName: string, urlOrPath: string): string {
  // If it's already just a path (no http), return as-is
  if (!urlOrPath.startsWith('http')) return urlOrPath;

  // Try to extract path from full Supabase storage URL
  // Format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const publicPattern = `/storage/v1/object/public/${bucketName}/`;
  const signedPattern = `/storage/v1/object/sign/${bucketName}/`;

  for (const pattern of [publicPattern, signedPattern]) {
    const idx = urlOrPath.indexOf(pattern);
    if (idx !== -1) {
      let path = urlOrPath.substring(idx + pattern.length);
      // Remove query params (e.g., ?token=...)
      const qIdx = path.indexOf('?');
      if (qIdx !== -1) path = path.substring(0, qIdx);
      return decodeURIComponent(path);
    }
  }

  // If we can't extract, return original (might be an external URL)
  return urlOrPath;
}

/**
 * Gets a signed URL for a file in a private storage bucket.
 * Falls back to the original URL if signing fails.
 * 
 * @param bucketName - The storage bucket name
 * @param urlOrPath - Either a full URL or a storage path
 * @param expiresIn - Expiry time in seconds (default: 1 hour)
 * @returns The signed URL, or the original URL on failure
 */
export async function getSignedStorageUrl(
  bucketName: string,
  urlOrPath: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!urlOrPath) return urlOrPath;

  // If it's an external URL (not from our Supabase), return as-is
  if (urlOrPath.startsWith('http') && !urlOrPath.includes('supabase.co/storage')) {
    return urlOrPath;
  }

  const path = extractStoragePath(bucketName, urlOrPath);

  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.warn(`Failed to create signed URL for ${bucketName}/${path}:`, error);
    return urlOrPath; // Fall back to original
  }

  return data.signedUrl;
}

/**
 * Gets the storage path to store in the database after uploading a file.
 * For private buckets, returns just the path (not a public URL).
 * For public buckets, returns the public URL as before.
 */
export function getStoragePathForDb(
  bucketName: string,
  filePath: string
): string {
  if (PRIVATE_BUCKETS.includes(bucketName)) {
    // Store just the path for private buckets
    return filePath;
  }

  // For public buckets, return the public URL
  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Resolves a stored URL/path to a displayable URL.
 * For private buckets, creates a signed URL.
 * For public buckets or external URLs, returns as-is.
 */
export async function resolveStorageUrl(
  bucketName: string,
  urlOrPath: string | null | undefined
): Promise<string | null> {
  if (!urlOrPath) return null;

  // Already a full external URL not from our storage
  if (urlOrPath.startsWith('http') && !urlOrPath.includes('supabase.co/storage')) {
    return urlOrPath;
  }

  if (PRIVATE_BUCKETS.includes(bucketName)) {
    return getSignedStorageUrl(bucketName, urlOrPath);
  }

  // Public bucket - use public URL
  if (urlOrPath.startsWith('http')) return urlOrPath;
  const { data } = supabase.storage.from(bucketName).getPublicUrl(urlOrPath);
  return data.publicUrl;
}
