import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Loader2, Save, Building, Calendar } from "lucide-react";

interface UserJobAccessProps {
  userId: string;
  userRole: string;
}

interface Job {
  id: string;
  name: string;
  client?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  project_manager_user_id?: string;
}

export default function UserJobAccess({ userId, userRole }: UserJobAccessProps) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [userJobAccess, setUserJobAccess] = useState<Record<string, boolean>>({});
  const [hasGlobalAccess, setHasGlobalAccess] = useState(false);

  useEffect(() => {
    loadJobAccess();
  }, [userId, currentCompany?.id]);

  const loadJobAccess = async () => {
    if (!currentCompany?.id) return;
    
    setLoading(true);
    try {
      // Load jobs for current company only
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('id, name, client, status, start_date, end_date, project_manager_user_id')
        .eq('company_id', currentCompany.id)
        .order('name');

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);

      // Load user's global job access setting
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('has_global_job_access')
        .eq('user_id', userId)
        .single();

      if (profileError) throw profileError;
      setHasGlobalAccess(profileData?.has_global_job_access || false);

      // Load user's specific job access
      const { data: accessData, error: accessError } = await supabase
        .from('user_job_access')
        .select('job_id')
        .eq('user_id', userId);

      if (accessError) throw accessError;

      const accessMap: Record<string, boolean> = {};
      accessData?.forEach(access => {
        accessMap[access.job_id] = true;
      });
      setUserJobAccess(accessMap);

    } catch (error) {
      console.error('Error loading job access:', error);
      toast({
        title: "Error",
        description: "Failed to load job access permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalAccessChange = async (globalAccess: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ has_global_job_access: globalAccess })
        .eq('user_id', userId);

      if (error) throw error;

      setHasGlobalAccess(globalAccess);
      
      // If enabling global access, clear specific job permissions
      if (globalAccess) {
        await supabase
          .from('user_job_access')
          .delete()
          .eq('user_id', userId);
        setUserJobAccess({});
      }

      toast({
        title: "Success",
        description: `Global job access ${globalAccess ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error updating global access:', error);
      toast({
        title: "Error",
        description: "Failed to update global job access",
        variant: "destructive",
      });
    }
  };

  const handleJobAccessChange = (jobId: string, hasAccess: boolean) => {
    setUserJobAccess(prev => ({
      ...prev,
      [jobId]: hasAccess
    }));
  };

  const saveJobAccess = async () => {
    setSaving(true);
    try {
      // Delete existing job access
      await supabase
        .from('user_job_access')
        .delete()
        .eq('user_id', userId);

      // Insert new job access permissions
      const accessEntries = Object.entries(userJobAccess)
        .filter(([_, hasAccess]) => hasAccess)
        .map(async ([jobId, _]) => ({
          user_id: userId,
          job_id: jobId,
          granted_by: (await supabase.auth.getUser()).data.user?.id
        }));

      const resolvedEntries = await Promise.all(accessEntries);

      if (resolvedEntries.length > 0) {
        const { error } = await supabase
          .from('user_job_access')
          .insert(resolvedEntries);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Job access permissions updated successfully",
      });
    } catch (error) {
      console.error('Error saving job access:', error);
      toast({
        title: "Error",
        description: "Failed to save job access permissions",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getJobStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'on_hold': return 'destructive';
      case 'planning': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading job access...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Job Access Permissions</CardTitle>
        {!hasGlobalAccess && (
          <Button onClick={saveJobAccess} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Access Toggle */}
        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="global-access" className="text-sm font-medium">
                Global Job Access
              </Label>
              <div className="text-xs text-muted-foreground">
                Grant access to all jobs and their associated bills
              </div>
            </div>
            <Switch
              id="global-access"
              checked={hasGlobalAccess}
              onCheckedChange={handleGlobalAccessChange}
            />
          </div>
        </div>

        {/* Individual Job Access */}
        {!hasGlobalAccess && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Select specific jobs this user can access. This includes viewing job details, associated bills, and related documents.
            </div>
            
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No jobs found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {jobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`job-${job.id}`} className="text-sm font-medium">
                          {job.name}
                        </Label>
                        {job.status && (
                          <Badge variant={getJobStatusColor(job.status)} className="text-xs">
                            {job.status.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {job.client && (
                          <div className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            <span>Client: {job.client}</span>
                          </div>
                        )}
                        {(job.start_date || job.end_date) && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {job.start_date && new Date(job.start_date).toLocaleDateString()}
                              {job.start_date && job.end_date && ' - '}
                              {job.end_date && new Date(job.end_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Switch
                      id={`job-${job.id}`}
                      checked={userJobAccess[job.id] || false}
                      onCheckedChange={(checked) => handleJobAccessChange(job.id, checked)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {hasGlobalAccess && (
          <div className="text-center py-8 text-muted-foreground">
            <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>User has global access to all jobs</p>
            <p className="text-xs">Disable global access to configure specific job permissions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}