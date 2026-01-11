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
import { useTenant } from '@/contexts/TenantContext';
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
  User
} from 'lucide-react';

type SubscriptionTier = 'free' | 'starter' | 'professional' | 'enterprise';
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

interface TenantCompany {
  id: string;
  name: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  city: string | null;
  state: string | null;
}

const SUBSCRIPTION_TIERS = [
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
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [companies, setCompanies] = useState<TenantCompany[]>([]);
  
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
      setTenant(tenantData);
      setFormData({
        name: tenantData.name,
        subscription_tier: tenantData.subscription_tier,
        max_companies: tenantData.max_companies,
        is_active: tenantData.is_active,
      });

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
          .select('user_id, first_name, last_name, display_name')
          .in('user_id', userIds);

        const enrichedMembers = membersData?.map(m => {
          const profile = profiles?.find(p => p.user_id === m.user_id);
          return {
            ...m,
            user_name: profile?.display_name || 
              [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 
              'Unknown User'
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
      const { error } = await supabase
        .from('tenants')
        .update({
          name: formData.name,
          subscription_tier: formData.subscription_tier,
          max_companies: formData.max_companies,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);

      if (error) throw error;

      toast({
        title: 'Saved',
        description: 'Organization settings updated successfully.',
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

  const getRoleIcon = (role: string) => {
    const roleConfig = MEMBER_ROLES.find(r => r.value === role);
    const Icon = roleConfig?.icon || User;
    return <Icon className="h-4 w-4" />;
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

  const tierInfo = SUBSCRIPTION_TIERS.find(t => t.value === formData.subscription_tier);
  const companyLimit = formData.max_companies ?? tierInfo?.maxCompanies ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/super-admin')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{tenant.name}</h1>
              <p className="text-muted-foreground text-sm">Organization Details</p>
            </div>
            <Badge variant={tenant.is_active ? 'default' : 'destructive'}>
              {tenant.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant={getTierBadgeVariant(tenant.subscription_tier)} className="capitalize">
              {tenant.subscription_tier}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
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
              <div className="text-2xl font-bold capitalize">{tenant.subscription_tier}</div>
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
                <CardTitle>Organization Settings</CardTitle>
                <CardDescription>
                  Manage organization name, subscription tier, and limits.
                </CardDescription>
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
                        const tier = SUBSCRIPTION_TIERS.find(t => t.value === value);
                        setFormData({ 
                          ...formData, 
                          subscription_tier: value as SubscriptionTier,
                          max_companies: tier?.maxCompanies ?? null
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBSCRIPTION_TIERS.map((tier) => (
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
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {getRoleIcon(member.role)}
                              {member.user_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={member.role}
                              onValueChange={(value) => handleUpdateMemberRole(member.id, value as MemberRole)}
                              disabled={member.role === 'owner'}
                            >
                              <SelectTrigger className="w-32">
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
                              onClick={() => handleRemoveMember(member.id, member.role)}
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
    </div>
  );
}
