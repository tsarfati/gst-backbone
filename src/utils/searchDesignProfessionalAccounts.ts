import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "@/integrations/supabase/client";

export type DesignProfessionalAccountSearchResult = {
  userId: string | null;
  companyId: string | null;
  companyName: string;
  companyLogoUrl: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  hasAccount: boolean;
};

export async function searchDesignProfessionalAccounts(companyId: string, query: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("You must be signed in to search design professional accounts.");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/search-design-professional-accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ companyId, query }),
  });

  const text = await response.text();
  let payload: { results?: DesignProfessionalAccountSearchResult[]; error?: string } | null = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || text || "Failed to search design professional accounts.");
  }

  if (payload?.error) {
    throw new Error(payload.error);
  }

  return payload?.results || [];
}
