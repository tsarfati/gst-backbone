import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  Store
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useTenant } from "@/contexts/TenantContext";
import UserJobAccess from "@/components/UserJobAccess";
import UserCompanyAccess from "@/components/UserCompanyAccess";

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
}

export default function UserDetails() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentCompany } = useCompany();
  const { isSuperAdmin } = useTenant();
  const { toast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userJobs, setUserJobs] = useState<Job[]>([]);
  const [loginAudit, setLoginAudit] = useState<LoginAudit[]>([]);
  const [associatedVendor, setAssociatedVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  
  const fromCompanyManagement = location.state?.fromCompanyManagement || false;

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
    // Super admins can view any user without company context
    if (userId && (currentCompany || isSuperAdmin)) {
      fetchUserDetails();
      fetchUserJobs();
      fetchLoginAudit();
    }
  }, [userId, currentCompany, isSuperAdmin]);

  const fetchUserDetails = async () => {
    try {
      // First try to fetch from profiles table (regular users)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileData) {
        setUser(profileData);
        
        // Fetch associated vendor if user is a vendor
        if (profileData.vendor_id) {
          const { data: vendorData } = await supabase
            .from('vendors')
            .select('id, name')
            .eq('id', profileData.vendor_id)
            .single();
          
          if (vendorData) {
            setAssociatedVendor(vendorData);
          }
        }
        
        setLoading(false);
        return;
      }

      // If not found in profiles, try pin_employees table
      const { data: pinData, error: pinError } = await (supabase as any)
        .from('pin_employees')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (pinError) throw pinError;

      if (pinData) {
        // Transform PIN employee data to match UserProfile interface
        setUser({
          user_id: pinData.id,
          display_name: pinData.display_name || `${pinData.first_name} ${pinData.last_name}`,
          first_name: pinData.first_name,
          last_name: pinData.last_name,
          email: pinData.email,
          phone: pinData.phone,
          role: 'employee',
          status: 'approved',
          has_global_job_access: false,
          avatar_url: pinData.avatar_url,
          created_at: pinData.created_at,
          department: pinData.department,
          notes: pinData.notes
        });
      } else {
        throw new Error('User not found');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserJobs = async () => {
    if (!currentCompany) return;

    try {
      // Try to fetch jobs from user_job_access (regular users)
      const { data: userJobsData, error: userJobsError } = await supabase
        .from('user_job_access')
        .select('job_id, jobs(id, name)')
        .eq('user_id', userId);

      if (userJobsData && userJobsData.length > 0) {
        const jobs = userJobsData.map((item: any) => item.jobs).filter(Boolean) || [];
        setUserJobs(jobs);
        return;
      }

      // If no jobs found, try pin_employee_timecard_settings
      const { data: pinSettingsData } = await (supabase as any)
        .from('pin_employee_timecard_settings')
        .select('assigned_jobs')
        .eq('pin_employee_id', userId)
        .maybeSingle();

      if (pinSettingsData?.assigned_jobs && pinSettingsData.assigned_jobs.length > 0) {
        // Fetch job details for the assigned job IDs
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('id, name')
          .in('id', pinSettingsData.assigned_jobs);

        if (jobsData) {
          setUserJobs(jobsData);
        }
      }
    } catch (error) {
      console.error('Error fetching user jobs:', error);
    }
  };

  const fetchLoginAudit = async () => {
    // TODO: Implement after user_login_audit table is created
    setLoginAudit([]);
  };

  if (loading) {
    return <div className="p-6 text-center">Loading user details...</div>;
  }

  if (!user) {
    return <div className="p-6 text-center">User not found</div>;
  }

  const displayName = user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unnamed User';
  const initials = user.display_name?.[0]?.toUpperCase() || user.first_name?.[0]?.toUpperCase() || 'U';

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(fromCompanyManagement ? '/settings/company' : '/settings/users')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {fromCompanyManagement ? 'Back to Company Management' : 'Back to Users'}
        </Button>
        <Button
          onClick={() => navigate(`/settings/users/${userId}/edit`)}
          className="flex items-center gap-2"
        >
          <Edit className="h-4 w-4" />
          Edit User
        </Button>
      </div>

      {/* User Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>User Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-3xl font-bold">{displayName}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={roleColors[user.role] || 'bg-muted'}>
                    {user.role}
                  </Badge>
                  <Badge className={statusColors[user.status] || 'bg-muted'}>
                    {user.status}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{user.email}</span>
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
              </div>

              {user.notes && (
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Punch Clock Job Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <UserJobAccess userId={userId!} userRole={user.role} />
        </CardContent>
      </Card>


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
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(audit.login_time).toLocaleString()}
                      </p>
                      {audit.logout_time && (
                        <p className="text-xs text-muted-foreground">
                          Logged out: {new Date(audit.logout_time).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {audit.ip_address && (
                    <Badge variant="outline" className="text-xs">
                      {audit.ip_address}
                    </Badge>
                  )}
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
