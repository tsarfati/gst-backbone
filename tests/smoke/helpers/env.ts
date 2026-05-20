export type SmokeUser = {
  email: string;
  password: string;
};

export type SmokeEnv = {
  baseUrl: string;
  internalUser: SmokeUser | null;
  vendorPortalUser: SmokeUser | null;
  sameEmailUser: SmokeUser | null;
  vendorLoginUrl: string | null;
  vendorExpectedCompanyName: string | null;
  workspaceChooserUser: SmokeUser | null;
};

function readUser(prefix: string): SmokeUser | null {
  const email = process.env[`${prefix}_EMAIL`]?.trim();
  const password = process.env[`${prefix}_PASSWORD`]?.trim();
  if (!email || !password) return null;
  return { email, password };
}

export function getSmokeEnv(): SmokeEnv {
  return {
    baseUrl: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8086',
    internalUser: readUser('PW_INTERNAL_USER'),
    vendorPortalUser: readUser('PW_VENDOR_USER'),
    sameEmailUser: readUser('PW_SAME_EMAIL_USER'),
    vendorLoginUrl: process.env.PW_VENDOR_LOGIN_URL?.trim() || null,
    vendorExpectedCompanyName: process.env.PW_VENDOR_EXPECTED_COMPANY_NAME?.trim() || null,
    workspaceChooserUser: readUser('PW_WORKSPACE_CHOOSER_USER'),
  };
}

export function hasUser(user: SmokeUser | null): user is SmokeUser {
  return Boolean(user?.email && user?.password);
}
