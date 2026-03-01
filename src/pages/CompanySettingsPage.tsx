import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import CompanySettings from '@/components/CompanySettings';
import PayablesSettings from '@/components/PayablesSettings';
import PaymentTermsSettings from '@/components/PaymentTermsSettings';
import CreditCardSettings from '@/components/CreditCardSettings';
import CompanySettingsSaveButton from '@/components/CompanySettingsSaveButton';
import { CreditCard, DollarSign, Banknote, FileText, Building2, Palette, Mail, Upload, Users, UserPlus, Trash2, Loader2 } from 'lucide-react';
import AccrualAccountingSettings from '@/components/AccrualAccountingSettings';
import AIAInvoiceTemplateSettings from '@/components/AIAInvoiceTemplateSettings';
import PdfTemplateSettings from '@/components/PdfTemplateSettings';
import ThemeSettings from '@/pages/ThemeSettings';
import { useCompany } from '@/contexts/CompanyContext';
import EmailTemplatesSettings from '@/components/EmailTemplatesSettings';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { resolveCompanyLogoUrl } from '@/utils/resolveCompanyLogoUrl';

interface OrganizationUserProfile {
  user_id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  custom_role_id?: string | null;
}

interface CompanyUserAccessRow {
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
    custom_role_id?: string | null;
  };
}

interface CompanyDirectoryUser {
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
}

interface CustomRoleRecord {
  id: string;
  role_name: string;
}

interface CompanyEmailSettingsForm {
  from_email: string;
  from_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  incoming_protocol: 'imap' | 'pop3';
  incoming_host: string;
  incoming_port: number;
  incoming_username: string;
  incoming_password: string;
  use_ssl: boolean;
  is_configured: boolean;
}

export default function CompanySettingsPage() {
  const navigate = useNavigate();
  const { currentCompany, userCompanies, refreshCompanies } = useCompany();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();

  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [companyUsers, setCompanyUsers] = useState<CompanyUserAccessRow[]>([]);
  const [loadingCompanyUsers, setLoadingCompanyUsers] = useState(false);
  const [showAddExistingUserDialog, setShowAddExistingUserDialog] = useState(false);
  const [eligibleUsers, setEligibleUsers] = useState<OrganizationUserProfile[]>([]);
  const [eligibleUserSearch, setEligibleUserSearch] = useState('');
  const [selectedExistingUserId, setSelectedExistingUserId] = useState('');
  const [assignUserRole, setAssignUserRole] = useState('employee');
  const [assigningUser, setAssigningUser] = useState(false);
  const [customRoles, setCustomRoles] = useState<CustomRoleRecord[]>([]);

  const [showCompanyEmailDialog, setShowCompanyEmailDialog] = useState(false);
  const [loadingCompanyEmailSettings, setLoadingCompanyEmailSettings] = useState(false);
  const [savingCompanyEmailSettings, setSavingCompanyEmailSettings] = useState(false);
  const [companyEmailSettings, setCompanyEmailSettings] = useState<CompanyEmailSettingsForm>({
    from_email: '',
    from_name: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    incoming_protocol: 'imap',
    incoming_host: '',
    incoming_port: 993,
    incoming_username: '',
    incoming_password: '',
    use_ssl: true,
    is_configured: false,
  });

  const currentUserCompany = userCompanies.find((uc) => uc.company_id === currentCompany?.id);
  const canManageCompanyUsers = ['admin', 'company_admin', 'controller'].includes(String(currentUserCompany?.role || '').toLowerCase());

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

  const fetchCompanyUsers = async () => {
    if (!currentCompany?.id) return;
    setLoadingCompanyUsers(true);
    try {
      const { data: accessRows, error: accessError } = await supabase
        .from('user_company_access')
        .select('id,user_id,company_id,role,is_active,granted_at')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('granted_at', { ascending: false });
      if (accessError) throw accessError;

      const userIds = (accessRows || []).map((row) => row.user_id);
      let profiles: OrganizationUserProfile[] = [];
      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('user_id,display_name,first_name,last_name,avatar_url,email,custom_role_id')
          .in('user_id', userIds);
        if (profileError) throw profileError;
        profiles = (profileRows || []) as OrganizationUserProfile[];
      }

      let directoryUsers: CompanyDirectoryUser[] = [];
      const { data: directoryRows, error: directoryError } = await supabase
        .rpc('get_company_directory', { p_company_id: currentCompany.id });
      if (!directoryError) {
        directoryUsers = (directoryRows || []) as CompanyDirectoryUser[];
      } else {
        console.warn('Company directory lookup failed, using profile fallback only.', directoryError);
      }

      const merged: CompanyUserAccessRow[] = (accessRows || []).map((row) => {
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
                  email: profile?.email || undefined,
                  custom_role_id: profile?.custom_role_id || null,
                }
            : profile
            ? {
                display_name: profile.display_name || undefined,
                first_name: profile.first_name || undefined,
                last_name: profile.last_name || undefined,
                avatar_url: profile.avatar_url || undefined,
                email: profile.email || undefined,
                custom_role_id: profile.custom_role_id || null,
              }
            : undefined,
        };
      });
      setCompanyUsers(merged);
    } catch (error) {
      console.error('Error fetching company users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load company users.',
        variant: 'destructive',
      });
    } finally {
      setLoadingCompanyUsers(false);
    }
  };

  const loadEligibleUsers = async () => {
    if (!currentCompany?.id || !currentTenant?.id) return;
    try {
      const { data: orgCompanies, error: companiesError } = await supabase
        .from('companies')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true);
      if (companiesError) throw companiesError;
      const orgCompanyIds = (orgCompanies || []).map((c: any) => c.id);
      if (orgCompanyIds.length === 0) {
        setEligibleUsers([]);
        return;
      }

      const { data: accessRows, error: accessError } = await supabase
        .from('user_company_access')
        .select('user_id,company_id,is_active')
        .in('company_id', orgCompanyIds)
        .eq('is_active', true);
      if (accessError) throw accessError;

      const byUser = new Map<string, Set<string>>();
      (accessRows || []).forEach((row: any) => {
        const current = byUser.get(row.user_id) || new Set<string>();
        current.add(row.company_id);
        byUser.set(row.user_id, current);
      });

      const eligibleIds = Array.from(byUser.entries())
        .filter(([, companySet]) => !companySet.has(currentCompany.id))
        .map(([userId]) => userId);
      if (eligibleIds.length === 0) {
        setEligibleUsers([]);
        return;
      }

      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('user_id,display_name,first_name,last_name,avatar_url,email')
        .in('user_id', eligibleIds);
      if (profileError) throw profileError;

      setEligibleUsers((profileRows || []) as OrganizationUserProfile[]);
    } catch (error) {
      console.error('Error loading eligible users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load eligible users.',
        variant: 'destructive',
      });
    }
  };

  const fetchCustomRoles = async () => {
    if (!currentCompany?.id) return;
    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('id, role_name')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('role_name', { ascending: true });
      if (error) throw error;
      setCustomRoles((data || []) as CustomRoleRecord[]);
    } catch (error) {
      console.error('Error fetching custom roles for company settings users:', error);
      setCustomRoles([]);
    }
  };

  const handleAssignExistingUser = async () => {
    if (!currentCompany?.id || !selectedExistingUserId || !user?.id) return;
    setAssigningUser(true);
    try {
      const { data: existing } = await supabase
        .from('user_company_access')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('user_id', selectedExistingUserId)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('user_company_access')
          .update({
            is_active: true,
            role: assignUserRole,
            granted_by: user.id,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_company_access')
          .insert({
            company_id: currentCompany.id,
            user_id: selectedExistingUserId,
            role: assignUserRole,
            granted_by: user.id,
            is_active: true,
          });
        if (error) throw error;
      }

      toast({
        title: 'User added',
        description: 'User access added to this company.',
      });
      setShowAddExistingUserDialog(false);
      setSelectedExistingUserId('');
      setAssignUserRole('employee');
      setEligibleUserSearch('');
      await Promise.all([fetchCompanyUsers(), loadEligibleUsers()]);
    } catch (error) {
      console.error('Error adding existing user:', error);
      toast({
        title: 'Error',
        description: 'Failed to add user.',
        variant: 'destructive',
      });
    } finally {
      setAssigningUser(false);
    }
  };

  const handleRemoveCompanyUser = async (userId: string) => {
    if (!currentCompany?.id) return;
    try {
      const { error } = await supabase
        .from('user_company_access')
        .update({ is_active: false })
        .eq('company_id', currentCompany.id)
        .eq('user_id', userId);
      if (error) throw error;

      toast({
        title: 'User removed',
        description: 'User was removed from this company.',
      });
      await Promise.all([fetchCompanyUsers(), loadEligibleUsers()]);
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove user.',
        variant: 'destructive',
      });
    }
  };

  const uploadCompanyLogoFile = async (file?: File | null) => {
    if (!file || !currentCompany) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 2MB',
        variant: 'destructive',
      });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany.id}/company-logo-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('company-logos').upload(fileName, file);
      if (uploadError) throw uploadError;

      const logoPath = `company-logos/${fileName}`;
      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: logoPath })
        .eq('id', currentCompany.id);
      if (updateError) throw updateError;

      await refreshCompanies();
      toast({
        title: 'Success',
        description: 'Company logo updated.',
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload company logo.',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const openCompanyEmailSetup = async () => {
    if (!currentCompany?.id) return;
    setShowCompanyEmailDialog(true);
    setLoadingCompanyEmailSettings(true);
    try {
      const { data, error } = await (supabase as any)
        .from('company_email_settings')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      if (error) throw error;

      setCompanyEmailSettings({
        from_email: data?.from_email || '',
        from_name: data?.from_name || '',
        smtp_host: data?.smtp_host || '',
        smtp_port: Number(data?.smtp_port || 587),
        smtp_username: data?.smtp_username || '',
        smtp_password: '',
        incoming_protocol: data?.incoming_protocol === 'pop3' ? 'pop3' : 'imap',
        incoming_host: data?.incoming_host || data?.imap_host || '',
        incoming_port: Number(data?.incoming_port || data?.imap_port || 993),
        incoming_username: data?.incoming_username || data?.imap_username || '',
        incoming_password: '',
        use_ssl: data?.use_ssl !== false,
        is_configured: data?.is_configured === true,
      });
    } catch (error) {
      console.error('Error loading company email settings:', error);
      toast({
        title: 'Setup unavailable',
        description: 'Company email settings table is not available yet. Run migrations first.',
        variant: 'destructive',
      });
    } finally {
      setLoadingCompanyEmailSettings(false);
    }
  };

  const saveCompanyEmailSetup = async () => {
    if (!currentCompany?.id) return;
    setSavingCompanyEmailSettings(true);
    try {
      const { data: existing } = await (supabase as any)
        .from('company_email_settings')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      const payload: any = {
        company_id: currentCompany.id,
        from_email: companyEmailSettings.from_email || null,
        from_name: companyEmailSettings.from_name || null,
        smtp_host: companyEmailSettings.smtp_host || null,
        smtp_port: companyEmailSettings.smtp_port || null,
        smtp_username: companyEmailSettings.smtp_username || null,
        smtp_password_encrypted: companyEmailSettings.smtp_password || existing?.smtp_password_encrypted || null,
        incoming_protocol: companyEmailSettings.incoming_protocol || 'imap',
        incoming_host: companyEmailSettings.incoming_host || null,
        incoming_port: companyEmailSettings.incoming_port || null,
        incoming_username: companyEmailSettings.incoming_username || null,
        incoming_password_encrypted: companyEmailSettings.incoming_password || existing?.incoming_password_encrypted || null,
        imap_host: companyEmailSettings.incoming_protocol === 'imap' ? (companyEmailSettings.incoming_host || null) : null,
        imap_port: companyEmailSettings.incoming_protocol === 'imap' ? (companyEmailSettings.incoming_port || null) : null,
        imap_username: companyEmailSettings.incoming_protocol === 'imap' ? (companyEmailSettings.incoming_username || null) : null,
        imap_password_encrypted:
          companyEmailSettings.incoming_protocol === 'imap'
            ? (companyEmailSettings.incoming_password || existing?.imap_password_encrypted || null)
            : null,
        use_ssl: companyEmailSettings.use_ssl,
        is_configured:
          companyEmailSettings.is_configured &&
          !!companyEmailSettings.smtp_host &&
          !!companyEmailSettings.smtp_username &&
          !!(companyEmailSettings.smtp_password || existing?.smtp_password_encrypted) &&
          !!companyEmailSettings.from_email,
      };

      const { error } = await (supabase as any)
        .from('company_email_settings')
        .upsert(payload, { onConflict: 'company_id' });
      if (error) throw error;

      toast({
        title: 'Saved',
        description: 'Company email setup saved.',
      });
      setShowCompanyEmailDialog(false);
    } catch (error) {
      console.error('Error saving company email settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save company email setup.',
        variant: 'destructive',
      });
    } finally {
      setSavingCompanyEmailSettings(false);
    }
  };

  const filteredEligibleUsers = useMemo(() => {
    const needle = eligibleUserSearch.trim().toLowerCase();
    if (!needle) return eligibleUsers;
    return eligibleUsers.filter((u) => {
      const displayName = getProfileDisplayName(u).toLowerCase();
      return displayName.includes(needle) || u.user_id.toLowerCase().includes(needle);
    });
  }, [eligibleUsers, eligibleUserSearch]);

  const getRoleLabel = (companyUser: CompanyUserAccessRow) => {
    const customRoleId = companyUser.profile?.custom_role_id;
    if (customRoleId) {
      const customRole = customRoles.find((role) => role.id === customRoleId);
      if (customRole?.role_name) return customRole.role_name;
    }
    return String(companyUser.role || '').replace(/_/g, ' ');
  };

  const getRoleBadgeClass = (companyUser: CompanyUserAccessRow) => {
    const hasCustomRole = !!companyUser.profile?.custom_role_id;
    if (hasCustomRole) {
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20';
    }

    switch (String(companyUser.role || '').toLowerCase()) {
      case 'admin':
        return 'border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/20';
      case 'company_admin':
        return 'border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300 hover:bg-fuchsia-500/20';
      case 'controller':
        return 'border-sky-500/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/20';
      case 'project_manager':
        return 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/20';
      case 'view_only':
        return 'border-slate-500/40 bg-slate-500/15 text-slate-300 hover:bg-slate-500/20';
      case 'vendor':
        return 'border-orange-500/40 bg-orange-500/15 text-orange-300 hover:bg-orange-500/20';
      case 'employee':
      default:
        return 'border-zinc-500/40 bg-zinc-500/15 text-zinc-300 hover:bg-zinc-500/20';
    }
  };

  useEffect(() => {
    if (activeTab === 'overview' && currentCompany?.id) {
      void fetchCompanyUsers();
      void loadEligibleUsers();
      void fetchCustomRoles();
    }
  }, [activeTab, currentCompany?.id, currentTenant?.id]);

  return (
    <div className="p-4 md:p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Company Settings</h1>
          </div>
          <CompanySettingsSaveButton />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="payables" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payables
            </TabsTrigger>
            <TabsTrigger value="receivable-settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Receivables
            </TabsTrigger>
            <TabsTrigger value="banking" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Banking
            </TabsTrigger>
            <TabsTrigger value="credit-cards" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Credit Cards
            </TabsTrigger>
            <TabsTrigger value="theme" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Themes & Appearance
            </TabsTrigger>
            <TabsTrigger value="pdf-templates" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2">
              <FileText className="h-4 w-4" />
              PDF Templates
            </TabsTrigger>
            <TabsTrigger value="email-templates" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Email Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardContent className="space-y-6 pt-6">
                <div className="flex">
                  <label className="group relative block h-24 w-52 overflow-hidden rounded-md border bg-muted/30 cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => void uploadCompanyLogoFile(e.target.files?.[0])}
                      disabled={uploadingLogo}
                    />
                    {resolveCompanyLogoUrl(currentCompany?.logo_url) ? (
                      <>
                        <img
                          src={resolveCompanyLogoUrl(currentCompany?.logo_url)}
                          alt={currentCompany?.display_name || currentCompany?.name || 'Company'}
                          className="h-full w-full object-contain p-2"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100">
                          Upload Logo
                        </div>
                      </>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                        {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      </div>
                    )}
                    {uploadingLogo && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-sm font-medium">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </div>
                    )}
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Company Name</Label>
                  <p className="text-sm">{currentCompany?.name || 'Not set'}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Display Name</Label>
                  <p className="text-sm">{currentCompany?.display_name || 'Not set'}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
                  <p className="text-sm">{currentCompany?.phone || 'Not set'}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                  <p className="text-sm break-all">{currentCompany?.email || 'Not set'}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Website</Label>
                  <p className="text-sm break-all">{currentCompany?.website || 'Not set'}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Address</Label>
                  <p className="text-sm">
                    {[
                      currentCompany?.address,
                      [currentCompany?.city, currentCompany?.state].filter(Boolean).join(', '),
                      currentCompany?.zip_code,
                    ].filter(Boolean).join(' ') || 'Not set'}
                  </p>
                </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Company Email Setup</CardTitle>
                  <CardDescription>
                    Configure a company-level mail server for system emails (used when user email is not configured).
                  </CardDescription>
                </div>
                <Button onClick={() => void openCompanyEmailSetup()}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email Setup
                </Button>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Manage Users</CardTitle>
                  <CardDescription>
                    Users assigned to this company. Add existing users from your organization.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowAddExistingUserDialog(true)}
                  disabled={!canManageCompanyUsers}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Existing User
                </Button>
              </CardHeader>
              <CardContent>
                {loadingCompanyUsers ? (
                  <div className="py-8 text-muted-foreground flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading users...
                  </div>
                ) : companyUsers.length === 0 ? (
                  <div className="py-8 text-sm text-muted-foreground">No users assigned to this company.</div>
                ) : (
                  <div className="space-y-2">
                    {companyUsers.map((companyUser) => (
                      <div key={`${companyUser.company_id}-${companyUser.user_id}`} className="flex items-center justify-between rounded border p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={companyUser.profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {getProfileDisplayName(companyUser.profile).substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{getProfileDisplayName(companyUser.profile)}</p>
                            <Badge variant="outline" className={`capitalize ${getRoleBadgeClass(companyUser)}`}>
                              {getRoleLabel(companyUser)}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleRemoveCompanyUser(companyUser.user_id)}
                            disabled={!canManageCompanyUsers}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove from company
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payables">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Payables & Payment Settings</CardTitle>
                  <CardDescription>
                    Configure approval workflows, thresholds, and payment processing settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PayablesSettings />
                </CardContent>
              </Card>

              <PaymentTermsSettings />

              <CompanySettings
                showBranding={false}
                showJournalEntrySettings={false}
              />
            </div>
          </TabsContent>

          <TabsContent value="receivable-settings">
            <Tabs defaultValue="aia-invoice-templates" className="space-y-4">
              <TabsList>
                <TabsTrigger value="aia-invoice-templates">AIA Invoice Templates</TabsTrigger>
              </TabsList>
              <TabsContent value="aia-invoice-templates">
                <AIAInvoiceTemplateSettings />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="theme">
            <ThemeSettings embedded />
          </TabsContent>

          <TabsContent value="pdf-templates">
            <PdfTemplateSettings />
          </TabsContent>

          <TabsContent value="email-templates">
            <EmailTemplatesSettings />
          </TabsContent>

          <TabsContent value="credit-cards">
            <Card>
              <CardHeader>
                <CardTitle>Credit Card Settings</CardTitle>
                <CardDescription>
                  Manage credit cards, configure approval workflows, and set spending controls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreditCardSettings />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="banking">
            <div className="space-y-6">
              <CompanySettings
                showBranding={false}
                showCheckPickupLocations={false}
                showBillApprovalSettings={false}
              />

              <AccrualAccountingSettings />

              <Card>
                <CardHeader>
                  <CardTitle>Chart of Accounts</CardTitle>
                  <CardDescription>
                    Manage your company's chart of accounts and accounting structure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Set up and manage your company's chart of accounts for proper financial tracking and reporting.
                    </p>
                    <Button onClick={() => navigate('/settings/company/chart-of-accounts')} variant="outline">
                      Manage Chart of Accounts
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Bank Accounts</CardTitle>
                  <CardDescription>
                    Add and manage your company's bank accounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Add new bank accounts which will automatically create associated cash accounts in your chart of accounts.
                    </p>
                    <Button onClick={() => navigate('/banking/accounts/add')} variant="outline">
                      Add Bank Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showAddExistingUserDialog} onOpenChange={setShowAddExistingUserDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Existing User</DialogTitle>
            <DialogDescription>
              Add a user already in this organization to the current company.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Search users</Label>
              <Input
                value={eligibleUserSearch}
                onChange={(e) => setEligibleUserSearch(e.target.value)}
                placeholder="Search by name or user id"
              />
            </div>
            <div className="space-y-2">
              <Label>Select user</Label>
              <Select value={selectedExistingUserId} onValueChange={setSelectedExistingUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an existing user" />
                </SelectTrigger>
                <SelectContent>
                  {filteredEligibleUsers.map((profile) => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {getProfileDisplayName(profile)}{profile.email ? ` (${profile.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role for this company</Label>
              <Select value={assignUserRole} onValueChange={setAssignUserRole}>
                <SelectTrigger>
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
            <Button variant="outline" onClick={() => setShowAddExistingUserDialog(false)}>
              Cancel
            </Button>
            <Button disabled={!selectedExistingUserId || assigningUser} onClick={() => void handleAssignExistingUser()}>
              {assigningUser ? 'Adding...' : 'Add User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCompanyEmailDialog} onOpenChange={setShowCompanyEmailDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Company Email Setup</DialogTitle>
            <DialogDescription>
              Configure a company-wide email server for system emails. Fallback order is: user email settings, then company email settings, then BuilderLYNK default mailer.
            </DialogDescription>
          </DialogHeader>

          {loadingCompanyEmailSettings ? (
            <div className="py-12 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Loading settings...
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded border p-3">
                <div>
                  <Label className="text-base">Use company email server</Label>
                  <p className="text-sm text-muted-foreground">
                    If enabled and configured, system emails for this company send from this server.
                  </p>
                </div>
                <Switch
                  checked={companyEmailSettings.is_configured}
                  onCheckedChange={(checked) => setCompanyEmailSettings((prev) => ({ ...prev, is_configured: checked }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    value={companyEmailSettings.from_name}
                    onChange={(e) => setCompanyEmailSettings((prev) => ({ ...prev, from_name: e.target.value }))}
                    placeholder="Sigma Construction"
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input
                    value={companyEmailSettings.from_email}
                    onChange={(e) => setCompanyEmailSettings((prev) => ({ ...prev, from_email: e.target.value }))}
                    placeholder="notifications@yourdomain.com"
                  />
                </div>
              </div>

              <div className="rounded border p-4 space-y-4">
                <Label className="text-base">Outgoing SMTP (required for sending)</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SMTP Host</Label>
                    <Input
                      value={companyEmailSettings.smtp_host}
                      onChange={(e) => setCompanyEmailSettings((prev) => ({ ...prev, smtp_host: e.target.value }))}
                      placeholder="smtp.office365.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Port</Label>
                    <Input
                      type="number"
                      value={companyEmailSettings.smtp_port}
                      onChange={(e) => setCompanyEmailSettings((prev) => ({ ...prev, smtp_port: Number(e.target.value) || 587 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Username</Label>
                    <Input
                      value={companyEmailSettings.smtp_username}
                      onChange={(e) => setCompanyEmailSettings((prev) => ({ ...prev, smtp_username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Password</Label>
                    <Input
                      type="password"
                      value={companyEmailSettings.smtp_password}
                      onChange={(e) => setCompanyEmailSettings((prev) => ({ ...prev, smtp_password: e.target.value }))}
                      placeholder="Leave blank to keep existing"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded border p-4 space-y-4">
                <Label className="text-base">Incoming Mail (optional, IMAP/POP)</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Incoming Protocol</Label>
                    <Select
                      value={companyEmailSettings.incoming_protocol}
                      onValueChange={(value: 'imap' | 'pop3') =>
                        setCompanyEmailSettings((prev) => ({
                          ...prev,
                          incoming_protocol: value,
                          incoming_port: value === 'pop3' ? 995 : 993,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imap">IMAP</SelectItem>
                        <SelectItem value="pop3">POP3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Incoming Host</Label>
                    <Input
                      value={companyEmailSettings.incoming_host}
                      onChange={(e) => setCompanyEmailSettings((prev) => ({ ...prev, incoming_host: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Incoming Port</Label>
                    <Input
                      type="number"
                      value={companyEmailSettings.incoming_port}
                      onChange={(e) => setCompanyEmailSettings((prev) => ({ ...prev, incoming_port: Number(e.target.value) || (prev.incoming_protocol === 'pop3' ? 995 : 993) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Incoming Username</Label>
                    <Input
                      value={companyEmailSettings.incoming_username}
                      onChange={(e) => setCompanyEmailSettings((prev) => ({ ...prev, incoming_username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Incoming Password</Label>
                    <Input
                      type="password"
                      value={companyEmailSettings.incoming_password}
                      onChange={(e) => setCompanyEmailSettings((prev) => ({ ...prev, incoming_password: e.target.value }))}
                      placeholder="Leave blank to keep existing"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompanyEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveCompanyEmailSetup()} disabled={savingCompanyEmailSettings || loadingCompanyEmailSettings}>
              {savingCompanyEmailSettings ? 'Saving...' : 'Save Email Setup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
