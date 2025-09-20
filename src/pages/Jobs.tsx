import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import JobViewSelector, { ViewType } from "@/components/JobViewSelector";
import JobCard from "@/components/JobCard";
import JobListView from "@/components/JobListView";
import JobCompactView from "@/components/JobCompactView";
import { supabase } from "@/integrations/supabase/client";

export default function Jobs() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<ViewType>("tiles");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        const mapped = data.map((j: any) => ({
          id: j.id,
          name: j.name,
          budget: j.budget ? `$${Number(j.budget).toLocaleString()}` : "$0",
          spent: "$0",
          receipts: 0,
          startDate: j.start_date || "-",
          status: j.status || "planning",
        }));
        setJobs(mapped);
      }
      setLoading(false);
    };
    loadJobs();
  }, []);

  const handleJobClick = (job: any) => {
    navigate(`/job-details/${job.id}`);
  };

  const renderJobs = () => {
    if (jobs.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            <Plus className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No jobs found</p>
            <p className="text-sm">Create your first job to get started</p>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case "tiles":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} onClick={() => handleJobClick(job)} />
            ))}
          </div>
        );
      case "list":
        return <JobListView jobs={jobs} onJobClick={handleJobClick} />;
      case "compact":
        return <JobCompactView jobs={jobs} onJobClick={handleJobClick} />;
      default:
        return null;
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
          <JobViewSelector currentView={currentView} onViewChange={setCurrentView} />
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