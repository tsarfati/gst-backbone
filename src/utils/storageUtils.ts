import { supabase } from "@/integrations/supabase/client";
import { Upload } from "tus-js-client";

const STORAGE_SUPABASE_URL = "https://watxvzoolmfjfijrgcvq.supabase.co";
const STORAGE_SUPABASE_STORAGE_URL = "https://watxvzoolmfjfijrgcvq.storage.supabase.co";
const STORAGE_SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q";

/**
 * Private buckets that require signed URLs for access.
 * These buckets contain sensitive data and are not publicly accessible.
 */
const PRIVATE_BUCKETS = ['receipts', 'punch-photos', 'credit-card-attachments'];

interface UploadFileWithProgressParams {
  bucketName: string;
  filePath: string;
  file: File;
  upsert?: boolean;
  onProgress?: (percent: number, loaded: number, total: number) => void;
}

const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;
const RESUMABLE_UPLOAD_URL = `${STORAGE_SUPABASE_STORAGE_URL}/storage/v1/upload/resumable`;
const RESUMABLE_CHUNK_SIZE = 6 * 1024 * 1024;

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

/**
 * Uploads a file to Supabase Storage with real browser upload progress callbacks.
 * Use this when the UI needs byte-based progress updates.
 */
export async function uploadFileWithProgress({
  bucketName,
  filePath,
  file,
  upsert = false,
  onProgress,
}: UploadFileWithProgressParams): Promise<void> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Missing authenticated session for file upload");
  }

  if (file.size > RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
    await new Promise<void>((resolve, reject) => {
      const upload = new Upload(file, {
        endpoint: RESUMABLE_UPLOAD_URL,
        headers: {
          apikey: STORAGE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
          "x-upsert": upsert ? "true" : "false",
        },
        metadata: {
          bucketName,
          objectName: filePath,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        chunkSize: RESUMABLE_CHUNK_SIZE,
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        retryDelays: [0, 1000, 3000, 5000],
        onError: (error) => {
          reject(error);
        },
        onProgress: (loaded, total) => {
          if (!onProgress || total <= 0) return;
          const percent = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
          onProgress(percent, loaded, total);
        },
        onSuccess: () => {
          if (onProgress) {
            onProgress(100, file.size, file.size);
          }
          resolve();
        },
      });

      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      }).catch((error) => {
        reject(error);
      });
    });
    return;
  }

  const uploadUrl = `${STORAGE_SUPABASE_URL}/storage/v1/object/${bucketName}/${filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl, true);
    xhr.setRequestHeader("apikey", STORAGE_SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("x-upsert", upsert ? "true" : "false");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;

      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress(percent, event.loaded, event.total);
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed"));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) {
          onProgress(100, file.size, file.size);
        }
        resolve();
        return;
      }

      try {
        const parsed = JSON.parse(xhr.responseText || "{}");
        reject(new Error(parsed.message || parsed.error || "Upload failed"));
      } catch {
        reject(new Error(xhr.responseText || "Upload failed"));
      }
    };

    xhr.send(file);
  });
}
