import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, User, Mail, UserPlus, ChevronDown, ChevronRight, Shield, Briefcase, HardHat, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useActiveCompanyRole } from "@/hooks/useActiveCompanyRole";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import AddSystemUserDialog from "@/components/AddSystemUserDialog";

const UserAvatar = ({ avatarUrl, name }: { avatarUrl?: string | null; name: string }) => {
  const [imgError, setImgError] = useState(false);
  const initial = name?.[0]?.toUpperCase() || 'U';

  if (!avatarUrl || imgError) {
    return (
      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-sm font-semibold text-primary">{initial}</span>
      </div>
    );
  }

  return (
    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
      <img
        src={avatarUrl}
        alt={name}
        className="h-full w-full object-cover"
        referrerPolicy="no-referrer"
        onError={() => {
          console.warn('[UserAvatar] img failed:', avatarUrl);
          setImgError(true);
        }}
      />
    </div>
  );
};

interface UserProfile {
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  vendor_id?: string | null;
  role: string;
  status: string;
  has_global_job_access: boolean;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  avatar_url?: string;
  pin_code?: string;
  punch_clock_access?: boolean;
  pm_lynk_access?: boolean;
  custom_role_id?: string | null;
}

interface CustomRole {
  id: string;
  role_name: string;
  role_key: string;
  color?: string | null;
}

interface PendingSignupMeta {
  requestId: string;
  requestType: string;
  requestedRole: 'employee' | 'vendor' | 'design_professional';
  businessName: string | null;
  customRoleId: string | null;
  customRoleName: string | null;
}

const isProjectDesignProfessionalInvite = (notes?: string | null): boolean => {
  if (!notes) return false;
  try {
    const parsed = JSON.parse(notes);
    return String(parsed?.requestedRole || '').toLowerCase() === 'design_professional'
      && Boolean(String(parsed?.invitedJobId || '').trim());
  } catch {
    return false;
  }
};

interface VendorCompanyOption {
  id: string;
  name: string;
}

interface RoleGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  badgeClass: string;
  roles: string[];
}

const roleGroups: RoleGroup[] = [
  { key: 'admins', label: 'Administrators', icon: <Shield className="h-5 w-5" />, badgeClass: 'bg-red-500 text-white', roles: ['admin', 'company_admin', 'owner'] },
  { key: 'controllers', label: 'Controllers', icon: <Briefcase className="h-5 w-5" />, badgeClass: 'bg-blue-500 text-white', roles: ['controller'] },
  { key: 'project_managers', label: 'Project Managers', icon: <HardHat className="h-5 w-5" />, badgeClass: 'bg-green-500 text-white', roles: ['project_manager'] },
  { key: 'design_professionals', label: 'Design Professionals', icon: <HardHat className="h-5 w-5" />, badgeClass: 'bg-cyan-500 text-white', roles: ['design_professional'] },
  { key: 'employees', label: 'Employees', icon: <Users className="h-5 w-5" />, badgeClass: 'bg-gray-500 text-white', roles: ['employee'] },
  { key: 'view_only', label: 'View Only', icon: <User className="h-5 w-5" />, badgeClass: 'bg-gray-400 text-white', roles: ['view_only'] },
  { key: 'vendors', label: 'Vendors', icon: <User className="h-5 w-5" />, badgeClass: 'bg-purple-500 text-white', roles: ['vendor'] },
];

export default function UserManagement() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ admins: true, controllers: true, project_managers: true, employees: true });
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [pendingSignupByUserId, setPendingSignupByUserId] = useState<Record<string, PendingSignupMeta>>({});
  const [availableVendors, setAvailableVendors] = useState<VendorCompanyOption[]>([]);
  const [approveVendorDialog, setApproveVendorDialog] = useState<{
    userId: string;
    userName: string;
    requestedRole: 'vendor' | 'design_professional';
    requestId: string;
    businessName: string | null;
  } | null>(null);
  const [vendorApprovalMode, setVendorApprovalMode] = useState<'link' | 'create'>('create');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const lastRefreshAtRef = useRef(0);

  const activeCompanyRole = useActiveCompanyRole();
  const isAdmin = activeCompanyRole === 'admin' || activeCompanyRole === 'company_admin' || activeCompanyRole === 'owner';

  const fetchCustomRoles = useCallback(async () => {
    if (!currentCompany) return;
    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('id, role_name, role_key, color')
        .eq('company_id', currentCompany.id)
        .or('is_active.eq.true,is_active.is.null')
        .order('role_name');
      if (error) throw error;
      setCustomRoles((data as CustomRole[]) || []);
    } catch (error) {
      console.error('Error fetching custom roles:', error);
      setCustomRoles([]);
    }
  }, [currentCompany]);

  const fetchVendors = useCallback(async () => {
    if (!currentCompany) return;
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .order('name', { ascending: true });
      if (error) throw error;
      setAvailableVendors((data as VendorCompanyOption[]) || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setAvailableVendors([]);
    }
  }, [currentCompany]);

  const fetchUsers = useCallback(async () => {
    if (!currentCompany) {
      setLoading(false);
      return;
    }

    try {
      const { data: userAccessData, error: accessError } = await supabase
        .from('user_company_access')
        .select('user_id, role, is_active, granted_at')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (accessError) throw accessError;

      let allUsers: UserProfile[] = [];
      const userIds = (userAccessData || []).map(access => access.user_id);

      const [profilesResult, pendingRequestsResult] = await Promise.all([
        userIds.length > 0
          ? supabase
              .from('profiles')
              .select('*')
              .in('user_id', userIds)
              .order('last_name', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('company_access_requests')
          .select('id, user_id, notes, status')
          .eq('company_id', currentCompany.id)
          .eq('status', 'pending'),
      ]);

      if (profilesResult.error) throw profilesResult.error;

      const accessByUserId = new Map(
        (userAccessData || []).map((access) => [String(access.user_id), access]),
      );

      allUsers = ((profilesResult.data || []) as any[]).map((profile) => {
        const access = accessByUserId.get(String(profile.user_id));
        return {
          ...profile,
          role: access?.role || profile.role,
        };
      });

      setUsers(allUsers);

      const pendingRequests = (pendingRequestsResult.data || [])
        .filter((request: any) => !isProjectDesignProfessionalInvite(request.notes || null));

      const pendingMap: Record<string, PendingSignupMeta> = {};
      (pendingRequests || []).forEach((request: any) => {
        try {
          const parsed = request?.notes ? JSON.parse(request.notes) : {};
          const requestedRole = String(parsed?.requestedRole || '').toLowerCase();
          const customRoleId = String(parsed?.customRoleId || '').trim() || null;
          const customRoleName = String(parsed?.customRoleName || '').trim() || null;
          pendingMap[request.user_id] = {
            requestId: request.id,
            requestType: String(parsed?.requestType || ''),
            requestedRole:
              requestedRole === 'vendor' || requestedRole === 'design_professional'
                ? requestedRole
                : 'employee',
            businessName: parsed?.businessName ? String(parsed.businessName) : null,
            customRoleId,
            customRoleName,
          };
        } catch {
          pendingMap[request.user_id] = {
            requestId: request.id,
            requestType: '',
            requestedRole: 'employee',
            businessName: null,
            customRoleId: null,
            customRoleName: null,
          };
        }
      });
      setPendingSignupByUserId(pendingMap);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentCompany, toast]);

  useEffect(() => {
    if (!currentCompany) return;

    setLoading(true);
    void Promise.all([
      fetchUsers(),
      fetchCustomRoles(),
      fetchVendors(),
    ]);
  }, [currentCompany, location.key, fetchUsers, fetchCustomRoles, fetchVendors]);

  useEffect(() => {
    if (!currentCompany) return;

    const refreshData = () => {
      const now = Date.now();
      if (document.visibilityState !== 'visible') return;
      if (now - lastRefreshAtRef.current < 15_000) return;
      lastRefreshAtRef.current = now;
      void Promise.all([
        fetchUsers(),
        fetchCustomRoles(),
        fetchVendors(),
      ]);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    };

    window.addEventListener('focus', refreshData);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', refreshData);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentCompany, fetchUsers, fetchCustomRoles, fetchVendors]);

  const approveUser = async (
    userId: string,
    resolution?: { mode: 'link' | 'create'; vendorId?: string; vendorName?: string }
  ) => {
    if (!user) return;
    if (!currentCompany) return;
    try {
      const targetUser = users.find((u) => u.user_id === userId);
      const pendingMeta = pendingSignupByUserId[userId];
      const requestedRole = pendingMeta?.requestedRole || (targetUser?.role as any) || 'employee';
      const needsVendorResolution =
        pendingMeta?.requestType === 'vendor_self_signup' &&
        (requestedRole === 'vendor' || requestedRole === 'design_professional');

      if (needsVendorResolution && !resolution) {
        setApproveVendorDialog({
          userId,
          userName:
            targetUser?.display_name ||
            `${targetUser?.first_name || ''} ${targetUser?.last_name || ''}`.trim() ||
            'User',
          requestedRole,
          requestId: pendingMeta.requestId,
          businessName: pendingMeta.businessName || null,
        });
        setVendorApprovalMode('create');
        setSelectedVendorId('');
        setNewVendorName(
          pendingMeta.businessName ||
            targetUser?.display_name ||
            `${targetUser?.first_name || ''} ${targetUser?.last_name || ''}`.trim() ||
            ''
        );
        return;
      }

      let resolvedVendorId: string | null = targetUser?.vendor_id || null;
      if (needsVendorResolution) {
        if (resolution?.mode === 'link') {
          if (!resolution.vendorId) {
            toast({ title: "Vendor required", description: "Select an existing vendor company.", variant: "destructive" });
            return;
          }
          resolvedVendorId = resolution.vendorId;
        } else {
          const vendorName = (resolution?.vendorName || '').trim();
          if (!vendorName) {
            toast({ title: "Vendor name required", description: "Enter a vendor company name.", variant: "destructive" });
            return;
          }
          const { data: createdVendor, error: createVendorError } = await supabase
            .from('vendors')
            .insert({
              company_id: currentCompany.id,
              name: vendorName,
              email: targetUser?.email || null,
              phone: targetUser?.phone || null,
              contact_person: `${targetUser?.first_name || ''} ${targetUser?.last_name || ''}`.trim() || null,
              vendor_type: requestedRole,
            } as any)
            .select('id')
            .single();
          if (createVendorError) throw createVendorError;
          resolvedVendorId = createdVendor?.id || null;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          role: requestedRole as any,
          custom_role_id: pendingMeta?.customRoleId || targetUser?.custom_role_id || null,
          vendor_id: resolvedVendorId,
        })
        .eq('user_id', userId);
      if (error) throw error;

      const { error: accessUpdateError } = await supabase
        .from('user_company_access')
        .update({
          role: requestedRole as any,
          is_active: true,
          granted_by: user.id,
        })
        .eq('user_id', userId)
        .eq('company_id', currentCompany.id);
      if (accessUpdateError) {
        console.warn('Unable to update user_company_access during approval:', accessUpdateError);
      }

      if (pendingMeta?.requestId) {
        const { error: requestUpdateError } = await supabase
          .from('company_access_requests')
          .update({
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', pendingMeta.requestId);
        if (requestUpdateError) {
          console.warn('Failed updating company_access_requests approval:', requestUpdateError);
        }
      }

      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('type', `intake_queue:${userId}`);

      const { error: notifyError } = await supabase.functions.invoke('notify-user-approved', {
        body: {
          userId,
          companyId: currentCompany.id,
        },
      });
      if (notifyError) {
        console.warn('User approval email notification failed:', notifyError);
      }

      toast({ title: "User Approved", description: "User has been approved successfully" });
      setApproveVendorDialog(null);
      fetchUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      toast({ title: "Error", description: "Failed to approve user", variant: "destructive" });
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'rejected' })
        .eq('user_id', userId);
      if (error) throw error;

      const pendingMeta = pendingSignupByUserId[userId];
      if (pendingMeta?.requestId) {
        await supabase
          .from('company_access_requests')
          .update({
            status: 'rejected',
            reviewed_by: user?.id || null,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', pendingMeta.requestId);
      }

      if (user?.id) {
        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', user.id)
          .eq('type', `intake_queue:${userId}`);
      }

      toast({ title: "User Rejected", description: "User has been rejected", variant: "destructive" });
      fetchUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({ title: "Error", description: "Failed to reject user", variant: "destructive" });
    }
  };

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getUsersForGroup = (group: RoleGroup) => {
    return users.filter(u => u.status !== 'pending' && !u.custom_role_id && group.roles.includes(u.role));
  };

  const getUsersForCustomRole = (customRoleId: string) => {
    return users.filter((u) => u.status !== 'pending' && u.custom_role_id === customRoleId);
  };

  const pendingUsers = users.filter(u => u.status === 'pending');

  const renderUserCard = (u: UserProfile) => (
    (() => {
      const customRole = u.custom_role_id ? customRoles.find((r) => r.id === u.custom_role_id) : null;
      const roleLabel = customRole ? customRole.role_name : u.role;
      return (
    <div
      key={u.user_id}
      onClick={() => navigate(`/settings/users/${u.user_id}`, { state: { fromCompanyManagement: false } })}
      className="flex items-center gap-4 p-4 bg-gradient-to-r from-background to-muted/20 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20"
    >
      <UserAvatar avatarUrl={u.avatar_url} name={u.first_name || u.display_name || 'U'} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold">{u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unnamed User'}</h3>
          <Badge variant={customRole ? 'secondary' : 'outline'}>
            {customRole ? `${customRole.role_name} (Custom)` : roleLabel}
          </Badge>
          <Badge variant={u.status === 'approved' ? 'default' : u.status === 'pending' ? 'secondary' : 'destructive'}>
            {u.status || 'pending'}
          </Badge>
          {u.pin_code && <Badge variant="outline">PIN Set</Badge>}
          {u.punch_clock_access && <Badge variant="outline" className="text-xs">Punch Clock</Badge>}
          {u.pm_lynk_access && <Badge variant="outline" className="text-xs">PM Lynk</Badge>}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
          <span>{u.first_name} {u.last_name}</span>
          <span>Created: {new Date(u.created_at).toLocaleDateString()}</span>
          {u.has_global_job_access && <span className="text-green-600">Global Access</span>}
        </div>
      </div>
    </div>
      );
    })()
  );

  if (loading) {
    return <div className="p-6 text-center"><span className="loading-dots">Loading users</span></div>;
  }

  if (!currentCompany) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Please select a company to view its users.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage users for {currentCompany.display_name || currentCompany.name}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAddUserDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add System User
          </Button>
        )}
      </div>

      {/* Pending Approvals */}
      {pendingUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Pending Approvals ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingUsers.map((u) => (
                <div key={u.user_id} className="flex items-center justify-between p-4 bg-gradient-to-r from-background to-muted/20 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {u.first_name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim()}</h3>
                      <span className="text-sm text-muted-foreground">Created: {new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approveUser(u.user_id)}>
                      <CheckCircle className="h-4 w-4 mr-2" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectUser(u.user_id)}>
                      <XCircle className="h-4 w-4 mr-2" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role-based collapsible groups */}
      {customRoles.map((customRole) => {
        const groupUsers = getUsersForCustomRole(customRole.id);
        if (groupUsers.length === 0) return null;

        const groupKey = `custom_${customRole.id}`;
        const isOpen = openGroups[groupKey] ?? true;

        return (
          <Collapsible key={groupKey} open={isOpen} onOpenChange={() => toggleGroup(groupKey)}>
            <Card>
              <CardHeader className="cursor-pointer py-4" onClick={() => toggleGroup(groupKey)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between w-full">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      <Shield className="h-5 w-5" />
                      {customRole.role_name}
                      <Badge variant="secondary">{groupUsers.length}</Badge>
                      <Badge variant="outline" className="text-xs">Custom Role</Badge>
                    </CardTitle>
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid gap-3">
                    {groupUsers.map(renderUserCard)}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {roleGroups.map(group => {
        const groupUsers = getUsersForGroup(group);
        if (groupUsers.length === 0) return null;

        const isOpen = openGroups[group.key] ?? false;

        return (
          <Collapsible key={group.key} open={isOpen} onOpenChange={() => toggleGroup(group.key)}>
            <Card>
              <CardHeader className="cursor-pointer py-4" onClick={() => toggleGroup(group.key)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between w-full">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      {group.icon}
                      {group.label}
                      <Badge className={group.badgeClass}>{groupUsers.length}</Badge>
                    </CardTitle>
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid gap-3">
                    {groupUsers.map(renderUserCard)}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      <AddSystemUserDialog
        open={showAddUserDialog}
        onOpenChange={setShowAddUserDialog}
        onUserAdded={fetchUsers}
      />

      <Dialog open={!!approveVendorDialog} onOpenChange={(open) => !open && setApproveVendorDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Vendor Approval</DialogTitle>
            <DialogDescription>
              This vendor signup requires vendor company mapping before approval.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Approval Mode</Label>
              <Select value={vendorApprovalMode} onValueChange={(value: 'link' | 'create') => setVendorApprovalMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">Create New Vendor Company</SelectItem>
                  <SelectItem value="link">Link to Existing Vendor Company</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {vendorApprovalMode === 'create' ? (
              <div className="space-y-2">
                <Label>New Vendor Company Name</Label>
                <Input
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="Vendor company name"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Existing Vendor Company</Label>
                <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor company" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveVendorDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!approveVendorDialog) return;
                void approveUser(approveVendorDialog.userId, {
                  mode: vendorApprovalMode,
                  vendorId: selectedVendorId,
                  vendorName: newVendorName,
                });
              }}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
