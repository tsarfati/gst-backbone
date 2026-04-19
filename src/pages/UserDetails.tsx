import { useState, useEffect, useRef } from "react";
import { resolveStorageUrl } from '@/utils/storageUtils';
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Briefcase, 
  Shield, 
  ArrowLeft,
  Edit,
  MapPin,
  Clock,
  Building2,
  Store,
  KeyRound,
  Loader2,
  CheckCircle,
  XCircle,
  Save,
  X,
  Trash2,
  Key,
  Camera,
  Upload,
  Eye,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
import { useActiveCompanyRole } from "@/hooks/useActiveCompanyRole";
import { useSystemAvatarLibraries } from "@/hooks/useSystemAvatarLibraries";
import { useIsMobile } from "@/hooks/use-mobile";
import AvatarLibraryDialog from "@/components/AvatarLibraryDialog";
import UserJobAccess from "@/components/UserJobAccess";
import UserCompanyAccess from "@/components/UserCompanyAccess";
import { UserPinSettings } from "@/components/UserPinSettings";
import DocumentPreviewModal from "@/components/DocumentPreviewModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AvatarLibraryAlbumId } from "@/components/avatarLibrary";

interface UserProfile {
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  birthday?: string | null;
  role: string;
  custom_role_id?: string | null;
  status: string;
  has_global_job_access: boolean;
  avatar_url?: string;
  created_at: string;
  approved_at?: string;
  department?: string;
  notes?: string;
  vendor_id?: string;
  group_id?: string | null;
  pin_code?: string;
  punch_clock_access?: boolean;
  pm_lynk_access?: boolean;
}

interface Vendor {
  id: string;
  name: string;
}

interface Job {
  id: string;
  name: string;
}

interface UserAccessJob extends Job {
  sources: Array<'project_team' | 'job_access'>;
}

interface VendorJob {
  id: string;
  name: string;
  sources: Array<'vendor_job_access' | 'rfp_invite'>;
}

interface CustomRole {
  id: string;
  role_name: string;
  role_key: string;
  color?: string | null;
}

interface EmployeeGroup {
  id: string;
  name: string;
}

interface LoginAudit {
  id: string;
  login_time: string;
  logout_time?: string;
  ip_address?: string;
  user_agent?: string;
  login_method?: string;
  success?: boolean;
  app_source?: string;
}

interface UserProfileFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  label: string | null;
  description: string | null;
  created_at: string;
  uploaded_by: string | null;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  owner: 'Owner',
  controller: 'Controller',
  project_manager: 'Project Manager',
  design_professional: 'Design Professional',
  employee: 'Employee',
  view_only: 'View Only',
  company_admin: 'Company Admin',
  vendor: 'Vendor'
};

const INTERNAL_ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrator' },
  { value: 'controller', label: 'Controller' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'design_professional', label: 'Design Professional' },
  { value: 'employee', label: 'Employee' },
  { value: 'view_only', label: 'View Only' },
  { value: 'company_admin', label: 'Company Admin' },
] as const;

export default function UserDetails() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentCompany } = useCompany();
  const { isSuperAdmin, tenantMember } = useTenant();
  const { profile } = useAuth();
  const { settings } = useSettings();
  const activeCompanyRole = useActiveCompanyRole();
  const { hasAccess } = useMenuPermissions();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { libraries: systemAvatarLibraries } = useSystemAvatarLibraries(currentCompany?.id);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [lastSignInAt, setLastSignInAt] = useState<string | null>(null);
  const [userJobs, setUserJobs] = useState<UserAccessJob[]>([]);
  const [vendorJobs, setVendorJobs] = useState<VendorJob[]>([]);
  const [loginAudit, setLoginAudit] = useState<LoginAudit[]>([]);
  const [associatedVendor, setAssociatedVendor] = useState<Vendor | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingReset, setSendingReset] = useState(false);
  const [setPasswordOpen, setSetPasswordOpen] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    display_name: '',
    email: '',
    phone: '',
    birthday: '',
    role: '',
    status: '',
  });
  const [groups, setGroups] = useState<EmployeeGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [companyRole, setCompanyRole] = useState<string | null>(null);
  const [removeConfirmName, setRemoveConfirmName] = useState('');
  const [removing, setRemoving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'files'>('profile');
  const [userFiles, setUserFiles] = useState<UserProfileFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [userFilesFeatureAvailable, setUserFilesFeatureAvailable] = useState(true);
  const [uploadingUserFile, setUploadingUserFile] = useState(false);
  const ADD_ROLE_OPTION_VALUE = "__add_role__";
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showAvatarLibrary, setShowAvatarLibrary] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [avatarLibraryCategory, setAvatarLibraryCategory] = useState<AvatarLibraryAlbumId>('nintendo');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [fileLabel, setFileLabel] = useState('');
  const [fileDescription, setFileDescription] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; url: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const fromCompanyManagement = location.state?.fromCompanyManagement || false;
  const fromEmployees = location.state?.fromEmployees || false;
  const normalizedActiveRole = String(activeCompanyRole || "").toLowerCase();
  const canManage = ['admin', 'controller', 'company_admin', 'owner'].includes(normalizedActiveRole);
  const canEditUserEmail = canManage && hasAccess('user-settings-edit-email');
  const canChangeUserPassword = canManage && hasAccess('user-settings-change-password');

  const roleColors: Record<string, string> = {
    admin: 'bg-destructive',
    owner: 'bg-destructive',
    controller: 'bg-primary',
    project_manager: 'bg-accent',
    design_professional: 'bg-cyan-500',
    employee: 'bg-muted',
    view_only: 'bg-muted',
    company_admin: 'bg-destructive',
    vendor: 'bg-secondary'
  };

  const statusColors: Record<string, string> = {
    approved: 'bg-green-500',
    pending: 'bg-yellow-500',
    rejected: 'bg-red-500'
  };

  useEffect(() => {
    if (userId && (currentCompany || isSuperAdmin)) {
      fetchUserDetails();
      if (!userFilesFeatureAvailable) {
        setUserFiles([]);
      }
      if (currentCompany) fetchCustomRoles();
      if (currentCompany) fetchGroups();
      if (currentCompany) fetchVendors();
    }
  }, [userId, currentCompany, isSuperAdmin, tenantMember?.role, tenantMember?.user_id, userFilesFeatureAvailable]);

  useEffect(() => {
    if (!userId || !currentCompany || !user) return;

    fetchUserJobs();

    const isExternalAccessUser = user.role === 'vendor' || user.role === 'design_professional';
    if (isExternalAccessUser) {
      setLoginAudit([]);
      setUserFiles([]);
      return;
    }

    fetchLoginAudit();
    fetchUserEmail();
    if (userFilesFeatureAvailable) fetchUserFiles();
  }, [userId, currentCompany, user?.role, userFilesFeatureAvailable]);

  useEffect(() => {
    if (selectedVendorId) {
      fetchVendorJobs(selectedVendorId);
    } else {
      setVendorJobs([]);
    }
  }, [selectedVendorId, currentCompany?.id]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    if (!showAvatarLibrary) return;

    const hasCustomAvatars = (settings.avatarLibrary?.customAvatars?.length || 0) > 0;
    const systemAlbumId = systemAvatarLibraries[0] ? (`system:${systemAvatarLibraries[0].id}` as AvatarLibraryAlbumId) : null;

    if (systemAlbumId) {
      setAvatarLibraryCategory(systemAlbumId);
      return;
    }

    if (hasCustomAvatars) {
      setAvatarLibraryCategory('custom');
    }
  }, [showAvatarLibrary, systemAvatarLibraries, settings.avatarLibrary?.customAvatars]);

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

  const fetchGroups = async () => {
    if (!currentCompany) return;
    try {
      const { data, error } = await supabase
        .from('employee_groups')
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .order('name');
      if (error) throw error;
      setGroups((data as EmployeeGroup[]) || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      setGroups([]);
    }
  };

  const fetchVendors = async () => {
    if (!currentCompany) return;
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setVendors((data as Vendor[]) || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setVendors([]);
    }
  };

  const fetchUserDetails = async () => {
    try {
      const [profileRes, accessRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        currentCompany ? supabase.from('user_company_access').select('role').eq('user_id', userId!).eq('company_id', currentCompany.id).eq('is_active', true).maybeSingle() : Promise.resolve({ data: null, error: null })
      ]);

      if (profileRes.data) {
      const role = accessRes.data?.role || profileRes.data.role;
      const isTenantOwnerProfile = tenantMember?.role === 'owner' && tenantMember?.user_id === profileRes.data.user_id;
      const effectiveRole = isTenantOwnerProfile ? 'owner' : role;
      setCompanyRole(accessRes.data?.role || null);
        
        // Fallback avatar: use latest punch selfie if no avatar set
        let avatarUrl = profileRes.data.avatar_url;
        if (!avatarUrl) {
          const { data: punchData } = await supabase
            .from('time_cards')
            .select('punch_in_photo_url, punch_out_photo_url')
            .eq('user_id', userId!)
            .not('punch_in_photo_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);
          if (punchData && punchData.length > 0) {
            const rawUrl = punchData[0].punch_out_photo_url || punchData[0].punch_in_photo_url || null;
            if (rawUrl) {
              avatarUrl = await resolveStorageUrl('punch-photos', rawUrl);
            }
          }
        }

        const userData = { ...profileRes.data, role: effectiveRole, avatar_url: avatarUrl };
        setUser(userData);
        setSelectedGroupId(profileRes.data.group_id || null);
        setEditForm({
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          display_name: userData.display_name || '',
          email: userEmail || userData.email || '',
          phone: userData.phone || '',
          birthday: userData.birthday || '',
          role: userData.custom_role_id ? `custom_${userData.custom_role_id}` : (effectiveRole === 'owner' ? 'admin' : role),
          status: userData.status || 'approved',
        });
        
        if (profileRes.data.vendor_id) {
          const { data: vendorData } = await supabase.from('vendors').select('id, name').eq('id', profileRes.data.vendor_id).single();
          if (vendorData) {
            setAssociatedVendor(vendorData);
            setSelectedVendorId(vendorData.id);
          }
        } else {
          setAssociatedVendor(null);
          setSelectedVendorId(null);
        }
        
        setLoading(false);
        return;
      }

      // No user found
      throw new Error('User not found');
    } catch (error) {
      console.error('Error fetching user:', error);
      toast({ title: "Error", description: "Failed to fetch user details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchVendorJobs = async (vendorId: string) => {
    if (!currentCompany) return;
    try {
      const [jobAccessRes, invitedRfpsRes] = await Promise.all([
        (supabase
          .from('vendor_job_access') as any)
          .select('jobs(id, name)')
          .eq('vendor_id', vendorId)
          .eq('company_id', currentCompany.id)
          .order('created_at', { ascending: false }),
        (supabase
          .from('rfp_invited_vendors') as any)
          .select('rfp:rfps(job:jobs(id, name, company_id))')
          .eq('vendor_id', vendorId)
          .eq('company_id', currentCompany.id)
          .order('invited_at', { ascending: false }),
      ]);

      if (jobAccessRes.error) throw jobAccessRes.error;
      if (invitedRfpsRes.error) throw invitedRfpsRes.error;

      const mergedById = new Map<string, VendorJob>();

      ((jobAccessRes.data || []) as any[]).forEach((row: any) => {
        const job = row?.jobs;
        if (!job?.id || !job?.name) return;
        const id = String(job.id);
        const existing = mergedById.get(id);
        if (existing) {
          if (!existing.sources.includes('vendor_job_access')) existing.sources.push('vendor_job_access');
          return;
        }
        mergedById.set(id, {
          id,
          name: String(job.name),
          sources: ['vendor_job_access'],
        });
      });

      ((invitedRfpsRes.data || []) as any[]).forEach((row: any) => {
        const job = row?.rfp?.job;
        if (!job?.id || !job?.name) return;
        const id = String(job.id);
        const existing = mergedById.get(id);
        if (existing) {
          if (!existing.sources.includes('rfp_invite')) existing.sources.push('rfp_invite');
          return;
        }
        mergedById.set(id, {
          id,
          name: String(job.name),
          sources: ['rfp_invite'],
        });
      });

      setVendorJobs(Array.from(mergedById.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching vendor jobs:', error);
      setVendorJobs([]);
    }
  };

  const fetchUserJobs = async () => {
    if (!currentCompany) return;
    try {
      const effectiveRole = String(user?.role || '').toLowerCase();

      if (effectiveRole === 'design_professional') {
        const { data: externalJobRows, error: externalJobsError } = await supabase
          .from('job_project_directory')
          .select('job_id, jobs(id, name)')
          .eq('linked_user_id', userId)
          .eq('company_id', currentCompany.id)
          .eq('is_project_team_member', true)
          .eq('is_active', true);

        if (externalJobsError) throw externalJobsError;

        const mappedJobs = (externalJobRows || [])
          .map((item: any) => item.jobs)
          .filter(Boolean)
          .map((job: any) => ({
            id: String(job.id),
            name: String(job.name),
            sources: ['project_team'] as Array<'project_team' | 'job_access'>,
          }));
        const uniqueJobs = Array.from(new Map(mappedJobs.map((job) => [job.id, job])).values());
        setUserJobs(uniqueJobs);
        return;
      }

      const [userJobAccessRes, projectDirectoryRes] = await Promise.all([
        supabase
          .from('user_job_access')
          .select('job_id, jobs!inner(id, name, company_id)')
          .eq('user_id', userId)
          .eq('jobs.company_id', currentCompany.id),
        supabase
          .from('job_project_directory')
          .select('job_id, jobs!inner(id, name)')
          .eq('linked_user_id', userId)
          .eq('company_id', currentCompany.id)
          .eq('is_project_team_member', true)
          .eq('is_active', true),
      ]);

      if (userJobAccessRes.error) throw userJobAccessRes.error;
      if (projectDirectoryRes.error) throw projectDirectoryRes.error;

      const mergedById = new Map<string, UserAccessJob>();

      (userJobAccessRes.data || []).forEach((item: any) => {
        const job = item.jobs;
        if (!job?.id || !job?.name) return;
        const id = String(job.id);
        const existing = mergedById.get(id);
        if (existing) {
          if (!existing.sources.includes('job_access')) existing.sources.push('job_access');
          return;
        }
        mergedById.set(id, {
          id,
          name: String(job.name),
          sources: ['job_access'],
        });
      });

      (projectDirectoryRes.data || []).forEach((item: any) => {
        const job = item.jobs;
        if (!job?.id || !job?.name) return;
        const id = String(job.id);
        const existing = mergedById.get(id);
        if (existing) {
          if (!existing.sources.includes('project_team')) existing.sources.push('project_team');
          return;
        }
        mergedById.set(id, {
          id,
          name: String(job.name),
          sources: ['project_team'],
        });
      });

      setUserJobs(Array.from(mergedById.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching user jobs:', error);
      setUserJobs([]);
    }
  };

  const fetchLoginAudit = async () => {
    try {
      const { data, error } = await supabase.from('user_login_audit').select('*').eq('user_id', userId).order('login_time', { ascending: false }).limit(20);
      if (!error) setLoginAudit(data || []);
    } catch (error) {
      console.error('Error fetching login audit:', error);
    }
  };

  const fetchUserEmail = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await supabase.functions.invoke('get-user-email', { body: { userId, companyId: currentCompany?.id } });
      if (response.data?.email) setUserEmail(response.data.email);
      setLastSignInAt(response.data?.lastSignInAt || null);
    } catch (error) {
      console.error('Error fetching user email:', error);
    }
  };

  const fetchUserFiles = async () => {
    if (!currentCompany?.id || !userId || !userFilesFeatureAvailable) return;
    setFilesLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_profile_files')
        .select('id,file_name,file_url,file_type,file_size,label,description,created_at,uploaded_by')
        .eq('company_id', currentCompany.id)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUserFiles((data || []) as UserProfileFile[]);
    } catch (error: any) {
      if (error?.code === 'PGRST205' || error?.status === 404) {
        setUserFilesFeatureAvailable(false);
        setUserFiles([]);
        return;
      }
      console.error('Error fetching user profile files:', error);
    } finally {
      setFilesLoading(false);
    }
  };

  const handleUploadUserFile = async () => {
    if (!selectedUploadFile || !currentCompany?.id || !userId || !profile?.user_id) {
      toast({
        title: 'Missing information',
        description: 'Select a file before uploading.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingUserFile(true);
    try {
      const sanitizedName = selectedUploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${currentCompany.id}/user-profile-files/${userId}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-files')
        .upload(filePath, selectedUploadFile, {
          upsert: false,
          contentType: selectedUploadFile.type || undefined,
        });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('company-files').getPublicUrl(filePath);
      const fileUrl = publicData?.publicUrl || '';

      const { error: insertError } = await (supabase as any)
        .from('user_profile_files')
        .insert({
          company_id: currentCompany.id,
          user_id: userId,
          file_name: selectedUploadFile.name,
          file_url: fileUrl,
          file_path: filePath,
          file_type: selectedUploadFile.type || null,
          file_size: selectedUploadFile.size || null,
          label: fileLabel || null,
          description: fileDescription || null,
          uploaded_by: profile.user_id,
          is_active: true,
        });
      if (insertError) throw insertError;

      toast({
        title: 'Uploaded',
        description: `${selectedUploadFile.name} uploaded.`,
      });
      setSelectedUploadFile(null);
      setFileLabel('');
      setFileDescription('');
      await fetchUserFiles();
    } catch (error) {
      console.error('Error uploading user file:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload file.',
        variant: 'destructive',
      });
    } finally {
      setUploadingUserFile(false);
    }
  };

  const handleDeleteUserFile = async (fileId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('user_profile_files')
        .update({ is_active: false })
        .eq('id', fileId);
      if (error) throw error;

      toast({
        title: 'Removed',
        description: 'File removed from this user profile.',
      });
      await fetchUserFiles();
    } catch (error) {
      console.error('Error removing user profile file:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove file.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenPreview = (file: UserProfileFile) => {
    setPreviewDoc({
      fileName: file.file_name,
      url: file.file_url,
      type: file.file_type || '',
    });
    setPreviewOpen(true);
  };

  const handleSendPasswordReset = async () => {
    if (!currentCompany?.id) {
      toast({ title: "Error", description: "Select a company before sending password resets", variant: "destructive" });
      return;
    }
    const email = userEmail || user?.email;
    if (!email) {
      toast({ title: "Error", description: "No email address found for this user", variant: "destructive" });
      return;
    }
    setSendingReset(true);
    try {
      const response = await supabase.functions.invoke('send-password-reset', {
        body: {
          email,
          companyId: currentCompany?.id,
          redirectTo: `${window.location.origin}/auth`,
        }
      });
      if (response.error) throw new Error(response.error.message || 'Failed to send password reset');
      toast({ title: "Success", description: `Password reset email sent to ${email}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send password reset email", variant: "destructive" });
    } finally {
      setSendingReset(false);
    }
  };

  const handleStartEdit = () => {
    if (!user) return;
    setEditForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      display_name: user.display_name || '',
      email: userEmail || user.email || '',
      phone: user.phone || '',
      birthday: user.birthday || '',
      role: user.custom_role_id ? `custom_${user.custom_role_id}` : (user.role === 'owner' ? 'admin' : user.role),
      status: user.status || 'approved',
    });
    setSelectedGroupId(user.group_id || null);
    setEditing(true);
  };

  const handleSetPassword = async () => {
    if (!currentCompany?.id || !user?.user_id) {
      toast({ title: "Error", description: "Missing company or user context", variant: "destructive" });
      return;
    }

    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }

    setSettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-user-password', {
        body: {
          userId: user.user_id,
          companyId: currentCompany.id,
          password: newPassword,
        },
      });
      if (error) throw new Error(error.message || 'Failed to set password');
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({ title: "Success", description: "Password updated successfully" });
      setSetPasswordOpen(false);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to set password", variant: "destructive" });
    } finally {
      setSettingPassword(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const persistAvatarUrl = async (avatarUrl: string | null) => {
    if (!user?.user_id) return;

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('user_id', user.user_id);

    if (error) throw error;

    setUser((prev) => (prev ? { ...prev, avatar_url: avatarUrl || undefined } : null));
  };

  const uploadAvatarFile = async (file?: File | null) => {
    if (!file || !user?.user_id) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.user_id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await persistAvatarUrl(data.publicUrl);

      toast({
        title: 'Avatar updated',
        description: 'The user avatar was updated successfully.',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to update the user avatar.',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    await uploadAvatarFile(file);
  };

  const handleLibraryAvatarSelect = async (avatarUrl: string) => {
    if (!user?.user_id) return;

    setUploadingAvatar(true);
    try {
      await persistAvatarUrl(avatarUrl);
      setShowAvatarLibrary(false);
      toast({
        title: 'Avatar updated',
        description: 'The user avatar was updated from the library.',
      });
    } catch (error) {
      console.error('Error applying avatar library image:', error);
      toast({
        title: 'Update failed',
        description: 'Failed to apply the selected avatar.',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const startCamera = async () => {
    try {
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' } },
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      setStream(mediaStream);
      setShowCamera(true);

      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 0);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Camera unavailable',
        description: 'Unable to access the camera on this device.',
        variant: 'destructive',
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      stopCamera();
      await uploadAvatarFile(file);
      setShowAvatarLibrary(false);
    }, 'image/jpeg', 0.85);
  };

  const handleRemoveAvatar = async () => {
    if (!user?.user_id) return;

    setUploadingAvatar(true);
    try {
      await persistAvatarUrl(null);
      setShowAvatarLibrary(false);
      toast({
        title: 'Avatar removed',
        description: 'The user avatar was removed successfully.',
      });
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast({
        title: 'Remove failed',
        description: 'Failed to remove the user avatar.',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const triggerJobAccessSave = () => {
    if (isVendorUser) return;
    const jobAccessEl = document.getElementById('job-access-section');
    if (!jobAccessEl) return;
    const saveBtn = jobAccessEl.querySelector<HTMLButtonElement>('[data-save-jobs]');
    saveBtn?.click();
  };

  const handleSaveEdit = async () => {
    if (!user || !currentCompany) return;
    setSaving(true);
    try {
      const previousStatus = String(user.status || '').toLowerCase();
      const nextStatus = String(editForm.status || '').toLowerCase();
      const becameApproved = previousStatus !== 'approved' && nextStatus === 'approved';

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          display_name: editForm.display_name,
          phone: editForm.phone || null,
          birthday: editForm.birthday || null,
          status: editForm.status,
          group_id: selectedGroupId || null,
        })
        .eq('user_id', user.user_id);
      if (profileError) throw profileError;

      const nextEmail = (editForm.email || '').trim().toLowerCase();
      const currentEmail = (userEmail || user.email || '').trim().toLowerCase();
      if (canEditUserEmail && nextEmail && nextEmail !== currentEmail) {
        const { data: updateEmailData, error: updateEmailError } = await supabase.functions.invoke('update-user-email', {
          body: {
            userId: user.user_id,
            email: nextEmail,
            companyId: currentCompany.id,
          },
        });

        if (updateEmailError) {
          throw new Error(updateEmailError.message || 'Failed to update user email');
        }
        if (updateEmailData?.error) {
          throw new Error(updateEmailData.error);
        }

        setUserEmail(nextEmail);
      }

      const isCustomRoleSelection = editForm.role.startsWith('custom_');
      const selectedCustomRoleId = isCustomRoleSelection ? editForm.role.replace('custom_', '') : null;
      const selectedBaseRole = isCustomRoleSelection ? 'employee' : editForm.role;
      const nextVendorId = selectedBaseRole === 'vendor' ? selectedVendorId : null;

      // Update company-specific role (custom roles use employee base role)
      const { error: roleError } = await supabase
        .from('user_company_access')
        .update({ role: selectedBaseRole as any })
        .eq('user_id', user.user_id)
        .eq('company_id', currentCompany.id);
      if (roleError) throw roleError;

      const { error: customRoleError } = await supabase
        .from('profiles')
        .update({ custom_role_id: selectedCustomRoleId, vendor_id: nextVendorId })
        .eq('user_id', user.user_id);
      if (customRoleError) throw customRoleError;

      // Keep legacy and junction group membership models aligned
      const { data: companyGroupRows } = await supabase
        .from('employee_groups')
        .select('id')
        .eq('company_id', currentCompany.id);

      const companyGroupIds = (companyGroupRows || []).map((g: any) => g.id);
      if (companyGroupIds.length > 0) {
        await supabase
          .from('employee_group_members')
          .delete()
          .eq('user_id', user.user_id)
          .in('group_id', companyGroupIds);
      }

      if (selectedGroupId) {
        if (!profile?.user_id) {
          throw new Error('Missing current user context for group membership save');
        }
        await supabase
          .from('employee_group_members')
          .insert({
            group_id: selectedGroupId,
            user_id: user.user_id,
            created_by: profile.user_id,
          });
      }

      // Keep intake queue state aligned with profile status to avoid stale pending badges.
      if (nextStatus === 'approved' || nextStatus === 'rejected') {
        const { error: requestSyncError } = await supabase
          .from('company_access_requests')
          .update({
            status: nextStatus as any,
            reviewed_by: profile?.user_id || null,
            reviewed_at: new Date().toISOString(),
          })
          .eq('company_id', currentCompany.id)
          .eq('user_id', user.user_id)
          .eq('status', 'pending');

        if (requestSyncError) {
          console.warn('Failed to sync company access request status:', requestSyncError);
        }
      }

      if (becameApproved) {
        const { error: notifyError } = await supabase.functions.invoke('notify-user-approved', {
          body: {
            userId: user.user_id,
            companyId: currentCompany.id,
          },
        });
        if (notifyError) {
          console.warn('User approval email notification failed:', notifyError);
        }
      }

      setUser(prev => prev ? {
        ...prev,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        display_name: editForm.display_name,
        phone: editForm.phone || null,
        birthday: editForm.birthday || null,
        status: editForm.status,
        role: selectedBaseRole,
        custom_role_id: selectedCustomRoleId,
        group_id: selectedGroupId || null,
        vendor_id: nextVendorId,
      } : null);
      if (selectedBaseRole === 'vendor') {
        const linked = vendors.find((vendor) => vendor.id === nextVendorId) || null;
        setAssociatedVendor(linked);
        if (nextVendorId) {
          await fetchVendorJobs(nextVendorId);
        } else {
          setVendorJobs([]);
        }
      } else {
        setAssociatedVendor(null);
        setSelectedVendorId(null);
        setVendorJobs([]);
      }
      triggerJobAccessSave();
      setEditing(false);
      toast({ title: "Success", description: "User updated successfully" });
    } catch (error) {
      console.error('Error saving user:', error);
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" });
    } finally {
    setSaving(false);
  }
};

  const handleRemoveUser = async () => {
    if (!currentCompany || !userId) return;
    setRemoving(true);
    try {
      const { error } = await supabase
        .from('user_company_access')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('company_id', currentCompany.id);

      if (error) throw error;

      toast({ title: 'User removed', description: 'The user has been removed from this company.' });
      navigate('/settings/users');
    } catch (error) {
      console.error('Error removing user:', error);
      toast({ title: 'Error', description: 'Failed to remove user.', variant: 'destructive' });
    } finally {
      setRemoving(false);
    }
  };

  const handleExternalStatusUpdate = async (nextStatus: 'approved' | 'rejected') => {
    if (!currentCompany || !user) return;

    try {
      setSaving(true);

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          status: nextStatus,
          approved_by: nextStatus === 'approved' ? profile?.user_id || null : null,
          approved_at: nextStatus === 'approved' ? new Date().toISOString() : null,
        })
        .eq('user_id', user.user_id);

      if (profileError) throw profileError;

      const { error: requestSyncError } = await supabase
        .from('company_access_requests')
        .update({
          status: nextStatus as any,
          reviewed_by: profile?.user_id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('company_id', currentCompany.id)
        .eq('user_id', user.user_id)
        .eq('status', 'pending');

      if (requestSyncError) {
        console.warn('Failed to sync company access request status:', requestSyncError);
      }

      if (nextStatus === 'approved') {
        const { error: notifyError } = await supabase.functions.invoke('notify-user-approved', {
          body: {
            userId: user.user_id,
            companyId: currentCompany.id,
          },
        });
        if (notifyError) {
          console.warn('User approval email notification failed:', notifyError);
        }
      }

      setUser((prev) => (prev ? {
        ...prev,
        status: nextStatus,
        approved_by: nextStatus === 'approved' ? profile?.user_id || undefined : undefined,
        approved_at: nextStatus === 'approved' ? new Date().toISOString() : undefined,
      } : null));

      toast({
        title: nextStatus === 'approved' ? 'Access granted' : 'Access denied',
        description:
          nextStatus === 'approved'
            ? `${displayName} can now access this company.`
            : `${displayName}'s company access was denied.`,
      });
    } catch (error) {
      console.error('Error updating external user status:', error);
      toast({
        title: 'Error',
        description: `Failed to ${nextStatus === 'approved' ? 'approve' : 'reject'} access.`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center"><span className="loading-dots">Loading user details</span></div>;
  if (!user) return <div className="p-6 text-center">User not found</div>;

  const displayName = user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unnamed User';
  const initials = user.display_name?.[0]?.toUpperCase() || user.first_name?.[0]?.toUpperCase() || 'U';
  const isSelf = profile?.user_id === userId;
  const isVendorUser = user.role === 'vendor';
  const isDesignProfessionalUser = user.role === 'design_professional';
  const isExternalAccessUser = isVendorUser || isDesignProfessionalUser;
  const isEmployeeLikeRole = ['employee'].includes(String(user.role || '').toLowerCase());
  const shouldShowWebsiteJobAccess = !isVendorUser && !isEmployeeLikeRole;
  const assignedCustomRole = user.custom_role_id ? customRoles.find((r) => r.id === user.custom_role_id) : null;

  const getAppLabel = (source?: string) => {
    if (source === 'punch_clock') return 'Punch Clock';
    if (source === 'pmlynk') return 'PM Lynk';
    return 'BuilderLynk Web';
  };

  const getAppBadgeVariant = (source?: string) => {
    if (source === 'punch_clock') return 'secondary';
    if (source === 'pmlynk') return 'default';
    return 'outline';
  };

  if (isExternalAccessUser) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/settings/users?tab=' + (isDesignProfessionalUser ? 'design-professional-access' : 'vendor-access'))}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {isDesignProfessionalUser ? 'Design Professional Access' : 'Vendor Access'}
          </Button>
          {canManage && !isSelf && user.status === 'pending' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => void handleExternalStatusUpdate('rejected')}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                Deny Access
              </Button>
              <Button
                disabled={saving}
                onClick={() => void handleExternalStatusUpdate('approved')}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Grant Access
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isDesignProfessionalUser ? 'Design Professional Access' : 'Vendor Access'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20 shrink-0">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-3xl font-bold">{displayName}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={roleColors[user.role] || 'bg-muted'}>
                      {roleLabels[user.role] || user.role}
                    </Badge>
                    <Badge className={statusColors[user.status] || 'bg-muted'}>
                      {user.status}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{isDesignProfessionalUser ? 'Design professional portal account' : 'Vendor portal account'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Added {new Date(user.created_at).toLocaleDateString()}</span>
                  </div>
                  {isVendorUser && associatedVendor && (
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      <span>Vendor Account: {associatedVendor.name}</span>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
                  {isDesignProfessionalUser
                    ? 'This design professional uses their own BuilderLYNK account. From your side, you can review their status here and see which jobs they are attached to through the project team.'
                    : 'This vendor user signs in through their own BuilderLYNK vendor account. From your side, you can review their status here and see which jobs and RFPs are shared with this vendor account.'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account Status</p>
              <p className="mt-1 text-sm font-semibold">{user.status || 'pending'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {isDesignProfessionalUser ? 'Attached Jobs' : 'Shared Jobs'}
              </p>
              <p className="mt-1 text-2xl font-bold">{isVendorUser ? vendorJobs.length : userJobs.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Portal Relationship</p>
              <p className="mt-1 text-sm font-semibold">
                {isDesignProfessionalUser
                  ? 'Independent design account'
                  : associatedVendor
                    ? `Linked to ${associatedVendor.name}`
                    : 'No vendor account linked'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              {isDesignProfessionalUser ? 'Project Team Jobs' : 'Job Access'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isVendorUser ? (
              !associatedVendor ? (
                <p className="text-sm text-muted-foreground">
                  No vendor account is assigned to this user yet.
                </p>
              ) : vendorJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No jobs or RFP-backed jobs are currently assigned to this vendor account.
                </p>
              ) : (
                <div className="space-y-2">
                  {vendorJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between rounded-md border p-3">
                      <span className="font-medium">{job.name}</span>
                      <Badge variant="outline">
                        {job.sources.includes('vendor_job_access') && job.sources.includes('rfp_invite')
                          ? 'Vendor Access + RFP'
                          : job.sources.includes('rfp_invite')
                            ? 'Shared Through RFP'
                            : 'Managed from Vendor / Job Access'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )
            ) : userJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This design professional is not currently attached to any project teams on this company.
              </p>
            ) : (
              <div className="space-y-2">
                {userJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between rounded-md border p-3">
                    <span className="font-medium">{job.name}</span>
                    <Badge variant="outline">Managed from Project Team</Badge>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Remove access from the job itself by editing that job’s Project Team.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(fromCompanyManagement ? '/settings/company-management' : fromEmployees ? '/employees' : '/settings/users')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {fromCompanyManagement ? 'Back to Company Management' : fromEmployees ? 'Back to All Employees' : 'Back to Users'}
        </Button>
        <div className="flex items-center gap-2">
          {canManage && !isSelf && (
            <AlertDialog onOpenChange={(open) => { if (!open) setRemoveConfirmName(''); }}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove User
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove User from Company</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will revoke <strong>{displayName}</strong>'s access to this company. To confirm, type their full name below.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  placeholder={displayName}
                  value={removeConfirmName}
                  onChange={(e) => setRemoveConfirmName(e.target.value)}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={removeConfirmName !== displayName || removing}
                    onClick={handleRemoveUser}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {removing ? 'Removing...' : 'Remove User'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={triggerJobAccessSave} size="sm" disabled={isVendorUser}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
        capture={isMobile ? ('environment' as any) : (undefined as any)}
      />
      <AvatarLibraryDialog
        open={showAvatarLibrary}
        onOpenChange={setShowAvatarLibrary}
        category={avatarLibraryCategory}
        onCategoryChange={setAvatarLibraryCategory}
        availableCategories={[]}
        systemLibraries={systemAvatarLibraries}
        customAvatars={settings.avatarLibrary?.customAvatars}
        selectedAvatarUrl={user.avatar_url}
        onSelect={(avatarUrl) => { void handleLibraryAvatarSelect(avatarUrl); }}
        disabled={uploadingAvatar}
        title={`Change Avatar for ${displayName}`}
        description="Choose from this company’s assigned avatar libraries, shared system albums, or custom company avatars."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingAvatar}
              onClick={() => {
                if (isMobile) {
                  cameraInputRef.current?.click();
                  return;
                }
                void startCamera();
              }}
            >
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
            {user.avatar_url ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploadingAvatar}
                onClick={() => void handleRemoveAvatar()}
              >
                Remove Avatar
              </Button>
            ) : null}
          </>
        }
      />
      <Dialog open={showCamera} onOpenChange={(open) => {
        if (!open) stopCamera();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Take a Photo</DialogTitle>
            <DialogDescription>Capture a new avatar photo for this user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg border bg-black"
              style={{ maxHeight: '320px' }}
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={stopCamera}>
                Cancel
              </Button>
              <Button type="button" onClick={capturePhoto} disabled={uploadingAvatar}>
                <Camera className="mr-2 h-4 w-4" />
                Capture
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'profile' | 'files')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">User Profile</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
      {/* User Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>User Profile</CardTitle>
            {canManage && !editing && (
              <Button variant="outline" size="sm" onClick={handleStartEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {editing && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            <div className="flex w-32 shrink-0 flex-col items-center gap-3">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              {editing && canManage && (
                <div className="flex w-full flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingAvatar}
                    onClick={() => setShowAvatarLibrary(true)}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingAvatar ? 'Uploading...' : 'Change Avatar'}
                  </Button>
                  {user.avatar_url && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={uploadingAvatar}
                      onClick={() => void handleRemoveAvatar()}
                    >
                      Remove Avatar
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 space-y-4">
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_first_name">First Name</Label>
                      <Input id="edit_first_name" value={editForm.first_name} onChange={(e) => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="edit_last_name">Last Name</Label>
                      <Input id="edit_last_name" value={editForm.last_name} onChange={(e) => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit_display_name">Display Name</Label>
                    <Input id="edit_display_name" value={editForm.display_name} onChange={(e) => setEditForm(f => ({ ...f, display_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editForm.email}
                        disabled={!canEditUserEmail}
                        onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_phone">Phone</Label>
                      <Input id="edit_phone" value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="edit_birthday">Birthdate</Label>
                      <Input id="edit_birthday" type="date" value={editForm.birthday || ''} onChange={(e) => setEditForm(f => ({ ...f, birthday: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Role</Label>
                      <Select
                        value={editForm.role}
                        onValueChange={(v) => {
                          if (v === ADD_ROLE_OPTION_VALUE) {
                            navigate('/settings/users?tab=roles');
                            return;
                          }
                          setEditForm(f => ({ ...f, role: v }));
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INTERNAL_ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                          {editForm.role === 'vendor' && (
                            <SelectItem value={editForm.role} disabled>
                              {roleLabels[editForm.role]} (Vendor Portal)
                            </SelectItem>
                          )}
                          {customRoles.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                Custom Roles
                              </div>
                              {customRoles.map((customRole) => (
                                <SelectItem key={customRole.id} value={`custom_${customRole.id}`}>
                                  {customRole.role_name}
                                </SelectItem>
                              ))}
                            </>
                          )}
                          <SelectItem value={ADD_ROLE_OPTION_VALUE}>
                            + Add Role
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Group</Label>
                      <Select
                        value={selectedGroupId || '__none__'}
                        onValueChange={(v) => setSelectedGroupId(v === '__none__' ? null : v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No Group</SelectItem>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {editForm.role === 'vendor' && (
                    <div>
                      <Label>Vendor Account</Label>
                      <Select
                        value={selectedVendorId || '__none__'}
                        onValueChange={(value) => setSelectedVendorId(value === '__none__' ? null : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not Linked</SelectItem>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        This vendor user will inherit access from this vendor account.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="text-3xl font-bold">{displayName}</h2>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={roleColors[user.role] || 'bg-muted'}>
                        {assignedCustomRole ? `${assignedCustomRole.role_name} (Custom)` : (roleLabels[user.role] || user.role)}
                      </Badge>
                      <Badge className={statusColors[user.status] || 'bg-muted'}>
                        {user.status}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{userEmail || user.email || 'Not set'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{user.phone || 'Not set'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{user.birthday ? new Date(user.birthday).toLocaleDateString() : 'Not set'}</span>
                    </div>
                    {user.department && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{user.department}</span>
                      </div>
                    )}
                    {associatedVendor && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Store className="h-4 w-4" />
                        <span>Vendor Account: {associatedVendor.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Password Reset Action */}
              {!editing && canChangeUserPassword && (userEmail || user.email) && (
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4" />
                        Send Password Reset Email
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Send Password Reset Email</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will send a password reset email to <strong>{userEmail || user.email}</strong>. 
                          The user will receive a link to create a new password.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSendPasswordReset} disabled={sendingReset}>
                          {sendingReset ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>) : 'Send Reset Email'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => setSetPasswordOpen(true)}
                  >
                    <Key className="h-4 w-4" />
                    Set Password
                  </Button>
                </div>
              )}

              {!editing && user.notes && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <p className="text-muted-foreground">{user.notes}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Apps */}
      {canManage && ['admin', 'controller', 'project_manager', 'employee'].includes(user.role) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Mobile Apps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PIN Settings */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="text-sm font-semibold">Set PIN</h3>
                <UserPinSettings
                  userId={user.user_id}
                  currentPin={user.pin_code}
                  userName={displayName}
                />
              </div>

              {/* App Access Toggles */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="text-sm font-semibold">App Access</h3>
                <p className="text-xs text-muted-foreground">
                  One PIN is shared across all apps.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="font-medium">Punch Clock</Label>
                      <p className="text-xs text-muted-foreground">Punch in/out access</p>
                    </div>
                    <Switch
                      checked={user.punch_clock_access !== false}
                      onCheckedChange={async (checked) => {
                        const { error } = await supabase.from('profiles').update({ punch_clock_access: checked }).eq('user_id', user.user_id);
                        if (!error) {
                          setUser(prev => prev ? { ...prev, punch_clock_access: checked } : null);
                          toast({ title: "Updated", description: `Punch Clock access ${checked ? 'enabled' : 'disabled'}` });
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="font-medium">PM Lynk</Label>
                      <p className="text-xs text-muted-foreground">PM Lynk mobile access</p>
                    </div>
                    <Switch
                      checked={user.pm_lynk_access === true}
                      onCheckedChange={async (checked) => {
                        const { error } = await supabase.from('profiles').update({ pm_lynk_access: checked }).eq('user_id', user.user_id);
                        if (!error) {
                          setUser(prev => prev ? { ...prev, pm_lynk_access: checked } : null);
                          toast({ title: "Updated", description: `PM Lynk access ${checked ? 'enabled' : 'disabled'}` });
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={setPasswordOpen} onOpenChange={(open) => {
        setSetPasswordOpen(open);
        if (!open) {
          setNewPassword('');
          setConfirmNewPassword('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set User Password</DialogTitle>
            <DialogDescription>
              Enter a new password for {displayName}. The user can use it immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="set-password">New Password</Label>
              <Input
                id="set-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-set-password">Confirm Password</Label>
              <Input
                id="confirm-set-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetPasswordOpen(false)} disabled={settingPassword}>
              Cancel
            </Button>
            <Button onClick={handleSetPassword} disabled={settingPassword}>
              {settingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting...
                </>
              ) : (
                'Set Password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Company Access - Only show when accessed from Company Management */}
      {fromCompanyManagement && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UserCompanyAccess userId={userId!} />
          </CardContent>
        </Card>
      )}

      {!isVendorUser && (
        shouldShowWebsiteJobAccess && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Website / PM Job Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This user does not currently have any BuilderLink website or PM job access.
                </p>
              ) : (
                <div className="space-y-2">
                  {userJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <span className="font-medium">{job.name}</span>
                      <div className="flex items-center gap-2">
                        {job.sources.includes('project_team') && (
                          <Badge variant="outline">Project Team</Badge>
                        )}
                        {job.sources.includes('job_access') && (
                          <Badge variant="outline">Job Access</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                This is view-only and reflects BuilderLink website / PM access. Punch Clock assignments are managed separately below.
              </p>
            </CardContent>
          </Card>
        )
      )}

      {!isVendorUser && (
        <div id="job-access-section">
          <UserJobAccess
            userId={userId!}
            userRole={user.role}
            title="Punch Clock Job Assignments & Cost Codes"
            description={`Control which jobs and cost codes this user can access in the punch clock app.`}
          />
        </div>
      )}

      {isVendorUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Vendor Job Access (View Only)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!associatedVendor ? (
              <p className="text-sm text-muted-foreground">
                No vendor account is assigned to this user yet.
              </p>
            ) : vendorJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No jobs or RFP-backed jobs are currently assigned to this vendor account.
              </p>
            ) : (
              <div className="space-y-2">
                {vendorJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between rounded-md border p-3">
                    <span className="font-medium">{job.name}</span>
                    <Badge variant="outline">
                      {job.sources.includes('vendor_job_access') && job.sources.includes('rfp_invite')
                        ? 'Vendor Access + RFP'
                        : job.sources.includes('rfp_invite')
                          ? 'RFP Access'
                          : 'View Only'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Job and RFP access for vendor users is managed from the vendor account.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Login Audit Trail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Login History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loginAudit.length > 0 ? (
            <div className="space-y-2">
              {loginAudit.map((audit) => (
                <div
                  key={audit.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {audit.success !== false ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(audit.login_time).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {audit.login_method && (
                          <span className="capitalize">{audit.login_method}</span>
                        )}
                        {audit.logout_time && (
                          <span>• Logged out: {new Date(audit.logout_time).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getAppBadgeVariant(audit.app_source) as any}>
                      {getAppLabel(audit.app_source)}
                    </Badge>
                    {audit.user_agent && (
                      <Badge variant="outline" className="text-xs max-w-32 truncate" title={audit.user_agent}>
                        {audit.user_agent.includes('Mobile') ? 'Mobile' : 'Desktop'}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              {lastSignInAt ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>
                      Last sign-in: {new Date(lastSignInAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Showing auth fallback because no audit rows were found yet.
                  </p>
                </div>
              ) : (
                "No login history available"
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="files" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              User Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(canManage || isSelf) ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border rounded-lg">
                <Input
                  type="file"
                  onChange={(e) => setSelectedUploadFile(e.target.files?.[0] || null)}
                  className="md:col-span-2"
                />
                <Select value={fileLabel} onValueChange={setFileLabel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Label" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="W-9">W-9</SelectItem>
                    <SelectItem value="W-2">W-2</SelectItem>
                    <SelectItem value="Photo ID">Photo ID</SelectItem>
                    <SelectItem value="Write-up">Write-up</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleUploadUserFile} disabled={!selectedUploadFile || uploadingUserFile}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingUserFile ? 'Uploading...' : 'Upload'}
                </Button>
                <Input
                  placeholder="Description (optional)"
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  className="md:col-span-4"
                />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">You do not have access to upload files for this user.</div>
            )}

            {filesLoading ? (
              <div className="text-sm text-muted-foreground"><span className="loading-dots">Loading files</span></div>
            ) : userFiles.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No files uploaded for this user.</div>
            ) : (
              <div className="space-y-2">
                {userFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between border rounded-md p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{file.file_name}</p>
                        {file.label && (
                          <Badge variant="outline">{file.label}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {file.description || 'No description'} • {new Date(file.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenPreview(file)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      {canManage && (
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteUserFile(file.id)}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isDesignProfessionalUser && userJobs.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                These jobs reflect project team membership on this builder company.
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>

      <DocumentPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        document={previewDoc}
      />
    </div>
  );
}
