import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
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

      if (error) throw error;

      setUserCompanies(data || []);

      // Set current company based on profile preference or first available
      if (data && data.length > 0) {
        const preferredCompanyId = profile?.current_company_id;
        const preferredCompany = data.find(c => c.company_id === preferredCompanyId);
        const companyToSet = preferredCompany || data[0];
        
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
    } catch (error) {
      console.error('Error switching company:', error);
      toast({
        title: "Error",
        description: "Failed to switch companies. Please try again.",
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
    if (user && profile) {
      fetchUserCompanies();
    } else {
      setCurrentCompany(null);
      setUserCompanies([]);
      setLoading(false);
    }
  }, [user, profile]);

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