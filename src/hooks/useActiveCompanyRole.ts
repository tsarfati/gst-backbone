import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

/**
 * Returns the current user's role for the *active company*.
 * Falls back to null when company context hasn't loaded or no company is selected.
 */
export function useActiveCompanyRole(): string | null {
  const { profile } = useAuth();
  const { currentCompany, userCompanies } = useCompany();

  return useMemo(() => {
    const companyId = currentCompany?.id ?? profile?.current_company_id ?? null;
    if (!companyId) return null;

    const access = userCompanies.find((uc) => uc.company_id === companyId);
    const role = (access?.role ?? null) as string | null;

    // Normalize to avoid mismatch due to casing/whitespace from DB.
    return role ? role.trim().toLowerCase() : null;
  }, [currentCompany?.id, profile?.current_company_id, userCompanies]);
}
