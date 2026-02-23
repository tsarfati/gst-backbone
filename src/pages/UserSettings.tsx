import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserCheck, UserPlus, Shield, ChevronDown, ChevronRight, Mail, MailCheck, MailOpen, MailX, Clock, RefreshCw, Loader2, X, Briefcase, HardHat } from 'lucide-react';
import UserJobAccess from "@/components/UserJobAccess";
import { UserPinSettings } from "@/components/UserPinSettings";
import CompanyAccessRequests from "@/components/CompanyAccessRequests";
import { useNavigate } from 'react-router-dom';
import UserRoleManagement from "@/components/UserRoleManagement";
import RolePermissionsManager from "@/components/RolePermissionsManager";
import { useActiveCompanyRole } from "@/hooks/useActiveCompanyRole";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import AddSystemUserDialog from "@/components/AddSystemUserDialog";
import { useTenant } from "@/contexts/TenantContext";
 import { useSettings } from "@/contexts/SettingsContext";
import { resolveCompanyLogoUrl } from "@/utils/resolveCompanyLogoUrl";

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url?: string | null;
  role: 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only' | 'company_admin' | 'vendor';
  created_at: string;
  pin_code?: string;
  jobs?: { id: string; name: string; }[];
  has_global_job_access?: boolean;
  has_pin?: boolean;
  status?: string;
  last_sign_in_at?: string;
  phone?: string;
  punch_clock_access?: boolean;
  pm_lynk_access?: boolean;
}

 interface Invitation {
   id: string;
   email: string;
   first_name: string | null;
   last_name: string | null;
   role: string;
   invited_at: string;
   expires_at: string;
   status: string;
   email_status: string | null;
   email_delivered_at: string | null;
   email_opened_at: string | null;
   email_bounced_at: string | null;
 }
 
 
const roleColors = {
  admin: 'destructive',
  controller: 'secondary',
  project_manager: 'default',
  employee: 'outline',
  view_only: 'outline',
  company_admin: 'destructive',
  vendor: 'secondary'
} as const;

const roleLabels = {
  admin: 'Administrator',
  controller: 'Controller',
  project_manager: 'Project Manager',
  employee: 'Employee',
  view_only: 'View Only',
  company_admin: 'Company Admin',
  vendor: 'Vendor'
};

interface RoleGroupDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

const roleGroupDefs: RoleGroupDef[] = [
  { key: 'admins', label: 'Administrators', icon: <Shield className="h-5 w-5" />, roles: ['admin', 'company_admin', 'owner'] },
  { key: 'controllers', label: 'Controllers', icon: <Briefcase className="h-5 w-5" />, roles: ['controller'] },
  { key: 'project_managers', label: 'Project Managers', icon: <HardHat className="h-5 w-5" />, roles: ['project_manager'] },
  { key: 'employees', label: 'Employees', icon: <Users className="h-5 w-5" />, roles: ['employee'] },
  { key: 'view_only', label: 'View Only', icon: <UserCheck className="h-5 w-5" />, roles: ['view_only'] },
  { key: 'vendors', label: 'Vendors', icon: <UserCheck className="h-5 w-5" />, roles: ['vendor'] },
];

export default function UserSettings() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [selectedUserForJobAccess, setSelectedUserForJobAccess] = useState<string | null>(null);
  const { profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const activeCompanyRole = useActiveCompanyRole();
  const { isSuperAdmin } = useTenant();
   const { settings } = useSettings();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
   const [invitations, setInvitations] = useState<Invitation[]>([]);
   const [pinEmployees, setPinEmployees] = useState<any[]>([]);
   const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Use company-specific role, fallback to profile role
  const effectiveRole = activeCompanyRole || profile?.role;
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'company_admin' || effectiveRole === 'owner' || isSuperAdmin;
  const isController = effectiveRole === 'controller';
  const canManageUsers = isAdmin || isController;

  useEffect(() => {
    if (currentCompany) {
      fetchUsers();
       fetchInvitations();
       // fetchPinEmployees removed - PIN employees are now regular users
    }
  }, [currentCompany]);

   const fetchInvitations = async () => {
     if (!currentCompany) return;
 
     try {
       const { data, error } = await supabase
         .from('user_invitations')
         .select('*')
         .eq('company_id', currentCompany.id)
         .eq('status', 'pending')
         .order('invited_at', { ascending: false });
 
       if (error) throw error;
       setInvitations(data || []);
     } catch (error) {
       console.error('Error fetching invitations:', error);
     }
   };
 
   // fetchPinEmployees removed - PIN employees are now regular profile-based users
 
   const resendInvitation = async (invitation: Invitation) => {
     if (!currentCompany || !profile) return;
 
     setResendingId(invitation.id);
 
     try {
        const companyLogoRaw = settings.customLogo || settings.headerLogo || currentCompany.logo_url;
        const companyLogo = resolveCompanyLogoUrl(companyLogoRaw);
       const primaryColor = settings.customColors?.primary;
 
       const { error } = await supabase.functions.invoke('send-user-invite', {
         body: {
           email: invitation.email,
           firstName: invitation.first_name,
           lastName: invitation.last_name,
           role: invitation.role,
           companyId: currentCompany.id,
           companyName: currentCompany.display_name || currentCompany.name,
           companyLogo,
           primaryColor,
           invitedBy: profile.user_id,
           resendInvitationId: invitation.id,
         },
       });
 
       if (error) throw error;
 
       toast({
         title: 'Invitation Resent',
         description: `A new invitation email has been sent to ${invitation.email}`,
       });
 
       fetchInvitations();
     } catch (error: any) {
       console.error('Error resending invitation:', error);
       toast({
         title: 'Error',
         description: error.message || 'Failed to resend invitation',
         variant: 'destructive',
       });
     } finally {
       setResendingId(null);
     }
   };

    const cancelInvitation = async (invitation: Invitation) => {
      if (!currentCompany || !profile) return;

      const confirmed = window.confirm(`Cancel the invitation for ${invitation.email}?`);
      if (!confirmed) return;

      setCancellingId(invitation.id);

      try {
        const { error } = await supabase.functions.invoke('cancel-user-invite', {
          body: {
            invitationId: invitation.id,
            companyId: currentCompany.id,
          },
        });

        if (error) throw error;

        toast({
          title: 'Invitation Cancelled',
          description: `The invitation for ${invitation.email} has been cancelled.`,
        });

        fetchInvitations();
      } catch (error: any) {
        console.error('Error cancelling invitation:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to cancel invitation',
          variant: 'destructive',
        });
      } finally {
        setCancellingId(null);
      }
    };
 
   const getEmailStatusBadge = (invitation: Invitation) => {
     const isExpired = new Date(invitation.expires_at) < new Date();
 
     if (isExpired) {
       return (
         <Badge variant="destructive" className="flex items-center gap-1">
           <Clock className="h-3 w-3" />
           Expired
         </Badge>
       );
     }
 
     if (invitation.email_bounced_at) {
       return (
         <Badge variant="destructive" className="flex items-center gap-1">
           <MailX className="h-3 w-3" />
           Bounced
         </Badge>
       );
     }
 
     if (invitation.email_opened_at) {
       return (
          <Badge variant="secondary" className="flex items-center gap-1">
           <MailOpen className="h-3 w-3" />
           Opened
         </Badge>
       );
     }
 
     if (invitation.email_delivered_at) {
       return (
         <Badge variant="secondary" className="flex items-center gap-1">
           <MailCheck className="h-3 w-3" />
           Delivered
         </Badge>
       );
     }
 
     return (
       <Badge variant="outline" className="flex items-center gap-1">
         <Mail className="h-3 w-3" />
         Sent
       </Badge>
     );
   };
 
  const fetchUsers = async () => {
    if (!currentCompany) {
      setLoading(false);
      return;
    }

    try {
      // Get users that have access to the current company WITH their roles
      const { data: companyUsers, error: companyError } = await supabase
        .from('user_company_access')
        .select('user_id, role')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (companyError) throw companyError;

      const userIds = companyUsers?.map(u => u.user_id) || [];
      const roleMap = new Map(companyUsers?.map(u => [u.user_id, u.role]) || []);

      // Fetch regular users
      const { data: regularUsers, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, display_name, avatar_url, created_at, pin_code, has_global_job_access, status, phone, punch_clock_access, pm_lynk_access')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch jobs for regular users and determine PIN status
      // Also fetch latest punch selfie as avatar fallback for users without avatars
      const usersWithJobs = await Promise.all((regularUsers || []).map(async (user) => {
        const userRole = roleMap.get(user.user_id) || 'employee';
        const hasPin = !!user.pin_code;

        // If no avatar, fetch latest punch selfie as fallback
        let effectiveAvatarUrl = user.avatar_url;
        if (!effectiveAvatarUrl) {
          const { data: latestPunch } = await supabase
            .from('time_cards')
            .select('punch_in_photo_url, punch_out_photo_url')
            .eq('user_id', user.user_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestPunch) {
            effectiveAvatarUrl = latestPunch.punch_out_photo_url || latestPunch.punch_in_photo_url || null;
          }
        }
        
        if (user.has_global_job_access) {
          return { ...user, avatar_url: effectiveAvatarUrl, role: userRole, jobs: [], has_pin: hasPin };
        }
        
        const { data: userJobs } = await supabase
          .from('user_job_access')
          .select('job_id, jobs(id, name)')
          .eq('user_id', user.user_id);
        
        const jobs = userJobs?.map((item: any) => item.jobs).filter(Boolean) || [];
        return { ...user, avatar_url: effectiveAvatarUrl, role: userRole, jobs, has_pin: hasPin };
      }));

      // Sort by name
      usersWithJobs.sort((a, b) => {
        const nameA = a.display_name || `${a.first_name} ${a.last_name}`;
        const nameB = b.display_name || `${b.first_name} ${b.last_name}`;
        return nameA.localeCompare(nameB);
      });
      
      setUsers(usersWithJobs);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only' | 'company_admin' | 'vendor') => {
    try {
      // Update the role in user_company_access for this specific company
      const { error } = await supabase
        .from('user_company_access')
        .update({ role: newRole })
        .eq('user_id', userId)
        .eq('company_id', currentCompany.id);

      if (error) throw error;

      await fetchUsers();
      setEditingUser(null);
      toast({
        title: 'Success',
        description: 'User role updated successfully',
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user role',
        variant: 'destructive',
      });
    }
  };

  const startEdit = (user: UserProfile) => {
    setEditingUser(user.user_id);
    setEditRole(user.role);
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditRole('');
  };

  if (!canManageUsers) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access user settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">
            Manage user roles and permissions for {currentCompany?.display_name || currentCompany?.name || 'your company'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAddUserDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add System User
          </Button>
        )}
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger 
            value="users" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
          >
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger 
            value="user-roles" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
          >
            <Shield className="h-4 w-4 mr-2" />
            User Roles
          </TabsTrigger>
          <TabsTrigger
            value="access-requests" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Access Requests
          </TabsTrigger>
          <TabsTrigger 
            value="roles" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Role Definitions
          </TabsTrigger>
          <TabsTrigger 
            value="job-access" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
          >
            Job Access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-8">Loading users...</div>
            ) : (
              <>
                {/* Pending Invitations */}
                {invitations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Pending Invitations ({invitations.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {invitations.map((invitation) => (
                          <div
                            key={invitation.id}
                            className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border"
                          >
                            <div className="flex-1">
                              <h3 className="font-semibold">
                                {invitation.first_name && invitation.last_name
                                  ? `${invitation.first_name} ${invitation.last_name}`
                                  : invitation.email}
                              </h3>
                              <p className="text-sm text-muted-foreground">{invitation.email}</p>
                              <p className="text-sm text-muted-foreground">
                                Invited: {new Date(invitation.invited_at).toLocaleDateString()}
                                {' • '}
                                Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="secondary">Pending Invitation</Badge>
                                <Badge variant={roleColors[invitation.role as keyof typeof roleColors] || 'outline'}>
                                  {roleLabels[invitation.role as keyof typeof roleLabels] || invitation.role}
                                </Badge>
                                {getEmailStatusBadge(invitation)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); resendInvitation(invitation); }} disabled={resendingId === invitation.id}>
                                {resendingId === invitation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-2" />Resend</>}
                              </Button>
                              <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); cancelInvitation(invitation); }} disabled={cancellingId === invitation.id}>
                                {cancellingId === invitation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-2" />Cancel</>}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Role-based collapsible groups */}
                {roleGroupDefs.map(group => {
                  const groupUsers = users.filter(u => group.roles.includes(u.role));
                  if (groupUsers.length === 0) return null;

                  const isOpen = openGroups[group.key] ?? false;

                  return (
                    <Collapsible key={group.key} open={isOpen} onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, [group.key]: open }))}>
                      <Card>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer py-4">
                            <div className="flex items-center justify-between w-full">
                              <CardTitle className="flex items-center gap-2 text-lg">
                                {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                {group.icon}
                                {group.label}
                                <Badge variant="secondary">{groupUsers.length}</Badge>
                              </CardTitle>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0">
                            <div className="space-y-3">
                              {groupUsers.map((user) => (
                                <div
                                  key={user.id}
                                  onClick={() => navigate(`/settings/users/${user.user_id}`)}
                                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-background to-muted/20 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20"
                                >
                                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                                    {user.avatar_url ? (
                                      <img
                                        src={user.avatar_url}
                                        alt={user.display_name || user.first_name || ''}
                                        className="h-full w-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                        }}
                                      />
                                    ) : null}
                                    <span className={`text-sm font-semibold text-primary ${user.avatar_url ? 'hidden' : ''}`}>
                                      {user.first_name?.[0]?.toUpperCase() || user.display_name?.[0]?.toUpperCase() || 'U'}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="font-semibold">
                                        {user.display_name || `${user.first_name} ${user.last_name}`}
                                      </h3>
                                      <Badge variant={user.status === 'approved' ? 'success' : user.status === 'pending' ? 'warning' : user.status === 'rejected' ? 'destructive' : 'outline'}>
                                        {user.status || 'pending'}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                                      {user.phone && <span>{user.phone}</span>}
                                      <span>Created: {new Date(user.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      <Badge variant={roleColors[user.role as keyof typeof roleColors]}>
                                        {roleLabels[user.role as keyof typeof roleLabels]}
                                      </Badge>
                                      {user.has_pin ? (
                                        <Badge variant="outline" className="text-xs">PIN: {user.pin_code}</Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs text-muted-foreground">No PIN</Badge>
                                      )}
                                      {user.punch_clock_access && <Badge variant="outline" className="text-xs">Punch Clock</Badge>}
                                      {user.pm_lynk_access && <Badge variant="outline" className="text-xs">PM Lynk</Badge>}
                                      {user.has_global_job_access && (
                                        <Badge variant="outline">All Jobs Access</Badge>
                                      )}
                                      {!user.has_global_job_access && user.jobs && user.jobs.length > 0 && (
                                        <Badge variant="secondary">{user.jobs.length} Job{user.jobs.length !== 1 ? 's' : ''}</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="user-roles">
          <UserRoleManagement />
        </TabsContent>

        <TabsContent value="access-requests">
          <CompanyAccessRequests />
        </TabsContent>

        <TabsContent value="roles">
          <RolePermissionsManager />
        </TabsContent>


        <TabsContent value="job-access">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Select User</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedUserForJobAccess || ''}
                  onValueChange={setSelectedUserForJobAccess}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user to manage job access" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.display_name || `${user.first_name} ${user.last_name}`} - {roleLabels[user.role as keyof typeof roleLabels]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
            
            {selectedUserForJobAccess && (
              <UserJobAccess 
                userId={selectedUserForJobAccess}
                userRole={users.find(u => u.user_id === selectedUserForJobAccess)?.role || 'employee'}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AddSystemUserDialog
        open={showAddUserDialog}
        onOpenChange={setShowAddUserDialog}
        onUserAdded={() => {
          fetchUsers();
          fetchInvitations();
        }}
      />

      {/* PIN Settings Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Set Employee PIN</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditingUser(null)}>
                ×
              </Button>
            </div>
            {(() => {
              const user = users.find(u => u.user_id === editingUser);
              return user ? (
                <UserPinSettings
                  userId={user.user_id}
                  currentPin={user.pin_code}
                  userName={user.display_name || `${user.first_name} ${user.last_name}`}
                />
              ) : null;
            })()}
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
