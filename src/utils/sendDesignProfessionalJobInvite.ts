import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "@/integrations/supabase/client";

type SendDesignProfessionalJobInviteInput = {
  companyId: string;
  jobId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

type SendDesignProfessionalJobInviteResult = {
  success?: boolean;
  inviteToken?: string;
  error?: string;
};

export async function sendDesignProfessionalJobInvite(
  input: SendDesignProfessionalJobInviteInput,
): Promise<SendDesignProfessionalJobInviteResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("You must be signed in to send invites.");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-design-professional-job-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  const text = await response.text();
  let payload: SendDesignProfessionalJobInviteResult | null = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || text || "Failed to send design professional invite.");
  }

  if (payload?.error) {
    throw new Error(payload.error);
  }

  return payload || { success: true };
}
