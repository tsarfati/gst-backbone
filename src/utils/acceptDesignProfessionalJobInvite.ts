import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "@/integrations/supabase/client";

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

  const response = await fetch(`${SUPABASE_URL}/functions/v1/accept-design-professional-job-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
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
