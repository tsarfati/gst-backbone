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
import { resolveStorageUrl } from '@/utils/storageUtils';
import { Users, UserCheck, UserPlus, Shield, ChevronDown, ChevronRight, Mail, MailCheck, MailOpen, MailX, Clock, RefreshCw, Loader2, X, Briefcase, HardHat, Store } from 'lucide-react';
import { UserPinSettings } from "@/components/UserPinSettings";
import CompanyAccessRequests from "@/components/CompanyAccessRequests";
import { useNavigate } from 'react-router-dom';
import UserRoleManagement from "@/components/UserRoleManagement";
import RolePermissionsManager from "@/components/RolePermissionsManager";
import EmployeeGroupManager from "@/components/EmployeeGroupManager";
import { useActiveCompanyRole } from "@/hooks/useActiveCompanyRole";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
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
  company_name?: string | null;
  company_logo_url?: string | null;
  vendor_id?: string | null;
  current_company_id?: string | null;
  role: 'admin' | 'controller' | 'project_manager' | 'design_professional' | 'employee' | 'view_only' | 'company_admin' | 'vendor';
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
  custom_role_id?: string | null;
  external_access_state?: 'active' | 'pending';
  external_pending_jobs?: { id: string; name: string }[];
}

interface CustomRole {
  id: string;
  role_name: string;
  role_key: string;
  color?: string | null;
}

interface Invitation {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  custom_role_id?: string | null;
  invited_at: string;
  expires_at: string;
  status: string;
  email_status: string | null;
  email_delivered_at: string | null;
  email_opened_at: string | null;
  email_bounced_at: string | null;
  matched_user_id?: string | null;
  matched_user_name?: string | null;
  matched_user_status?: string | null;
  has_company_access?: boolean;
}
 
 
const roleColors = {
  admin: 'destructive',
  controller: 'secondary',
  project_manager: 'default',
  design_professional: 'secondary',
  employee: 'outline',
  view_only: 'outline',
  company_admin: 'destructive',
  vendor: 'secondary'
} as const;

const roleLabels = {
  admin: 'Administrator',
  controller: 'Controller',
  project_manager: 'Project Manager',
  design_professional: 'Design Professional',
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
];

const EXTERNAL_ACCESS_ROLES = ['vendor', 'design_professional'] as const;
const LEGACY_INTERNAL_FALLBACK_ROLES = ['admin', 'company_admin', 'controller', 'project_manager', 'view_only'] as const;

const parseRequestedRoleFromNotes = (notes?: string | null): string | null => {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    const requestedRole = String(parsed?.requestedRole || '').trim().toLowerCase();
    return requestedRole || null;
  } catch {
    return null;
  }
};

const parseBusinessNameFromNotes = (notes?: string | null): string | null => {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    const businessName = String(parsed?.businessName || '').trim();
    return businessName || null;
  } catch {
    return null;
  }
};

const parseEmailFromNotes = (notes?: string | null): string | null => {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    const email = String(parsed?.email || '').trim().toLowerCase();
    return email || null;
  } catch {
    return null;
  }
};

const parsePendingJobIdsFromNotes = (notes?: string | null): string[] => {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes);
    const inviteRows = Array.isArray(parsed?.pendingJobInvites) ? parsed.pendingJobInvites : [];
    return inviteRows
      .map((invite: any) => String(invite?.jobId || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const normalizeCompanyKey = (value?: string | null) => String(value || '').trim().toLowerCase();

export default function UserSettings() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const { profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const activeCompanyRole = useActiveCompanyRole();
  const { hasAccess, permissions, loading: permissionsLoading } = useMenuPermissions();
  const { isSuperAdmin } = useTenant();
   const { settings } = useSettings();
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'users';
  const initialIntakeRoleFilter = (() => {
    const role = String(urlParams.get('role') || '').trim().toLowerCase();
    if (role === 'vendor' || role === 'design_professional') return role;
    return 'all';
  })();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
   const [invitations, setInvitations] = useState<Invitation[]>([]);
   const [pinEmployees, setPinEmployees] = useState<any[]>([]);
   const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [intakeRoleFilter, setIntakeRoleFilter] = useState<'all' | 'vendor' | 'design_professional'>(initialIntakeRoleFilter);
  const [intakePendingOnly, setIntakePendingOnly] = useState(true);

  // Use company-specific role, fallback to profile role
  const effectiveRole = activeCompanyRole || profile?.role;
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'company_admin' || effectiveRole === 'owner' || isSuperAdmin;
  const isController = effectiveRole === 'controller';
  const canViewUserManagement = hasAccess('user-settings-view') || hasAccess('user-settings');
  const canManageUsers = isAdmin || isController || canViewUserManagement;

  const canAccessUserSettingsTab = (tabPermissionKey: string) => {
    if (isSuperAdmin) return true;
    if (typeof permissions[tabPermissionKey] === 'boolean') {
      return hasAccess(tabPermissionKey);
    }
    return canViewUserManagement;
  };

  const visibleTabs = [
    { value: 'users', label: 'System Users', permissionKey: 'user-settings-tab-users', icon: Users },
    { value: 'user-roles', label: 'User Roles', permissionKey: 'user-settings-tab-user-roles', icon: Shield },
    { value: 'roles', label: 'Role Definitions', permissionKey: 'user-settings-tab-roles', icon: UserCheck },
    { value: 'vendor-access', label: 'Vendor Access', permissionKey: 'user-settings-tab-vendor-access', icon: Store },
    { value: 'design-professional-access', label: 'Design Professional Access', permissionKey: 'user-settings-tab-design-professional-access', icon: HardHat },
    { value: 'intake-queue', label: 'Intake Queue', permissionKey: 'user-settings-tab-intake-queue', icon: MailOpen },
    { value: 'groups', label: 'Groups', permissionKey: 'user-settings-tab-groups', icon: Users },
  ].filter((tab) => canAccessUserSettingsTab(tab.permissionKey));

  useEffect(() => {
    if (currentCompany) {
      fetchUsers();
      fetchCustomRoles();
       fetchInvitations();
       // fetchPinEmployees removed - PIN employees are now regular users
    }
  }, [currentCompany]);

  useEffect(() => {
    if (permissionsLoading) return;
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((tab) => tab.value === activeTab)) {
      setActiveTab(visibleTabs[0].value);
    }
  }, [activeTab, permissionsLoading, visibleTabs]);

  const fetchCustomRoles = async () => {
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
  };

   const performInvitationRepair = async (invitation: Invitation, options?: { silent?: boolean }) => {
     if (!currentCompany) return false;

     const { data, error } = await supabase.functions.invoke('repair-user-invite', {
       body: {
         invitationId: invitation.id,
         companyId: currentCompany.id,
       },
     });

     if (error) throw error;

     if (!options?.silent) {
       toast({
         title: 'Invitation finalized',
         description:
           data?.message ||
           `The pending invitation for ${invitation.email} has been reconciled with the existing account.`,
       });
     }

     return true;
   };

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
       const pendingInvites = (data || []) as Invitation[];
       const invitationEmails = Array.from(
         new Set(
           pendingInvites
             .map((invite) => String(invite.email || '').trim().toLowerCase())
             .filter(Boolean),
         ),
       );

       if (invitationEmails.length === 0) {
         setInvitations(pendingInvites);
         return;
       }

       const { data: matchingProfiles, error: matchingProfilesError } = await supabase
         .from('profiles')
         .select('user_id, email, display_name, first_name, last_name, status')
         .in('email', invitationEmails);

       if (matchingProfilesError) throw matchingProfilesError;

       const matchedProfiles = (matchingProfiles || []) as Array<{
         user_id: string;
         email: string | null;
         display_name: string | null;
         first_name: string | null;
         last_name: string | null;
         status: string | null;
       }>;

       const profileByEmail = new Map(
         matchedProfiles
           .filter((entry) => entry.email)
           .map((entry) => [String(entry.email).trim().toLowerCase(), entry] as const),
       );

       const matchedUserIds = matchedProfiles.map((entry) => entry.user_id).filter(Boolean);
       let accessUserIds = new Set<string>();

       if (matchedUserIds.length > 0) {
         const { data: accessRows, error: accessError } = await supabase
           .from('user_company_access')
           .select('user_id')
           .eq('company_id', currentCompany.id)
           .in('user_id', matchedUserIds)
           .eq('is_active', true);

         if (accessError) throw accessError;
         accessUserIds = new Set((accessRows || []).map((row: any) => String(row.user_id || '')));
       }

       const hydratedInvitations = pendingInvites.map((invite) => {
           const matchedProfile = profileByEmail.get(String(invite.email || '').trim().toLowerCase());
           const matchedUserName = matchedProfile
             ? matchedProfile.display_name || `${matchedProfile.first_name || ''} ${matchedProfile.last_name || ''}`.trim() || invite.email
             : null;

           return {
             ...invite,
             matched_user_id: matchedProfile?.user_id || null,
             matched_user_name: matchedUserName,
             matched_user_status: matchedProfile?.status || null,
             has_company_access: matchedProfile?.user_id ? accessUserIds.has(String(matchedProfile.user_id)) : false,
           };
         });

       const reconciliableInvitations = hydratedInvitations.filter(
         (invite) => String(invite.email || '').trim().length > 0,
       );

       if (reconciliableInvitations.length > 0) {
         const repairResults = await Promise.allSettled(
           reconciliableInvitations.map((invite) => performInvitationRepair(invite, { silent: true })),
         );

         const repairedInvitationIds = new Set(
           repairResults
             .map((result, index) =>
               result.status === 'fulfilled' ? reconciliableInvitations[index]?.id : null,
             )
             .filter(Boolean),
         );

         const repairedCount = repairedInvitationIds.size;
         if (repairedCount > 0) {
           const remainingInvitations = hydratedInvitations.filter(
             (invite) => !repairedInvitationIds.has(invite.id),
           );
           setInvitations(remainingInvitations);
           return;
         }
       }

       setInvitations(hydratedInvitations);
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
       let errorMessage = error?.message || 'Failed to resend invitation';
       try {
         if (typeof error?.context?.json === 'function') {
           const body = await error.context.json();
           errorMessage = body?.error || body?.message || errorMessage;
         }
       } catch {
         // ignore parse errors and keep fallback message
       }
       toast({
         title: 'Error',
         description: errorMessage,
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
        let errorMessage = error?.message || 'Failed to cancel invitation';
        try {
          if (typeof error?.context?.json === 'function') {
            const body = await error.context.json();
            errorMessage = body?.error || body?.message || errorMessage;
          }
        } catch {
          // ignore parse errors and keep fallback message
        }
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setCancellingId(null);
      }
    };

   const repairInvitation = async (invitation: Invitation) => {
     if (!currentCompany) return;

     setRepairingId(invitation.id);

     try {
       await performInvitationRepair(invitation);

       await Promise.all([fetchInvitations(), fetchUsers()]);
     } catch (error: any) {
       console.error('Error repairing invitation:', error);
       let errorMessage = error?.message || 'Failed to repair invitation';
       try {
         if (typeof error?.context?.json === 'function') {
           const body = await error.context.json();
           errorMessage = body?.error || body?.message || errorMessage;
         }
       } catch {
         // ignore parse errors
       }
       toast({
         title: 'Error',
         description: errorMessage,
         variant: 'destructive',
       });
     } finally {
       setRepairingId(null);
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
 
     if (invitation.email_delivered_at || invitation.email_status === 'delivered') {
       return (
         <Badge variant="secondary" className="flex items-center gap-1">
           <MailCheck className="h-3 w-3" />
           Received
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
      setLoading(true);
      // Get users that have access to the current company WITH their roles
      const { data: companyUsers, error: companyError } = await supabase
        .from('user_company_access')
        .select('user_id, role')
        .eq('company_id', currentCompany.id)
        .or('is_active.eq.true,is_active.is.null');

      if (companyError) throw companyError;

      const roleMap = new Map(companyUsers?.map(u => [u.user_id, u.role]) || []);

      // Legacy fallback for users missing user_company_access rows: use approved
      // company access requests rather than profiles.current_company_id. The profile's
      // current company is just a workspace pointer and changes as users switch companies.
      const { data: approvedAccessRequests, error: approvedAccessRequestsError } = await supabase
        .from('company_access_requests')
        .select('user_id, status, notes')
        .eq('company_id', currentCompany.id)
        .eq('status', 'approved');

      if (approvedAccessRequestsError) throw approvedAccessRequestsError;

      const requestedUserIds = new Set<string>();
      const requestBusinessNameByUserId = new Map<string, string>();
      const requestEmailByUserId = new Map<string, string>();
      const requestPendingJobIdsByUserId = new Map<string, string[]>();
      for (const request of approvedAccessRequests || []) {
        const requestedUserId = String(request.user_id || '').trim();
        const requestedRole = String(parseRequestedRoleFromNotes(request.notes) || '').trim().toLowerCase();
        const isExternalAccessRequest = EXTERNAL_ACCESS_ROLES.includes(
          requestedRole as typeof EXTERNAL_ACCESS_ROLES[number],
        );
        const isLegacyInternalRequest = LEGACY_INTERNAL_FALLBACK_ROLES.includes(
          requestedRole as typeof LEGACY_INTERNAL_FALLBACK_ROLES[number],
        );

        if (requestedUserId && (isExternalAccessRequest || isLegacyInternalRequest)) {
          requestedUserIds.add(requestedUserId);
        }

        if (requestedUserId && requestedRole && !roleMap.has(requestedUserId)) {
          if (isExternalAccessRequest || isLegacyInternalRequest) {
            roleMap.set(requestedUserId, requestedRole as UserProfile['role']);
          }
        }

        if (!isExternalAccessRequest) {
          continue;
        }

        const requestBusinessName = parseBusinessNameFromNotes(request.notes);
        const requestEmail = parseEmailFromNotes(request.notes);
        const pendingJobIds = parsePendingJobIdsFromNotes(request.notes);
        if (requestBusinessName) {
          requestBusinessNameByUserId.set(requestedUserId, requestBusinessName);
        }
        if (requestEmail) {
          requestEmailByUserId.set(requestedUserId, requestEmail);
        }
        if (pendingJobIds.length > 0) {
          requestPendingJobIdsByUserId.set(requestedUserId, pendingJobIds);
        }
      }

      const userIds = Array.from(new Set([...Array.from(roleMap.keys()), ...Array.from(requestedUserIds)]));

      // Fetch regular users
      const { data: regularUsers, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, display_name, avatar_url, created_at, pin_code, has_global_job_access, status, phone, punch_clock_access, pm_lynk_access, custom_role_id, role, vendor_id, current_company_id')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: companyVendors, error: companyVendorsError } = await supabase
        .from('vendors')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (companyVendorsError) throw companyVendorsError;

      const companyVendorIds = Array.from(
        new Set(((companyVendors || []) as any[]).map((vendor) => String(vendor.id || '').trim()).filter(Boolean))
      );

      const existingProfileUserIds = new Set((regularUsers || []).map((user: any) => String(user.user_id || '')));
      const { data: linkedVendorProfiles, error: linkedVendorProfilesError } = companyVendorIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, user_id, first_name, last_name, display_name, avatar_url, created_at, pin_code, has_global_job_access, status, phone, punch_clock_access, pm_lynk_access, custom_role_id, role, vendor_id, current_company_id')
            .in('vendor_id', companyVendorIds)
            .order('created_at', { ascending: false })
        : { data: [], error: null };

      if (linkedVendorProfilesError) throw linkedVendorProfilesError;

      const mergedExistingProfileUserIds = new Set([
        ...existingProfileUserIds,
      ]);
      const supplementalVendorProfiles = ((linkedVendorProfiles || []) as any[]).filter(
        (user) => !mergedExistingProfileUserIds.has(String(user.user_id || ''))
      );

      supplementalVendorProfiles.forEach((user: any) => {
        const linkedUserId = String(user.user_id || '').trim();
        if (linkedUserId) {
          roleMap.set(linkedUserId, 'vendor');
        }
      });

      const mergedProfiles = [...(regularUsers || []), ...supplementalVendorProfiles];
      const foundProfileUserIds = new Set(mergedProfiles.map((user: any) => String(user.user_id || '')));
      const fallbackExternalUsers = (approvedAccessRequests || [])
        .filter((request: any) => {
          const userId = String(request.user_id || '').trim();
          if (!userId || foundProfileUserIds.has(userId)) return false;
          const requestedRole = String(parseRequestedRoleFromNotes(request.notes) || '').trim().toLowerCase();
          return EXTERNAL_ACCESS_ROLES.includes(requestedRole as typeof EXTERNAL_ACCESS_ROLES[number]);
        })
        .map((request: any) => {
          const userId = String(request.user_id || '').trim();
          const requestedRole = String(parseRequestedRoleFromNotes(request.notes) || '').trim().toLowerCase() as UserProfile['role'];
          const requestBusinessName = parseBusinessNameFromNotes(request.notes);
          const requestEmail = parseEmailFromNotes(request.notes);
          const pendingJobIds = parsePendingJobIdsFromNotes(request.notes);
          return {
            id: `external-request:${userId}`,
            user_id: userId,
            first_name: '',
            last_name: '',
            display_name: requestEmail || requestBusinessName || 'Pending External User',
            avatar_url: null,
            company_name: requestBusinessName || null,
            company_logo_url: null,
            vendor_id: null,
            current_company_id: currentCompany.id,
            role: requestedRole,
            created_at: new Date().toISOString(),
            has_global_job_access: false,
            has_pin: false,
            status: 'approved',
            phone: undefined,
            punch_clock_access: false,
            pm_lynk_access: false,
            custom_role_id: null,
            last_sign_in_at: undefined,
            jobs: [],
            external_access_state: pendingJobIds.length > 0 ? 'pending' as const : 'active' as const,
            external_pending_jobs: pendingJobIds.map((jobId) => ({
              id: jobId,
              name: 'Pending Job',
            })),
          } satisfies UserProfile;
        });

      const allRegularUsers = [...mergedProfiles, ...fallbackExternalUsers];

      const vendorIds = Array.from(
        new Set(
          allRegularUsers
            .map((user: any) => String(user.vendor_id || '').trim())
            .filter(Boolean)
        )
      );
      const companyIds = Array.from(
        new Set(
          allRegularUsers
            .map((user: any) => String(user.current_company_id || '').trim())
            .filter(Boolean)
        )
      );

      const [{ data: vendorRows, error: vendorsError }, { data: companyRows, error: companiesError }] = await Promise.all([
        vendorIds.length > 0
          ? supabase
              .from('vendors')
              .select('id, name, logo_url')
              .in('id', vendorIds)
          : Promise.resolve({ data: [], error: null }),
        companyIds.length > 0
          ? supabase
              .from('companies')
              .select('id, name, display_name, logo_url')
              .in('id', companyIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (vendorsError) throw vendorsError;
      if (companiesError) throw companiesError;

      const vendorById = new Map(
        ((vendorRows || []) as any[]).map((vendor) => [String(vendor.id), vendor]),
      );
      const companyById = new Map(
        ((companyRows || []) as any[]).map((company) => [String(company.id), company]),
      );

      const externalUserIds = allRegularUsers
        .map((user: any) => {
          const profileRole = String(user.role || '').trim().toLowerCase();
          const resolvedRole = roleMap.get(user.user_id)
            || (EXTERNAL_ACCESS_ROLES.includes(profileRole as typeof EXTERNAL_ACCESS_ROLES[number]) ? profileRole : null);
          return resolvedRole && EXTERNAL_ACCESS_ROLES.includes(resolvedRole as typeof EXTERNAL_ACCESS_ROLES[number])
            ? String(user.user_id)
            : null;
        })
        .filter(Boolean) as string[];

      const externalVendorIds = Array.from(
        new Set(
          allRegularUsers
            .map((user: any) => {
              const profileRole = String(user.role || '').trim().toLowerCase();
              const resolvedRole = roleMap.get(user.user_id)
                || (EXTERNAL_ACCESS_ROLES.includes(profileRole as typeof EXTERNAL_ACCESS_ROLES[number]) ? profileRole : null);
              return resolvedRole === 'vendor' ? String(user.vendor_id || '').trim() : '';
            })
            .filter(Boolean)
        )
      );

      const pendingJobIds = Array.from(
        new Set(
          Array.from(requestPendingJobIdsByUserId.values()).flat().filter(Boolean),
        ),
      );

      const [externalJobAccessRes, externalProjectDirectoryRes, vendorJobAccessRes, vendorRfpInvitesRes, pendingJobsRes, loginAuditRes] = await Promise.all([
        externalUserIds.length > 0
          ? supabase
              .from('user_job_access')
              .select('user_id, job_id, jobs!inner(id, name, company_id)')
              .in('user_id', externalUserIds)
              .eq('jobs.company_id', currentCompany.id)
          : Promise.resolve({ data: [], error: null }),
        externalUserIds.length > 0
          ? supabase
              .from('job_project_directory')
              .select('linked_user_id, job_id, jobs!inner(id, name)')
              .in('linked_user_id', externalUserIds)
              .eq('company_id', currentCompany.id)
              .eq('is_project_team_member', true)
              .eq('is_active', true)
          : Promise.resolve({ data: [], error: null }),
        externalVendorIds.length > 0
          ? supabase
              .from('vendor_job_access' as any)
              .select('vendor_id, job_id, jobs!inner(id, name, company_id)')
              .in('vendor_id', externalVendorIds)
              .eq('jobs.company_id', currentCompany.id)
          : Promise.resolve({ data: [], error: null }),
        externalVendorIds.length > 0
          ? supabase
              .from('rfp_invited_vendors')
              .select('vendor_id, rfp:rfps!inner(job_id, jobs!inner(id, name, company_id))')
              .in('vendor_id', externalVendorIds)
              .eq('company_id', currentCompany.id)
          : Promise.resolve({ data: [], error: null }),
        pendingJobIds.length > 0
          ? supabase
              .from('jobs')
              .select('id, name')
              .in('id', pendingJobIds)
              .eq('company_id', currentCompany.id)
          : Promise.resolve({ data: [], error: null }),
        externalUserIds.length > 0
          ? supabase
              .from('user_login_audit')
              .select('user_id, login_time')
              .in('user_id', externalUserIds)
              .order('login_time', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (externalJobAccessRes.error) throw externalJobAccessRes.error;
      if (externalProjectDirectoryRes.error) throw externalProjectDirectoryRes.error;
      if (vendorJobAccessRes.error) throw vendorJobAccessRes.error;
      if (vendorRfpInvitesRes.error) throw vendorRfpInvitesRes.error;
      if (pendingJobsRes.error) throw pendingJobsRes.error;
      if (loginAuditRes.error) throw loginAuditRes.error;

      const activeJobsByExternalUserId = new Map<string, { id: string; name: string }[]>();
      const userIdsByVendorId = new Map<string, string[]>();
      allRegularUsers.forEach((user: any) => {
        const profileRole = String(user.role || '').trim().toLowerCase();
        const resolvedRole = roleMap.get(user.user_id)
          || (EXTERNAL_ACCESS_ROLES.includes(profileRole as typeof EXTERNAL_ACCESS_ROLES[number]) ? profileRole : null);
        if (resolvedRole === 'vendor' && user.vendor_id) {
          const vendorId = String(user.vendor_id);
          const existingUserIds = userIdsByVendorId.get(vendorId) || [];
          existingUserIds.push(String(user.user_id));
          userIdsByVendorId.set(vendorId, existingUserIds);
        }
      });
      const pushActiveJob = (targetUserId: string, job: { id: string; name: string } | null | undefined) => {
        if (!targetUserId || !job?.id || !job?.name) return;
        const existing = activeJobsByExternalUserId.get(targetUserId) || [];
        if (!existing.some((entry) => entry.id === job.id)) {
          existing.push(job);
        }
        activeJobsByExternalUserId.set(targetUserId, existing);
      };

      ((externalJobAccessRes.data || []) as any[]).forEach((row) => {
        const job = row.jobs;
        pushActiveJob(String(row.user_id), job ? { id: String(job.id), name: String(job.name) } : null);
      });

      ((externalProjectDirectoryRes.data || []) as any[]).forEach((row) => {
        const job = row.jobs;
        pushActiveJob(String(row.linked_user_id), job ? { id: String(job.id), name: String(job.name) } : null);
      });

      ((vendorJobAccessRes.data || []) as any[]).forEach((row) => {
        const linkedUserIds = userIdsByVendorId.get(String(row.vendor_id || '')) || [];
        const job = row.jobs;
        linkedUserIds.forEach((linkedUserId) => {
          pushActiveJob(linkedUserId, job ? { id: String(job.id), name: String(job.name) } : null);
        });
      });

      ((vendorRfpInvitesRes.data || []) as any[]).forEach((row) => {
        const linkedUserIds = userIdsByVendorId.get(String(row.vendor_id || '')) || [];
        const job = row?.rfp?.jobs;
        linkedUserIds.forEach((linkedUserId) => {
          pushActiveJob(linkedUserId, job ? { id: String(job.id), name: String(job.name) } : null);
        });
      });

      const pendingJobNameById = new Map(
        ((pendingJobsRes.data || []) as any[]).map((job) => [String(job.id), String(job.name || 'Unnamed Job')]),
      );
      const lastLoginByUserId = new Map<string, string>();
      ((loginAuditRes.data || []) as any[]).forEach((row) => {
        const resolvedUserId = String(row.user_id || '');
        const resolvedLoginTime = String(row.login_time || '');
        if (!resolvedUserId || !resolvedLoginTime || lastLoginByUserId.has(resolvedUserId)) return;
        lastLoginByUserId.set(resolvedUserId, resolvedLoginTime);
      });

      // Fetch jobs for regular users and determine PIN status
      // Also fetch latest punch selfie as avatar fallback for users without avatars
      const usersWithJobs = await Promise.all(allRegularUsers.map(async (user) => {
        const profileRole = String((user as any).role || '').trim().toLowerCase();
        const userRole = roleMap.get(user.user_id)
          || (EXTERNAL_ACCESS_ROLES.includes(profileRole as typeof EXTERNAL_ACCESS_ROLES[number]) ? profileRole : 'employee');
        const hasPin = !!user.pin_code;
        const vendorRecord = user.vendor_id ? vendorById.get(String(user.vendor_id)) : null;
        const companyRecord = user.current_company_id ? companyById.get(String(user.current_company_id)) : null;
        const resolvedCompanyName =
          userRole === 'vendor'
            ? String(vendorRecord?.name || '').trim()
              || requestBusinessNameByUserId.get(String(user.user_id))
              || String(companyRecord?.display_name || companyRecord?.name || '').trim()
              || null
            : String(companyRecord?.display_name || companyRecord?.name || '').trim()
              || String(vendorRecord?.name || '').trim()
              || requestBusinessNameByUserId.get(String(user.user_id))
              || null;
        const resolvedCompanyLogo =
          resolveCompanyLogoUrl(companyRecord?.logo_url || vendorRecord?.logo_url || null);
        const activeExternalJobs = (activeJobsByExternalUserId.get(String(user.user_id)) || [])
          .sort((a, b) => a.name.localeCompare(b.name));
        const pendingExternalJobs = Array.from(
          new Set(requestPendingJobIdsByUserId.get(String(user.user_id)) || []),
        )
          .filter((jobId) => !activeExternalJobs.some((job) => job.id === jobId))
          .map((jobId) => ({
            id: jobId,
            name: pendingJobNameById.get(jobId) || 'Pending Job',
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        // External portal users do not need punch-clock avatar fallbacks here.
        // Skipping those extra queries keeps vendor/design-professional access
        // tabs from loading slowly.
        let effectiveAvatarUrl = user.avatar_url;
        if (!effectiveAvatarUrl && !EXTERNAL_ACCESS_ROLES.includes(userRole as typeof EXTERNAL_ACCESS_ROLES[number])) {
          const { data: punchData, error: punchError } = await supabase
            .from('time_cards')
            .select('punch_in_photo_url, punch_out_photo_url')
            .eq('user_id', user.user_id)
            .not('punch_in_photo_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);

          if (punchError) {
            console.warn(`[AvatarFallback] Error for ${user.first_name} ${user.last_name}:`, punchError);
          } else if (punchData && punchData.length > 0) {
            const rawUrl = punchData[0].punch_out_photo_url || punchData[0].punch_in_photo_url || null;
            if (rawUrl) {
              effectiveAvatarUrl = await resolveStorageUrl('punch-photos', rawUrl);
            }
          }
        }
        
        if (EXTERNAL_ACCESS_ROLES.includes(userRole as typeof EXTERNAL_ACCESS_ROLES[number])) {
          const requestEmail = requestEmailByUserId.get(String(user.user_id));
          return {
            ...user,
            email: (user as any).email || requestEmail || undefined,
            avatar_url: effectiveAvatarUrl,
            role: userRole,
            jobs: activeExternalJobs,
            has_pin: hasPin,
            last_sign_in_at: lastLoginByUserId.get(String(user.user_id)) || undefined,
            company_name: resolvedCompanyName,
            company_logo_url: resolvedCompanyLogo,
            external_access_state: activeExternalJobs.length > 0 ? 'active' : 'pending',
            external_pending_jobs: pendingExternalJobs,
          };
        }

        if (user.has_global_job_access) {
          return {
            ...user,
            avatar_url: effectiveAvatarUrl,
            role: userRole,
            jobs: [],
            has_pin: hasPin,
            company_name: resolvedCompanyName,
            company_logo_url: resolvedCompanyLogo,
          };
        }
        
        const { data: userJobs } = await supabase
          .from('user_job_access')
          .select('job_id, jobs(id, name)')
          .eq('user_id', user.user_id);
        
        const jobs = userJobs?.map((item: any) => item.jobs).filter(Boolean) || [];
        return {
          ...user,
          avatar_url: effectiveAvatarUrl,
          role: userRole,
          jobs,
          has_pin: hasPin,
          company_name: resolvedCompanyName,
          company_logo_url: resolvedCompanyLogo,
        };
      }));

      // Sort by name
      usersWithJobs.sort((a, b) => {
        const nameA = a.display_name || `${a.first_name} ${a.last_name}`;
        const nameB = b.display_name || `${b.first_name} ${b.last_name}`;
        return nameA.localeCompare(nameB);
      });
      
      setUsers(usersWithJobs as any);
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

  const updateUserRole = async (userId: string, newRole: 'admin' | 'controller' | 'project_manager' | 'design_professional' | 'employee' | 'view_only' | 'company_admin' | 'vendor') => {
    try {
      // Update the role in user_company_access for this specific company
      const { error } = await supabase
        .from('user_company_access')
        .update({ role: newRole as any })
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

  const getCustomRoleForUser = (user: UserProfile) => {
    if (!user.custom_role_id) return null;
    return customRoles.find((r) => r.id === user.custom_role_id) || null;
  };

  const getUsersForCustomRole = (customRoleId: string) => {
    return users.filter((u) => {
      if (u.custom_role_id !== customRoleId || u.status !== 'approved') return false;
      return !roleGroupDefs.some((group) => group.roles.includes(u.role));
    });
  };

  const getUsersForSystemGroup = (roles: string[]) => {
    return users.filter((u) => {
      const isExternalRole = EXTERNAL_ACCESS_ROLES.includes(u.role as typeof EXTERNAL_ACCESS_ROLES[number]);
      if (isExternalRole) return false;
      if (u.status !== 'approved') return false;
      return roles.includes(u.role);
    });
  };

  const getExternalUsers = (role: typeof EXTERNAL_ACCESS_ROLES[number]) => {
    if (role === 'vendor') {
      return users.filter((u) => u.role === role);
    }
    return users.filter((u) => u.role === role && (u.status === 'approved' || u.external_access_state === 'active'));
  };

  const getPendingExternalUsers = (role: typeof EXTERNAL_ACCESS_ROLES[number]) =>
    role === 'vendor'
      ? []
      : users.filter((u) => u.role === role && u.external_access_state === 'pending' && u.status !== 'approved');

  const groupUsersByCompany = (sourceUsers: UserProfile[]) => {
    const groups = new Map<string, { companyName: string; companyLogoUrl: string | null; users: UserProfile[] }>();

    sourceUsers.forEach((user) => {
      const companyName = String(user.company_name || 'Unassigned Company').trim() || 'Unassigned Company';
      const key = normalizeCompanyKey(companyName) || user.user_id;
      const existing = groups.get(key);

      if (existing) {
        existing.users.push(user);
        if (!existing.companyLogoUrl && user.company_logo_url) {
          existing.companyLogoUrl = user.company_logo_url;
        }
        return;
      }

      groups.set(key, {
        companyName,
        companyLogoUrl: user.company_logo_url || null,
        users: [user],
      });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        users: [...group.users].sort((a, b) => {
          const nameA = a.display_name || `${a.first_name} ${a.last_name}`.trim() || 'Unnamed User';
          const nameB = b.display_name || `${b.first_name} ${b.last_name}`.trim() || 'Unnamed User';
          return nameA.localeCompare(nameB);
        }),
      }))
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  };

  const getExternalUsersGroupedByCompany = (role: typeof EXTERNAL_ACCESS_ROLES[number]) =>
    groupUsersByCompany(getExternalUsers(role));

  const getInvitationRoleBadge = (invitation: Invitation) => {
    if (invitation.custom_role_id) {
      const customRole = customRoles.find((r) => r.id === invitation.custom_role_id);
      if (customRole) {
        return (
          <Badge variant="secondary">
            {customRole.role_name}
          </Badge>
        );
      }
    }

    return (
      <Badge variant={roleColors[invitation.role as keyof typeof roleColors] || 'outline'}>
        {roleLabels[invitation.role as keyof typeof roleLabels] || invitation.role}
      </Badge>
    );
  };

  if (!canManageUsers || (!permissionsLoading && !visibleTabs.length)) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors"
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="users">
          <div className="space-y-6">
            {isAdmin && (
              <div className="flex justify-end">
                <Button onClick={() => setShowAddUserDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add System User
                </Button>
              </div>
            )}
            {loading ? (
              <div className="text-center py-8"><span className="loading-dots">Loading users</span></div>
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
                                {getInvitationRoleBadge(invitation)}
                                {getEmailStatusBadge(invitation)}
                                {invitation.matched_user_id ? (
                                  <Badge variant={invitation.has_company_access ? 'secondary' : 'outline'}>
                                    {invitation.has_company_access ? 'Account Linked' : 'Account Created'}
                                  </Badge>
                                ) : null}
                              </div>
                              {invitation.matched_user_id ? (
                                <p className="text-xs text-muted-foreground mt-2">
                                  {invitation.matched_user_name || invitation.email}
                                  {invitation.has_company_access
                                    ? ' already has company access, but this invitation still shows pending.'
                                    : ' already created an account, but the Sigma invitation was never finalized.'}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              {invitation.matched_user_id && !invitation.has_company_access ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    repairInvitation(invitation);
                                  }}
                                  disabled={repairingId === invitation.id}
                                >
                                  {repairingId === invitation.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Finalize Invite'
                                  )}
                                </Button>
                              ) : null}
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
                  const groupUsers = getUsersForSystemGroup(group.roles);
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
                                (() => {
                                  const customRoleForUser = getCustomRoleForUser(user);
                                  return (
                                <div
                                  key={user.id}
                                  onClick={() => navigate(`/settings/users/${user.user_id}?companyId=${currentCompany?.id || ''}`, { state: { companyId: currentCompany?.id } })}
                                  className="flex items-center gap-4 p-3 bg-gradient-to-r from-background to-muted/20 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20"
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
                                    <div className="flex items-center gap-2 flex-wrap leading-tight">
                                      <h3 className="font-semibold truncate">
                                        {user.display_name || `${user.first_name} ${user.last_name}`}
                                      </h3>
                                      <Badge variant={user.status === 'approved' ? 'success' : user.status === 'pending' ? 'warning' : user.status === 'rejected' ? 'destructive' : 'outline'}>
                                        {user.status || 'pending'}
                                      </Badge>
                                      <Badge variant={customRoleForUser ? 'secondary' : (roleColors[user.role as keyof typeof roleColors] || 'outline')}>
                                        {customRoleForUser ? `${customRoleForUser.role_name} (Custom)` : (roleLabels[user.role as keyof typeof roleLabels] || user.role)}
                                      </Badge>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground flex-wrap leading-tight">
                                      {user.phone && <span>{user.phone}</span>}
                                      <span>Created: {new Date(user.created_at).toLocaleDateString()}</span>
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
                                  );
                                })()
                              ))}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })}

                {/* Custom-role collapsible groups (always after built-in system roles) */}
                {customRoles.map((customRole) => {
                  const groupUsers = getUsersForCustomRole(customRole.id);
                  if (groupUsers.length === 0) return null;

                  const groupKey = `custom_${customRole.id}`;
                  const isOpen = openGroups[groupKey] ?? true;

                  return (
                    <Collapsible
                      key={groupKey}
                      open={isOpen}
                      onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, [groupKey]: open }))}
                    >
                      <Card>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer py-4">
                            <div className="flex items-center justify-between w-full">
                              <CardTitle className="flex items-center gap-2 text-lg">
                                {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                <Shield className="h-5 w-5" />
                                {customRole.role_name}
                                <Badge variant="secondary">{groupUsers.length}</Badge>
                                <Badge variant="outline" className="text-xs">Custom Role</Badge>
                              </CardTitle>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0">
                            <div className="space-y-3">
                              {groupUsers.map((user) => {
                                const customRoleForUser = getCustomRoleForUser(user);
                                return (
                                  <div
                                    key={user.id}
                                    onClick={() => navigate(`/settings/users/${user.user_id}?companyId=${currentCompany?.id || ''}`, { state: { companyId: currentCompany?.id } })}
                                    className="flex items-center gap-4 p-3 bg-gradient-to-r from-background to-muted/20 rounded-lg border cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20"
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
                                      <div className="flex items-center gap-2 flex-wrap leading-tight">
                                        <h3 className="font-semibold truncate">
                                          {user.display_name || `${user.first_name} ${user.last_name}`}
                                        </h3>
                                        <Badge variant={user.status === 'approved' ? 'success' : user.status === 'pending' ? 'warning' : user.status === 'rejected' ? 'destructive' : 'outline'}>
                                          {user.status || 'pending'}
                                        </Badge>
                                        <Badge variant="secondary">
                                          {customRoleForUser ? `${customRoleForUser.role_name} (Custom)` : 'Custom Role'}
                                        </Badge>
                                      </div>
                                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground flex-wrap leading-tight">
                                        {user.phone && <span>{user.phone}</span>}
                                        <span>Created: {new Date(user.created_at).toLocaleDateString()}</span>
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
                                );
                              })}
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

        <TabsContent value="vendor-access">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Vendor Access Users{loading ? '' : ` (${getExternalUsers('vendor').length})`}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading vendor access users...</p>
                ) : getExternalUsers('vendor').length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vendor users are currently linked to this company.</p>
                ) : (
                  getExternalUsers('vendor').map((user) => (
                    <div
                      key={user.user_id}
                      onClick={() => navigate(`/settings/users/${user.user_id}?companyId=${currentCompany?.id || ''}`, { state: { companyId: currentCompany?.id } })}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 cursor-pointer hover:border-primary hover:bg-primary/10 transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap leading-none">
                            <p className="font-medium truncate">{user.display_name || `${user.first_name} ${user.last_name}`.trim() || 'Unnamed User'}</p>
                            <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">Vendor</Badge>
                            <Badge className="h-5 px-1.5 text-[11px]" variant={user.status === 'approved' ? 'default' : user.status === 'pending' ? 'secondary' : 'outline'}>
                              {user.status || 'pending'}
                            </Badge>
                            <Badge className="h-5 px-1.5 text-[11px]" variant={user.external_access_state === 'pending' ? 'secondary' : 'outline'}>
                              {user.external_access_state === 'pending' ? 'Portal Pending' : 'Portal Active'}
                            </Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap leading-tight">
                            <span className="truncate">{user.company_name || 'Vendor'}</span>
                            {user.phone ? <span>• {user.phone}</span> : null}
                            {user.external_pending_jobs && user.external_pending_jobs.length > 0 ? (
                              <Badge className="h-5 px-1.5 text-[11px]" variant="outline">
                                {user.external_pending_jobs.length} pending job{user.external_pending_jobs.length === 1 ? '' : 's'}
                              </Badge>
                            ) : null}
                            {user.last_sign_in_at ? (
                              <Badge className="h-5 px-1.5 text-[11px]" variant="outline">
                                Last login {new Date(user.last_sign_in_at).toLocaleDateString()}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="h-5 px-1.5 text-[11px] text-muted-foreground">No login yet</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-start">
                        {user.vendor_id ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/vendors/${user.vendor_id}`);
                            }}
                          >
                            Vendor
                          </Button>
                        ) : null}
                        {user.external_pending_jobs && user.external_pending_jobs.length > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/jobs/${user.external_pending_jobs?.[0]?.id}`);
                            }}
                          >
                            Open Job
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <CompanyAccessRequests
              requestedRoleFilter={['vendor']}
              statusFilter={intakePendingOnly ? 'pending' : 'all'}
              title="Vendor Intake Queue"
              description="Approve or reject vendor signup requests for this company."
            />
          </div>
        </TabsContent>

        <TabsContent value="design-professional-access">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Design Professional Access Users{loading ? '' : ` (${getExternalUsers('design_professional').length})`}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading design professional access users...</p>
                ) : getExternalUsers('design_professional').length === 0 ? (
                  <p className="text-sm text-muted-foreground">No design professional users are currently linked to this company.</p>
                ) : (
                  getExternalUsers('design_professional').map((user) => (
                    <div
                      key={user.user_id}
                      onClick={() => navigate(`/settings/users/${user.user_id}?companyId=${currentCompany?.id || ''}`, { state: { companyId: currentCompany?.id } })}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 cursor-pointer hover:border-primary hover:bg-primary/10 transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap leading-none">
                            <p className="font-medium truncate">{user.display_name || `${user.first_name} ${user.last_name}`.trim() || 'Unnamed User'}</p>
                            <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">Design Professional</Badge>
                            <Badge className="h-5 px-1.5 text-[11px]" variant={user.status === 'approved' ? 'default' : user.status === 'pending' ? 'secondary' : 'outline'}>
                              {user.status || 'pending'}
                            </Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap leading-tight">
                            <span className="truncate">{user.company_name || 'Design Professional'}</span>
                            {user.phone ? <span>• {user.phone}</span> : null}
                            {user.last_sign_in_at ? (
                              <Badge className="h-5 px-1.5 text-[11px]" variant="outline">
                                Last login {new Date(user.last_sign_in_at).toLocaleDateString()}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="h-5 px-1.5 text-[11px] text-muted-foreground">No login yet</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Awaiting Design Professional Acceptance ({getPendingExternalUsers('design_professional').length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getPendingExternalUsers('design_professional').length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No design professional users are currently awaiting activation.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {groupUsersByCompany(getPendingExternalUsers('design_professional')).map((group) => (
                        <div key={group.companyName} className="rounded-xl border bg-card/50">
                          <div className="flex items-center gap-3 border-b px-4 py-3">
                            {group.companyLogoUrl ? (
                              <img
                                src={group.companyLogoUrl}
                                alt={group.companyName}
                                className="h-10 w-10 rounded-md border object-contain bg-background p-1 shrink-0"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-xs font-semibold text-muted-foreground">
                                {group.companyName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold">{group.companyName}</p>
                              <p className="text-sm text-muted-foreground">
                                {group.users.length} pending user{group.users.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2 p-3">
                            {group.users.map((user) => (
                              <div
                                key={user.user_id}
                                onClick={() => navigate(`/settings/users/${user.user_id}?companyId=${currentCompany?.id || ''}`, { state: { companyId: currentCompany?.id } })}
                                className="flex items-center justify-between rounded-lg border bg-background p-3 cursor-pointer hover:border-primary hover:bg-primary/10 transition-colors"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="relative h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
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
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap leading-tight">
                                      <p className="font-medium truncate">{user.display_name || `${user.first_name} ${user.last_name}`.trim() || 'Unnamed User'}</p>
                                      <Badge variant="outline">Awaiting Acceptance</Badge>
                                      <Badge variant="secondary">Design Professional</Badge>
                                    </div>
                                    <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap leading-tight">
                                      <span className="truncate">{group.companyName}</span>
                                      {user.phone ? <span>• {user.phone}</span> : null}
                                      {user.external_pending_jobs && user.external_pending_jobs.length > 0 ? (
                                        <Badge variant="outline" className="text-[11px]">
                                          {user.external_pending_jobs.length} pending job{user.external_pending_jobs.length === 1 ? '' : 's'}
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[11px] text-muted-foreground">
                                          Waiting on acceptance
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <CompanyAccessRequests
              requestedRoleFilter={['design_professional']}
              statusFilter={intakePendingOnly ? 'pending' : 'all'}
              title="Design Professional Intake Queue"
              description="Approve or reject design professional signup requests for this company."
            />
          </div>
        </TabsContent>

        <TabsContent value="intake-queue">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Filters</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={intakeRoleFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setIntakeRoleFilter('all')}
                >
                  All Roles
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={intakeRoleFilter === 'vendor' ? 'default' : 'outline'}
                  onClick={() => setIntakeRoleFilter('vendor')}
                >
                  Vendors
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={intakeRoleFilter === 'design_professional' ? 'default' : 'outline'}
                  onClick={() => setIntakeRoleFilter('design_professional')}
                >
                  Design Professionals
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={intakePendingOnly ? 'default' : 'outline'}
                  onClick={() => setIntakePendingOnly((prev) => !prev)}
                >
                  Pending Only
                </Button>
              </CardContent>
            </Card>
            <CompanyAccessRequests
              requestedRoleFilter={
                intakeRoleFilter === 'all'
                  ? undefined
                  : [intakeRoleFilter]
              }
              statusFilter={intakePendingOnly ? 'pending' : 'all'}
              title="Signup Intake Queue"
              description="Review all signup requests, including internal users, vendors, and design professionals."
            />
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <RolePermissionsManager />
        </TabsContent>

        <TabsContent value="groups">
          <EmployeeGroupManager onGroupChange={fetchUsers} />
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
