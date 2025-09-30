import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  MapPin
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

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
}

interface Job {
  id: string;
  name: string;
}

export default function UserDetails() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userJobs, setUserJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const roleColors: Record<string, string> = {
    admin: 'bg-destructive',
    controller: 'bg-primary',
    project_manager: 'bg-accent',
    employee: 'bg-muted'
  };

  const statusColors: Record<string, string> = {
    approved: 'bg-green-500',
    pending: 'bg-yellow-500',
    rejected: 'bg-red-500'
  };

  useEffect(() => {
    if (userId && currentCompany) {
      fetchUserDetails();
      fetchUserJobs();
    }
  }, [userId, currentCompany]);

  const fetchUserDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      setUser(data);
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
      const { data, error } = await supabase
        .from('user_job_access')
        .select('job_id, jobs(id, name)')
        .eq('user_id', userId);

      if (error) throw error;
      
      const jobs = data?.map((item: any) => item.jobs).filter(Boolean) || [];
      setUserJobs(jobs);
    } catch (error) {
      console.error('Error fetching user jobs:', error);
    }
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
          onClick={() => navigate('/settings/users')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
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

      {/* Access & Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Access & Permissions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <span className="font-medium">Global Job Access</span>
            <Badge variant={user.has_global_job_access ? "default" : "secondary"}>
              {user.has_global_job_access ? "Enabled" : "Disabled"}
            </Badge>
          </div>

          {!user.has_global_job_access && userJobs.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Assigned Jobs ({userJobs.length})
              </h3>
              <div className="grid gap-2">
                {userJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <span>{job.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!user.has_global_job_access && userJobs.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              No specific jobs assigned
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
