import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CalendarRange, Search } from "lucide-react";
import JobScheduleTab from "@/components/JobScheduleTab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useActionPermissions } from "@/hooks/useActionPermissions";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";
import { supabase } from "@/integrations/supabase/client";

interface ScheduleJob {
  id: string;
  name: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  company_id: string;
  project_number: string | null;
  address: string | null;
  customer?: {
    name: string | null;
    display_name?: string | null;
  } | null;
}

export default function ConstructionSchedule() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const permissions = useActionPermissions();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<ScheduleJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const {
    loading: jobAccessLoading,
    hasGlobalJobAccess,
    allowedJobIds,
    isPrivileged,
  } = useWebsiteJobAccess();

  const selectedJobId = searchParams.get("jobId") || "";

  useEffect(() => {
    if (!user || !currentCompany?.id || jobAccessLoading) return;
    void loadJobs();
  }, [user, currentCompany?.id, jobAccessLoading, hasGlobalJobAccess, isPrivileged, allowedJobIds.join(",")]);

  const loadJobs = async () => {
    if (!currentCompany?.id) return;

    try {
      setLoading(true);

      if (!isPrivileged && !hasGlobalJobAccess && allowedJobIds.length === 0) {
        setJobs([]);
        return;
      }

      let query = supabase
        .from("jobs")
        .select(`
          id,
          name,
          status,
          start_date,
          end_date,
          company_id,
          project_number,
          address,
          customer:customers(name, display_name)
        `)
        .eq("company_id", currentCompany.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (!isPrivileged && !hasGlobalJobAccess) {
        query = query.in("id", allowedJobIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      setJobs(((data || []) as ScheduleJob[]).filter((job) => job.company_id === currentCompany.id));
    } catch (error) {
      console.error("Failed to load schedule jobs:", error);
      toast({
        title: "Error",
        description: "Failed to load jobs for the schedule workspace.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return jobs;

    return jobs.filter((job) => {
      const customerName = String(job.customer?.display_name || job.customer?.name || "").toLowerCase();
      return [
        job.name,
        job.project_number || "",
        job.address || "",
        customerName,
      ].some((value) => String(value).toLowerCase().includes(query));
    });
  }, [jobs, search]);

  const selectedJob = filteredJobs.find((job) => job.id === selectedJobId)
    || jobs.find((job) => job.id === selectedJobId)
    || null;

  const handleSelectJob = (jobId: string) => {
    const next = new URLSearchParams(searchParams);
    if (jobId) {
      next.set("jobId", jobId);
    } else {
      next.delete("jobId");
    }
    setSearchParams(next, { replace: true });
  };

  if (loading) {
    return <PremiumLoadingScreen text="Loading schedule workspace..." />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" />
            Construction Schedule
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Schedule Workspace</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Pick a job to work in a larger schedule view without the job detail tabs. This keeps the
            timeline, dependencies, and assignments in a wider construction workspace.
          </p>
        </div>
        {selectedJob && (
          <Button variant="outline" onClick={() => navigate(`/jobs/${selectedJob.id}?tab=schedule`)}>
            Open Job Detail Schedule
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Select Job</CardTitle>
          <CardDescription>
            Choose which project schedule to open. You can switch jobs here without leaving the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-2">
              <Label htmlFor="schedule-job-search">Search jobs</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="schedule-job-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by job, customer, address, or project number"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Select job</Label>
              <Select value={selectedJobId} onValueChange={handleSelectJob}>
                <SelectTrigger>
                  <SelectValue placeholder={filteredJobs.length ? "Choose a job" : "No jobs available"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.project_number ? `${job.project_number} · ${job.name}` : job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredJobs.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredJobs.slice(0, 6).map((job) => {
                const isSelected = job.id === selectedJobId;
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => handleSelectJob(job.id)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{job.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {job.customer?.display_name || job.customer?.name || "No customer"}
                        </div>
                      </div>
                      <Badge variant={isSelected ? "default" : "outline"}>
                        {job.status || "planning"}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <div>{job.project_number || "No project number"}</div>
                      <div className="truncate">{job.address || "No address"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              No matching jobs found for this schedule workspace.
            </div>
          )}
        </CardContent>
      </Card>

      {selectedJob ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{selectedJob.name}</CardTitle>
                <CardDescription>
                  {selectedJob.customer?.display_name || selectedJob.customer?.name || "No customer"} ·{" "}
                  {selectedJob.project_number || "No project number"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Start</div>
                  <div className="mt-1 text-sm">{selectedJob.start_date || "Not set"}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">End</div>
                  <div className="mt-1 text-sm">{selectedJob.end_date || "Not set"}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</div>
                  <div className="mt-1 text-sm">{selectedJob.address || "Not set"}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Workspace Tools</CardTitle>
                <CardDescription>Quick actions for this schedule.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button variant="outline" onClick={() => navigate(`/jobs/${selectedJob.id}`)}>
                  Open Job Details
                </Button>
                <Button variant="outline" onClick={() => navigate(`/jobs/${selectedJob.id}?tab=schedule`)}>
                  Open Tab View
                </Button>
              </CardContent>
            </Card>
          </div>

          <JobScheduleTab
            jobId={selectedJob.id}
            companyId={selectedJob.company_id}
            canEdit={permissions.canEditJobs()}
            jobStartDate={selectedJob.start_date}
            jobEndDate={selectedJob.end_date}
          />
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex min-h-[280px] items-center justify-center p-10 text-center text-muted-foreground">
            Select a job above to open its full schedule workspace.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
