import { clearVendorPortalCompanyId } from "@/utils/vendorPortalSession";

export type AuthEntryContext = "builder" | "vendor";

const AUTH_ENTRY_CONTEXT_KEY = "builderlynk_auth_entry_context";

export const getAuthEntryContext = (): AuthEntryContext | null => {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(AUTH_ENTRY_CONTEXT_KEY);
    return value === "builder" || value === "vendor" ? value : null;
  } catch {
    return null;
  }
};

export const setAuthEntryContext = (context: AuthEntryContext) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(AUTH_ENTRY_CONTEXT_KEY, context);
    if (context === "builder") {
      clearVendorPortalCompanyId();
    }
  } catch {
    // ignore storage errors
  }
};

export const clearAuthEntryContext = () => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(AUTH_ENTRY_CONTEXT_KEY);
    clearVendorPortalCompanyId();
  } catch {
    // ignore storage errors
  }
};
