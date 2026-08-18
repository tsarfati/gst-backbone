import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { useToast } from '@/hooks/use-toast';
import { getAuthEntryContext } from '@/utils/authEntryContext';
import { getVendorPortalCompanyId } from '@/utils/vendorPortalSession';

interface Company {
  id: string;
  name: string;
  company_type?: 'construction' | 'design_professional' | 'vendor';
  display_name?: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  website?: string;
  enable_shared_vendor_database?: boolean;
  allow_journal_entry_deletion?: boolean;
  created_by?: string;
  tax_id?: string;
  license_number?: string;
  [key: string]: unknown;
}

interface UserCompanyAccess {
  company_id: string;
  company_name: string;
  role: string;
}

const normalizeCompanyRole = (role?: string | null) => String(role || '').trim().toLowerCase();

const getCompanyRolePriority = (role?: string | null) => {
  switch (normalizeCompanyRole(role)) {
    case 'owner':
      return 100;
    case 'company_admin':
    case 'admin':
      return 90;
    case 'controller':
      return 80;
    case 'project_manager':
      return 70;
    case 'employee':
      return 60;
    case 'view_only':
      return 50;
    case 'design_professional':
      return 40;
    case 'vendor':
      return 30;
    default:
      return 0;
  }
};

const dedupeCompanyAccessRows = (rows: UserCompanyAccess[]) => {
  const deduped = new Map<string, UserCompanyAccess>();

  for (const row of rows) {
    const companyId = String(row.company_id || '').trim();
    if (!companyId) continue;

    const existing = deduped.get(companyId);
    if (!existing || getCompanyRolePriority(row.role) >= getCompanyRolePriority(existing.role)) {
      deduped.set(companyId, {
        ...row,
        company_id: companyId,
        role: normalizeCompanyRole(row.role),
      });
    }
  }

  return Array.from(deduped.values());
};

interface CompanyContextType {
  currentCompany: Company | null;
  userCompanies: UserCompanyAccess[];
  loading: boolean;
  switchCompany: (companyId: string) => Promise<void>;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};

interface CompanyProviderProps {
  children: ReactNode;
}

export const CompanyProvider: React.FC<CompanyProviderProps> = ({ children }) => {
  const { user, profile, setProfile, loading: authLoading } = useAuth();
  const { currentTenant, isSuperAdmin, loading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [userCompanies, setUserCompanies] = useState<UserCompanyAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const currentCompanyPreferenceId = profile?.current_company_id ?? null;
  const hasResolvedProfile = !!profile;

  const getCompanyLogoUrl = (logoUrl?: string | null): string | null => {
    if (!logoUrl) return null;
    if (logoUrl.includes('http')) return logoUrl;
    return `https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/company-logos/${logoUrl.replace('company-logos/', '')}`;
  };

  const preloadCompanyLogo = async (logoUrl?: string | null): Promise<void> => {
    const resolved = getCompanyLogoUrl(logoUrl);
    if (!resolved) return;

    await new Promise<void>((resolve) => {
      const img = new Image();
      const done = () => resolve();
      const timeout = window.setTimeout(done, 2500);
      img.onload = () => {
        window.clearTimeout(timeout);
        done();
      };
      img.onerror = () => {
        window.clearTimeout(timeout);
        done();
      };
      img.src = resolved;
    });
  };

  const fetchUserCompanies = async () => {
    if (!user) {
      setCurrentCompany(null);
      setUserCompanies([]);
      setLoading(false);
      return;
    }

    try {
      const shouldShowFullScreenLoader = !currentCompany && userCompanies.length === 0;
      if (shouldShowFullScreenLoader) {
        setLoading(true);
      }

      const { data, error } = await supabase.rpc('get_user_companies', {
        _user_id: user.id
      });

      let companies = (data || []) as unknown as UserCompanyAccess[];

      if (error) {
        console.warn('get_user_companies RPC failed, falling back to user_company_access:', error);
        companies = [];
      }

      // Fallback: some legacy users may have access rows but the RPC returns nothing due to RLS/definition issues
      if (companies.length === 0) {
        const { data: accessData, error: accessError } = await supabase
          .from('user_company_access')
          .select('company_id, role, companies ( id, name, display_name, is_active, tenant_id )')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (accessError) throw accessError;

        companies = (accessData || [])
          .map((row: any) => {
            const company = row.companies;
            if (company?.is_active === false) return null;
            return {
              company_id: row.company_id,
              company_name: company?.display_name || company?.name || row.company_id,
              role: row.role,
            } as UserCompanyAccess;
          })
          .filter(Boolean) as unknown as UserCompanyAccess[];
      }

      const companyIds = Array.from(new Set(companies.map((c) => c.company_id).filter(Boolean)));
      let companyMeta = new Map<string, { id: string; tenant_id: string | null; is_active: boolean; name?: string | null; display_name?: string | null }>();

      if (companyIds.length > 0) {
        const { data: allowedCompanies, error: allowedError } = await supabase
          .from('companies')
          .select('id, tenant_id, is_active, name, display_name')
          .in('id', companyIds);

        if (allowedError) throw allowedError;

        companyMeta = new Map((allowedCompanies || []).map((company) => [company.id, company]));
        companies = companies
          .filter((company) => {
            const meta = companyMeta.get(company.company_id);
            return !!meta && meta.is_active === true;
          })
          .map((company) => {
            const meta = companyMeta.get(company.company_id);
            return {
              ...company,
              company_name: meta?.display_name || meta?.name || company.company_name,
            };
          });
      }

      // Tenant isolation: if the user belongs to a tenant, only show companies in that tenant.
      // (Super admins can see across tenants.)
      if (!isSuperAdmin && currentTenant?.id && companies.length > 0) {
        companies = companies.filter(c => {
          const companyRole = String(c.role || '').toLowerCase();
          const meta = companyMeta.get(c.company_id);
          if (!meta) return false;
          if (companyRole === 'vendor' || companyRole === 'design_professional') {
            return meta.is_active === true;
          }
          return meta.tenant_id === currentTenant.id;
        });
      }

      companies = dedupeCompanyAccessRows(companies);
      setUserCompanies(companies);

      // Preserve the currently selected workspace when possible so refreshes
      // do not unexpectedly jump to a different company for external users.
      if (companies.length > 0) {
        const authEntryContext = getAuthEntryContext();
        const vendorPortalCompanyId = getVendorPortalCompanyId();
        const activeCompanyId = currentCompany?.id;
        const preferredCompanyId = profile?.current_company_id;
        const internalCompanies = companies.filter((company) => {
          const companyRole = String(company.role || '').toLowerCase();
          return companyRole && companyRole !== 'vendor' && companyRole !== 'design_professional';
        });
        const activeCompany = activeCompanyId
          ? companies.find(c => c.company_id === activeCompanyId)
          : undefined;
        const preferredCompany = preferredCompanyId
          ? companies.find(c => c.company_id === preferredCompanyId)
          : undefined;
        const activeInternalCompany =
          activeCompany &&
          !['vendor', 'design_professional'].includes(String(activeCompany.role || '').toLowerCase())
            ? activeCompany
            : undefined;
        const preferredInternalCompany =
          preferredCompany &&
          !['vendor', 'design_professional'].includes(String(preferredCompany.role || '').toLowerCase())
            ? preferredCompany
            : undefined;
        const pinnedVendorPortalCompany =
          authEntryContext === 'vendor' && vendorPortalCompanyId
            ? companies.find((company) => company.company_id === vendorPortalCompanyId)
            : undefined;

        const companyToSet =
          authEntryContext === 'builder' && internalCompanies.length > 0
            ? activeInternalCompany || preferredInternalCompany || internalCompanies[0]
            : pinnedVendorPortalCompany || activeCompany || preferredCompany || companies[0];

        // Fetch full company details
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyToSet.company_id)
          .single();

        if (!companyError && companyData) {
          const mergedCompanyData =
            currentCompany?.id === companyData.id && currentCompany?.logo_url && !companyData.logo_url
              ? { ...companyData, logo_url: currentCompany.logo_url }
              : companyData;
          await preloadCompanyLogo(mergedCompanyData.logo_url);
          setCurrentCompany(mergedCompanyData as Company);
        } else {
          console.error('Error fetching company details:', companyError);
          // Use basic company info from get_user_companies if detailed fetch fails
          setCurrentCompany({
            id: companyToSet.company_id,
            name: companyToSet.company_name
          });
        }
      } else {
        setCurrentCompany(null);
      }
    } catch (error) {
      console.error('Error fetching user companies:', error);
      toast({
        title: "Error",
        description: "Failed to load companies. Please refresh the page.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const switchCompany = async (companyId: string) => {
    if (!user) return;

    try {
      setLoading(true);

      // Tenant isolation guard: prevent switching into a different tenant.
      const targetAccessRole = String(
        userCompanies.find((company) => company.company_id === companyId)?.role || ''
      ).toLowerCase();

      if (
        !isSuperAdmin &&
        currentTenant?.id &&
        targetAccessRole !== 'vendor' &&
        targetAccessRole !== 'design_professional'
      ) {
        const { data: companyCheck, error: companyCheckError } = await supabase
          .from('companies')
          .select('id, tenant_id')
          .eq('id', companyId)
          .maybeSingle();

        if (companyCheckError) throw companyCheckError;

        if (!companyCheck || companyCheck.tenant_id !== currentTenant.id) {
          throw new Error("You don't have access to that company.");
        }
      }

      // Update user's current company preference
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ current_company_id: companyId })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      setProfile((prev: any) => (
        prev
          ? { ...prev, current_company_id: companyId }
          : prev
      ));

      // Fetch the new company details
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (companyError) throw companyError;

      await preloadCompanyLogo(companyData.logo_url);
      setCurrentCompany(companyData as Company);

      toast({
        title: "Switched companies",
        description: `Now viewing ${companyData.display_name || companyData.name}`,
      });

      // Trigger a soft navigation will be handled by caller
      // (previously reloaded the page here)
    } catch (error: any) {
      console.error('Error switching company:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to switch companies. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshCompanies = async () => {
    await fetchUserCompanies();
  };

  useEffect(() => {
    if (tenantLoading) return;

    // No user → clear company context
    if (!user?.id) {
      setCurrentCompany(null);
      setUserCompanies([]);
      setLoading(false);
      return;
    }

    // User exists but profile hasn't hydrated yet.
    // Keep loading while auth context is still resolving, but fail-safe to avoid an infinite loading screen
    // when profile fetch/create fails for first-time signups.
    if (!profile) {
      setLoading(authLoading);
      if (!authLoading) {
        setCurrentCompany(null);
        setUserCompanies([]);
      }
      return;
    }

    fetchUserCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.id,
    currentCompanyPreferenceId,
    currentTenant?.id,
    isSuperAdmin,
    tenantLoading,
    authLoading,
    hasResolvedProfile,
  ]);

  const value = {
    currentCompany,
    userCompanies,
    loading,
    switchCompany,
    refreshCompanies
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__builderCompanyDebug = {
      loading,
      currentCompanyId: currentCompany?.id || null,
      currentCompanyType: currentCompany?.company_type || null,
      userCompanies: userCompanies.map((company) => ({
        company_id: company.company_id,
        role: company.role,
        company_name: company.company_name,
      })),
    };
  }, [loading, currentCompany?.id, currentCompany?.company_type, userCompanies]);

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};
