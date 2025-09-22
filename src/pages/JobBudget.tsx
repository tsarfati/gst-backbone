import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calculator, DollarSign } from "lucide-react";
import JobBudgetManager from "@/components/JobBudgetManager";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function JobBudget() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [job, setJob] = useState<any>(null);
  const [selectedCostCodes, setSelectedCostCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setJob(data);

          // Fetch selected cost codes for this job
          const { data: codes, error: codesError } = await supabase
            .from('cost_codes')
            .select('*')
            .eq('job_id', id)
            .eq('is_active', true);

          if (!codesError && codes) {
            setSelectedCostCodes(codes);
          }
        }
      } catch (err) {
        console.error('Error:', err);
        toast({
          title: "Error",
          description: "Failed to load job details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id, toast]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-12 text-muted-foreground">Loading budget details...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate(`/jobs/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Job Not Found</h1>
            <p className="text-muted-foreground">Unable to load budget details</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/jobs/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{job.name} - Budget</h1>
            <p className="text-muted-foreground">Manage job budget and cost allocations</p>
          </div>
        </div>
      </div>

      {/* Budget Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${job.budget_total ? Number(job.budget_total).toLocaleString() : '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Allocated across {selectedCostCodes.length} cost codes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Actual Costs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              $0
            </div>
            <p className="text-xs text-muted-foreground">
              Spent to date
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${job.budget_total ? Number(job.budget_total).toLocaleString() : '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Available to spend
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Manager */}
      <JobBudgetManager 
        jobId={id!} 
        jobName={job.name}
        selectedCostCodes={selectedCostCodes}
      />
    </div>
  );
}