import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { useToast } from '@/hooks/use-toast';

interface Company {
  id: string;
  name: string;
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
}

interface UserCompanyAccess {
  company_id: string;
  company_name: string;
  role: string;
}

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
  const { user, profile } = useAuth();
  const { currentTenant, isSuperAdmin, loading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [userCompanies, setUserCompanies] = useState<UserCompanyAccess[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserCompanies = async () => {
    if (!user) return;

    try {
      setLoading(true);

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

      // Tenant isolation: if the user belongs to a tenant, only show companies in that tenant.
      // (Super admins can see across tenants.)
      if (!isSuperAdmin && currentTenant?.id && companies.length > 0) {
        const companyIds = companies.map(c => c.company_id);

        const { data: allowedCompanies, error: allowedError } = await supabase
          .from('companies')
          .select('id')
          .in('id', companyIds)
          .eq('tenant_id', currentTenant.id)
          .eq('is_active', true);

        if (allowedError) throw allowedError;

        const allowedSet = new Set((allowedCompanies || []).map(c => c.id));
        companies = companies.filter(c => allowedSet.has(c.company_id));
      }

      setUserCompanies(companies);

      // Set current company based on profile preference or first available
      if (companies.length > 0) {
        const preferredCompanyId = profile?.current_company_id;
        const preferredCompany = preferredCompanyId
          ? companies.find(c => c.company_id === preferredCompanyId)
          : undefined;

        const companyToSet = preferredCompany || companies[0];

        // Fetch full company details
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyToSet.company_id)
          .single();

        if (!companyError && companyData) {
          setCurrentCompany(companyData);
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
      if (!isSuperAdmin && currentTenant?.id) {
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

      // Fetch the new company details
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (companyError) throw companyError;

      setCurrentCompany(companyData);

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

    // User exists but profile hasn't hydrated yet → keep loading so we don't mis-route (e.g. super admin → /super-admin)
    if (!profile) {
      setLoading(true);
      return;
    }

    fetchUserCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.current_company_id, currentTenant?.id, isSuperAdmin, tenantLoading]);

  const value = {
    currentCompany,
    userCompanies,
    loading,
    switchCompany,
    refreshCompanies
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};