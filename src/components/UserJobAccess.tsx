import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Save, Building, CheckSquare, MapPin, ChevronRight } from "lucide-react";

interface UserJobAccessProps {
  userId: string;
  userRole: string;
  title?: string;
  description?: string;
}

interface Job {
  id: string;
  name: string;
  address?: string;
  client?: string;
  status?: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
  type?: string;
  job_id?: string;
}

export default function UserJobAccess({
  userId,
  userRole,
  title,
  description,
}: UserJobAccessProps) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [userJobAccess, setUserJobAccess] = useState<Record<string, boolean>>({});
  const [userJobCostCodes, setUserJobCostCodes] = useState<Record<string, string[]>>({});
  const [hasGlobalAccess, setHasGlobalAccess] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
  const isFieldEmployee = String(userRole || '').toLowerCase() === 'employee';

  useEffect(() => {
    loadJobAccess();
  }, [userId, currentCompany?.id]);

  const loadJobAccess = async () => {
    if (!currentCompany?.id) return;
    
    setLoading(true);
    try {
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('id, name, address, client, status')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('name');

      if (jobsError) throw jobsError;
      const companyJobs = jobsData || [];
      const companyJobIds = companyJobs.map((job) => job.id);
      setJobs(companyJobs);

      const { data: costCodesData } = await supabase
        .from('cost_codes')
        .select('id, code, description, type, job_id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('code');

      setCostCodes(costCodesData || []);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('has_global_job_access')
        .eq('user_id', userId)
        .maybeSingle();

      setHasGlobalAccess(profileData?.has_global_job_access || false);

      const accessMap: Record<string, boolean> = {};
      const { data: timecardSettingsData, error: timecardSettingsError } = await supabase
        .from('employee_timecard_settings')
        .select('assigned_jobs')
        .eq('user_id', userId)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (timecardSettingsError && timecardSettingsError.code !== 'PGRST116') throw timecardSettingsError;

      const assignedJobIds = (timecardSettingsData?.assigned_jobs || []).filter((jobId: string) => companyJobIds.includes(jobId));
      assignedJobIds.forEach((jobId: string) => {
        accessMap[jobId] = true;
      });
      setUserJobAccess(accessMap);

      let costCodeAccessData: Array<{ job_id: string; cost_code_id: string }> = [];
      if (companyJobIds.length > 0) {
        const { data } = await supabase
          .from('user_job_cost_codes')
          .select('job_id, cost_code_id')
          .eq('user_id', userId)
          .in('job_id', companyJobIds);
        costCodeAccessData = (data || []) as Array<{ job_id: string; cost_code_id: string }>;
      }

      const costCodeMap: Record<string, string[]> = {};
      costCodeAccessData?.forEach((item: any) => {
        if (!costCodeMap[item.job_id]) {
          costCodeMap[item.job_id] = [];
        }
        costCodeMap[item.job_id].push(item.cost_code_id);
      });
      setUserJobCostCodes(costCodeMap);

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
      const { data: profileExists } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profileExists) {
        toast({
          title: "Not Available",
          description: "Global access is not available for PIN employees",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ has_global_job_access: globalAccess })
        .eq('user_id', userId);

      if (error) throw error;

      setHasGlobalAccess(globalAccess);
      
      if (globalAccess) {
        const companyJobIds = jobs.map((job) => job.id);
        const currentUserId = (await supabase.auth.getUser()).data.user?.id || userId;
        const { error: settingsError } = await supabase
          .from('employee_timecard_settings')
          .upsert({
            user_id: userId,
            company_id: currentCompany.id,
            assigned_jobs: [],
            assigned_cost_codes: [],
            created_by: currentUserId
          }, { onConflict: 'user_id,company_id' });
        if (settingsError) throw settingsError;

        if (companyJobIds.length > 0) {
          await supabase.from('user_job_cost_codes').delete().eq('user_id', userId).in('job_id', companyJobIds);
        }
        setUserJobAccess({});
        setUserJobCostCodes({});
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

  const toggleJobAccess = (jobId: string) => {
    setUserJobAccess(prev => {
      const newMap = { ...prev };
      if (newMap[jobId]) {
        delete newMap[jobId];
        setUserJobCostCodes(prevCc => {
          const updated = { ...prevCc };
          delete updated[jobId];
          return updated;
        });
      } else {
        newMap[jobId] = true;
      }
      return newMap;
    });
  };

  const toggleCostCodeForJob = (jobId: string, costCodeId: string) => {
    setUserJobCostCodes(prev => {
      const updated = { ...prev };
      const current = updated[jobId] || [];
      if (current.includes(costCodeId)) {
        updated[jobId] = current.filter(id => id !== costCodeId);
      } else {
        updated[jobId] = [...current, costCodeId];
      }
      return updated;
    });
  };

  const getJobCostCodes = (jobId: string) => {
    return costCodes.filter(cc => cc.job_id === jobId && cc.type === 'labor');
  };

  const isCostCodeSelected = (jobId: string, costCodeId: string) => {
    return (userJobCostCodes[jobId] || []).includes(costCodeId);
  };

  const saveJobAccess = async () => {
    if (!currentCompany?.id) return;
    setSaving(true);
    try {
      const currentUserId = (await supabase.auth.getUser()).data.user?.id || userId;
      const companyJobIds = jobs.map((job) => job.id);

      const jobEntries = Object.entries(userJobAccess)
        .filter(([_, hasAccess]) => hasAccess)
        .filter(([jobId]) => companyJobIds.includes(jobId))
        .map(([jobId]) => ({
          user_id: userId,
          job_id: jobId,
          granted_by: currentUserId
        }));

      const assignedJobs = jobEntries.map((entry) => entry.job_id);
      const assignedCostCodes = Array.from(new Set(
        Object.entries(userJobCostCodes)
          .filter(([jobId]) => assignedJobs.includes(jobId))
          .flatMap(([_, ccIds]) => ccIds)
      ));

      const { error: settingsError } = await supabase
        .from('employee_timecard_settings')
        .upsert({
          user_id: userId,
          company_id: currentCompany.id,
          assigned_jobs: assignedJobs,
          assigned_cost_codes: assignedCostCodes,
          created_by: currentUserId
        }, { onConflict: 'user_id,company_id' });
      if (settingsError) throw settingsError;

      if (companyJobIds.length > 0) {
        const { error: deleteCostCodeError } = await supabase
          .from('user_job_cost_codes')
          .delete()
          .eq('user_id', userId)
          .in('job_id', companyJobIds);
        if (deleteCostCodeError) throw deleteCostCodeError;
      }

      const costCodeEntries: { user_id: string; job_id: string; cost_code_id: string; granted_by: string | undefined }[] = [];
      Object.entries(userJobCostCodes).forEach(([jobId, ccIds]) => {
        if (userJobAccess[jobId]) {
          ccIds.forEach(ccId => {
            costCodeEntries.push({
              user_id: userId,
              job_id: jobId,
              cost_code_id: ccId,
              granted_by: currentUserId
            });
          });
        }
      });

      if (costCodeEntries.length > 0) {
        const { error } = await supabase.from('user_job_cost_codes').insert(costCodeEntries);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Job access and cost code assignments updated successfully",
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

  const toggleJobExpanded = (jobId: string) => {
    setExpandedJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2"><span className="loading-dots">Loading job access</span></span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            {title || 'Job Assignments & Cost Codes'}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {description || `Control which jobs and cost codes this ${isFieldEmployee ? 'field employee' : 'user'} can access in the punch clock app`}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hidden save trigger for parent page */}
        <button data-save-jobs className="hidden" onClick={saveJobAccess} />
        {/* Global Access Toggle */}
        {!isFieldEmployee && (
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="global-access" className="text-sm font-medium">
                  Global Job Access
                </Label>
                <div className="text-xs text-muted-foreground">
                  Grant access to all jobs in the punch clock app
                </div>
              </div>
              <Switch
                id="global-access"
                checked={hasGlobalAccess}
                onCheckedChange={handleGlobalAccessChange}
              />
            </div>
          </div>
        )}

        {/* Individual Job Access with nested Cost Codes - collapsed by default */}
        {(!hasGlobalAccess || isFieldEmployee) && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Select specific jobs and cost codes this {isFieldEmployee ? 'field employee' : 'user'} can access.
            </div>

            {jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active jobs found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => {
                  const isJobAssigned = userJobAccess[job.id] || false;
                  const jobCostCodesList = getJobCostCodes(job.id);
                  const isExpanded = expandedJobs[job.id] || false;
                  const assignedCount = (userJobCostCodes[job.id] || []).length;

                  return (
                    <div key={job.id} className="border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center space-x-3 flex-1">
                          <input
                            type="checkbox"
                            id={`job-${job.id}`}
                            checked={isJobAssigned}
                            onChange={() => toggleJobAccess(job.id)}
                            className="rounded"
                          />
                          <button
                            onClick={() => toggleJobExpanded(job.id)}
                            className="flex items-center gap-2 flex-1 text-left"
                          >
                            <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            <span className="font-medium">{job.name}</span>
                            {job.client && <span className="text-xs text-muted-foreground">({job.client})</span>}
                            <Badge variant="outline" className="text-xs ml-1">
                              {isExpanded ? 'Collapse' : 'Expand'}
                            </Badge>
                          </button>
                          {job.status && (
                            <Badge variant="outline" className="text-xs">
                              {job.status.replace('_', ' ')}
                            </Badge>
                          )}
                          {isJobAssigned && assignedCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {assignedCount} code{assignedCount !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t bg-muted/30 p-3">
                          {job.address && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                              <MapPin className="h-3 w-3" />
                              {job.address}
                            </div>
                          )}

                          {isJobAssigned && jobCostCodesList.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <CheckSquare className="h-4 w-4" />
                                <span>Labor Cost Codes</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {jobCostCodesList.map((costCode) => {
                                  const isSelected = isCostCodeSelected(job.id, costCode.id);
                                  return (
                                    <div
                                      key={costCode.id}
                                      className={`flex items-center space-x-2 p-2 rounded border cursor-pointer transition-colors ${
                                        isSelected
                                          ? 'bg-primary/10 border-primary'
                                          : 'bg-card hover:bg-muted/50'
                                      }`}
                                      onClick={() => toggleCostCodeForJob(job.id, costCode.id)}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleCostCodeForJob(job.id, costCode.id)}
                                        className="rounded"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <Label className="cursor-pointer flex-1">
                                        <Badge variant="outline" className="mr-2">{costCode.code}</Badge>
                                        <span className="text-sm">{costCode.description}</span>
                                      </Label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {isJobAssigned && jobCostCodesList.length === 0 && (
                            <div className="text-sm text-muted-foreground italic">
                              No labor cost codes available for this job
                            </div>
                          )}

                          {!isJobAssigned && (
                            <div className="text-sm text-muted-foreground italic">
                              Enable this job to assign cost codes
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {hasGlobalAccess && userRole !== 'employee' && (
          <div className="text-center py-8 text-muted-foreground">
            <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>User has global access to all jobs in the punch clock</p>
            <p className="text-xs">Disable global access to configure specific job permissions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
