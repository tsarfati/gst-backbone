import { supabase } from "@/integrations/supabase/client";

export type EmailSenderPreview = {
  mode: "user" | "company" | "builderlynk";
  label: string;
  email: string;
  description: string;
};

const BUILDERLYNK_INVITE_EMAIL = "hello@send.builderlynk.com";

const hasSmtpConfig = (row: any) =>
  Boolean(
    row?.is_configured &&
      row?.smtp_host &&
      row?.smtp_port &&
      row?.smtp_username &&
      row?.smtp_password_encrypted &&
      row?.from_email,
  );

export async function loadEmailSenderPreview(params: {
  userId?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  noUserDescription: string;
  userDescription: string;
  companyDescription: string;
  builderlynkDescription: string;
  unavailableDescription: string;
}): Promise<EmailSenderPreview> {
  const {
    userId,
    companyId,
    companyName,
    noUserDescription,
    userDescription,
    companyDescription,
    builderlynkDescription,
    unavailableDescription,
  } = params;

  if (!userId) {
    return {
      mode: "builderlynk",
      label: "BuilderLYNK",
      email: BUILDERLYNK_INVITE_EMAIL,
      description: noUserDescription,
    };
  }

  try {
    const { data: userEmailSettings, error: userSettingsError } = await supabase
      .from("user_email_settings")
      .select("is_configured, from_name, from_email, smtp_host, smtp_port, smtp_username, smtp_password_encrypted")
      .eq("user_id", userId)
      .maybeSingle();

    if (userSettingsError) throw userSettingsError;

    if (hasSmtpConfig(userEmailSettings)) {
      return {
        mode: "user",
        label: userEmailSettings.from_name || "Personal email settings",
        email: userEmailSettings.from_email,
        description: userDescription,
      };
    }

    if (companyId) {
      const { data: companyEmailSettings, error: companySettingsError } = await supabase
        .from("company_email_settings")
        .select("is_configured, from_name, from_email, smtp_host, smtp_port, smtp_username, smtp_password_encrypted")
        .eq("company_id", companyId)
        .maybeSingle();

      if (companySettingsError) throw companySettingsError;

      if (hasSmtpConfig(companyEmailSettings)) {
        return {
          mode: "company",
          label: companyEmailSettings.from_name || companyName || "Company email settings",
          email: companyEmailSettings.from_email,
          description: companyDescription,
        };
      }
    }

    return {
      mode: "builderlynk",
      label: "BuilderLYNK",
      email: BUILDERLYNK_INVITE_EMAIL,
      description: builderlynkDescription,
    };
  } catch (error) {
    console.error("Error loading sender preview:", error);
    return {
      mode: "builderlynk",
      label: "BuilderLYNK",
      email: BUILDERLYNK_INVITE_EMAIL,
      description: unavailableDescription,
    };
  }
}
