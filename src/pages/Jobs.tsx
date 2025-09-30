import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building, Plus } from "lucide-react";
import UnifiedViewSelector from "@/components/ui/unified-view-selector";
import { useUnifiedViewPreference } from "@/hooks/useUnifiedViewPreference";
import JobCard from "@/components/JobCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

export default function Jobs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentView, setCurrentView, setDefaultView, isDefault } = useUnifiedViewPreference('jobs-view', 'list');

  useEffect(() => {
    if (user && currentCompany) {
      // Clear previous company's jobs to avoid cross-company bleed
      setJobs([]);
      loadJobs();

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
  }, [user, currentCompany]);

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
      
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

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

      const mapped = filtered.map((j: any) => ({
        id: j.id,
        name: j.name,
        client: j.client,
        budget: j.budget_total ? `$${Number(j.budget_total).toLocaleString()}` : "$0",
        spent: "$0",
        receipts: 0,
        startDate: j.start_date || "-",
        status: j.status || "planning",
        company_id: j.company_id, // Keep company_id for debugging
      }));
      
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
      case "list":
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
      case "compact":
        return (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => handleJobClick(job)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{job.name}</h3>
                    <p className="text-sm text-muted-foreground">{job.client}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{job.budget}</p>
                    <p className="text-sm text-muted-foreground">{job.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      case "super-compact":
        return (
          <div className="space-y-1">
            {jobs.map((job) => (
              <div 
                key={job.id} 
                className="flex items-center justify-between p-2 border rounded hover:bg-accent/50 transition-colors cursor-pointer"
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
          <p className="text-muted-foreground">
            Manage projects and view associated receipts
          </p>
        </div>
        <div className="flex items-center gap-4">
          <UnifiedViewSelector 
            currentView={currentView} 
            onViewChange={setCurrentView}
            onSetDefault={setDefaultView}
            isDefault={isDefault}
          />
          <Button onClick={() => navigate("/jobs/add")}>
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
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