const FALLBACK_PUBLIC_ORIGIN = 'https://builderlynk.com';

export const isDisallowedAuthHost = (hostname: string) => {
  const value = String(hostname || '').toLowerCase();
  return (
    value === 'localhost'
    || value === '127.0.0.1'
    || value.endsWith('.lovable.app')
    || value === 'lovable.app'
    || value.endsWith('.lovableproject.com')
    || value === 'lovableproject.com'
  );
};

export const getPublicAuthOrigin = (fallback = FALLBACK_PUBLIC_ORIGIN) => {
  try {
    const current = new URL(window.location.origin);
    if (isDisallowedAuthHost(current.hostname)) return fallback;
    return current.origin;
  } catch {
    return fallback;
  }
};
