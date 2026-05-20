const VENDOR_PORTAL_COMPANY_ID_KEY = "builderlynk_vendor_portal_company_id";

export const getVendorPortalCompanyId = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(VENDOR_PORTAL_COMPANY_ID_KEY);
    return value ? String(value).trim() || null : null;
  } catch {
    return null;
  }
};

export const setVendorPortalCompanyId = (companyId: string | null | undefined) => {
  if (typeof window === "undefined") return;
  try {
    const normalized = String(companyId || "").trim();
    if (!normalized) {
      window.sessionStorage.removeItem(VENDOR_PORTAL_COMPANY_ID_KEY);
      return;
    }
    window.sessionStorage.setItem(VENDOR_PORTAL_COMPANY_ID_KEY, normalized);
  } catch {
    // ignore storage errors
  }
};

export const clearVendorPortalCompanyId = () => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(VENDOR_PORTAL_COMPANY_ID_KEY);
  } catch {
    // ignore storage errors
  }
};
