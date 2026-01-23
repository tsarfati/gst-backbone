import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building, Plus, X } from "lucide-react";
import UnifiedViewSelector from "@/components/ui/unified-view-selector";
import { useUnifiedViewPreference } from "@/hooks/useUnifiedViewPreference";
import JobCard from "@/components/JobCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { useActionPermissions } from "@/hooks/useActionPermissions";
import { Badge } from "@/components/ui/badge";

export default function Jobs() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const { canCreate } = useActionPermissions();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentView, setCurrentView, setDefaultView, isDefault } = useUnifiedViewPreference('jobs-view', 'list');
  
  const customerId = searchParams.get("customerId");
  const [customerName, setCustomerName] = useState<string | null>(null);

  useEffect(() => {
    if (user && currentCompany) {
      // Clear previous company's jobs to avoid cross-company bleed
      setJobs([]);
      loadJobs();
      
      // Load customer name if filtering
      if (customerId) {
        loadCustomerName(customerId);
      } else {
        setCustomerName(null);
      }

      // Live updates for job budget changes
      const channel = supabase
        .channel('jobs-budget-updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: currentCompany ? `company_id=eq.${currentCompany.id}` : undefined,
        }, () => {
          loadJobs();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, currentCompany, customerId]);

  const loadCustomerName = async (custId: string) => {
    const { data } = await supabase
      .from("customers")
      .select("name")
      .eq("id", custId)
      .single();
    setCustomerName(data?.name || null);
  };

  const loadJobs = async () => {
    const companyId = currentCompany?.id;
    if (!user || !companyId) {
      console.log('Missing user or company ID:', { user: !!user, companyId });
      return;
    }
    
    console.log('Loading jobs for company:', companyId, currentCompany?.name);
    
    try {
      setLoading(true);
      
      // Clear any existing jobs first to prevent cross-company contamination
      setJobs([]);
      
      let query = supabase
        .from('jobs')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true);
      
      // Filter by customer if specified
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Raw data from Supabase:', data);

      // Guard against race conditions if company switched mid-request
      if (currentCompany?.id !== companyId) {
        console.log('Company changed during request, aborting');
        return;
      }

      // Triple check filtering to ensure no cross-company data
      const filtered = (data || []).filter((j: any) => {
        const isMatch = j.company_id === companyId;
        if (!isMatch) {
          console.warn('Found job from wrong company:', j.name, 'Company ID:', j.company_id, 'Expected:', companyId);
        }
        return isMatch;
      });

      console.log('Filtered jobs:', filtered.length, 'for company:', companyId);

      // Fetch actual spent amounts and receipt counts for each job
      const jobIds = filtered.map((j: any) => j.id);
      
      // Get actual amounts from job_budgets
      const { data: budgetData } = await supabase
        .from('job_budgets')
        .select('job_id, actual_amount')
        .in('job_id', jobIds.length > 0 ? jobIds : ['00000000-0000-0000-0000-000000000000']);
      
      // Get receipt counts
      const { data: receiptData } = await supabase
        .from('receipts')
        .select('job_id')
        .in('job_id', jobIds.length > 0 ? jobIds : ['00000000-0000-0000-0000-000000000000']);
      
      // Aggregate actual amounts per job
      const spentByJob: Record<string, number> = {};
      (budgetData || []).forEach((b: any) => {
        spentByJob[b.job_id] = (spentByJob[b.job_id] || 0) + (Number(b.actual_amount) || 0);
      });
      
      // Count receipts per job
      const receiptsByJob: Record<string, number> = {};
      (receiptData || []).forEach((r: any) => {
        receiptsByJob[r.job_id] = (receiptsByJob[r.job_id] || 0) + 1;
      });

      const mapped = filtered.map((j: any) => {
        const spent = spentByJob[j.id] || 0;
        const budget = Number(j.budget_total) || 0;
        return {
          id: j.id,
          name: j.name,
          client: j.client,
          budget: budget ? `$${budget.toLocaleString()}` : "$0",
          spent: `$${spent.toLocaleString()}`,
          receipts: receiptsByJob[j.id] || 0,
          startDate: j.start_date || "-",
          status: j.status || "planning",
          company_id: j.company_id, // Keep company_id for debugging
          banner_url: j.banner_url || null,
        };
      });
      
      console.log('Final mapped jobs:', mapped);
      setJobs(mapped);
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load jobs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJobClick = (job: any) => {
    navigate(`/jobs/${job.id}`);
  };

  const renderJobs = () => {
    if (jobs.length === 0) {
      return (
        <div className="text-center py-8">
          <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No jobs found</h3>
          <p className="text-muted-foreground">Get started by creating your first job</p>
        </div>
      );
    }

    switch (currentView) {
      case "icons":
        return (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onClick={() => handleJobClick(job)}
              />
            ))}
          </div>
        );
      case "list":
        return (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-3 font-medium">Job Name</th>
                  <th className="p-3 font-medium">Client</th>
                  <th className="p-3 font-medium text-right">Budget</th>
                  <th className="p-3 font-medium text-right">Spent</th>
                  <th className="p-3 font-medium text-right">Receipts</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Start Date</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const spentValue = parseInt(job.spent.replace(/[$,]/g, '')) || 0;
                  const budgetValue = parseInt(job.budget.replace(/[$,]/g, '')) || 0;
                  const usage = budgetValue > 0 ? Math.round((spentValue / budgetValue) * 100) : 0;
                  return (
                    <tr
                      key={job.id}
                      className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => handleJobClick(job)}
                    >
                      <td className="p-3 font-medium">{job.name}</td>
                      <td className="p-3 text-muted-foreground">{job.client || "-"}</td>
                      <td className="p-3 text-right">{job.budget}</td>
                      <td className="p-3 text-right">{job.spent}</td>
                      <td className="p-3 text-right">{job.receipts}</td>
                      <td className="p-3">
                        <Badge variant={job.status === "active" ? "default" : "secondary"}>
                          {job.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{job.startDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      case "super-compact":
        return (
          <div className="space-y-1">
            {jobs.map((job) => (
              <div 
                key={job.id} 
                className="flex items-center justify-between p-2 border rounded hover:bg-primary/10 hover:border-primary transition-colors cursor-pointer"
                onClick={() => handleJobClick(job)}
              >
                <div className="flex items-center gap-2">
                  <Building className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-medium">{job.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{job.client}</span>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
              </div>
            ))}
          </div>
        );
      default:
        return (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onClick={() => handleJobClick(job)}
              />
            ))}
          </div>
        );
    }
  };

  const clearCustomerFilter = () => {
    setSearchParams({});
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
          <p className="text-muted-foreground">
            Manage projects and view associated receipts
          </p>
          {customerId && customerName && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground">Filtered by customer:</span>
              <Badge variant="secondary" className="gap-1">
                {customerName}
                <button onClick={clearCustomerFilter} className="ml-1 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <UnifiedViewSelector 
            currentView={currentView} 
            onViewChange={setCurrentView}
            onSetDefault={setDefaultView}
            isDefault={isDefault}
          />
          {canCreate('jobs') && (
            <Button onClick={() => navigate("/jobs/add")}>
              <Plus className="h-4 w-4 mr-2" />
              New Job
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading jobs...</div>
      ) : (
        renderJobs()
      )}
    </div>
  );
}