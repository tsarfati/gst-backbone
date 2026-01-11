import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subscription_tier: 'free' | 'starter' | 'professional' | 'enterprise';
  max_companies: number | null;
  is_active: boolean;
  created_at: string;
}

interface TenantMember {
  tenant_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
}

interface TenantAccessRequest {
  id: string;
  user_id: string;
  tenant_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface TenantContextType {
  currentTenant: Tenant | null;
  tenantMember: TenantMember | null;
  loading: boolean;
  isSuperAdmin: boolean;
  hasTenantAccess: boolean;
  hasPendingRequest: boolean;
  pendingRequest: TenantAccessRequest | null;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

interface TenantProviderProps {
  children: ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenantMember, setTenantMember] = useState<TenantMember | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<TenantAccessRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenantData = async () => {
    if (!user) {
      setCurrentTenant(null);
      setTenantMember(null);
      setIsSuperAdmin(false);
      setHasPendingRequest(false);
      setPendingRequest(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Check if user is super admin
      const { data: superAdminData } = await supabase
        .from('super_admins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      setIsSuperAdmin(!!superAdminData);

      // Get user's tenant membership
      const { data: memberData, error: memberError } = await supabase
        .from('tenant_members')
        .select(`
          tenant_id,
          user_id,
          role,
          tenants (
            id,
            name,
            slug,
            subscription_tier,
            max_companies,
            is_active,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError && memberError.code !== 'PGRST116') {
        console.error('Error fetching tenant membership:', memberError);
      }

      if (memberData?.tenants) {
        const tenantData = memberData.tenants as unknown as Tenant;
        setCurrentTenant(tenantData);
        setTenantMember({
          tenant_id: memberData.tenant_id,
          user_id: memberData.user_id,
          role: memberData.role as 'owner' | 'admin' | 'member'
        });
        setHasPendingRequest(false);
        setPendingRequest(null);
      } else {
        setCurrentTenant(null);
        setTenantMember(null);

        // Check for pending tenant access request
        const { data: requestData } = await supabase
          .from('tenant_access_requests')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (requestData) {
          setHasPendingRequest(true);
          setPendingRequest(requestData as TenantAccessRequest);
        } else {
          setHasPendingRequest(false);
          setPendingRequest(null);
        }
      }
    } catch (error) {
      console.error('Error fetching tenant data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshTenant = async () => {
    await fetchTenantData();
  };

  useEffect(() => {
    if (user?.id) {
      fetchTenantData();
    } else {
      setCurrentTenant(null);
      setTenantMember(null);
      setIsSuperAdmin(false);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const value = {
    currentTenant,
    tenantMember,
    loading,
    isSuperAdmin,
    hasTenantAccess: !!currentTenant || isSuperAdmin,
    hasPendingRequest,
    pendingRequest,
    refreshTenant
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};
