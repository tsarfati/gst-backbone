import { supabase } from "@/integrations/supabase/client";

export type UserUiPreferences = Record<string, unknown>;

export async function loadUserUiPreferences(
  userId?: string | null,
  companyId?: string | null,
): Promise<UserUiPreferences> {
  if (!userId || !companyId) return {};

  const { data, error } = await supabase
    .from("user_ui_preferences" as any)
    .select("settings")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error && error.code !== "PGRST205" && error.code !== "42P01") {
    throw error;
  }

  return ((data as any)?.settings as UserUiPreferences | null) || {};
}

export async function saveUserUiPreferences(
  userId?: string | null,
  companyId?: string | null,
  updates?: UserUiPreferences,
): Promise<UserUiPreferences> {
  if (!userId || !companyId || !updates) return {};

  const existingSettings = await loadUserUiPreferences(userId, companyId);
  const mergedSettings = {
    ...existingSettings,
    ...updates,
  };

  const { error } = await supabase
    .from("user_ui_preferences" as any)
    .upsert(
      {
        user_id: userId,
        company_id: companyId,
        settings: mergedSettings,
      },
      {
        onConflict: "user_id,company_id",
      },
    );

  if (error && error.code !== "PGRST205" && error.code !== "42P01") {
    throw error;
  }

  return mergedSettings;
}
