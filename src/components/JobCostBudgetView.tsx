import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import JobBudgetManager from "@/components/JobBudgetManager";
import JobCostCodeSelector from "@/components/JobCostCodeSelector";
import DynamicBudgetManager from "@/components/DynamicBudgetManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CostCode {
  id: string;
  code: string;
  description: string;
  type?: string;
}

export default function JobCostBudgetView() {
  const { id } = useParams();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCostCodes, setSelectedCostCodes] = useState<CostCode[]>([]);
  const [activeTab, setActiveTab] = useState("budget");

  const isPlanning = job?.status === 'planning';

  useEffect(() => {
    loadData();
  }, [id]);

  // Reload cost codes when switching to budget tab - only if we don't have any yet
  useEffect(() => {
    if (activeTab === "budget" && selectedCostCodes.length === 0) {
      loadCostCodes();
    }
  }, [activeTab, id]);

  const loadCostCodes = async () => {
    try {
      const { data: codes, error: codesError } = await supabase
        .from('cost_codes')
        .select('id, code, description, type')
        .eq('job_id', id)
        .eq('is_active', true);

      if (codesError) throw codesError;

      setSelectedCostCodes(codes || []);
    } catch (error) {
      console.error('Error loading cost codes:', error);
    }
  };

  const loadData = async () => {
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (jobError) throw jobError;
      setJob(jobData);

      const { data: codes, error: codesError } = await supabase
        .from('cost_codes')
        .select('id, code, description, type')
        .eq('job_id', id)
        .eq('is_active', true);

      if (codesError) throw codesError;

      setSelectedCostCodes(codes || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load job data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading budget data...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Job not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isPlanning && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Budget can only be edited when the job is in Planning status.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="dynamic">Dynamic Budgets</TabsTrigger>
          <TabsTrigger value="cost-codes">Cost Codes</TabsTrigger>
        </TabsList>
        <TabsContent value="budget" className="mt-6">
          <JobBudgetManager 
            jobId={id!} 
            jobName={job.name}
            selectedCostCodes={selectedCostCodes}
            jobStatus={job.status}
          />
        </TabsContent>
        <TabsContent value="dynamic" className="mt-6">
          <DynamicBudgetManager jobId={id!} />
        </TabsContent>
        <TabsContent value="cost-codes" className="mt-6">
          <JobCostCodeSelector 
            jobId={id!} 
            selectedCostCodes={selectedCostCodes}
            onSelectedCostCodesChange={setSelectedCostCodes}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
