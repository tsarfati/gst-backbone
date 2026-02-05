import { supabase } from "@/integrations/supabase/client";

/**
 * Email clients cannot render Supabase Storage object paths (e.g. "company-logos/abc/logo.jpg").
 * This helper normalizes common stored logo formats into a publicly reachable URL.
 */
export function resolveCompanyLogoUrl(logo?: string | null): string | undefined {
  if (!logo) return undefined;
  const trimmed = logo.trim();
  if (!trimmed) return undefined;

  // Already a URL (or data URI)
  if (/^(https?:\/\/)/i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;

  // Common stored format in this app: "company-logos/<objectPath>"
  const prefix = "company-logos/";
  const objectPath = trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed;

  const { data } = supabase.storage.from("company-logos").getPublicUrl(objectPath);
  return data?.publicUrl;
}
