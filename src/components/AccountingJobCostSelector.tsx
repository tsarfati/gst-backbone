import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Building, Code, Plus, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BudgetStatusDisplay from "@/components/BudgetStatusDisplay";

interface Job {
  id: string;
  name: string;
  status: string;
  budget_total: number;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
  job_id: string;
  type?: string;
}

interface AccountingJobCostSelectorProps {
  selectedJobId?: string;
  selectedCostCodeId?: string;
  onJobChange?: (jobId: string, jobName: string) => void;
  onCostCodeChange?: (costCodeId: string, costCode: string, description: string) => void;
  showCreateButton?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function AccountingJobCostSelector({
  selectedJobId,
  selectedCostCodeId,
  onJobChange,
  onCostCodeChange,
  showCreateButton = true,
  disabled = false,
  className = ""
}: AccountingJobCostSelectorProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (selectedJobId) {
      loadCostCodes(selectedJobId);
    } else {
      setCostCodes([]);
    }
  }, [selectedJobId]);

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, status, budget_total')
        .in('status', ['planning', 'active', 'on-hold'])
        .order('name');

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load jobs",
        variant: "destructive",
      });
    }
  };

  const loadCostCodes = async (jobId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cost_codes')
        .select('id, code, description, job_id, type')
        .eq('job_id', jobId)
        .eq('is_active', true)
        .eq('is_dynamic_group', false)
        .order('code');

      if (error) throw error;
      setCostCodes(data || []);
    } catch (error) {
      console.error('Error loading cost codes:', error);
      toast({
        title: "Error",
        description: "Failed to load cost codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJobChange = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job && onJobChange) {
      onJobChange(jobId, job.name);
    }
  };

  const handleCostCodeChange = (costCodeId: string) => {
    const costCode = costCodes.find(c => c.id === costCodeId);
    if (costCode && onCostCodeChange) {
      onCostCodeChange(costCodeId, costCode.code, costCode.description);
    }
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const selectedCostCode = costCodes.find(c => c.id === selectedCostCodeId);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Job Selection */}
      <div>
        <Label htmlFor="job-select" className="flex items-center gap-2 mb-2">
          <Building className="h-4 w-4" />
          Job Assignment
        </Label>
        <div className="flex gap-2">
          <Select 
            value={selectedJobId || ""} 
            onValueChange={handleJobChange}
            disabled={disabled}
          >
            <SelectTrigger id="job-select">
              <SelectValue placeholder="Select a job" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{job.name}</span>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge 
                        variant={job.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {job.status}
                      </Badge>
                      {job.budget_total > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ${job.budget_total.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showCreateButton && (
            <Button 
              variant="outline" 
              size="icon"
              disabled={disabled}
              onClick={() => window.open('/jobs/add', '_blank')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Cost Code Selection */}
      <div>
        <Label htmlFor="cost-code-select" className="flex items-center gap-2 mb-2">
          <Code className="h-4 w-4" />
          Cost Code
        </Label>
        <div className="flex gap-2">
          <Select 
            value={selectedCostCodeId || ""} 
            onValueChange={handleCostCodeChange}
            disabled={disabled || !selectedJobId}
          >
            <SelectTrigger id="cost-code-select">
              <SelectValue 
                placeholder={
                  !selectedJobId 
                    ? "Select a job first" 
                    : loading 
                    ? "Loading cost codes..." 
                    : "Select a cost code"
                } 
              />
            </SelectTrigger>
            <SelectContent>
              {costCodes.map((costCode) => (
                <SelectItem key={costCode.id} value={costCode.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{costCode.code} - {costCode.description} {costCode.type && `(${costCode.type})`}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showCreateButton && selectedJobId && (
            <Button 
              variant="outline" 
              size="icon"
              disabled={disabled}
              onClick={() => window.open(`/jobs/${selectedJobId}/cost-codes`, '_blank')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Selected Summary */}
      {(selectedJob || selectedCostCode) && (
        <Card>
          <CardContent className="p-3">
            <div className="text-sm space-y-1">
              {selectedJob && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Job:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedJob.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {selectedJob.status}
                    </Badge>
                  </div>
                </div>
              )}
              {selectedCostCode && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cost Code:</span>
                  <div className="text-right">
                    <div className="font-medium">{selectedCostCode.code} - {selectedCostCode.description}</div>
                    {selectedCostCode.type && (
                      <div className="text-xs text-muted-foreground">
                        Type: {selectedCostCode.type}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {selectedJob?.budget_total > 0 && (
                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Job Budget:
                  </span>
                  <span className="font-medium">
                    ${selectedJob.budget_total.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Budget Status Display */}
      {selectedJobId && selectedCostCodeId && (
        <BudgetStatusDisplay
          jobId={selectedJobId}
          costCodeId={selectedCostCodeId}
          showWarning={false}
        />
      )}
    </div>
  );
}