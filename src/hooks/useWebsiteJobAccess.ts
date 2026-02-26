import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useActiveCompanyRole } from "@/hooks/useActiveCompanyRole";

export function useWebsiteJobAccess() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const activeCompanyRole = useActiveCompanyRole();
  const [loading, setLoading] = useState(true);
  const [hasGlobalJobAccess, setHasGlobalJobAccess] = useState(false);
  const [allowedJobIds, setAllowedJobIds] = useState<string[]>([]);

  const isPrivileged = useMemo(() => {
    const role = (activeCompanyRole || "").toLowerCase();
    return role === "admin" || role === "company_admin" || role === "controller" || role === "owner";
  }, [activeCompanyRole]);

  useEffect(() => {
    const load = async () => {
      if (!user?.id || !currentCompany?.id) {
        setHasGlobalJobAccess(false);
        setAllowedJobIds([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        if (isPrivileged) {
          setHasGlobalJobAccess(true);
          setAllowedJobIds([]);
          return;
        }

        const { data: accessData, error: accessError } = await supabase
            .from("user_job_access")
            .select("job_id, jobs!inner(company_id)")
            .eq("user_id", user.id);
        if (accessError) throw accessError;
        
        // Website/PM job visibility is driven by explicit website job assignments,
        // not the legacy/global punch clock job access flag.
        setHasGlobalJobAccess(false);

        const ids = (accessData || [])
          .filter((row: any) => row.jobs?.company_id === currentCompany.id)
          .map((row: any) => row.job_id);
        setAllowedJobIds(Array.from(new Set(ids)));
      } catch (error) {
        console.warn("Error loading website job access:", error);
        setHasGlobalJobAccess(false);
        setAllowedJobIds([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id, currentCompany?.id, isPrivileged]);

  const canAccessJob = useCallback((jobId: string | null | undefined) => {
    if (!jobId) return false;
    if (hasGlobalJobAccess) return true;
    return allowedJobIds.includes(jobId);
  }, [hasGlobalJobAccess, allowedJobIds]);

  return {
    loading,
    hasGlobalJobAccess,
    allowedJobIds,
    isPrivileged,
    canAccessJob,
  };
}
