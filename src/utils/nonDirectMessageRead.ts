type MessageReadTokenInput = {
  message_source?: string | null;
  source_record_id?: string | null;
  id?: string | null;
};

import { supabase } from "@/integrations/supabase/client";
import { loadUserUiPreferences, saveUserUiPreferences } from "@/utils/userUiPreferences";

const SETTINGS_KEY = "dashboard_non_direct_read_tokens";
const MAX_STORED_TOKENS = 500;
const TABLE_NAME = "non_direct_message_reads";
const readTokenCache = new Map<string, Set<string>>();
const pendingWrites = new Set<Promise<void>>();

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

const buildCacheKey = (userId?: string | null, companyId?: string | null) =>
  `${companyId || "global"}:${userId || "anonymous"}`;

export const buildNonDirectReadToken = (message: MessageReadTokenInput) => {
  const source = String(message.message_source || "unknown");
  const sourceId = String(message.source_record_id || message.id || "");
  return `${source}:${sourceId}`;
};

const parseNonDirectReadToken = (token: string) => {
  const separatorIndex = token.indexOf(":");
  if (separatorIndex <= 0) return null;

  return {
    message_source: token.slice(0, separatorIndex),
    source_record_id: token.slice(separatorIndex + 1),
  };
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

const getCachedTokenSet = (userId?: string | null, companyId?: string | null) =>
  readTokenCache.get(buildCacheKey(userId, companyId)) || new Set<string>();

const cacheTokenSet = (
  tokens: Iterable<string>,
  userId?: string | null,
  companyId?: string | null,
) => {
  readTokenCache.set(buildCacheKey(userId, companyId), new Set(tokens));
};

export const isNonDirectMessageReadStored = (
  message: MessageReadTokenInput,
  userId?: string | null,
  companyId?: string | null,
) => {
  const token = buildNonDirectReadToken(message);
  if (getCachedTokenSet(userId, companyId).has(token)) return true;
  const keys = buildStorageKeys(userId, companyId);
  return keys.some((key) => readStoredTokenSet(key).has(token));
};

export const persistNonDirectMessageReadStored = (
  message: MessageReadTokenInput,
  userId?: string | null,
  companyId?: string | null,
) => {
  const token = buildNonDirectReadToken(message);
  const merged = new Set<string>(getCachedTokenSet(userId, companyId));
  merged.add(token);
  cacheTokenSet(merged, userId, companyId);
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
    const { data: readRows, error: readRowsError } = await supabase
      .from(TABLE_NAME as any)
      .select("message_source, source_record_id")
      .eq("user_id", userId)
      .eq("company_id", companyId);
    if (readRowsError && readRowsError.code !== "PGRST205" && readRowsError.code !== "42P01") {
      throw readRowsError;
    }

    const settings = await loadUserUiPreferences(userId, companyId);
    const serverTokens = Array.isArray(settings[SETTINGS_KEY])
      ? settings[SETTINGS_KEY].filter((value: unknown) => typeof value === "string")
      : [];

    const tableTokens = (readRows || []).map((row: any) =>
      buildNonDirectReadToken({
        message_source: row.message_source,
        source_record_id: row.source_record_id,
      }),
    );

    const merged = new Set<string>([...serverTokens, ...tableTokens]);
    buildStorageKeys(userId, companyId).forEach((key) => {
      readStoredTokenSet(key).forEach((token) => merged.add(token));
    });

    cacheTokenSet(merged, userId, companyId);
    buildStorageKeys(userId, companyId).forEach((key) => writeStoredTokenSet(key, merged));

    const legacyOnlyTokens = serverTokens.filter((token) => !tableTokens.includes(token));
    if (legacyOnlyTokens.length > 0) {
      const rows = legacyOnlyTokens
        .map(parseNonDirectReadToken)
        .filter((row): row is { message_source: string; source_record_id: string } => !!row)
        .map((row) => ({
          user_id: userId,
          company_id: companyId,
          message_source: row.message_source,
          source_record_id: row.source_record_id,
        }));

      if (rows.length > 0) {
        const { error: backfillError } = await supabase
          .from(TABLE_NAME as any)
          .upsert(rows, {
            onConflict: "user_id,company_id,message_source,source_record_id",
            ignoreDuplicates: true,
          });

        if (backfillError && backfillError.code !== "PGRST205" && backfillError.code !== "42P01") {
          console.error("Failed to backfill legacy non-direct read markers:", backfillError);
        }
      }
    }

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

  const writePromise = (async () => {
    const token = buildNonDirectReadToken(message);
    try {
      const parsedToken = parseNonDirectReadToken(token);
      if (parsedToken) {
        const { error: tableError } = await supabase
          .from(TABLE_NAME as any)
          .upsert({
            user_id: userId,
            company_id: companyId,
            message_source: parsedToken.message_source,
            source_record_id: parsedToken.source_record_id,
          }, {
            onConflict: "user_id,company_id,message_source,source_record_id",
          });

        if (tableError && tableError.code !== "PGRST205" && tableError.code !== "42P01") {
          throw tableError;
        }
      }

      const settings = await loadUserUiPreferences(userId, companyId);
      const currentTokens = Array.isArray(settings[SETTINGS_KEY])
        ? settings[SETTINGS_KEY].filter((value: unknown) => typeof value === "string")
        : [];
      const merged = new Set<string>(currentTokens);
      merged.add(token);

      await saveUserUiPreferences(userId, companyId, {
        [SETTINGS_KEY]: Array.from(merged).slice(-MAX_STORED_TOKENS),
      });
    } catch (error) {
      console.error("Failed to persist non-direct read marker:", error);
      throw error;
    }
  })();

  pendingWrites.add(writePromise);
  try {
    await writePromise;
  } finally {
    pendingWrites.delete(writePromise);
  }
};

export const flushPendingNonDirectMessageReadWrites = async () => {
  if (pendingWrites.size === 0) return;
  await Promise.allSettled(Array.from(pendingWrites));
};
