import { useState, useEffect } from "react";
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
  Key
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import UserJobAccess from "@/components/UserJobAccess";
import UserCompanyAccess from "@/components/UserCompanyAccess";
import { UserPinSettings } from "@/components/UserPinSettings";
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

interface UserProfile {
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  role: string;
  status: string;
  has_global_job_access: boolean;
  avatar_url?: string;
  created_at: string;
  approved_at?: string;
  department?: string;
  notes?: string;
  vendor_id?: string;
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

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  controller: 'Controller',
  project_manager: 'Project Manager',
  employee: 'Employee',
  view_only: 'View Only',
  company_admin: 'Company Admin',
  vendor: 'Vendor'
};

export default function UserDetails() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentCompany } = useCompany();
  const { isSuperAdmin } = useTenant();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userJobs, setUserJobs] = useState<Job[]>([]);
  const [loginAudit, setLoginAudit] = useState<LoginAudit[]>([]);
  const [associatedVendor, setAssociatedVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingReset, setSendingReset] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', display_name: '', role: '', status: '' });
  const [companyRole, setCompanyRole] = useState<string | null>(null);
  const [removeConfirmName, setRemoveConfirmName] = useState('');
  const [removing, setRemoving] = useState(false);
  
  const fromCompanyManagement = location.state?.fromCompanyManagement || false;
  const fromEmployees = location.state?.fromEmployees || false;
  const isAdmin = profile?.role === 'admin';
  const isController = profile?.role === 'controller';
  const canManage = isAdmin || isController;

  const roleColors: Record<string, string> = {
    admin: 'bg-destructive',
    controller: 'bg-primary',
    project_manager: 'bg-accent',
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
      fetchUserJobs();
      fetchLoginAudit();
      fetchUserEmail();
    }
  }, [userId, currentCompany, isSuperAdmin]);

  const fetchUserDetails = async () => {
    try {
      const [profileRes, accessRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        currentCompany ? supabase.from('user_company_access').select('role').eq('user_id', userId!).eq('company_id', currentCompany.id).eq('is_active', true).maybeSingle() : Promise.resolve({ data: null, error: null })
      ]);

      if (profileRes.data) {
        const role = accessRes.data?.role || profileRes.data.role;
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

        const userData = { ...profileRes.data, role, avatar_url: avatarUrl };
        setUser(userData);
        setEditForm({
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          display_name: userData.display_name || '',
          role: role,
          status: userData.status || 'approved',
        });
        
        if (profileRes.data.vendor_id) {
          const { data: vendorData } = await supabase.from('vendors').select('id, name').eq('id', profileRes.data.vendor_id).single();
          if (vendorData) setAssociatedVendor(vendorData);
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

  const fetchUserJobs = async () => {
    if (!currentCompany) return;
    try {
      const { data: userJobsData } = await supabase.from('user_job_access').select('job_id, jobs(id, name)').eq('user_id', userId);
      if (userJobsData && userJobsData.length > 0) {
        setUserJobs(userJobsData.map((item: any) => item.jobs).filter(Boolean));
        return;
      }
      const { data: tcSettings } = await supabase.from('employee_timecard_settings').select('assigned_jobs').eq('user_id', userId).eq('company_id', currentCompany.id).maybeSingle();
      if (tcSettings?.assigned_jobs?.length > 0) {
        const { data: jobsData } = await supabase.from('jobs').select('id, name').in('id', tcSettings.assigned_jobs);
        if (jobsData) setUserJobs(jobsData);
      }
    } catch (error) {
      console.error('Error fetching user jobs:', error);
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
    } catch (error) {
      console.error('Error fetching user email:', error);
    }
  };

  const handleSendPasswordReset = async () => {
    const email = userEmail || user?.email;
    if (!email) {
      toast({ title: "Error", description: "No email address found for this user", variant: "destructive" });
      return;
    }
    setSendingReset(true);
    try {
      const response = await supabase.functions.invoke('send-password-reset', { body: { email, redirectTo: `${window.location.origin}/auth` } });
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
      role: user.role,
      status: user.status || 'approved',
    });
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!user || !currentCompany) return;
    setSaving(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          display_name: editForm.display_name,
          status: editForm.status,
        })
        .eq('user_id', user.user_id);
      if (profileError) throw profileError;

      // Update company-specific role
      const { error: roleError } = await supabase
        .from('user_company_access')
        .update({ role: editForm.role as any })
        .eq('user_id', user.user_id)
        .eq('company_id', currentCompany.id);
      if (roleError) throw roleError;

      setUser(prev => prev ? { ...prev, ...editForm } : null);
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

  if (loading) return <div className="p-6 text-center">Loading user details...</div>;
  if (!user) return <div className="p-6 text-center">User not found</div>;

  const displayName = user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unnamed User';
  const initials = user.display_name?.[0]?.toUpperCase() || user.first_name?.[0]?.toUpperCase() || 'U';
  const isSelf = profile?.user_id === userId;

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
          {isAdmin && !isSelf && (
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
          <Button onClick={() => {
            const jobAccessEl = document.getElementById('job-access-section');
            if (jobAccessEl) {
              const saveBtn = jobAccessEl.querySelector<HTMLButtonElement>('[data-save-jobs]');
              saveBtn?.click();
            }
          }} size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

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
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Role</Label>
                      <Select value={editForm.role} onValueChange={(v) => setEditForm(f => ({ ...f, role: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="controller">Controller</SelectItem>
                          <SelectItem value="project_manager">Project Manager</SelectItem>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="view_only">View Only</SelectItem>
                          <SelectItem value="company_admin">Company Admin</SelectItem>
                          <SelectItem value="vendor">Vendor</SelectItem>
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
                  </div>
                </div>
              ) : (
                <>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(userEmail || user.email) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{userEmail || user.email}</span>
                      </div>
                    )}
                    {user.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                    {user.department && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{user.department}</span>
                      </div>
                    )}
                    {associatedVendor && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Store className="h-4 w-4" />
                        <span>Associated Vendor: {associatedVendor.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="text-xs font-mono break-all">ID: {user.user_id}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Password Reset Action */}
              {!editing && (userEmail || user.email) && (
                <div className="pt-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4" />
                        Send Password Reset
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

      {/* Punch Clock Job Access */}
      <div id="job-access-section">
        <UserJobAccess userId={userId!} userRole={user.role} />
      </div>

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
              No login history available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
