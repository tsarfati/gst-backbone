const HARD_DEFAULT_FROM = "BuilderLYNK <no-reply@send.builderlynk.com>";

function parseFromAddress(value?: string | null): { name?: string; email: string } | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const bracketMatch = raw.match(/^(.*?)<([^>]+)>$/);
  if (bracketMatch) {
    const name = bracketMatch[1]?.trim();
    const email = bracketMatch[2]?.trim().toLowerCase();
    if (!email.includes("@")) return null;
    return { name: name || undefined, email };
  }

  if (!raw.includes("@")) return null;
  return { email: raw.toLowerCase() };
}

function isBuilderlynkEmail(email: string): boolean {
  const normalized = email.toLowerCase();
  return /^[^@\s]+@send\.builderlynk\.com$/.test(normalized);
}

function formatFromAddress(parsed: { name?: string; email: string }): string {
  const safeName = parsed.name?.trim();
  if (!safeName) return parsed.email;
  return `${safeName} <${parsed.email}>`;
}

export function resolveBuilderlynkFrom(
  preferredFrom: string | null | undefined,
  fallbackFrom: string,
  context: string,
): string {
  const preferred = parseFromAddress(preferredFrom);
  if (preferred && isBuilderlynkEmail(preferred.email)) {
    return formatFromAddress(preferred);
  }

  if (preferredFrom && String(preferredFrom).trim()) {
    console.warn(
      `[email-from:${context}] Rejected non-builderlynk sender override`,
      preferredFrom,
    );
  }

  const fallback = parseFromAddress(fallbackFrom);
  if (fallback && isBuilderlynkEmail(fallback.email)) {
    return formatFromAddress(fallback);
  }

  console.warn(
    `[email-from:${context}] Invalid fallback sender. Using hard default.`,
    fallbackFrom,
  );
  return HARD_DEFAULT_FROM;
}

export const EMAIL_FROM = {
  AUTH: "BuilderLYNK <no-reply@send.builderlynk.com>",
  INVITE: "BuilderLYNK <hello@send.builderlynk.com>",
  SYSTEM: "System Notifications <system@send.builderlynk.com>",
  REPORTS: "Financial Reports <reports@send.builderlynk.com>",
  NOTIFICATIONS: "Notifications <notifications@send.builderlynk.com>",
  TEST: "System Notifications <system@send.builderlynk.com>",
} as const;
