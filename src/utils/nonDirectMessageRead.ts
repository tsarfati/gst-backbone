type MessageReadTokenInput = {
  message_source?: string | null;
  source_record_id?: string | null;
  id?: string | null;
};

import { supabase } from "@/integrations/supabase/client";

const SETTINGS_KEY = "dashboard_non_direct_read_tokens";
const MAX_STORED_TOKENS = 500;

const buildStorageKeys = (userId?: string | null, companyId?: string | null) => {
  const keys: string[] = [];
  if (userId && companyId) {
    keys.push(`dashboard:read-non-direct:${companyId}:${userId}`);
  }
  if (userId) {
    keys.push(`dashboard:read-non-direct:global:${userId}`);
  }
  return keys;
};

export const buildNonDirectReadToken = (message: MessageReadTokenInput) => {
  const source = String(message.message_source || "unknown");
  const sourceId = String(message.source_record_id || message.id || "");
  return `${source}:${sourceId}`;
};

const readStoredTokenSet = (key: string) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value) => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
};

const writeStoredTokenSet = (key: string, values: Set<string>) => {
  try {
    const trimmed = Array.from(values).slice(-MAX_STORED_TOKENS);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // Ignore storage failures.
  }
};

export const isNonDirectMessageReadStored = (
  message: MessageReadTokenInput,
  userId?: string | null,
  companyId?: string | null,
) => {
  const token = buildNonDirectReadToken(message);
  const keys = buildStorageKeys(userId, companyId);
  return keys.some((key) => readStoredTokenSet(key).has(token));
};

export const persistNonDirectMessageReadStored = (
  message: MessageReadTokenInput,
  userId?: string | null,
  companyId?: string | null,
) => {
  const token = buildNonDirectReadToken(message);
  const keys = buildStorageKeys(userId, companyId);
  keys.forEach((key) => {
    try {
      const stored = readStoredTokenSet(key);
      stored.add(token);
      writeStoredTokenSet(key, stored);
    } catch {
      // Ignore storage failures.
    }
  });
};

export const hydrateNonDirectMessageReadsFromServer = async (
  userId?: string | null,
  companyId?: string | null,
) => {
  if (!userId || !companyId) return new Set<string>();

  try {
    const { data, error } = await supabase
      .from("company_ui_settings")
      .select("settings")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw error;

    const settings = (data?.settings as Record<string, any> | null) || {};
    const serverTokens = Array.isArray(settings[SETTINGS_KEY])
      ? settings[SETTINGS_KEY].filter((value: unknown) => typeof value === "string")
      : [];

    const merged = new Set<string>(serverTokens);
    buildStorageKeys(userId, companyId).forEach((key) => {
      readStoredTokenSet(key).forEach((token) => merged.add(token));
    });

    buildStorageKeys(userId, companyId).forEach((key) => writeStoredTokenSet(key, merged));
    return merged;
  } catch (error) {
    console.error("Failed to hydrate non-direct read markers:", error);
    return new Set<string>();
  }
};

export const persistNonDirectMessageReadEverywhere = async (
  message: MessageReadTokenInput,
  userId?: string | null,
  companyId?: string | null,
) => {
  if (!userId || !companyId) {
    persistNonDirectMessageReadStored(message, userId, companyId);
    return;
  }

  persistNonDirectMessageReadStored(message, userId, companyId);

  try {
    const token = buildNonDirectReadToken(message);
    const { data: existing, error: existingError } = await supabase
      .from("company_ui_settings")
      .select("settings")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (existingError) throw existingError;

    const settings = (existing?.settings as Record<string, any> | null) || {};
    const currentTokens = Array.isArray(settings[SETTINGS_KEY])
      ? settings[SETTINGS_KEY].filter((value: unknown) => typeof value === "string")
      : [];
    const merged = new Set<string>(currentTokens);
    merged.add(token);

    const { error } = await supabase
      .from("company_ui_settings")
      .upsert({
        user_id: userId,
        company_id: companyId,
        settings: {
          ...settings,
          [SETTINGS_KEY]: Array.from(merged).slice(-MAX_STORED_TOKENS),
        },
      }, {
        onConflict: "user_id,company_id",
      });
    if (error) throw error;
  } catch (error) {
    console.error("Failed to persist non-direct read marker:", error);
  }
};
