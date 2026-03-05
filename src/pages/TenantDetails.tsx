import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  Building2, 
  Users, 
  Settings, 
  Loader2, 
  Save,
  Trash2,
  UserPlus,
  Crown,
  Shield,
  User,
  Mail,
  KeyRound,
  ExternalLink,
  History
} from 'lucide-react';

type SubscriptionTier = string;
type MemberRole = 'owner' | 'admin' | 'member';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  subscription_tier: SubscriptionTier;
  max_companies: number | null;
  is_active: boolean;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

interface MemberDetails {
  profile: {
    user_id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
    status: string | null;
    avatar_url: string | null;
    created_at: string | null;
    updated_at: string | null;
  } | null;
  loginAudit: Array<{
    id: string;
    login_time: string;
    logout_time: string | null;
    login_method: string | null;
    success: boolean;
    app_source: string | null;
    user_agent: string | null;
    ip_address: string | null;
  }>;
  companyAudit: Array<{
    id: string;
    created_at: string;
    company_id: string;
    table_name: string;
    action: string;
    field_name: string | null;
    old_value: string | null;
    new_value: string | null;
    reason: string | null;
  }>;
}

interface TenantCompany {
  id: string;
  name: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  city: string | null;
  state: string | null;
}

interface TierOption {
  value: string;
  label: string;
  maxCompanies: number | null;
}

const LEGACY_SUBSCRIPTION_TIERS: TierOption[] = [
  { value: 'free', label: 'Free', maxCompanies: 1 },
  { value: 'starter', label: 'Starter', maxCompanies: 3 },
  { value: 'professional', label: 'Professional', maxCompanies: 10 },
  { value: 'enterprise', label: 'Enterprise', maxCompanies: null },
];

const MEMBER_ROLES = [
  { value: 'owner', label: 'Owner', icon: Crown },
  { value: 'admin', label: 'Admin', icon: Shield },
  { value: 'member', label: 'Member', icon: User },
];

export default function TenantDetails() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin, loading: tenantLoading } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [companies, setCompanies] = useState<TenantCompany[]>([]);
  const [subscriptionTierOptions, setSubscriptionTierOptions] = useState<TierOption[]>(LEGACY_SUBSCRIPTION_TIERS);
  
  // Editable form state
  const [formData, setFormData] = useState<{
    name: string;
    subscription_tier: SubscriptionTier;
    max_companies: number | null;
    is_active: boolean;
  }>({
    name: '',
    subscription_tier: 'free',
    max_companies: null,
    is_active: true,
  });

  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>('member');
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TenantMember | null>(null);
  const [memberDetails, setMemberDetails] = useState<MemberDetails | null>(null);
  const [memberDetailsLoading, setMemberDetailsLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [impersonatingOrg, setImpersonatingOrg] = useState(false);

  const parseFunctionError = async (error: any) => {
    try {
      if (typeof error?.context?.json === 'function') {
        const payload = await error.context.json();
        return payload?.error || payload?.message || error?.message || 'Request failed';
      }
    } catch {
      // ignore parse failure
    }
    return error?.message || 'Request failed';
  };

  const ensureFunctionAuth = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    let accessToken = sessionData.session?.access_token;
    const expiresAt = sessionData.session?.expires_at || 0;
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (!accessToken || (expiresAt > 0 && expiresAt <= nowSeconds + 30)) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        throw new Error('Your session expired. Please sign in again.');
      }
      accessToken = refreshed.session?.access_token;
    }

    if (!accessToken) {
      throw new Error('Your session expired. Please sign in again.');
    }

    supabase.functions.setAuth(accessToken);
  };

  useEffect(() => {
    if (!tenantLoading && !isSuperAdmin) {
      navigate('/', { replace: true });
    }
  }, [isSuperAdmin, tenantLoading, navigate]);

  useEffect(() => {
    if (isSuperAdmin && tenantId) {
      fetchTenantData();
    }
  }, [isSuperAdmin, tenantId]);

  const fetchTenantData = async () => {
    if (!tenantId) return;
    
    try {
      setLoading(true);

      // Fetch tenant details
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (tenantError) throw tenantError;

      // Fetch members with profile info
      const { data: membersData, error: membersError } = await supabase
        .from('tenant_members')
        .select(`
          id,
          tenant_id,
          user_id,
          role,
          created_at
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;

      // Get user profiles for members
      const userIds = membersData?.map(m => m.user_id) || [];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, display_name, email')
          .in('user_id', userIds);

        const enrichedMembers = membersData?.map(m => {
          const profile = profiles?.find(p => p.user_id === m.user_id);
          return {
            ...m,
            user_name: profile?.display_name || 
              [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 
              'Unknown User',
            user_email: profile?.email || undefined,
          };
        }) || [];

        setMembers(enrichedMembers);
      } else {
        setMembers([]);
      }

      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, display_name, is_active, created_at, city, state')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      const companyIds = (companiesData || []).map((company) => company.id).filter(Boolean);
      let effectiveTierValue = String(tenantData.subscription_tier || '');

      if (companyIds.length > 0) {
        const { data: companySubs, error: companySubsError } = await supabase
          .from('company_subscriptions')
          .select('company_id, subscription_tiers(name)')
          .in('company_id', companyIds)
          .eq('status', 'active');

        if (companySubsError) throw companySubsError;

        const assignedTierNames = Array.from(
          new Set(
            (companySubs || [])
              .map((row: any) => String(row?.subscription_tiers?.name || ''))
              .filter(Boolean)
          )
        );

        if (assignedTierNames.length === 1) {
          effectiveTierValue = assignedTierNames[0];
        }
      }

      const { data: tierRows, error: tierError } = await supabase
        .from('subscription_tiers')
        .select('name, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (tierError) throw tierError;

      const dynamicTierOptions: TierOption[] = (tierRows || [])
        .map((tier: any) => ({
          value: String(tier.name),
          label: String(tier.name),
          maxCompanies: null,
        }))
        .filter((tier: TierOption) => !!tier.value);

      const nextTierOptions = dynamicTierOptions.length > 0 ? dynamicTierOptions : LEGACY_SUBSCRIPTION_TIERS;
      const currentTierValue = effectiveTierValue;
      const hasCurrentTier = nextTierOptions.some((tier) => tier.value === currentTierValue);

      setSubscriptionTierOptions(
        currentTierValue && !hasCurrentTier
          ? [{ value: currentTierValue, label: currentTierValue, maxCompanies: tenantData.max_companies ?? null }, ...nextTierOptions]
          : nextTierOptions
      );

      setTenant({
        ...tenantData,
        subscription_tier: effectiveTierValue as SubscriptionTier,
      });
      setFormData({
        name: tenantData.name,
        subscription_tier: effectiveTierValue as SubscriptionTier,
        max_companies: tenantData.max_companies,
        is_active: tenantData.is_active,
      });

    } catch (error) {
      console.error('Error fetching tenant data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tenant data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;

    setSaving(true);
    try {
      const tenantUpdatePayload: Record<string, any> = {
        name: formData.name,
        max_companies: formData.max_companies,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      };

      // tenants.subscription_tier is still a legacy enum column.
      // Only write to it for legacy enum values to avoid save failures on custom tier names.
      if (LEGACY_SUBSCRIPTION_TIERS.some((tier) => tier.value === formData.subscription_tier)) {
        tenantUpdatePayload.subscription_tier = formData.subscription_tier;
      }

      const { error } = await supabase
        .from('tenants')
        .update(tenantUpdatePayload)
        .eq('id', tenantId);

      if (error) throw error;

      const { data: selectedTier, error: selectedTierError } = await supabase
        .from('subscription_tiers')
        .select('id, name')
        .eq('name', formData.subscription_tier)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (selectedTierError) throw selectedTierError;

      if (!selectedTier?.id) {
        throw new Error(`No active subscription tier found named "${formData.subscription_tier}".`);
      }

      if (!user?.id) {
        throw new Error('Missing authenticated user for subscription sync.');
      }

      const companyIds = companies.map((company) => company.id).filter(Boolean);
      if (companyIds.length > 0) {
        const upsertRows = companyIds.map((companyId) => ({
          company_id: companyId,
          tier_id: selectedTier.id,
          status: 'active',
          billing_cycle: 'monthly',
          assigned_by: user.id,
          notes: `Synced from organization tier (${selectedTier.name})`,
        }));

        const { error: subscriptionSyncError } = await supabase
          .from('company_subscriptions')
          .upsert(upsertRows, { onConflict: 'company_id' });

        if (subscriptionSyncError) throw subscriptionSyncError;
      }

      toast({
        title: 'Saved',
        description: 'Organization settings and company subscriptions updated successfully.',
      });

      await fetchTenantData();
    } catch (error) {
      console.error('Error saving tenant:', error);
      toast({
        title: 'Error',
        description: 'Failed to save changes.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: MemberRole) => {
    try {
      const { error } = await supabase
        .from('tenant_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Updated',
        description: 'Member role updated successfully.',
      });

      await fetchTenantData();
    } catch (error) {
      console.error('Error updating member role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update member role.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (memberId: string, memberRole: string) => {
    if (memberRole === 'owner') {
      toast({
        title: 'Cannot Remove',
        description: 'Cannot remove the organization owner.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('tenant_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Removed',
        description: 'Member removed from organization.',
      });

      await fetchTenantData();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove member.',
        variant: 'destructive',
      });
    }
  };

  const getTierBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'default';
      case 'professional': return 'secondary';
      case 'starter': return 'outline';
      default: return 'outline';
    }
  };

  const getTierLabel = (tier: string) => {
    return subscriptionTierOptions.find((option) => option.value === tier)?.label || tier;
  };

  const getRoleIcon = (role: string) => {
    const roleConfig = MEMBER_ROLES.find(r => r.value === role);
    const Icon = roleConfig?.icon || User;
    return <Icon className="h-4 w-4" />;
  };

  const openMemberModal = async (member: TenantMember) => {
    setSelectedMember(member);
    setMemberModalOpen(true);
    setMemberDetailsLoading(true);
    setMemberDetails(null);
    setNewPassword('');

    try {
      await ensureFunctionAuth();
      const { data, error } = await supabase.functions.invoke('super-admin-member-details', {
        body: { userId: member.user_id },
      });
      if (error) throw error;
      setMemberDetails({
        profile: data?.profile ?? null,
        loginAudit: Array.isArray(data?.loginAudit) ? data.loginAudit : [],
        companyAudit: Array.isArray(data?.companyAudit) ? data.companyAudit : [],
      });
    } catch (error: any) {
      console.error('Error loading member details:', error);
      const message = await parseFunctionError(error);
      toast({
        title: 'Error',
        description: message || 'Failed to load member details.',
        variant: 'destructive',
      });
    } finally {
      setMemberDetailsLoading(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!selectedMember?.user_id) return;
    setSendingReset(true);
    try {
      await ensureFunctionAuth();
      const { error } = await supabase.functions.invoke('super-admin-send-password-reset', {
        body: {
          userId: selectedMember.user_id,
          redirectTo: `${window.location.origin}/auth?type=recovery`,
        },
      });
      if (error) throw error;
      toast({
        title: 'Password Reset Sent',
        description: 'Reset email sent to this member.',
      });
    } catch (error: any) {
      console.error('Error sending password reset:', error);
      const message = await parseFunctionError(error);
      toast({
        title: 'Error',
        description: message || 'Failed to send password reset.',
        variant: 'destructive',
      });
    } finally {
      setSendingReset(false);
    }
  };

  const handleSetPassword = async () => {
    if (!selectedMember?.user_id) return;
    if (!newPassword || newPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Use at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    setSettingPassword(true);
    try {
      await ensureFunctionAuth();
      const { error } = await supabase.functions.invoke('super-admin-set-user-password', {
        body: {
          userId: selectedMember.user_id,
          password: newPassword,
        },
      });
      if (error) throw error;
      setNewPassword('');
      toast({
        title: 'Password Updated',
        description: 'Member password was updated successfully.',
      });
    } catch (error: any) {
      console.error('Error setting password:', error);
      const message = await parseFunctionError(error);
      toast({
        title: 'Error',
        description: message || 'Failed to set password.',
        variant: 'destructive',
      });
    } finally {
      setSettingPassword(false);
    }
  };

  const handleImpersonateOrganization = async () => {
    if (!tenantId) return;

    let impersonationUserId: string | null = null;

    // Prefer explicit owner membership in this tenant.
    try {
      const { data: ownerMember } = await supabase
        .from('tenant_members')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle();
      if (ownerMember?.user_id) {
        impersonationUserId = ownerMember.user_id;
      }
    } catch (error) {
      console.warn('Failed to resolve owner member:', error);
    }

    // Fallback to tenant.owner_id if owner membership lookup has no result.
    if (!impersonationUserId && tenant?.owner_id) {
      impersonationUserId = tenant.owner_id;
    }

    // Last resort: any member in the organization.
    if (!impersonationUserId) {
      try {
        const { data: anyMember } = await supabase
          .from('tenant_members')
          .select('user_id')
          .eq('tenant_id', tenantId)
          .limit(1)
          .maybeSingle();
        if (anyMember?.user_id) {
          impersonationUserId = anyMember.user_id;
        }
      } catch (error) {
        console.warn('Failed to resolve member fallback:', error);
      }
    }

    if (!impersonationUserId) {
      toast({
        title: 'Missing owner',
        description: 'This organization has no owner or member user to impersonate.',
        variant: 'destructive',
      });
      return;
    }

    // Open a blank popup synchronously in the click event to avoid popup blockers.
    const popup = window.open('about:blank', '_blank');
    if (!popup) {
      toast({
        title: 'Popup blocked',
        description: 'Allow popups, then click "Log In As Org Admin" again.',
        variant: 'destructive',
      });
      return;
    }
    popup.document.write('<p style="font-family:Arial,sans-serif;padding:16px;">Preparing impersonation session...</p>');

    setImpersonatingOrg(true);
    try {
      await ensureFunctionAuth();
      const { data, error } = await supabase.functions.invoke('super-admin-impersonate-user', {
        body: {
          userId: impersonationUserId,
          redirectTo: `${window.location.origin}/auth?impersonating=1&tenantId=${encodeURIComponent(tenantId)}`,
        },
      });
      if (error) throw error;
      if (!data?.actionLink) {
        throw new Error('No impersonation link was returned');
      }
      popup.location.replace(data.actionLink as string);
      popup.focus();

      toast({
        title: 'Impersonation Window Opened',
        description: 'You are now opening a troubleshooting session in a new tab.',
      });
    } catch (error: any) {
      popup.close();
      console.error('Error impersonating organization:', error);
      const message = await parseFunctionError(error);
      toast({
        title: 'Error',
        description: message || 'Failed to start impersonation.',
        variant: 'destructive',
      });
    } finally {
      setImpersonatingOrg(false);
    }
  };

  if (tenantLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin || !tenant) {
    return null;
  }

  const tierInfo = subscriptionTierOptions.find(t => t.value === formData.subscription_tier);
  const companyLimit = formData.max_companies ?? tierInfo?.maxCompanies ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/super-admin')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{tenant.name}</h1>
            </div>
            <Badge variant={tenant.is_active ? 'default' : 'destructive'}>
              {tenant.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant={getTierBadgeVariant(tenant.subscription_tier)} className="capitalize">
              {getTierLabel(tenant.subscription_tier)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{members.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {companies.length}
                {companyLimit !== null && (
                  <span className="text-sm text-muted-foreground font-normal"> / {companyLimit}</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tier</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getTierLabel(tenant.subscription_tier)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Created</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Date(tenant.created_at).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="members">
              Members
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                {members.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="companies">
              Companies
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                {companies.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Organization Settings</CardTitle>
                    <CardDescription>
                      Manage organization name, subscription tier, and limits.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleImpersonateOrganization}
                    disabled={impersonatingOrg}
                  >
                    {impersonatingOrg ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Log In As Org Admin
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Organization Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={tenant.slug}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tier">Subscription Tier</Label>
                    <Select
                      value={formData.subscription_tier}
                      onValueChange={(value) => {
                        const tier = subscriptionTierOptions.find(t => t.value === value);
                        setFormData({ 
                          ...formData, 
                          subscription_tier: value as SubscriptionTier,
                          max_companies: tier?.maxCompanies ?? formData.max_companies
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {subscriptionTierOptions.map((tier) => (
                          <SelectItem key={tier.value} value={tier.value}>
                            {tier.label} {tier.maxCompanies ? `(${tier.maxCompanies} companies)` : '(Unlimited)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_companies">Max Companies</Label>
                    <Input
                      id="max_companies"
                      type="number"
                      min="1"
                      value={formData.max_companies ?? ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        max_companies: e.target.value ? parseInt(e.target.value) : null 
                      })}
                      placeholder="Unlimited"
                    />
                    <p className="text-xs text-muted-foreground">Leave empty for unlimited</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Organization Active</Label>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Organization Members</CardTitle>
                  <CardDescription>
                    Manage users who have access to this organization.
                  </CardDescription>
                </div>
                <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Member</DialogTitle>
                      <DialogDescription>
                        Add a new member to this organization by their user ID.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>User ID</Label>
                        <Input
                          value={newMemberEmail}
                          onChange={(e) => setNewMemberEmail(e.target.value)}
                          placeholder="Enter user UUID"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={newMemberRole} onValueChange={(v) => setNewMemberRole(v as MemberRole)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEMBER_ROLES.filter(r => r.value !== 'owner').map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddMemberDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={async () => {
                        if (!newMemberEmail || !tenantId) return;
                        try {
                          const { error } = await supabase
                            .from('tenant_members')
                            .insert({
                              tenant_id: tenantId,
                              user_id: newMemberEmail,
                              role: newMemberRole,
                            });
                          if (error) throw error;
                          toast({ title: 'Added', description: 'Member added successfully.' });
                          setAddMemberDialogOpen(false);
                          setNewMemberEmail('');
                          setNewMemberRole('member');
                          await fetchTenantData();
                        } catch (error: any) {
                          toast({ title: 'Error', description: error.message, variant: 'destructive' });
                        }
                      }}>
                        Add Member
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No members in this organization</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow
                          key={member.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openMemberModal(member)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {getRoleIcon(member.role)}
                              {member.user_name}
                            </div>
                          </TableCell>
                          <TableCell>{member.user_email || '-'}</TableCell>
                          <TableCell>
                            <Select
                              value={member.role}
                              onValueChange={(value) => handleUpdateMemberRole(member.id, value as MemberRole)}
                              disabled={member.role === 'owner'}
                            >
                              <SelectTrigger
                                className="w-32"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MEMBER_ROLES.map((role) => (
                                  <SelectItem 
                                    key={role.value} 
                                    value={role.value}
                                    disabled={role.value === 'owner'}
                                  >
                                    {role.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {new Date(member.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRemoveMember(member.id, member.role);
                              }}
                              disabled={member.role === 'owner'}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Companies Tab */}
          <TabsContent value="companies">
            <Card>
              <CardHeader>
                <CardTitle>Companies</CardTitle>
                <CardDescription>
                  Companies belonging to this organization.
                  {companyLimit !== null && (
                    <span className="ml-1">
                      ({companies.length} of {companyLimit} allowed)
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {companies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No companies in this organization</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies.map((company) => (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">
                            {company.display_name || company.name}
                          </TableCell>
                          <TableCell>
                            {[company.city, company.state].filter(Boolean).join(', ') || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={company.is_active ? 'default' : 'destructive'}>
                              {company.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(company.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={memberModalOpen} onOpenChange={setMemberModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Member Profile</DialogTitle>
            <DialogDescription>
              Review account details and audit activity for this member.
            </DialogDescription>
          </DialogHeader>

          {memberDetailsLoading ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !selectedMember ? (
            <p className="text-sm text-muted-foreground">No member selected.</p>
          ) : (
            <Tabs defaultValue="profile" className="space-y-4">
              <TabsList>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="login">
                  <History className="h-4 w-4 mr-1" />
                  Login Audit
                </TabsTrigger>
                <TabsTrigger value="changes">Change Audit</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={memberDetails?.profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {(memberDetails?.profile?.display_name || selectedMember.user_name || 'U')
                          .split(' ')
                          .map((part) => part[0] || '')
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="text-base font-semibold">
                        {memberDetails?.profile?.display_name || selectedMember.user_name || 'Unknown User'}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {memberDetails?.profile?.email || selectedMember.user_email || '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Use this exact email for login.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Badge variant="secondary" className="capitalize">
                          {memberDetails?.profile?.role || selectedMember.role}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {memberDetails?.profile?.status || 'unknown'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Send Reset Email</CardTitle>
                      <CardDescription>
                        Sends a password reset email to this member.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={handleSendPasswordReset}
                        disabled={sendingReset}
                        className="w-full"
                      >
                        {sendingReset ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Mail className="h-4 w-4 mr-2" />
                        )}
                        Send Password Reset
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Set Password Directly</CardTitle>
                      <CardDescription>
                        Set a new password immediately for this member.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Input
                        type="password"
                        placeholder="New password (8+ characters)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <Button
                        onClick={handleSetPassword}
                        disabled={settingPassword}
                        className="w-full"
                      >
                        {settingPassword ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <KeyRound className="h-4 w-4 mr-2" />
                        )}
                        Update Password
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="login">
                <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                  {(memberDetails?.loginAudit || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No login audit entries found.</p>
                  ) : (
                    memberDetails?.loginAudit.map((event) => (
                      <div key={event.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {new Date(event.login_time).toLocaleString()}
                          </p>
                          <Badge variant={event.success ? 'default' : 'destructive'}>
                            {event.success ? 'Success' : 'Failed'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Method: {event.login_method || 'unknown'} • App: {event.app_source || 'web'}
                        </p>
                        {event.user_agent && (
                          <p className="text-xs text-muted-foreground mt-1 truncate" title={event.user_agent}>
                            {event.user_agent}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="changes">
                <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                  {(memberDetails?.companyAudit || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No change audit entries found.</p>
                  ) : (
                    memberDetails?.companyAudit.map((event) => (
                      <div key={event.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium capitalize">
                            {event.action} on {event.table_name}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Company: {event.company_id}
                          {event.field_name ? ` • Field: ${event.field_name}` : ''}
                        </p>
                        {event.reason && (
                          <p className="text-xs text-muted-foreground mt-1">Reason: {event.reason}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
