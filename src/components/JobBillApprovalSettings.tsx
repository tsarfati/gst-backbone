import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Job {
  id: string;
  name: string;
}

interface JobApprovalSetting {
  id?: string;
  job_id: string;
  require_approval: boolean;
  approval_roles: string[];
  approver_user_ids: string[];
}

interface User {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
}

const availableRoles = [
  { value: "admin", label: "Admin" },
  { value: "controller", label: "Controller" },
  { value: "project_manager", label: "Project Manager" },
];

export default function JobBillApprovalSettings() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [settings, setSettings] = useState<JobApprovalSetting | null>(null);

  useEffect(() => {
    if (currentCompany) {
      fetchJobs();
      fetchUsers();
    }
  }, [currentCompany]);

  useEffect(() => {
    if (selectedJobId) {
      fetchJobSettings();
    } else {
      setSettings(null);
    }
  }, [selectedJobId]);

  const fetchJobs = async () => {
    if (!currentCompany) return;

    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchUsers = async () => {
    if (!currentCompany) return;

    try {
      const { data, error } = await supabase
        .from('user_company_access')
        .select(`
          user_id,
          profiles (
            first_name,
            last_name,
            role
          )
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (error) throw error;

      const formattedUsers = data
        ?.map((item: any) => ({
          user_id: item.user_id,
          first_name: item.profiles?.first_name || '',
          last_name: item.profiles?.last_name || '',
          role: item.profiles?.role || '',
        }))
        .filter(user => user.first_name && user.last_name) || [];

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchJobSettings = async () => {
    if (!currentCompany || !selectedJobId) return;

    try {
      const { data, error } = await supabase
        .from('job_bill_approval_settings')
        .select('*')
        .eq('job_id', selectedJobId)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          job_id: data.job_id,
          require_approval: data.require_approval,
          approval_roles: data.approval_roles || [],
          approver_user_ids: data.approver_user_ids || [],
        });
      } else {
        setSettings({
          job_id: selectedJobId,
          require_approval: false,
          approval_roles: [],
          approver_user_ids: [],
        });
      }
    } catch (error) {
      console.error('Error fetching job settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    if (!currentCompany || !settings || !selectedJobId) return;

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('job_bill_approval_settings')
        .upsert({
          job_id: selectedJobId,
          company_id: currentCompany.id,
          require_approval: settings.require_approval,
          approval_roles: settings.approval_roles,
          approver_user_ids: settings.approver_user_ids,
          created_by: user.id,
        }, {
          onConflict: 'job_id,company_id'
        });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Job bill approval settings have been updated",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Failed to save settings",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role: string) => {
    if (!settings) return;

    const newRoles = settings.approval_roles.includes(role)
      ? settings.approval_roles.filter(r => r !== role)
      : [...settings.approval_roles, role];

    setSettings({ ...settings, approval_roles: newRoles });
  };

  const toggleApprover = (userId: string) => {
    if (!settings) return;

    const newApprovers = settings.approver_user_ids.includes(userId)
      ? settings.approver_user_ids.filter(id => id !== userId)
      : [...settings.approver_user_ids, userId];

    setSettings({ ...settings, approver_user_ids: newApprovers });
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.user_id === userId);
    return user ? `${user.first_name} ${user.last_name}` : 'Unknown User';
  };

  return (
    <div className="space-y-6 py-4 border-t">
      <div className="space-y-2">
        <Label className="text-lg font-semibold">Job-Specific Bill Approval Settings</Label>
        <p className="text-sm text-muted-foreground">
          Configure approval requirements for bills on specific jobs
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="job-select">Select Job</Label>
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger id="job-select">
              <SelectValue placeholder="Select a job..." />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {settings && (
          <div className="space-y-6 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="require-approval">Require Bill Approval for this Job</Label>
                <p className="text-sm text-muted-foreground">
                  Bills for this job must be approved before payment
                </p>
              </div>
              <Switch
                id="require-approval"
                checked={settings.require_approval}
                onCheckedChange={(checked) => setSettings({ ...settings, require_approval: checked })}
              />
            </div>

            {settings.require_approval && (
              <>
                <div className="space-y-3">
                  <Label>Approval Roles</Label>
                  <p className="text-sm text-muted-foreground">
                    Select which roles can approve bills for this job
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableRoles.map((role) => (
                      <Badge
                        key={role.value}
                        variant={settings.approval_roles.includes(role.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleRole(role.value)}
                      >
                        {role.label}
                        {settings.approval_roles.includes(role.value) && (
                          <X className="ml-1 h-3 w-3" />
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Specific Approvers</Label>
                  <p className="text-sm text-muted-foreground">
                    Select specific users who can approve bills for this job
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {users.map((user) => (
                      <Badge
                        key={user.user_id}
                        variant={settings.approver_user_ids.includes(user.user_id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleApprover(user.user_id)}
                      >
                        {user.first_name} {user.last_name}
                        {settings.approver_user_ids.includes(user.user_id) && (
                          <X className="ml-1 h-3 w-3" />
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Button
              onClick={handleSaveSettings}
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Job Approval Settings
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
