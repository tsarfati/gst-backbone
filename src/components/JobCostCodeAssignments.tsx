import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Building, CheckSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Job {
  id: string;
  name: string;
  address?: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
  type?: string;
  job_id?: string;
}

export interface JobCostCodes {
  jobId: string;
  costCodeIds: string[];
}

interface JobCostCodeAssignmentsProps {
  companyId: string;
  assignedJobs: string[];
  jobCostCodes: JobCostCodes[];
  onJobsChange: (jobs: string[]) => void;
  onCostCodesChange: (jobCostCodes: JobCostCodes[]) => void;
}

export default function JobCostCodeAssignments({
  companyId,
  assignedJobs,
  jobCostCodes,
  onJobsChange,
  onCostCodesChange
}: JobCostCodeAssignmentsProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      loadJobs();
      loadCostCodes();
    }
  }, [companyId]);

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, address')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCostCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('id, code, description, type, job_id')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setCostCodes(data || []);
    } catch (error) {
      console.error('Error loading cost codes:', error);
    }
  };

  const toggleJobAssignment = (jobId: string) => {
    const updatedJobs = assignedJobs.includes(jobId)
      ? assignedJobs.filter(id => id !== jobId)
      : [...assignedJobs, jobId];
    
    // Remove cost codes for unassigned jobs
    const updatedJobCostCodes = jobCostCodes.filter(jcc => 
      updatedJobs.includes(jcc.jobId)
    );
    
    onJobsChange(updatedJobs);
    onCostCodesChange(updatedJobCostCodes);
  };

  const toggleCostCodeForJob = (jobId: string, costCodeId: string) => {
    const jobCostCodesIndex = jobCostCodes.findIndex(jcc => jcc.jobId === jobId);
    const updatedJobCostCodes = [...jobCostCodes];
    
    if (jobCostCodesIndex >= 0) {
      const currentCostCodes = updatedJobCostCodes[jobCostCodesIndex].costCodeIds;
      if (currentCostCodes.includes(costCodeId)) {
        updatedJobCostCodes[jobCostCodesIndex].costCodeIds = currentCostCodes.filter(id => id !== costCodeId);
      } else {
        updatedJobCostCodes[jobCostCodesIndex].costCodeIds.push(costCodeId);
      }
    } else {
      updatedJobCostCodes.push({
        jobId,
        costCodeIds: [costCodeId]
      });
    }
    
    onCostCodesChange(updatedJobCostCodes);
  };

  const getJobCostCodes = (jobId: string) => {
    return costCodes.filter(cc => 
      cc.job_id === jobId && 
      cc.type === 'labor'
    );
  };

  const isCostCodeSelectedForJob = (jobId: string, costCodeId: string) => {
    const jobCostCode = jobCostCodes.find(jcc => jcc.jobId === jobId);
    return jobCostCode?.costCodeIds.includes(costCodeId) || false;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading job assignments...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Job Assignments & Cost Codes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {jobs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No active jobs found. Create jobs to assign them to employees.
          </div>
        ) : (
          jobs.map((job) => {
            const jobCostCodesList = getJobCostCodes(job.id);
            const isJobAssigned = assignedJobs.includes(job.id);
            
            return (
              <div key={job.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`job-${job.id}`}
                      checked={isJobAssigned}
                      onChange={() => toggleJobAssignment(job.id)}
                      className="rounded"
                    />
                    <Label htmlFor={`job-${job.id}`} className="font-semibold cursor-pointer">
                      {job.name}
                    </Label>
                  </div>
                  {job.address && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {job.address}
                    </div>
                  )}
                </div>
                
                {isJobAssigned && jobCostCodesList.length > 0 && (
                  <div className="ml-6 mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <CheckSquare className="h-4 w-4" />
                      <span>Assigned Cost Codes (Labor Tasks)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {jobCostCodesList.map((costCode) => {
                        const isSelected = isCostCodeSelectedForJob(job.id, costCode.id);
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
                            <Label 
                              htmlFor={`cc-${costCode.id}`}
                              className="cursor-pointer flex-1"
                            >
                              <Badge variant="outline" className="mr-2">
                                {costCode.code}
                              </Badge>
                              <span className="text-sm">{costCode.description}</span>
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {isJobAssigned && jobCostCodesList.length === 0 && (
                  <div className="ml-6 text-sm text-muted-foreground italic">
                    No labor cost codes available for this job
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}