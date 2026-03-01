import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Users, UserPlus, Trash2, Edit, Plus, Upload, Camera, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import CompanyAccessApproval from '@/components/CompanyAccessApproval';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import DragDropUpload from '@/components/DragDropUpload';

interface CompanyUser {
  id: string;
  user_id: string;
  company_id: string;
  role: string;
  is_active: boolean;
  granted_at: string;
  profile?: {
    display_name?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    email?: string;
  };
}

interface OrganizationCompany {
  id: string;
  name: string;
  display_name?: string | null;
  logo_url?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

interface OrganizationUserProfile {
  user_id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
}

interface CompanyDirectoryUser {
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
}

export default function CompanyManagement() {
  const { currentCompany, userCompanies, refreshCompanies } = useCompany();
  const { user } = useAuth();
  const { currentTenant, tenantMember } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [organizationCompanies, setOrganizationCompanies] = useState<OrganizationCompany[]>([]);
  const [showManageUsersDialog, setShowManageUsersDialog] = useState(false);
  const [showAssignExistingUserDialog, setShowAssignExistingUserDialog] = useState(false);
  const [selectedCompanyForUsers, setSelectedCompanyForUsers] = useState<OrganizationCompany | null>(null);
  const [selectedExistingUserId, setSelectedExistingUserId] = useState<string>('');
  const [assignUserRole, setAssignUserRole] = useState<string>('employee');
  const [existingUserSearch, setExistingUserSearch] = useState('');
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [eligibleOrganizationUsers, setEligibleOrganizationUsers] = useState<OrganizationUserProfile[]>([]);
  const [loadingCompanyUsers, setLoadingCompanyUsers] = useState(false);
  const [assigningUser, setAssigningUser] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<CompanyUser | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showEditCompanyDialog, setShowEditCompanyDialog] = useState(false);
  const [showCompanyDetailDialog, setShowCompanyDetailDialog] = useState(false);
  const [selectedCompanyDetail, setSelectedCompanyDetail] = useState<OrganizationCompany | null>(null);
  const [showCreateCompanyDialog, setShowCreateCompanyDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('employee');
  const [companyForm, setCompanyForm] = useState({
    name: '',
    display_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    website: ''
  });
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: '',
    display_name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    website: ''
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Get current user's role in this company
  const currentUserCompany = userCompanies.find(uc => uc.company_id === currentCompany?.id);
  const isCompanyAdmin = currentUserCompany?.role === 'admin' || currentUserCompany?.role === 'controller';
  const isOwnerOrAdmin = currentUserCompany?.role === 'admin';

  // Helper function to get user IDs that have access to a company
  const getCompanyUserIds = async (companyId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('user_company_access')
      .select('user_id')
      .eq('company_id', companyId)
      .eq('is_active', true);
    
    if (error) {
      console.error('Error fetching company user IDs:', error);
      return [];
    }
    
    return data?.map(item => item.user_id) || [];
  };

  const fetchCompanyUsers = async () => {
    if (!currentCompany) return;

    try {
      console.log('Fetching users for company:', currentCompany.id);
      
      // Fetch regular users from user_company_access
      const { data: userAccessData, error: accessError } = await supabase
        .from('user_company_access')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      console.log('User access data:', userAccessData, 'error:', accessError);

      if (accessError) throw accessError;

      let combinedUsers: CompanyUser[] = [];

      // Process regular users if they exist
      if (userAccessData && userAccessData.length > 0) {
        // Get user IDs to fetch profiles with role
        const userIds = userAccessData.map(access => access.user_id);
        console.log('User IDs to fetch:', userIds);
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, display_name, first_name, last_name, role')
          .in('user_id', userIds);

        console.log('Profiles data:', profilesData, 'error:', profilesError);

        if (profilesError) throw profilesError;

        // Combine the regular user data
        const regularUsers = userAccessData.map(access => {
          const profile = profilesData?.find(profile => profile.user_id === access.user_id);
          return {
            ...access,
            role: profile?.role || access.role,
            profile
          };
        });

        combinedUsers = [...regularUsers];
      }

      setUsers(combinedUsers);
    } catch (error) {
      console.error('Error fetching company users:', error);
      toast({
        title: "Error",
        description: "Failed to load company users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizationCompanies = async () => {
    if (!currentTenant?.id) return;
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id,name,display_name,logo_url,created_by,created_at,address,city,state,zip_code,phone,email,website')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('display_name', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setOrganizationCompanies((data || []) as OrganizationCompany[]);
    } catch (error) {
      console.error('Error fetching organization companies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load organization companies.',
        variant: 'destructive',
      });
    }
  };

  const loadCompanyUsersForManagement = async (companyId: string) => {
    setLoadingCompanyUsers(true);
    try {
      const { data: accessRows, error: accessError } = await supabase
        .from('user_company_access')
        .select('id,user_id,company_id,role,is_active,granted_at')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('granted_at', { ascending: false });

      if (accessError) throw accessError;

      const userIds = (accessRows || []).map((row) => row.user_id);
      let profiles: OrganizationUserProfile[] = [];
      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('user_id,display_name,first_name,last_name,avatar_url,email')
          .in('user_id', userIds);
        if (profileError) throw profileError;
        profiles = (profileRows || []) as OrganizationUserProfile[];
      }

      let directoryUsers: CompanyDirectoryUser[] = [];
      const { data: directoryRows, error: directoryError } = await supabase
        .rpc('get_company_directory', { p_company_id: companyId });
      if (!directoryError) {
        directoryUsers = (directoryRows || []) as CompanyDirectoryUser[];
      } else {
        console.warn('Company directory lookup failed, using profile fallback only.', directoryError);
      }

      const merged: CompanyUser[] = (accessRows || []).map((row) => {
        const profile = profiles.find((p) => p.user_id === row.user_id);
        const directoryProfile = directoryUsers.find((d) => d.user_id === row.user_id);
        return {
          ...row,
          profile: directoryProfile
            ? {
                display_name: directoryProfile.display_name || undefined,
                first_name: directoryProfile.first_name || undefined,
                last_name: directoryProfile.last_name || undefined,
                avatar_url: directoryProfile.avatar_url || undefined,
                email: undefined,
              }
            : profile
            ? {
                display_name: profile.display_name || undefined,
                first_name: profile.first_name || undefined,
                last_name: profile.last_name || undefined,
                avatar_url: profile.avatar_url || undefined,
                email: profile.email || undefined,
              }
            : undefined,
        };
      });
      setCompanyUsers(merged);
    } catch (error) {
      console.error('Error loading company users for management:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users for this company.',
        variant: 'destructive',
      });
    } finally {
      setLoadingCompanyUsers(false);
    }
  };

  const loadEligibleOrganizationUsers = async (companyId: string) => {
    try {
      const orgCompanyIds = organizationCompanies.map((c) => c.id);
      if (orgCompanyIds.length === 0) {
        setEligibleOrganizationUsers([]);
        return;
      }

      const { data: accessRows, error: accessError } = await supabase
        .from('user_company_access')
        .select('user_id,company_id,is_active')
        .in('company_id', orgCompanyIds)
        .eq('is_active', true);

      if (accessError) throw accessError;

      const byUser = new Map<string, Set<string>>();
      (accessRows || []).forEach((row) => {
        const current = byUser.get(row.user_id) || new Set<string>();
        current.add(row.company_id);
        byUser.set(row.user_id, current);
      });

      const eligibleIds = Array.from(byUser.entries())
        .filter(([, companySet]) => !companySet.has(companyId) && companySet.size > 0)
        .map(([userId]) => userId);

      if (eligibleIds.length === 0) {
        setEligibleOrganizationUsers([]);
        return;
      }

      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('user_id,display_name,first_name,last_name,avatar_url,email')
        .in('user_id', eligibleIds);
      if (profileError) throw profileError;

      const profileMap = new Map<string, OrganizationUserProfile>();
      ((profileRows || []) as OrganizationUserProfile[]).forEach((p) => profileMap.set(p.user_id, p));

      const directoryMap = new Map<string, OrganizationUserProfile>();
      await Promise.all(
        orgCompanyIds.map(async (companyIdForDirectory) => {
          const { data: directoryRows, error: directoryError } = await supabase
            .rpc('get_company_directory', { p_company_id: companyIdForDirectory });
          if (directoryError || !directoryRows) return;
          (directoryRows as CompanyDirectoryUser[]).forEach((d) => {
            if (!directoryMap.has(d.user_id)) {
              directoryMap.set(d.user_id, {
                user_id: d.user_id,
                display_name: d.display_name || undefined,
                first_name: d.first_name || undefined,
                last_name: d.last_name || undefined,
                avatar_url: d.avatar_url || undefined,
              });
            }
          });
        })
      );

      const mergedEligible = eligibleIds.map((userId) => {
        return profileMap.get(userId) || directoryMap.get(userId) || { user_id: userId };
      });

      setEligibleOrganizationUsers(mergedEligible);
    } catch (error) {
      console.error('Error loading eligible organization users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load eligible users.',
        variant: 'destructive',
      });
    }
  };

  const openManageUsersForCompany = async (company: OrganizationCompany) => {
    setSelectedCompanyForUsers(company);
    setShowManageUsersDialog(true);
    setSelectedExistingUserId('');
    setAssignUserRole('employee');
    setExistingUserSearch('');
    await Promise.all([
      loadCompanyUsersForManagement(company.id),
      loadEligibleOrganizationUsers(company.id),
    ]);
  };

  const handleAssignExistingUserToCompany = async () => {
    if (!selectedCompanyForUsers || !selectedExistingUserId || !user?.id) return;
    setAssigningUser(true);
    try {
      const { data: existing, error: existingError } = await supabase
        .from('user_company_access')
        .select('id')
        .eq('company_id', selectedCompanyForUsers.id)
        .eq('user_id', selectedExistingUserId)
        .maybeSingle();

      if (existingError && existingError.code !== 'PGRST116') throw existingError;

      if (existing?.id) {
        const { error: reactivateError } = await supabase
          .from('user_company_access')
          .update({
            is_active: true,
            role: assignUserRole,
            granted_by: user.id,
          })
          .eq('id', existing.id);
        if (reactivateError) throw reactivateError;
      } else {
        const { error: insertError } = await supabase
          .from('user_company_access')
          .insert({
            company_id: selectedCompanyForUsers.id,
            user_id: selectedExistingUserId,
            role: assignUserRole,
            granted_by: user.id,
            is_active: true,
          });
        if (insertError) throw insertError;
      }

      toast({
        title: 'User added',
        description: 'User was added to the selected company.',
      });

      await Promise.all([
        loadCompanyUsersForManagement(selectedCompanyForUsers.id),
        loadEligibleOrganizationUsers(selectedCompanyForUsers.id),
      ]);
      setShowAssignExistingUserDialog(false);
    } catch (error) {
      console.error('Error assigning existing user to company:', error);
      toast({
        title: 'Error',
        description: 'Failed to add user to company.',
        variant: 'destructive',
      });
    } finally {
      setAssigningUser(false);
    }
  };

  const handleRemoveUserFromManagedCompany = async (companyId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('user_company_access')
        .update({ is_active: false })
        .eq('company_id', companyId)
        .eq('user_id', userId);
      if (error) throw error;

      toast({
        title: 'User removed',
        description: 'User access to this company was removed.',
      });

      await Promise.all([
        loadCompanyUsersForManagement(companyId),
        loadEligibleOrganizationUsers(companyId),
      ]);
    } catch (error) {
      console.error('Error removing user from managed company:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove user from company.',
        variant: 'destructive',
      });
    }
  };

  const handleAddUser = async () => {
    if (!currentCompany || !newUserEmail.trim()) return;

    try {
      // First, check if user exists in the system
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', newUserEmail); // This would need to be email lookup

      if (profileError) throw profileError;

      // For now, show a message that user invitation system needs to be implemented
      toast({
        title: "Feature in development",
        description: "User invitation system will be implemented in the next update. For now, users need to sign up first.",
        variant: "default"
      });

      setShowAddUserDialog(false);
      setNewUserEmail('');
      setNewUserRole('employee');
    } catch (error) {
      console.error('Error adding user:', error);
      toast({
        title: "Error",
        description: "Failed to add user to company",
        variant: "destructive"
      });
    }
  };

  const handleCreateCompany = async () => {
    if (!user || !newCompanyForm.name.trim()) return;

    try {
      // Ensure user has a tenant before creating company
      if (!currentTenant) {
        toast({
          title: "Error",
          description: "You must belong to an organization to create a company",
          variant: "destructive"
        });
        return;
      }

      // Create the company within the user's tenant
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          ...newCompanyForm,
          created_by: user.id,
          tenant_id: currentTenant.id
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Grant admin access to the creator
      const { error: accessError } = await supabase
        .from('user_company_access')
        .insert({
          user_id: user.id,
          company_id: companyData.id,
          role: 'admin',
          granted_by: user.id
        });

      if (accessError) throw accessError;

      // Update the current user's profile to set the new company as current
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ current_company_id: companyData.id })
        .eq('user_id', user.id);

      if (profileError) {
        console.warn('Failed to update current company:', profileError);
      }

      toast({
        title: "Success",
        description: "Company created successfully and you've been added as admin"
      });

      setShowCreateCompanyDialog(false);
      setNewCompanyForm({
        name: '',
        display_name: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        phone: '',
        email: '',
        website: ''
      });
      
      await refreshCompanies();
    } catch (error) {
      console.error('Error creating company:', error);
      toast({
        title: "Error",
        description: "Failed to create company",
        variant: "destructive"
      });
    }
  };

  const handleUpdateCompany = async () => {
    const companyToEditId = selectedCompanyDetail?.id || currentCompany?.id;
    if (!companyToEditId) return;

    try {
      const { error } = await supabase
        .from('companies')
        .update(companyForm)
        .eq('id', companyToEditId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company information updated successfully"
      });

      setShowEditCompanyDialog(false);
      setShowCompanyDetailDialog(false);
      setSelectedCompanyDetail(null);
      await refreshCompanies();
      await fetchOrganizationCompanies();
    } catch (error) {
      console.error('Error updating company:', error);
      toast({
        title: "Error",
        description: "Failed to update company information",
        variant: "destructive"
      });
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!currentCompany) return;

    try {
      const { error } = await supabase
        .from('user_company_access')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('company_id', currentCompany.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User removed from company"
      });

      fetchCompanyUsers();
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: "Failed to remove user from company",
        variant: "destructive"
      });
    }
  };

  const uploadCompanyLogoFile = async (file?: File | null) => {
    if (!file || !currentCompany) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 2MB",
        variant: "destructive"
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    setUploadingLogo(true);

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany.id}/company-logo-${Date.now()}.${fileExt}`;
      
      // Upload to company-logos bucket
      const { data, error } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file);

      if (error) throw error;

      // Get the storage path (not full URL)
      const logoPath = `company-logos/${fileName}`;

      // Update company record with logo path
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: logoPath })
        .eq('id', currentCompany.id);

      if (updateError) throw updateError;

      // Refresh company data to show new logo
      await refreshCompanies();
      
      toast({
        title: "Success", 
        description: "Company logo updated successfully"
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Error",
        description: "Failed to upload company logo",
        variant: "destructive"
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await uploadCompanyLogoFile(event.target.files?.[0]);
    event.target.value = '';
  };

  useEffect(() => {
    if (currentCompany) {
      fetchCompanyUsers();
      setCompanyForm({
        name: currentCompany.name || '',
        display_name: currentCompany.display_name || '',
        address: currentCompany.address || '',
        city: currentCompany.city || '',
        state: currentCompany.state || '',
        zip_code: currentCompany.zip_code || '',
        phone: currentCompany.phone || '',
        email: currentCompany.email || '',
        website: currentCompany.website || ''
      });
    }
  }, [currentCompany]);

  useEffect(() => {
    void fetchOrganizationCompanies();
  }, [currentTenant?.id]);

  const openCompanyDetail = (company: OrganizationCompany) => {
    setSelectedCompanyDetail(company);
    setCompanyForm({
      name: company.name || '',
      display_name: company.display_name || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      zip_code: company.zip_code || '',
      phone: company.phone || '',
      email: company.email || '',
      website: company.website || ''
    });
    setShowCompanyDetailDialog(true);
  };

  const startEditFromDetail = () => {
    setShowCompanyDetailDialog(false);
    setShowEditCompanyDialog(true);
  };

  const getProfileDisplayName = (profile?: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  }) => {
    if (!profile) return 'Unknown User';
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
    return profile.display_name || fullName || profile.email || 'Unknown User';
  };

  const getDisplayNameForCompanyUser = (companyUser: CompanyUser) => {
    const baseName = getProfileDisplayName(companyUser.profile);
    if (baseName !== 'Unknown User') return baseName;
    return `Unknown User (${companyUser.user_id.slice(0, 8)})`;
  };

  const filteredEligibleUsers = eligibleOrganizationUsers.filter((profile) => {
    const name = getProfileDisplayName(profile).toLowerCase();
    const needle = existingUserSearch.trim().toLowerCase();
    if (!needle) return true;
    return name.includes(needle) || profile.user_id.toLowerCase().includes(needle);
  });

  if (!currentCompany && userCompanies.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>No Companies Found</CardTitle>
            <CardDescription>
              You don't have access to any companies yet. Create your first company to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowCreateCompanyDialog(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Company
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>No Company Selected</CardTitle>
            <CardDescription>
              Please select a company to manage its settings and users.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Organization Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowCreateCompanyDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Company
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Portfolio
          </CardTitle>
          <CardDescription>
            Manage the companies you belong to and choose the active company.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {organizationCompanies.map((companyItem) => {
              const accessForCompany = userCompanies.find((access) => access.company_id === companyItem.id);
              const isActive = companyItem.id === currentCompany.id;
              return (
                <div
                  key={companyItem.id}
                  className="flex cursor-pointer flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/30 md:flex-row md:items-start md:justify-between"
                  onClick={() => openCompanyDetail(companyItem)}
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">
                        {companyItem.display_name || companyItem.name || 'Unnamed company'}
                      </p>
                      <Badge variant={isActive ? "default" : "secondary"}>
                        {isActive ? "Active" : "Available"}
                      </Badge>
                      {accessForCompany && (
                        <Badge variant="outline" className="capitalize">
                          {accessForCompany.role}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {companyItem.name}
                    </p>
                    {(companyItem.address || companyItem.city || companyItem.state || companyItem.zip_code) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[companyItem.address, companyItem.city, companyItem.state, companyItem.zip_code].filter(Boolean).join(', ')}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {companyItem.phone && <span>{companyItem.phone}</span>}
                      {companyItem.email && <span className="truncate">{companyItem.email}</span>}
                      {companyItem.website && <span className="truncate">{companyItem.website}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        void openManageUsersForCompany(companyItem);
                      }}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Manage Users
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCompanyDetailDialog} onOpenChange={setShowCompanyDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCompanyDetail?.display_name || selectedCompanyDetail?.name || 'Company Details'}</DialogTitle>
            <DialogDescription>Company details and contact information.</DialogDescription>
          </DialogHeader>
          {selectedCompanyDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Company Name</Label>
                  <p className="text-sm">{selectedCompanyDetail.name || '-'}</p>
                </div>
                <div>
                  <Label>Display Name</Label>
                  <p className="text-sm">{selectedCompanyDetail.display_name || '-'}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <p className="text-sm">{selectedCompanyDetail.phone || '-'}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="text-sm break-all">{selectedCompanyDetail.email || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <Label>Website</Label>
                  <p className="text-sm break-all">{selectedCompanyDetail.website || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <p className="text-sm">
                    {[selectedCompanyDetail.address, selectedCompanyDetail.city, selectedCompanyDetail.state, selectedCompanyDetail.zip_code]
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </p>
                </div>
                <div>
                  <Label>Created</Label>
                  <p className="text-sm">{selectedCompanyDetail.created_at ? new Date(selectedCompanyDetail.created_at).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p className="text-sm">{selectedCompanyDetail.id === currentCompany.id ? 'Active' : 'Available'}</p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCompanyDetailDialog(false);
                    void openManageUsersForCompany(selectedCompanyDetail);
                  }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
                {isCompanyAdmin && (
                  <Button onClick={startEditFromDetail}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Company
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showManageUsersDialog} onOpenChange={setShowManageUsersDialog}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              Manage Company Users
            </DialogTitle>
            <DialogDescription>
              {selectedCompanyForUsers
                ? `Manage users assigned to ${selectedCompanyForUsers.display_name || selectedCompanyForUsers.name}.`
                : 'Manage users assigned to this company.'}
              {' '}Removing a user here only removes access to this specific company.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <Button onClick={() => setShowAssignExistingUserDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Existing User
              </Button>
            </div>

            <div className="max-h-[420px] overflow-y-auto rounded border">
              {loadingCompanyUsers ? (
                <div className="p-4 text-sm text-muted-foreground">Loading users...</div>
              ) : companyUsers.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No users assigned to this company yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Granted</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyUsers.map((companyUser) => (
                      <TableRow key={`${companyUser.company_id}-${companyUser.user_id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={companyUser.profile?.avatar_url || undefined} />
                              <AvatarFallback>
                                {getDisplayNameForCompanyUser(companyUser).substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{getDisplayNameForCompanyUser(companyUser)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{companyUser.role}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {companyUser.granted_at ? new Date(companyUser.granted_at).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              selectedCompanyForUsers &&
                              handleRemoveUserFromManagedCompany(selectedCompanyForUsers.id, companyUser.user_id)
                            }
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignExistingUserDialog} onOpenChange={setShowAssignExistingUserDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Existing User</DialogTitle>
            <DialogDescription>
              Add a user already in this organization to the selected company.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="existing-user-search">Search users</Label>
              <Input
                id="existing-user-search"
                value={existingUserSearch}
                onChange={(e) => setExistingUserSearch(e.target.value)}
                placeholder="Search by name or user id"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="existing-user-select">Select user</Label>
              <Select value={selectedExistingUserId} onValueChange={setSelectedExistingUserId}>
                <SelectTrigger id="existing-user-select">
                  <SelectValue placeholder="Choose an existing user" />
                </SelectTrigger>
                <SelectContent>
                  {filteredEligibleUsers.map((profile) => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {getProfileDisplayName(profile)} ({profile.user_id.slice(0, 8)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="existing-user-role">Role for this company</Label>
              <Select value={assignUserRole} onValueChange={setAssignUserRole}>
                <SelectTrigger id="existing-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="project_manager">Project Manager</SelectItem>
                  <SelectItem value="controller">Controller</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="company_admin">Company Admin</SelectItem>
                  <SelectItem value="view_only">View Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignExistingUserDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedExistingUserId || assigningUser}
              onClick={handleAssignExistingUserToCompany}
            >
              {assigningUser ? 'Adding...' : 'Add User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User to Company</DialogTitle>
            <DialogDescription>
              Invite a user to join this company. They must already have an account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">User Email</Label>
              <Input
                id="email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="controller">Controller</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>Add User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Company Dialog */}
      <Dialog open={showCreateCompanyDialog} onOpenChange={setShowCreateCompanyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
            <DialogDescription>
              Set up a new company with basic information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new_name">Company Name *</Label>
                <Input
                  id="new_name"
                  value={newCompanyForm.name}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Acme Construction"
                  required
                />
              </div>
              <div>
                <Label htmlFor="new_display_name">Display Name</Label>
                <Input
                  id="new_display_name"
                  value={newCompanyForm.display_name}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="Acme"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="new_address">Address</Label>
              <Input
                id="new_address"
                value={newCompanyForm.address}
                onChange={(e) => setNewCompanyForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main Street"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="new_city">City</Label>
                <Input
                  id="new_city"
                  value={newCompanyForm.city}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="New York"
                />
              </div>
              <div>
                <Label htmlFor="new_state">State</Label>
                <Input
                  id="new_state"
                  value={newCompanyForm.state}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="NY"
                />
              </div>
              <div>
                <Label htmlFor="new_zip">Zip Code</Label>
                <Input
                  id="new_zip"
                  value={newCompanyForm.zip_code}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, zip_code: e.target.value }))}
                  placeholder="10001"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new_phone">Phone</Label>
                <Input
                  id="new_phone"
                  value={newCompanyForm.phone}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="new_email">Email</Label>
                <Input
                  id="new_email"
                  type="email"
                  value={newCompanyForm.email}
                  onChange={(e) => setNewCompanyForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="info@company.com"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="new_website">Website</Label>
              <Input
                id="new_website"
                value={newCompanyForm.website}
                onChange={(e) => setNewCompanyForm(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://company.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCompanyDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCompany}
              disabled={!newCompanyForm.name.trim()}
            >
              Create Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={showEditCompanyDialog} onOpenChange={setShowEditCompanyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Company Information</DialogTitle>
            <DialogDescription>
              Update your company's basic information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Company Name</Label>
                <Input
                  id="name"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={companyForm.display_name}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, display_name: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={companyForm.address}
                onChange={(e) => setCompanyForm(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={companyForm.city}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={companyForm.state}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="zip">Zip Code</Label>
                <Input
                  id="zip"
                  value={companyForm.zip_code}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, zip_code: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={companyForm.email}
                  onChange={(e) => setCompanyForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={companyForm.website}
                onChange={(e) => setCompanyForm(prev => ({ ...prev, website: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCompanyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCompany}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Remove User from Company
            </DialogTitle>
            <DialogDescription>
              This is a permanent action. The user will lose all access to this company's data, jobs, and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5">
              <p className="text-sm font-medium mb-2">
                To confirm, type the user's name: <strong>{
                  deleteTargetUser?.profile?.display_name ||
                  `${deleteTargetUser?.profile?.first_name || ''} ${deleteTargetUser?.profile?.last_name || ''}`.trim() ||
                  'Unknown User'
                }</strong>
              </p>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Type the user's name to confirm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                deleteConfirmName.toLowerCase().trim() !== (
                  deleteTargetUser?.profile?.display_name ||
                  `${deleteTargetUser?.profile?.first_name || ''} ${deleteTargetUser?.profile?.last_name || ''}`.trim() ||
                  ''
                ).toLowerCase().trim()
              }
              onClick={() => {
                if (deleteTargetUser) {
                  handleRemoveUser(deleteTargetUser.user_id);
                  setShowDeleteDialog(false);
                  setDeleteTargetUser(null);
                  setDeleteConfirmName('');
                }
              }}
            >
              Remove User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
