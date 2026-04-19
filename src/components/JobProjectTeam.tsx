import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Edit, Users, Mail, MailCheck, MailOpen, MailX, Phone, Building2, Star, UserCheck, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useUserAvatars } from '@/hooks/useUserAvatar';
import UserAvatar from '@/components/UserAvatar';
import { useActiveCompanyRole } from '@/hooks/useActiveCompanyRole';
import { sendDesignProfessionalJobInvite } from '@/utils/sendDesignProfessionalJobInvite';
import { searchDesignProfessionalAccounts, type DesignProfessionalAccountSearchResult } from '@/utils/searchDesignProfessionalAccounts';


interface ProjectRole {
  id: string;
  name: string;
}

interface DirectoryMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  avatar_url: string | null;
  linked_user_id?: string | null;
  project_role_id: string | null;
  project_role?: ProjectRole | null;
  is_primary_contact: boolean;
  is_project_team_member: boolean;
  source?: 'directory' | 'pm' | 'assistant_pm' | 'employee' | 'company-user';
}

interface CompanyUserOption {
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  avatar_url: string | null;
  role: string;
  role_label: string;
}

interface CompanyAccessRow {
  user_id: string;
  role?: string | null;
}

interface CustomRoleRow {
  id: string;
  role_name: string;
}

interface CompanyDirectoryUser {
  user_id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
}

interface CompanyProfileRow {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  custom_role_id?: string | null;
  role?: string | null;
  current_company_id?: string | null;
}

interface JobProjectTeamProps {
  jobId: string;
  readOnly?: boolean;
  companyIdOverride?: string | null;
  companyNameOverride?: string | null;
}

interface PendingDesignInvite {
  id: string;
  user_id: string;
  requested_at: string;
  updated_at?: string | null;
  business_name?: string | null;
  display_name?: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  project_role_id?: string | null;
  project_role_name?: string | null;
  email_status?: string | null;
  email_delivered_at?: string | null;
  email_opened_at?: string | null;
  email_bounced_at?: string | null;
}

interface ConnectedVendorOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  vendor_type: string | null;
  contact_person?: string | null;
}

const ADD_DESIGN_PROFESSIONAL_ROLE_VALUE = '__add_design_professional_role__';
const ADD_SUBCONTRACTOR_ROLE_VALUE = '__add_subcontractor_role__';

const isMissingRelationError = (error: unknown, relationName: string): boolean => {
  const message = String((error as any)?.message || error || '').toLowerCase();
  return message.includes(relationName.toLowerCase()) && (
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('relation')
  );
};

const safeParseInviteNotes = (value: unknown): Record<string, any> => {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
};

const dedupePendingDesignInvites = (invites: PendingDesignInvite[]): PendingDesignInvite[] => {
  const latestByKey = new Map<string, PendingDesignInvite>();

  invites.forEach((invite) => {
    const key = String(invite.email || invite.display_name || invite.user_id || invite.id).trim().toLowerCase();
    const existing = latestByKey.get(key);

    if (!existing) {
      latestByKey.set(key, invite);
      return;
    }

    const existingTime = new Date(existing.requested_at || 0).getTime();
    const nextTime = new Date(invite.requested_at || 0).getTime();

    if (nextTime >= existingTime) {
      latestByKey.set(key, invite);
    }
  });

  return Array.from(latestByKey.values()).sort(
    (a, b) => new Date(b.requested_at || 0).getTime() - new Date(a.requested_at || 0).getTime()
  );
};

export default function JobProjectTeam({ jobId, readOnly = false, companyIdOverride = null, companyNameOverride = null }: JobProjectTeamProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const activeCompanyRole = useActiveCompanyRole();
  const [teamMembers, setTeamMembers] = useState<DirectoryMember[]>([]);
  const [availableMembers, setAvailableMembers] = useState<DirectoryMember[]>([]);
  const [availableCompanyUsers, setAvailableCompanyUsers] = useState<CompanyUserOption[]>([]);
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<DirectoryMember | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addMemberTab, setAddMemberTab] = useState<'inner_company' | 'design_professional' | 'subcontractor'>('inner_company');
  const [newDesignProfessionalRole, setNewDesignProfessionalRole] = useState('');
  const [newSubcontractorRole, setNewSubcontractorRole] = useState('');
  const [showDesignProfessionalRoleInput, setShowDesignProfessionalRoleInput] = useState(false);
  const [showSubcontractorRoleInput, setShowSubcontractorRoleInput] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [designProfessionalSearch, setDesignProfessionalSearch] = useState('');
  const [designProfessionalSearchLoading, setDesignProfessionalSearchLoading] = useState(false);
  const [designProfessionalSearchResults, setDesignProfessionalSearchResults] = useState<DesignProfessionalAccountSearchResult[]>([]);
  const [pendingDesignInvites, setPendingDesignInvites] = useState<PendingDesignInvite[]>([]);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [connectedVendors, setConnectedVendors] = useState<ConnectedVendorOption[]>([]);
  const [vendorInviteDialogOpen, setVendorInviteDialogOpen] = useState(false);
  const [sendingVendorInvite, setSendingVendorInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    vendorId: '',
  });
  const [inviteProjectRoleId, setInviteProjectRoleId] = useState('');
  const companyScopeId = companyIdOverride || currentCompany?.id || null;
  const primaryGroupCompanyName = String(companyNameOverride || (currentCompany as any)?.display_name || currentCompany?.name || 'Company');
  const canInviteDesignProfessional = ['admin', 'company_admin', 'controller', 'owner', 'project_manager'].includes(String(activeCompanyRole || '').toLowerCase());
  const designProfessionalProjectRoles = useMemo(() => {
    const roleNames = [
      'Architect',
      'Owner Representative',
      'Engineer',
      'Structural Engineer',
      'Civil Engineer',
      'Mechanical Engineer',
    ];
    if (selectedRoleId.startsWith('role-name:')) {
      const selectedRoleName = selectedRoleId.replace('role-name:', '').trim();
      if (
        selectedRoleName &&
        !roleNames.some((name) => name.toLowerCase() === selectedRoleName.toLowerCase())
      ) {
        roleNames.push(selectedRoleName);
      }
    }
    return roleNames.map((name) => ({ id: `role-name:${name}`, name }));
  }, [selectedRoleId]);
  const subcontractorProjectRoles = useMemo(() => {
    const defaultRoles = [
      'Subcontractor',
      'Steel Subcontractor',
      'Electrical Subcontractor',
      'Plumbing Subcontractor',
      'Insulation Subcontractor',
      'Sprinkler Subcontractor',
      'Roofing Subcontractor',
      'Framing Subcontractor',
    ];
    const customRoles = roles
      .filter((role) => !defaultRoles.map((item) => item.toLowerCase()).includes(String(role.name || '').toLowerCase()))
      .filter((role) => String(role.name || '').toLowerCase().includes('subcontract') || String(role.name || '').toLowerCase().includes('contractor'))
      .map((role) => role.name);
    const roleNames = [...new Set([...defaultRoles, ...customRoles])];
    if (selectedRoleId.startsWith('role-name:')) {
      const selectedRoleName = selectedRoleId.replace('role-name:', '').trim();
      if (
        selectedRoleName &&
        !roleNames.some((name) => name.toLowerCase() === selectedRoleName.toLowerCase())
      ) {
        roleNames.push(selectedRoleName);
      }
    }
    return roleNames.map((name) => ({ id: `role-name:${name}`, name }));
  }, [roles, selectedRoleId]);
  const companyProjectRoles = useMemo(() => {
    return [
      'Project Manager',
      'Superintendent',
      'Estimator',
      'Safety Manager',
      `${currentCompany?.name || 'Company'} Member`,
    ].map((name) => ({ id: `role-name:${name}`, name }));
  }, [currentCompany?.name]);
  const designProfessionalVendors = useMemo(
    () => connectedVendors.filter((vendor) => String(vendor.vendor_type || '').toLowerCase() === 'design_professional'),
    [connectedVendors]
  );
  const subcontractorVendors = useMemo(
    () => connectedVendors.filter((vendor) => String(vendor.vendor_type || '').toLowerCase() !== 'design_professional'),
    [connectedVendors]
  );
  const availableCompanyUserById = useMemo(
    () => new Map(availableCompanyUsers.map((companyUser) => [companyUser.user_id, companyUser])),
    [availableCompanyUsers]
  );
  const designProfessionalCompanyUsers = useMemo(
    () => availableCompanyUsers.filter((companyUser) => companyUser.role === 'design_professional'),
    [availableCompanyUsers]
  );
  const designProfessionalUserIds = useMemo(
    () => new Set(designProfessionalCompanyUsers.map((companyUser) => companyUser.user_id)),
    [designProfessionalCompanyUsers]
  );
  const innerCompanyAvailableMembers = useMemo(
    () =>
      availableMembers.filter((member) => {
        if (!member.id.startsWith('company-user:')) return true;
        const userId = member.id.replace('company-user:', '');
        return !designProfessionalUserIds.has(userId);
      }),
    [availableMembers, designProfessionalUserIds]
  );
  const getEffectiveCompanyRole = (companyAccessRole?: string | null, profileRole?: string | null, hasCustomRole?: boolean) => {
    const normalizedProfileRole = String(profileRole || '').toLowerCase();
    const normalizedAccessRole = String(companyAccessRole || '').toLowerCase();
    if (hasCustomRole) {
      return normalizedProfileRole || normalizedAccessRole;
    }
    return normalizedAccessRole || normalizedProfileRole;
  };

  useEffect(() => {
    if (companyScopeId && jobId) {
      loadData();
    }
  }, [companyScopeId, jobId, refreshKey]);

  useEffect(() => {
    if (!inviteDialogOpen || !companyScopeId) return;

    const query = designProfessionalSearch.trim();
    if (query.length < 2) {
      setDesignProfessionalSearchResults([]);
      setDesignProfessionalSearchLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setDesignProfessionalSearchLoading(true);
        const results = await searchDesignProfessionalAccounts(companyScopeId, query);
        setDesignProfessionalSearchResults(results);
      } catch (error) {
        console.error('Error searching design professional accounts:', error);
        setDesignProfessionalSearchResults([]);
      } finally {
        setDesignProfessionalSearchLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [inviteDialogOpen, companyScopeId, designProfessionalSearch]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load directory members, roles, job details, and PIN employees in parallel
      const [allMembersRes, rolesRes, jobRes, assistantPMsRes, pendingRequestsRes, connectedVendorsRes, empSettingsRes] = await Promise.all([
        supabase
          .from('job_project_directory')
          .select(`
            id, linked_user_id, name, email, phone, company_name, project_role_id, is_primary_contact, is_project_team_member,
            project_role:project_roles(id, name)
          `)
          .eq('job_id', jobId)
          .eq('is_active', true)
          .order('is_primary_contact', { ascending: false })
          .order('name'),
        supabase
          .from('project_roles')
          .select('id, name')
          .eq('company_id', companyScopeId)
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('jobs')
          .select('project_manager_user_id')
          .eq('id', jobId)
          .single(),
        supabase
          .from('job_assistant_managers')
          .select('user_id')
          .eq('job_id', jobId),
        supabase
          .from('company_access_requests')
          .select('id, user_id, requested_at, status, notes')
          .eq('company_id', companyScopeId)
          .in('status', ['pending', 'approved'])
          .order('requested_at', { ascending: false }),
        supabase
          .from('vendors')
          .select('id, name, email, phone, vendor_type, contact_person')
          .eq('company_id', companyScopeId)
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('employee_timecard_settings')
          .select('user_id, assigned_jobs, assigned_cost_codes')
          .eq('company_id', companyScopeId),
      ]);

      if (allMembersRes.error) throw allMembersRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (pendingRequestsRes.error) throw pendingRequestsRes.error;
      if (connectedVendorsRes.error) throw connectedVendorsRes.error;
      if (empSettingsRes.error) throw empSettingsRes.error;

      const rawDirectoryMembers = (allMembersRes.data || []).map((member) => ({
        ...member,
        avatar_url: null,
        source: 'directory' as const,
      }));
      
      setRoles(rolesRes.data || []);

      let nextPendingDesignInvites: PendingDesignInvite[] = [];
      const { data: inviteRows, error: inviteRowsError } = await supabase
        .from('design_professional_job_invites')
        .select('id, accepted_by_user_id, company_id, job_id, email, first_name, last_name, invited_by, created_at, updated_at, status, notes, email_status, email_delivered_at, email_opened_at, email_bounced_at')
        .eq('company_id', companyScopeId)
        .eq('job_id', jobId)
        .eq('status', 'pending')
        .order('updated_at', { ascending: false });

      if (!inviteRowsError) {
        nextPendingDesignInvites = (inviteRows || []).map((row: any) => {
          const parsedNotes = safeParseInviteNotes(row.notes);
          return {
            id: row.id,
            user_id: row.accepted_by_user_id || row.email || row.id,
            requested_at: row.updated_at || row.created_at,
            updated_at: row.updated_at || null,
            display_name: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || 'Pending user',
            email: row.email || null,
            first_name: row.first_name || null,
            last_name: row.last_name || null,
            business_name: parsedNotes.businessName ? String(parsedNotes.businessName) : null,
            project_role_id: parsedNotes.projectRoleId ? String(parsedNotes.projectRoleId) : null,
            project_role_name: parsedNotes.projectRoleName ? String(parsedNotes.projectRoleName) : null,
            email_status: row.email_status || null,
            email_delivered_at: row.email_delivered_at || null,
            email_opened_at: row.email_opened_at || null,
            email_bounced_at: row.email_bounced_at || null,
          };
        });
      } else if (!isMissingRelationError(inviteRowsError, 'design_professional_job_invites')) {
        throw inviteRowsError;
      } else {
        const pendingRows = (pendingRequestsRes.data || []).filter((row: any) => {
          try {
            const parsed = row.notes ? JSON.parse(row.notes) : {};
            if (String(parsed?.requestedRole || '').toLowerCase() !== 'design_professional') {
              return false;
            }

            const pendingInvites = Array.isArray(parsed?.pendingJobInvites)
              ? parsed.pendingJobInvites
              : [];

            const hasMatchingPendingInvite = pendingInvites.some((invite: any) => String(invite?.jobId || '') === jobId);
            const legacyMatchingInvite = !pendingInvites.length && String(parsed?.invitedJobId || '') === jobId;

            return hasMatchingPendingInvite || legacyMatchingInvite;
          } catch {
            return false;
          }
        });

        const pendingUserIds = Array.from(new Set(pendingRows.map((r: any) => r.user_id).filter(Boolean)));
        let pendingProfiles: any[] = [];
        if (pendingUserIds.length > 0) {
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name, display_name')
            .in('user_id', pendingUserIds);
          pendingProfiles = profileRows || [];
        }

        nextPendingDesignInvites = pendingRows.map((row: any) => {
          let businessName: string | null = null;
          try {
            const parsed = row.notes ? JSON.parse(row.notes) : {};
            businessName = parsed?.businessName ? String(parsed.businessName) : null;
          } catch {
            businessName = null;
          }
          const profile = pendingProfiles.find((p) => p.user_id === row.user_id);
          const displayName = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
          return {
            id: row.id,
            user_id: row.user_id,
            requested_at: row.requested_at,
            business_name: businessName,
            display_name: displayName || 'Pending user',
          };
        });
      }

      setPendingDesignInvites(dedupePendingDesignInvites(nextPendingDesignInvites));
      setConnectedVendors((connectedVendorsRes.data || []) as ConnectedVendorOption[]);

      const { data: accessRows, error: accessError } = await supabase
        .from('user_company_access')
        .select('user_id, role')
        .eq('company_id', companyScopeId)
        .eq('is_active', true);

      if (accessError) throw accessError;

      const companyAccessRows = (accessRows || []) as CompanyAccessRow[];
      const resolvePreferredCompanyAccess = (rows: CompanyAccessRow[]) => {
        const rankedRows = [...rows].sort((a, b) => {
          const score = (role?: string | null) => {
            const normalized = String(role || '').toLowerCase();
            if (!normalized) return 0;
            if (normalized === 'employee') return 1;
            if (normalized === 'view_only') return 2;
            if (normalized === 'project_manager') return 3;
            if (normalized === 'controller') return 4;
            if (normalized === 'admin') return 5;
            if (normalized === 'company_admin') return 6;
            if (normalized === 'owner') return 7;
            return 8;
          };
          return score(b.role) - score(a.role);
        });
        return rankedRows[0];
      };
      const companyAccessByUserId = new Map<string, CompanyAccessRow>();
      companyAccessRows.forEach((row) => {
        const existing = companyAccessByUserId.get(row.user_id);
        if (!existing) {
          companyAccessByUserId.set(row.user_id, row);
          return;
        }
        companyAccessByUserId.set(
          row.user_id,
          resolvePreferredCompanyAccess([existing, row])
        );
      });
      let directoryUsers: CompanyDirectoryUser[] = [];
      const { data: directoryRows, error: directoryError } = await supabase
        .rpc('get_company_directory', { p_company_id: companyScopeId });

      if (!directoryError) {
        directoryUsers = (directoryRows || []) as CompanyDirectoryUser[];
      } else {
        console.warn('Company directory lookup failed in job project team, using profile fallback only.', directoryError);
      }

      const companyUserIds = Array.from(
        new Set([
          ...companyAccessRows.map((row) => row.user_id),
          ...directoryUsers.map((row) => row.user_id).filter(Boolean),
        ])
      );
      let companyUserOptions: CompanyUserOption[] = [];
      let companyProfileRows: CompanyProfileRow[] = [];
      let customRoleMap = new Map<string, string>();
      let companyNameById = new Map<string, string>();

      if (companyUserIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, display_name, phone, avatar_url, custom_role_id, role, current_company_id')
          .in('user_id', companyUserIds);

        if (profileError) throw profileError;
        companyProfileRows = (profileRows || []) as CompanyProfileRow[];

        const externalCompanyIds = Array.from(
          new Set(
            companyProfileRows
              .map((profile) => profile.current_company_id)
              .filter((companyId): companyId is string => !!companyId)
          )
        );

        if (externalCompanyIds.length > 0) {
          const { data: companyRows } = await supabase
            .from('companies')
            .select('id, name, display_name')
            .in('id', externalCompanyIds);

          companyNameById = new Map(
            (companyRows || []).map((company: any) => [
              company.id,
              String(company.display_name || company.name || 'Company'),
            ])
          );
        }

        const customRoleIds = Array.from(
          new Set(
            companyProfileRows
              .map((profile) => profile.custom_role_id)
              .filter(Boolean)
          )
        ) as string[];

        if (customRoleIds.length > 0) {
          const { data: customRoleRows } = await supabase
            .from('custom_roles')
            .select('id, role_name')
            .in('id', customRoleIds);

          customRoleMap = new Map(
            ((customRoleRows || []) as CustomRoleRow[]).map((role) => [role.id, role.role_name])
          );
        }

      }

      // Find PM and Assistant PM roles
      const pmRole = rolesRes.data?.find(r => r.name.toLowerCase().includes('project manager') && !r.name.toLowerCase().includes('assistant'));
      const assistantPMRole = rolesRes.data?.find(r => r.name.toLowerCase().includes('assistant') && r.name.toLowerCase().includes('project manager'));
      const employeeRole = rolesRes.data?.find(r => r.name.toLowerCase() === 'employee');

      // Build auto-populated team members
      const autoMembers: DirectoryMember[] = [];
      const pmUserId = jobRes.data?.project_manager_user_id;
      const assistantPMUserIds = (assistantPMsRes.data || []).map(a => a.user_id);
      const allManagerIds = [pmUserId, ...assistantPMUserIds].filter(Boolean) as string[];

      // Load employees with timecard settings assigned to this job
      const empSettings = empSettingsRes.data || [];

      const assignedCostCodeIds = Array.from(
        new Set(
          empSettings
            .flatMap((setting: any) => setting.assigned_cost_codes || [])
            .filter(Boolean)
        )
      );

      let costCodeJobMap = new Map<string, string>();
      if (assignedCostCodeIds.length > 0) {
        const { data: assignedCostCodeRows } = await supabase
          .from('cost_codes')
          .select('id, job_id')
          .in('id', assignedCostCodeIds);

        costCodeJobMap = new Map(
          (assignedCostCodeRows || []).map((row: any) => [row.id, row.job_id])
        );
      }

      const empIdsForJob = empSettings
        .filter((setting: any) => {
          const hasJobAssigned = (setting.assigned_jobs || []).includes(jobId);
          const hasCostCodeForJob = (setting.assigned_cost_codes || []).some((costCodeId: string) => costCodeJobMap.get(costCodeId) === jobId);
          return hasJobAssigned && hasCostCodeForJob;
        })
        .map((s: any) => s.user_id);

      let managerProfiles: any[] = [];
      if (allManagerIds.length > 0) {
        const { data: fetchedManagerProfiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, display_name, phone, avatar_url')
          .in('user_id', allManagerIds);
        managerProfiles = fetchedManagerProfiles || [];
      }

      let empProfiles: any[] = [];
      if (empIdsForJob.length > 0) {
        const { data: fetchedEmployeeProfiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, display_name, phone, avatar_url, custom_role_id, role')
          .in('user_id', empIdsForJob);
        empProfiles = fetchedEmployeeProfiles || [];
      }

      const trueFieldEmployees = empProfiles
        .filter((profile) => {
          const companyAccess = companyAccessByUserId.get(profile.user_id);
          const effectiveRole = getEffectiveCompanyRole(companyAccess?.role, profile.role, !!profile.custom_role_id);
          return !profile.custom_role_id && effectiveRole === 'employee';
        });

      const emailLookupUserIds = Array.from(
        new Set([
          ...companyUserIds,
          ...allManagerIds,
          ...trueFieldEmployees.map((profile: any) => profile.user_id),
        ])
      );

      const emailMap = new Map<string, string>();
      if (emailLookupUserIds.length > 0) {
        const { data: emailData } = await supabase.functions.invoke('get-user-email', {
          body: { user_ids: emailLookupUserIds }
        });

        if (emailData?.users) {
          emailData.users.forEach((u: { id: string; email: string }) => {
            emailMap.set(u.id, u.email);
          });
        }
      }

      companyUserOptions = companyProfileRows
        .filter((profile) => {
          const companyAccess = companyAccessByUserId.get(profile.user_id);
          const resolvedRole = getEffectiveCompanyRole(companyAccess?.role, profile.role, !!profile.custom_role_id);
          const isPlainEmployee = resolvedRole === 'employee' && !profile.custom_role_id;
          return !isPlainEmployee;
        })
        .map((profile) => {
          const directoryProfile = directoryUsers.find((d) => d.user_id === profile.user_id);
          const name =
            [directoryProfile?.first_name, directoryProfile?.last_name].filter(Boolean).join(' ') ||
            directoryProfile?.display_name ||
            [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
            profile.display_name ||
            'Unknown';
          const companyAccess = companyAccessByUserId.get(profile.user_id);
          const normalizedRole = getEffectiveCompanyRole(companyAccess?.role, profile.role, !!profile.custom_role_id);
          const roleLabel = profile.custom_role_id
            ? customRoleMap.get(profile.custom_role_id) || 'Custom Role'
            : normalizedRole
              ? normalizedRole
                  .split('_')
                  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                  .join(' ')
              : 'User';

          const resolvedCompanyName = normalizedRole === 'design_professional' && profile.current_company_id
            ? companyNameById.get(profile.current_company_id) || primaryGroupCompanyName || null
            : primaryGroupCompanyName || null;

          return {
            user_id: profile.user_id,
            name,
            email: emailMap.get(profile.user_id) || null,
            phone: profile.phone || null,
            company_name: resolvedCompanyName,
            avatar_url: directoryProfile?.avatar_url || profile.avatar_url || null,
            role: normalizedRole,
            role_label: roleLabel,
          };
        });

      // Add Project Manager
      if (pmUserId) {
        const pmProfile = managerProfiles?.find(p => p.user_id === pmUserId);
        if (pmProfile) {
          autoMembers.push({
            id: `pm-${pmUserId}`,
            name: [pmProfile.first_name, pmProfile.last_name].filter(Boolean).join(' ') || pmProfile.display_name || 'Unknown',
            email: emailMap.get(pmUserId) || null,
            phone: pmProfile.phone,
            company_name: currentCompany?.name || null,
            avatar_url: pmProfile.avatar_url,
            project_role_id: pmRole?.id || null,
            project_role: pmRole || { id: '', name: 'Project Manager' },
            is_primary_contact: false,
            is_project_team_member: true,
            source: 'pm'
          });
        }
      }

      // Add Assistant PMs
      for (const apmId of assistantPMUserIds) {
        const apmProfile = managerProfiles?.find(p => p.user_id === apmId);
        if (apmProfile) {
          autoMembers.push({
            id: `apm-${apmId}`,
            name: [apmProfile.first_name, apmProfile.last_name].filter(Boolean).join(' ') || apmProfile.display_name || 'Unknown',
            email: emailMap.get(apmId) || null,
            phone: apmProfile.phone,
            company_name: currentCompany?.name || null,
            avatar_url: apmProfile.avatar_url,
            project_role_id: assistantPMRole?.id || null,
            project_role: assistantPMRole || { id: '', name: 'Assistant Project Manager' },
            is_primary_contact: false,
            is_project_team_member: true,
            source: 'assistant_pm'
          });
        }
      }

      if (trueFieldEmployees.length > 0) {
        for (const emp of trueFieldEmployees) {
          autoMembers.push({
            id: `emp-${emp.user_id}`,
            name: [emp.first_name, emp.last_name].filter(Boolean).join(' ') || emp.display_name || 'Unknown',
            email: emailMap.get(emp.user_id) || null,
            phone: emp.phone,
            company_name: currentCompany?.name || null,
            avatar_url: emp.avatar_url,
            project_role_id: employeeRole?.id || null,
            project_role: employeeRole || { id: '', name: 'Employee' },
            is_primary_contact: false,
            is_project_team_member: true,
            source: 'employee' as const
          });
        }
      }

      const internalCompanyUserIds = new Set(companyUserOptions.map((companyUser) => companyUser.user_id));

      const allMembers = rawDirectoryMembers.map((member) => {
        const linkedUserId = String(member.linked_user_id || '');
        if (!linkedUserId || !internalCompanyUserIds.has(linkedUserId)) {
          return member;
        }

        const linkedCompanyUser = availableCompanyUserById.get(linkedUserId)
          || companyUserOptions.find((companyUser) => companyUser.user_id === linkedUserId);

        return {
          ...member,
          source: 'company-user' as const,
          company_name: primaryGroupCompanyName,
          avatar_url: linkedCompanyUser?.avatar_url || member.avatar_url || null,
        };
      });

      const directoryTeamMembers = allMembers.filter((member) => member.is_project_team_member);
      const directoryAvailable = allMembers.filter((member) => !member.is_project_team_member);

      // Combine auto-populated and directory team members (remove duplicates by name)
      const existingNames = new Set(directoryTeamMembers.map(m => m.name.toLowerCase()));
      const uniqueAutoMembers = autoMembers.filter(m => !existingNames.has(m.name.toLowerCase()));

      const takenKeys = new Set(
        allMembers.flatMap((member) => [
          member.email?.toLowerCase() || '',
          member.name.toLowerCase(),
        ]).filter(Boolean)
      );
      const autoMemberKeys = new Set(
        autoMembers.flatMap((member) => [
          member.email?.toLowerCase() || '',
          member.name.toLowerCase(),
        ]).filter(Boolean)
      );

      const companyUserCandidates: DirectoryMember[] = companyUserOptions
        .filter((companyUser) => {
          const emailKey = companyUser.email?.toLowerCase() || '';
          const nameKey = companyUser.name.toLowerCase();
          const alreadyTakenByDirectory = (emailKey && takenKeys.has(emailKey)) || takenKeys.has(nameKey);
          const alreadyOnJob = (emailKey && autoMemberKeys.has(emailKey)) || autoMemberKeys.has(nameKey);
          return !alreadyTakenByDirectory && !alreadyOnJob;
        })
          .map((companyUser) => ({
            id: `company-user:${companyUser.user_id}`,
            name: companyUser.name,
            email: companyUser.email,
            phone: companyUser.phone,
            company_name: companyUser.company_name,
            avatar_url: companyUser.avatar_url,
            linked_user_id: companyUser.user_id,
            project_role_id: null,
            project_role: companyUser.role_label ? { id: '', name: companyUser.role_label } : null,
            is_primary_contact: false,
            is_project_team_member: false,
            source: 'company-user' as const,
          }));

      setTeamMembers([...uniqueAutoMembers, ...directoryTeamMembers]);
      setAvailableMembers([...directoryAvailable, ...companyUserCandidates]);
      setAvailableCompanyUsers(companyUserOptions);
    } catch (error) {
      console.error('Error loading project team:', error);
      toast({
        title: "Error",
        description: "Failed to load project team",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendDesignProfessionalInvite = async () => {
    if (!companyScopeId || !inviteForm.email.trim()) {
      toast({
        title: "Email required",
        description: "Enter an email address to send the invitation.",
        variant: "destructive",
      });
      return;
    }

    const selectedVendor = connectedVendors.find((vendor) => vendor.id === inviteForm.vendorId);
    if (!selectedVendor?.name) {
      toast({
        title: "Company required",
        description: "Choose the design professional company for this invite.",
        variant: "destructive",
      });
      return;
    }

    try {
      setInviteSubmitting(true);
      await sendDesignProfessionalJobInvite({
        companyId: companyScopeId,
        jobId,
        email: inviteForm.email.trim().toLowerCase(),
        firstName: inviteForm.firstName.trim() || null,
        lastName: inviteForm.lastName.trim() || null,
        businessName: selectedVendor.name,
        vendorId: selectedVendor.id,
        projectRoleId: inviteProjectRoleId || null,
        projectRoleName: roles.find((role) => role.id === inviteProjectRoleId)?.name || null,
      });

      toast({
        title: "Invite sent",
        description: "Design professional invitation email sent.",
      });
      setInviteDialogOpen(false);
      setInviteForm({ firstName: '', lastName: '', email: '', vendorId: '' });
      setInviteProjectRoleId('');
      loadData();
    } catch (error: any) {
      console.error('Error sending design professional invite:', error);
      toast({
        title: "Invite failed",
        description: error?.message || "Failed to send design professional invitation.",
        variant: "destructive",
      });
    } finally {
      setInviteSubmitting(false);
    }
  };

  const resendDesignProfessionalInvite = async (invite: PendingDesignInvite) => {
    if (!companyScopeId || !invite.email) {
      toast({
        title: 'Email unavailable',
        description: 'This pending invite does not have an email address available to resend.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setResendingInviteId(invite.id);
      await sendDesignProfessionalJobInvite({
        companyId: companyScopeId,
        jobId,
        email: invite.email.trim().toLowerCase(),
        firstName: invite.first_name || null,
        lastName: invite.last_name || null,
        businessName: invite.business_name || null,
        projectRoleId: invite.project_role_id || null,
        projectRoleName: invite.project_role_name || null,
      });

      toast({
        title: 'Invite resent',
        description: `Resent design professional invite to ${invite.email}.`,
      });

      setPendingDesignInvites((prev) =>
        dedupePendingDesignInvites(
          prev.map((item) =>
            item.id === invite.id
              ? {
                  ...item,
                  requested_at: new Date().toISOString(),
                  email_status: 'sent',
                  email_delivered_at: null,
                  email_opened_at: null,
                  email_bounced_at: null,
                }
              : item,
          ),
        ),
      );

      await loadData();
    } catch (error: any) {
      console.error('Error resending design professional invite:', error);
      toast({
        title: 'Resend failed',
        description: error?.message || 'Failed to resend design professional invitation.',
        variant: 'destructive',
      });
    } finally {
      setResendingInviteId(null);
    }
  };

  const renderInviteEmailStatusBadge = (invite: PendingDesignInvite) => {
    if (invite.email_bounced_at) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <MailX className="h-3 w-3" />
          Bounced
        </Badge>
      );
    }

    if (invite.email_opened_at) {
      return (
        <Badge variant="info" className="flex items-center gap-1">
          <MailOpen className="h-3 w-3" />
          Opened
        </Badge>
      );
    }

    if (invite.email_delivered_at || invite.email_status === 'delivered') {
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

  const selectDesignProfessionalSearchResult = (result: DesignProfessionalAccountSearchResult) => {
    const matchedVendor = connectedVendors.find((vendor) => {
      const vendorName = String(vendor.name || '').trim().toLowerCase();
      const resultCompanyName = String(result.companyName || '').trim().toLowerCase();
      return Boolean(vendorName && resultCompanyName && vendorName === resultCompanyName);
    });

    setInviteForm({
      firstName: result.firstName || '',
      lastName: result.lastName || '',
      email: result.email || '',
      vendorId: matchedVendor?.id || '',
    });
    setDesignProfessionalSearch(result.email || result.displayName || result.companyName || '');
    setDesignProfessionalSearchResults([]);
  };

  const handleDirectoryChange = () => {
    setRefreshKey(prev => prev + 1);
  };

  const openAddDialog = () => {
    setEditingMember(null);
    setSelectedMemberId('');
    setSelectedRoleId('');
    setIsPrimaryContact(false);
    setNewDesignProfessionalRole('');
    setNewSubcontractorRole('');
    setShowDesignProfessionalRoleInput(false);
    setShowSubcontractorRoleInput(false);
    setAddMemberTab('inner_company');
    setDialogOpen(true);
  };

  const openEditDialog = (member: DirectoryMember) => {
    // Don't allow editing auto-populated members
    if (member.source && !['directory', 'company-user'].includes(member.source)) {
      toast({
        title: "Cannot edit",
        description: "This team member is auto-populated from job settings. Edit in Job Settings instead.",
        variant: "default",
      });
      return;
    }
    setEditingMember(member);
    setSelectedMemberId(member.id);
    setSelectedRoleId(member.project_role_id || '');
    setIsPrimaryContact(member.is_primary_contact);
    setNewDesignProfessionalRole('');
    setNewSubcontractorRole('');
    setShowDesignProfessionalRoleInput(false);
    setShowSubcontractorRoleInput(false);
    setDialogOpen(true);
  };

  const ensureProjectRoleId = async (selectedRoleValue: string) => {
    if (!selectedRoleValue) return null;
    if (!selectedRoleValue.startsWith('role-name:')) return selectedRoleValue;

    const roleName = selectedRoleValue.replace('role-name:', '').trim();
    if (!roleName || !companyScopeId) return null;

    const existingRole = roles.find((role) => String(role.name || '').toLowerCase() === roleName.toLowerCase());
    if (existingRole) return existingRole.id;

    const nextSortOrder = (roles?.length || 0) + 1;
    const { data, error } = await supabase
      .from('project_roles')
      .insert({
        company_id: companyScopeId,
        name: roleName,
        is_active: true,
        sort_order: nextSortOrder,
      })
      .select('id, name')
      .single();

    if (error) throw error;

    if (data) {
      setRoles((prev) => [...prev, data as ProjectRole]);
      return data.id;
    }

    return null;
  };

  const addSubcontractorRole = () => {
    const trimmed = newSubcontractorRole.trim();
    if (!trimmed) return;
    setSelectedRoleId(`role-name:${trimmed}`);
    setNewSubcontractorRole('');
    setShowSubcontractorRoleInput(false);
  };

  const addDesignProfessionalRole = () => {
    const trimmed = newDesignProfessionalRole.trim();
    if (!trimmed) return;
    setSelectedRoleId(`role-name:${trimmed}`);
    setNewDesignProfessionalRole('');
    setShowDesignProfessionalRoleInput(false);
  };

  const saveMember = async () => {
    if (!selectedMemberId && !editingMember) return;

    try {
      setSaving(true);
      const resolvedRoleId = await ensureProjectRoleId(selectedRoleId);

      if (!editingMember && selectedMemberId.startsWith('company-user:')) {
        const selectedUserId = selectedMemberId.replace('company-user:', '');
        const selectedCompanyUser = availableCompanyUsers.find((companyUser) => companyUser.user_id === selectedUserId);

        if (!selectedCompanyUser) {
          throw new Error('Selected company user not found');
        }

        const { error } = await supabase
          .from('job_project_directory')
          .insert({
            job_id: jobId,
            company_id: companyScopeId,
            name: selectedCompanyUser.name,
            email: selectedCompanyUser.email,
            phone: selectedCompanyUser.phone,
            company_name: selectedCompanyUser.company_name,
            linked_user_id: selectedUserId,
            is_project_team_member: true,
            project_role_id: resolvedRoleId || null,
            is_primary_contact: isPrimaryContact,
            created_by: user?.id || selectedUserId,
          });

        if (error) throw error;
      } else if (!editingMember && (selectedMemberId.startsWith('vendor:') || selectedMemberId.startsWith('design-vendor:'))) {
        const selectedVendorId = selectedMemberId.includes(':') ? selectedMemberId.split(':')[1] : '';
        const selectedVendor = connectedVendors.find((vendor) => vendor.id === selectedVendorId);

        if (!selectedVendor) {
          throw new Error('Selected vendor not found');
        }

        const { error } = await supabase
          .from('job_project_directory')
          .insert({
            job_id: jobId,
            company_id: companyScopeId,
            name: selectedVendor.name,
            email: selectedVendor.email,
            phone: selectedVendor.phone,
            company_name: selectedVendor.name,
            is_project_team_member: true,
            project_role_id: resolvedRoleId || null,
            is_primary_contact: isPrimaryContact,
            created_by: user?.id,
          });

        if (error) throw error;
      } else {
        const memberId = editingMember ? editingMember.id : selectedMemberId;

        const { error } = await supabase
          .from('job_project_directory')
          .update({
            is_project_team_member: true,
            project_role_id: resolvedRoleId || null,
            is_primary_contact: isPrimaryContact,
          })
          .eq('id', memberId);

        if (error) throw error;
      }

      toast({ title: editingMember ? "Team member updated" : "Added to project team" });
      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving team member:', error);
      toast({
        title: "Error",
        description: "Failed to save team member",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const sendVendorPortalInvite = async () => {
    const selectedVendorId = selectedMemberId.startsWith('vendor:') ? selectedMemberId.replace('vendor:', '') : '';
    const selectedVendor = connectedVendors.find((vendor) => vendor.id === selectedVendorId);

    if (!selectedVendor?.email) {
      toast({
        title: "No email",
        description: "This vendor does not have an email address configured.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingVendorInvite(true);
      const { data, error } = await supabase.functions.invoke('send-vendor-invite', {
        body: {
          vendorId: selectedVendor.id,
          vendorName: selectedVendor.name,
          vendorEmail: selectedVendor.email,
          companyId: currentCompany?.id,
          companyName: currentCompany?.name,
          invitedBy: user?.id,
          baseUrl: window.location.origin,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Invite sent",
        description: `Portal invitation sent to ${selectedVendor.email}.`,
      });
      setVendorInviteDialogOpen(false);
    } catch (error: any) {
      console.error('Error sending vendor invite:', error);
      toast({
        title: "Invite failed",
        description: error?.message || 'Failed to send vendor invitation.',
        variant: "destructive",
      });
    } finally {
      setSendingVendorInvite(false);
    }
  };

  const removeMember = async (member: DirectoryMember) => {
    if (!confirm(`Remove "${member.name}" from the project team?`)) return;

    try {
      if (member.source === 'pm') {
        const memberUserId = getMemberUserId(member);
        if (!memberUserId) throw new Error('Missing project manager user id');

        const { error } = await supabase
          .from('jobs')
          .update({ project_manager_user_id: null })
          .eq('id', jobId)
          .eq('project_manager_user_id', memberUserId);

        if (error) throw error;
      } else if (member.source === 'assistant_pm') {
        const memberUserId = getMemberUserId(member);
        if (!memberUserId) throw new Error('Missing assistant project manager user id');

        const { error } = await supabase
          .from('job_assistant_managers')
          .delete()
          .eq('job_id', jobId)
          .eq('user_id', memberUserId);

        if (error) throw error;
      } else if (member.source && !['directory', 'company-user'].includes(member.source)) {
        toast({
          title: "Cannot remove",
          description: "This team member is auto-populated from another assignment source.",
          variant: "default",
        });
        return;
      } else {
        const { error } = await supabase
          .from('job_project_directory')
          .update({ 
            is_project_team_member: false,
            project_role_id: null,
            is_primary_contact: false,
          })
          .eq('id', member.id);

        if (error) throw error;
      }

      toast({ title: "Removed from project team" });
      loadData();
    } catch (error) {
      console.error('Error removing team member:', error);
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getMemberUserId = (member: DirectoryMember) => {
    if (member.linked_user_id) return member.linked_user_id;
    if (member.source && member.source !== 'directory') {
      const parts = member.id.split('-');
      return parts.slice(1).join('-') || null;
    }
    return null;
  };

  const getRoleBadgeClasses = (roleName?: string | null, source?: DirectoryMember['source']) => {
    const normalizedRole = String(roleName || '').toLowerCase();
    if (source === 'pm' || normalizedRole.includes('project manager')) {
      return 'border-sky-200 bg-sky-100 text-sky-900';
    }
    if (source === 'assistant_pm' || normalizedRole.includes('assistant')) {
      return 'border-indigo-200 bg-indigo-100 text-indigo-900';
    }
    if (normalizedRole.includes('superintendent')) {
      return 'border-emerald-200 bg-emerald-100 text-emerald-900';
    }
    if (normalizedRole.includes('estimator')) {
      return 'border-violet-200 bg-violet-100 text-violet-900';
    }
    if (normalizedRole.includes('safety')) {
      return 'border-amber-200 bg-amber-100 text-amber-900';
    }
    if (source === 'employee' || normalizedRole.includes('employee') || normalizedRole.includes('member')) {
      return 'border-slate-200 bg-slate-100 text-slate-800';
    }
    if (normalizedRole.includes('architect') || normalizedRole.includes('engineer') || normalizedRole.includes('representative')) {
      return 'border-fuchsia-200 bg-fuchsia-100 text-fuchsia-900';
    }
    if (normalizedRole.includes('subcontractor') || normalizedRole.includes('plumbing') || normalizedRole.includes('electrical') || normalizedRole.includes('roofing') || normalizedRole.includes('framing')) {
      return 'border-orange-200 bg-orange-100 text-orange-900';
    }
    return 'border-muted bg-muted text-foreground';
  };

  // Extract linked user IDs for avatar resolution across both auto and directory members
  const teamUserIds = useMemo(() => {
    return Array.from(
      new Set(
        teamMembers
          .map((member) => getMemberUserId(member))
          .filter(Boolean) as string[]
      )
    );
  }, [teamMembers]);

  const { avatarMap } = useUserAvatars(teamUserIds);

  const getResolvedMemberRoleName = (member: DirectoryMember) => {
    const explicitRoleName = String(member.project_role?.name || '').trim();
    if (explicitRoleName) return explicitRoleName;

    switch (member.source) {
      case 'pm':
        return 'Project Manager';
      case 'assistant_pm':
        return 'Assistant Project Manager';
      case 'employee':
        return 'Employee';
      default:
        return 'Team Member';
    }
  };

  const getExternalMemberType = (member: DirectoryMember): 'design_professional' | 'subcontractor' | null => {
    const memberEmail = String(member.email || '').toLowerCase();
    const memberCompany = String(member.company_name || '').toLowerCase();
    const linkedUserId = String(member.linked_user_id || '');

    if (linkedUserId) {
      const linkedCompanyUser = availableCompanyUserById.get(linkedUserId);
      if (linkedCompanyUser) {
        if (linkedCompanyUser.role === 'design_professional') {
          return 'design_professional';
        }
        return null;
      }
    }

    const matchingDesignProfessional = designProfessionalVendors.find((vendor) => {
      const vendorEmail = String(vendor.email || '').toLowerCase();
      const vendorName = String(vendor.name || '').toLowerCase();
      return (vendorEmail && vendorEmail === memberEmail) || (vendorName && vendorName === memberCompany);
    });

    if (matchingDesignProfessional) {
      return 'design_professional';
    }

    const matchingVendor = subcontractorVendors.find((vendor) => {
      const vendorEmail = String(vendor.email || '').toLowerCase();
      const vendorName = String(vendor.name || '').toLowerCase();
      return (vendorEmail && vendorEmail === memberEmail) || (vendorName && vendorName === memberCompany);
    });

    if (matchingVendor) {
      return 'subcontractor';
    }

    return null;
  };

  const getResolvedMemberCompanyName = (member: DirectoryMember) => {
    const externalType = getExternalMemberType(member);
    if (!externalType) {
      return primaryGroupCompanyName;
    }

    const linkedUserId = String(member.linked_user_id || '');
    if (linkedUserId) {
      const linkedCompanyUser = availableCompanyUserById.get(linkedUserId);
      if (linkedCompanyUser?.company_name) {
        return linkedCompanyUser.company_name;
      }
    }
    return member.company_name || 'External Company';
  };

  const groupedTeamMembers = useMemo(() => {
    const companyMap = new Map<
      string,
      {
        companyName: string;
        roleGroups: Map<string, DirectoryMember[]>;
      }
    >();

    [...teamMembers]
      .sort((a, b) => {
        const companyCompare = getResolvedMemberCompanyName(a).localeCompare(getResolvedMemberCompanyName(b));
        if (companyCompare !== 0) return companyCompare;

        const roleCompare = getResolvedMemberRoleName(a).localeCompare(getResolvedMemberRoleName(b));
        if (roleCompare !== 0) return roleCompare;

        return a.name.localeCompare(b.name);
      })
      .forEach((member) => {
        const companyName = getResolvedMemberCompanyName(member);
        const roleName = getResolvedMemberRoleName(member);

        if (!companyMap.has(companyName)) {
          companyMap.set(companyName, {
            companyName,
            roleGroups: new Map<string, DirectoryMember[]>(),
          });
        }

        const companyGroup = companyMap.get(companyName)!;
        if (!companyGroup.roleGroups.has(roleName)) {
          companyGroup.roleGroups.set(roleName, []);
        }

        companyGroup.roleGroups.get(roleName)!.push(member);
      });

    return Array.from(companyMap.values()).map((companyGroup) => ({
      companyName: companyGroup.companyName,
      roleGroups: Array.from(companyGroup.roleGroups.entries()).map(([roleName, members]) => ({
        roleName,
        members,
      })),
    }));
  }, [teamMembers, availableCompanyUserById, designProfessionalVendors, subcontractorVendors, primaryGroupCompanyName]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground"><span className="loading-dots">Loading project team</span></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Project Team
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog} size="sm" disabled={availableMembers.length === 0 && !editingMember}>
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingMember ? 'Edit Team Member' : 'Add to Project Team'}
                </DialogTitle>
                <DialogDescription>
                  {editingMember ? 'Update role and settings' : 'Choose who you are adding and then assign their project role.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {!editingMember && (
                  <Tabs value={addMemberTab} onValueChange={(value) => {
                    setAddMemberTab(value as 'inner_company' | 'design_professional' | 'subcontractor');
                    setSelectedMemberId('');
                    setSelectedRoleId('');
                    setIsPrimaryContact(false);
                  }} className="space-y-4">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="inner_company">Inner Company</TabsTrigger>
                      <TabsTrigger value="design_professional">Design Professional</TabsTrigger>
                      <TabsTrigger value="subcontractor">Subcontractor</TabsTrigger>
                    </TabsList>

                    <TabsContent value="inner_company" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Company Team Member</Label>
                        <p className="text-xs text-muted-foreground">
                          Internal company roles belong here. Regular field employees will appear on the project team once they are assigned this job in punch clock and have at least one cost code on this job available to punch against.
                        </p>
                        {innerCompanyAvailableMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No internal company users are available to add right now.
                          </p>
                        ) : (
                          <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose an internal company user..." />
                            </SelectTrigger>
                            <SelectContent>
                              {innerCompanyAvailableMembers.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.name} {member.project_role?.name ? `• ${currentCompany?.name || 'Company'} - ${member.project_role.name}` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Company Role on This Job</Label>
                        <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a company role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {companyProjectRoles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {(currentCompany?.name || 'Company')} - {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>

                    <TabsContent value="design_professional" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Connected Design Professionals</Label>
                        {designProfessionalVendors.length === 0 && designProfessionalCompanyUsers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No design professional companies are connected yet.
                          </p>
                        ) : (
                          <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a connected design professional..." />
                            </SelectTrigger>
                            <SelectContent>
                              {designProfessionalCompanyUsers.map((companyUser) => (
                                <SelectItem key={companyUser.user_id} value={`company-user:${companyUser.user_id}`}>
                                  {companyUser.name}{companyUser.email ? ` • ${companyUser.email}` : ''} • {currentCompany?.name || 'Company'}
                                </SelectItem>
                              ))}
                              {designProfessionalVendors.map((vendor) => (
                                <SelectItem key={vendor.id} value={`design-vendor:${vendor.id}`}>
                                  {vendor.name}{vendor.email ? ` • ${vendor.email}` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Design Professional Role</Label>
                        <Select
                          value={showDesignProfessionalRoleInput ? ADD_DESIGN_PROFESSIONAL_ROLE_VALUE : selectedRoleId}
                          onValueChange={(value) => {
                            if (value === ADD_DESIGN_PROFESSIONAL_ROLE_VALUE) {
                              setShowDesignProfessionalRoleInput(true);
                              setSelectedRoleId('');
                              return;
                            }
                            setShowDesignProfessionalRoleInput(false);
                            setSelectedRoleId(value);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a design professional role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {designProfessionalProjectRoles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                            <SelectItem value={ADD_DESIGN_PROFESSIONAL_ROLE_VALUE}>
                              + Add Role
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {showDesignProfessionalRoleInput && (
                        <div className="space-y-2">
                          <Label>New Design Professional Role</Label>
                          <div className="flex gap-2">
                            <Input
                              value={newDesignProfessionalRole}
                              onChange={(e) => setNewDesignProfessionalRole(e.target.value)}
                              placeholder="Add a design professional role..."
                            />
                            <Button type="button" variant="outline" onClick={addDesignProfessionalRole} disabled={!newDesignProfessionalRole.trim()}>
                              Add Role
                            </Button>
                          </div>
                        </div>
                      )}
                      {canInviteDesignProfessional ? (
                        <div className="rounded-md border border-dashed p-3 space-y-2">
                          <div>
                            <p className="text-sm font-medium">Invite Design Professional</p>
                            <p className="text-xs text-muted-foreground">
                              Invite architects, engineers, owner representatives, or expediters if they are not already connected.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDialogOpen(false);
                              setInviteDialogOpen(true);
                            }}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Invite Design Professional
                          </Button>
                        </div>
                      ) : null}
                    </TabsContent>

                    <TabsContent value="subcontractor" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Connected Vendor Accounts</Label>
                        {subcontractorVendors.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No vendor accounts are connected yet.
                          </p>
                        ) : (
                          <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a subcontractor or vendor..." />
                            </SelectTrigger>
                            <SelectContent>
                              {subcontractorVendors.map((vendor) => (
                                <SelectItem key={vendor.id} value={`vendor:${vendor.id}`}>
                                  {vendor.name}{vendor.vendor_type ? ` • ${vendor.vendor_type}` : ''}{vendor.email ? ` • ${vendor.email}` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Subcontractor Role</Label>
                        <Select
                          value={showSubcontractorRoleInput ? ADD_SUBCONTRACTOR_ROLE_VALUE : selectedRoleId}
                          onValueChange={(value) => {
                            if (value === ADD_SUBCONTRACTOR_ROLE_VALUE) {
                              setShowSubcontractorRoleInput(true);
                              setSelectedRoleId('');
                              return;
                            }
                            setShowSubcontractorRoleInput(false);
                            setSelectedRoleId(value);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a subcontractor role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {subcontractorProjectRoles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                            <SelectItem value={ADD_SUBCONTRACTOR_ROLE_VALUE}>
                              + Add Role
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {showSubcontractorRoleInput && (
                        <div className="space-y-2">
                          <Label>New Subcontractor Role</Label>
                          <div className="flex gap-2">
                            <Input
                              value={newSubcontractorRole}
                              onChange={(e) => setNewSubcontractorRole(e.target.value)}
                              placeholder="Add a subcontractor role..."
                            />
                            <Button type="button" variant="outline" onClick={addSubcontractorRole} disabled={!newSubcontractorRole.trim()}>
                              Add Role
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="rounded-md border border-dashed p-3 space-y-2">
                        <div>
                          <p className="text-sm font-medium">Invite Vendor to Sign Up</p>
                          <p className="text-xs text-muted-foreground">
                            Send a vendor portal invite to the selected connected vendor account.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!selectedMemberId.startsWith('vendor:')}
                          onClick={() => setVendorInviteDialogOpen(true)}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Invite Vendor
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}

                {editingMember && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium">{editingMember.name}</p>
                    {editingMember.company_name && (
                      <p className="text-sm text-muted-foreground">{editingMember.company_name}</p>
                    )}
                  </div>
                )}
                {editingMember && (
                  <div className="space-y-2">
                    <Label>Project Role</Label>
                    <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    id="primary"
                    checked={isPrimaryContact}
                    onCheckedChange={setIsPrimaryContact}
                  />
                  <Label htmlFor="primary">Primary Contact</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={saveMember} 
                  disabled={saving || (!editingMember && !selectedMemberId)}
                >
                  {saving ? 'Saving...' : editingMember ? 'Update' : 'Add to Team'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>}
          {!readOnly && canInviteDesignProfessional && (
            <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
              setInviteDialogOpen(open);
              if (!open) {
                setDesignProfessionalSearch('');
                setDesignProfessionalSearchResults([]);
              }
            }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite Design Professional</DialogTitle>
                  <DialogDescription>
                    Send a job-linked signup invitation. Once approved, this user will be assigned to this job.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1">
                    <Label>Search Existing Design Pro Accounts</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={designProfessionalSearch}
                        onChange={(e) => setDesignProfessionalSearch(e.target.value)}
                        placeholder="Search by firm, name, or email"
                        className="pl-9"
                      />
                      {designProfessionalSearchLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                    </div>
                    {designProfessionalSearch.trim().length >= 2 && (
                      <div className="rounded-md border bg-background">
                        {designProfessionalSearchResults.length > 0 ? (
                          <div className="max-h-56 overflow-y-auto p-1">
                            {designProfessionalSearchResults.map((result) => (
                              <button
                                key={`${result.userId || result.companyId || result.email}`}
                                type="button"
                                onClick={() => selectDesignProfessionalSearchResult(result)}
                                className="flex w-full items-start justify-between rounded-md px-3 py-2 text-left hover:bg-muted"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{result.displayName}</p>
                                  <p className="truncate text-xs text-muted-foreground">{result.companyName || 'Design Pro Account'}</p>
                                  <p className="truncate text-xs text-muted-foreground">{result.email}</p>
                                </div>
                                <Badge variant="outline" className="ml-3 shrink-0">Has Account</Badge>
                              </button>
                            ))}
                          </div>
                        ) : !designProfessionalSearchLoading ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            No existing DesignProLYNK account found. You can still send a new invite below.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>First Name</Label>
                      <Input
                        value={inviteForm.firstName}
                        onChange={(e) => setInviteForm((prev) => ({ ...prev, firstName: e.target.value }))}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Last Name</Label>
                      <Input
                        value={inviteForm.lastName}
                        onChange={(e) => setInviteForm((prev) => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="name@company.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Company *</Label>
                    <Select
                      value={inviteForm.vendorId}
                      onValueChange={(value) => setInviteForm((prev) => ({ ...prev, vendorId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a vendor company..." />
                      </SelectTrigger>
                      <SelectContent>
                        {connectedVendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      This company name is used to group invited design professionals together on the BuilderLYNK side.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label>Project Role</Label>
                    <Select value={inviteProjectRoleId} onValueChange={setInviteProjectRoleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a design professional role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {designProfessionalProjectRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
                  <Button onClick={sendDesignProfessionalInvite} disabled={inviteSubmitting || !inviteForm.email.trim() || !inviteForm.vendorId}>
                    {inviteSubmitting ? 'Sending...' : 'Send Invite'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {!readOnly && <Dialog open={vendorInviteDialogOpen} onOpenChange={setVendorInviteDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Invite Vendor to Portal</DialogTitle>
                <DialogDescription>
                  Send a vendor portal invitation to the selected subcontractor account.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2 text-sm">
                {(() => {
                  const selectedVendorId = selectedMemberId.startsWith('vendor:') ? selectedMemberId.replace('vendor:', '') : '';
                  const selectedVendor = connectedVendors.find((vendor) => vendor.id === selectedVendorId);
                  if (!selectedVendor) {
                    return <p className="text-muted-foreground">Select a connected vendor first.</p>;
                  }
                  return (
                    <div className="space-y-1">
                      <p className="font-medium">{selectedVendor.name}</p>
                      <p className="text-muted-foreground">{selectedVendor.email || 'No email configured'}</p>
                    </div>
                  );
                })()}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setVendorInviteDialogOpen(false)}>Cancel</Button>
                <Button onClick={sendVendorPortalInvite} disabled={sendingVendorInvite || !selectedMemberId.startsWith('vendor:')}>
                  {sendingVendorInvite ? 'Sending...' : 'Send Invite'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>}
        </div>
      </CardHeader>
      <CardContent>
        {pendingDesignInvites.length > 0 && (
          <div className="mb-4 rounded-lg bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Awaiting Design Professional Acceptance</p>
              <Badge variant="warning">{pendingDesignInvites.length}</Badge>
            </div>
            {pendingDesignInvites.slice(0, 5).map((invite) => (
              <div key={invite.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{invite.display_name || 'Pending user'}</span>
                  {invite.business_name ? <span className="text-muted-foreground"> • {invite.business_name}</span> : null}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {invite.email ? <span className="text-xs text-muted-foreground">{invite.email}</span> : null}
                    {renderInviteEmailStatusBadge(invite)}
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-3">
                  <span className="text-muted-foreground">{new Date(invite.requested_at).toLocaleDateString()}</span>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={!invite.email || resendingInviteId === invite.id}
                      onClick={() => resendDesignProfessionalInvite(invite)}
                    >
                      {resendingInviteId === invite.id ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Sending
                        </>
                      ) : (
                        'Resend'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              These project invites become active automatically as soon as the design professional accepts them.
            </p>
          </div>
        )}

        {teamMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No team members assigned yet.</p>
            <p className="text-sm">
              {!readOnly && availableMembers.length > 0 
                ? 'Click "Add Member" to assign company users or job contacts.'
                : 'No eligible people are available to add right now.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(() => {
              const renderMemberRow = (member: DirectoryMember) => (
                <div
                  key={member.id}
                  className="group flex items-start gap-2.5 py-2 hover:bg-muted/20 px-2 rounded transition-colors"
                >
                  {(() => {
                    const linkedUserId = getMemberUserId(member);
                    let resolvedUrl = member.avatar_url;
                    if (linkedUserId && avatarMap[linkedUserId] !== undefined) {
                      resolvedUrl = avatarMap[linkedUserId];
                    }
                    return (
                      <UserAvatar
                        src={resolvedUrl}
                        name={member.name}
                        className="h-8 w-8 shrink-0"
                        fallbackClassName="bg-primary/10 text-primary text-sm"
                      />
                    );
                  })()}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                          <span className="font-medium leading-tight truncate">{member.name}</span>
                          {member.is_primary_contact && (
                            <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" fill="currentColor" />
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <div className="truncate min-w-0">
                            {member.email ? (
                              <a href={`mailto:${member.email}`} className="hover:text-primary inline-flex items-center gap-1">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate">{member.email}</span>
                              </a>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="h-3 w-3 shrink-0" />
                                No email
                              </span>
                            )}
                          </div>
                          <div className="truncate min-w-0">
                            {member.phone ? (
                              <a href={`tel:${member.phone}`} className="hover:text-primary inline-flex items-center gap-1">
                                <Phone className="h-3 w-3 shrink-0" />
                                <span className="truncate">{member.phone}</span>
                              </a>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3 w-3 shrink-0" />
                                No phone
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="hidden md:flex items-center justify-end gap-2 shrink-0 min-w-[220px]">
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border">
                          {getResolvedMemberCompanyName(member)}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border ${getRoleBadgeClasses(getResolvedMemberRoleName(member), member.source)}`}>
                          {getResolvedMemberRoleName(member)}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-1 flex md:hidden items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 border">
                        {getResolvedMemberCompanyName(member)}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border ${getRoleBadgeClasses(getResolvedMemberRoleName(member), member.source)}`}>
                        {getResolvedMemberRoleName(member)}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!readOnly && (!member.source || ['directory', 'company-user', 'pm', 'assistant_pm'].includes(member.source)) ? (
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        {(!member.source || ['directory', 'company-user'].includes(member.source)) && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(member)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => removeMember(member)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="w-7" />
                    )}
                  </div>
                </div>
              );

              return (
                <div className="w-full space-y-3">
                  {groupedTeamMembers.map((companyGroup) => (
                    <div key={companyGroup.companyName} className="rounded-lg border bg-background/40">
                      <div className="flex items-center gap-2 border-b px-3 py-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{companyGroup.companyName}</span>
                      </div>
                      <div className="px-2 py-1">
                        {companyGroup.roleGroups.map((roleGroup) => (
                          <div key={`${companyGroup.companyName}-${roleGroup.roleName}`} className="divide-y">
                            <div className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {roleGroup.roleName}
                            </div>
                            {roleGroup.members.map(renderMemberRow)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
