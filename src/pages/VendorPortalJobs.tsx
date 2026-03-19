import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { useVendorPortalData } from "@/hooks/useVendorPortalData";
import { useState } from "react";
import { Building2, CalendarDays } from "lucide-react";

export default function VendorPortalJobs() {
  const navigate = useNavigate();
  const { loading, jobs } = useVendorPortalData();
  const [query, setQuery] = useState("");

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) =>
      [job.name, job.company_name, job.project_number, job.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [jobs, query]);

  if (loading) {
    return <PremiumLoadingScreen text="Loading shared jobs..." />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-foreground">All Jobs</h1>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search jobs, builders, status, or project number"
          className="max-w-md"
        />
      </div>

      {filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            No jobs match your search.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredJobs.map((job) => (
            <button
              key={job.id}
              type="button"
              className="text-left"
              onClick={() => navigate(`/vendor/jobs/${job.id}`)}
            >
              <Card className="h-full transition-colors hover:border-primary hover:bg-muted/30">
                <CardContent className="flex gap-4 p-4">
                  <div className="h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {job.image_url ? (
                      <img src={job.image_url} alt={job.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Building2 className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {job.company_logo_url ? (
                            <img src={job.company_logo_url} alt={job.company_name || "Builder"} className="h-8 w-auto max-w-[140px] object-contain" />
                          ) : (
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{job.company_name || "Builder company"}</p>
                          )}
                        </div>
                        <h2 className="truncate text-lg font-semibold text-foreground">{job.name}</h2>
                      </div>
                      {job.status ? <Badge variant="outline">{job.status}</Badge> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {job.project_number ? <span>#{job.project_number}</span> : null}
                      {job.start_date ? (
                        <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(job.start_date).toLocaleDateString()}</span>
                      ) : null}
                      <Badge variant={job.can_submit_bills ? "default" : "secondary"}>{job.can_submit_bills ? "Billing Enabled" : "View Only"}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {job.can_view_plans && <Badge variant="outline">Plans</Badge>}
                      {(job.can_view_rfis || job.can_submit_rfis) && <Badge variant="outline">RFIs</Badge>}
                      {(job.can_view_submittals || job.can_submit_submittals) && <Badge variant="outline">Submittals</Badge>}
                      {job.can_view_photos && <Badge variant="outline">Photos</Badge>}
                      {(job.can_view_rfps || job.can_submit_bids) && <Badge variant="outline">RFPs / Bids</Badge>}
                      {job.can_view_subcontracts && <Badge variant="outline">Subcontracts</Badge>}
                      {job.can_access_messages && <Badge variant="outline">Messages</Badge>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
