import { supabase } from "@/integrations/supabase/client";

const DESIGN_PRO_SUPABASE_URL = "https://watxvzoolmfjfijrgcvq.supabase.co";
const DESIGN_PRO_SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q";

type AcceptDesignProfessionalJobInviteInput = {
  companyId: string;
  jobId: string;
  inviteToken?: string | null;
};

type AcceptDesignProfessionalJobInviteResult = {
  success?: boolean;
  error?: string;
};

export async function acceptDesignProfessionalJobInvite(
  input: AcceptDesignProfessionalJobInviteInput,
): Promise<AcceptDesignProfessionalJobInviteResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("You must be signed in to accept invitations.");
  }

  const response = await fetch(`${DESIGN_PRO_SUPABASE_URL}/functions/v1/accept-design-professional-job-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: DESIGN_PRO_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  const text = await response.text();
  let payload: AcceptDesignProfessionalJobInviteResult | null = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || text || "Failed to accept design professional invitation.");
  }

  if (payload?.error) {
    throw new Error(payload.error);
  }

  return payload || { success: true };
}
