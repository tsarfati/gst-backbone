type MessageReadTokenInput = {
  message_source?: string | null;
  source_record_id?: string | null;
  id?: string | null;
};

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
      localStorage.setItem(key, JSON.stringify(Array.from(stored)));
    } catch {
      // Ignore storage failures.
    }
  });
};
