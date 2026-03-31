import { supabase } from "@/integrations/supabase/client";

const DESIGN_PRO_SUPABASE_URL = "https://watxvzoolmfjfijrgcvq.supabase.co";
const DESIGN_PRO_SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q";

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

  const response = await fetch(`${DESIGN_PRO_SUPABASE_URL}/functions/v1/search-design-professional-accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: DESIGN_PRO_SUPABASE_PUBLISHABLE_KEY,
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
