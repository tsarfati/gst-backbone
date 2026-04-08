import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useActiveCompanyRole } from "@/hooks/useActiveCompanyRole";
import { useTenant } from "@/contexts/TenantContext";

export function useWebsiteJobAccess() {
  const { user, profile } = useAuth();
  const { isSuperAdmin } = useTenant();
  const { currentCompany } = useCompany();
  const activeCompanyRole = useActiveCompanyRole();
  const [loading, setLoading] = useState(true);
  const [hasGlobalJobAccess, setHasGlobalJobAccess] = useState(false);
  const [allowedJobIds, setAllowedJobIds] = useState<string[]>([]);
  const isDesignProfessionalUser = useMemo(
    () => String(profile?.role || "").toLowerCase() === "design_professional",
    [profile?.role],
  );
  const isVendorUser = useMemo(
    () => String(profile?.role || "").toLowerCase() === "vendor",
    [profile?.role],
  );
  const isExternalSharedUser = isDesignProfessionalUser || isVendorUser;

  const isPrivilegedRole = useMemo(() => {
    const role = (activeCompanyRole || "").toLowerCase();
    const profileRole = String(profile?.role || "").toLowerCase();
    return (
      isSuperAdmin ||
      role === "admin" ||
      role === "company_admin" ||
      role === "controller" ||
      role === "owner" ||
      role === "super_admin" ||
      profileRole === "admin" ||
      profileRole === "company_admin" ||
      profileRole === "controller" ||
      profileRole === "owner" ||
      profileRole === "super_admin"
    );
  }, [activeCompanyRole, isSuperAdmin, profile?.role]);
  const isPrivileged = isPrivilegedRole && !isExternalSharedUser;

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

        const [directoryRes, projectManagerRes, assistantPmRes, employeeSettingsRes, companyJobsRes, sharedJobAccessRes] = await Promise.all([
          supabase
            .from('job_project_directory')
            .select('job_id')
            .eq('company_id', currentCompany.id)
            .eq('linked_user_id', user.id)
            .eq('is_active', true)
            .eq('is_project_team_member', true),
          supabase
            .from('jobs')
            .select('id')
            .eq('company_id', currentCompany.id)
            .eq('project_manager_user_id', user.id),
          supabase
            .from('job_assistant_managers')
            .select('job_id')
            .eq('user_id', user.id)
            ,
          supabase
            .from('employee_timecard_settings')
            .select('assigned_jobs')
            .eq('company_id', currentCompany.id)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('jobs')
            .select('id')
            .eq('company_id', currentCompany.id),
          supabase
            .from('user_job_access')
            .select('job_id')
            .eq('user_id', user.id),
        ]);

        if (directoryRes.error) throw directoryRes.error;
        if (projectManagerRes.error) throw projectManagerRes.error;
        if (assistantPmRes.error) throw assistantPmRes.error;
        if (companyJobsRes.error) throw companyJobsRes.error;
        if (sharedJobAccessRes.error) throw sharedJobAccessRes.error;
        if (employeeSettingsRes.error && employeeSettingsRes.error.code !== 'PGRST116') {
          throw employeeSettingsRes.error;
        }

        setHasGlobalJobAccess(false);

        const allowedIds = new Set<string>();

        const companyJobIds = new Set((companyJobsRes.data || []).map((row: any) => String(row.id)));

        (directoryRes.data || []).forEach((row: any) => {
          if (row?.job_id) allowedIds.add(String(row.job_id));
        });

        (projectManagerRes.data || []).forEach((row: any) => {
          if (row?.id) allowedIds.add(String(row.id));
        });

        (assistantPmRes.data || []).forEach((row: any) => {
          if (row?.job_id && companyJobIds.has(String(row.job_id))) {
            allowedIds.add(String(row.job_id));
          }
        });

        (sharedJobAccessRes.data || []).forEach((row: any) => {
          if (row?.job_id) {
            allowedIds.add(String(row.job_id));
          }
        });

        if (!isExternalSharedUser) {
          (((employeeSettingsRes.data as any)?.assigned_jobs) || []).forEach((jobId: string) => {
            if (jobId) allowedIds.add(String(jobId));
          });
        }

        setAllowedJobIds(Array.from(allowedIds));
      } catch (error) {
        console.warn("Error loading website job access:", error);
        setHasGlobalJobAccess(false);
        setAllowedJobIds([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id, currentCompany?.id, isPrivileged, isExternalSharedUser]);

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
