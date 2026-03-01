import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Building2, Calendar, FolderOpen, Layers, PieChart, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export default function JobReports() {
  const [period, setPeriod] = useState("6months");
  const [groupBy, setGroupBy] = useState("status");
  const { currentCompany } = useCompany();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!currentCompany?.id) { setJobs([]); setLoadingJobs(false); return; }
      setLoadingJobs(true);
      const { data } = await supabase
        .from('jobs')
        .select('id, name, client, status, start_date, end_date')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setJobs(data || []);
      setLoadingJobs(false);
    };
    load();
  }, [currentCompany?.id]);

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Job Reports</h1>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status">Group by Status</SelectItem>
              <SelectItem value="costcode">Group by Cost Code</SelectItem>
              <SelectItem value="vendor">Group by Vendor</SelectItem>
              <SelectItem value="month">Group by Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">Export</Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <Badge className="mt-2" variant="default">Current period</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
            <p className="text-sm text-muted-foreground">All active jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Duration</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 days</div>
            <p className="text-sm text-muted-foreground">From start to completion</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On‑time Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
            <p className="text-sm text-muted-foreground">Planned vs actual</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" /> Jobs by {groupBy === "status" ? "Status" : groupBy === "costcode" ? "Cost Code" : groupBy === "vendor" ? "Vendor" : "Month"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No data available yet. Start creating jobs to see insights here.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" /> Budget Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Charts will appear when there is sufficient data.</p>
          </CardContent>
        </Card>
      </div>

      {/* Jobs grid */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingJobs ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="h-24 rounded-md bg-muted animate-pulse" />
                    <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {jobs.map((job) => (
                  <Card key={job.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{job.name}</h3>
                        <Badge variant="outline">{job.status || 'N/A'}</Badge>
                      </div>
                      {job.client && <p className="text-sm text-muted-foreground mt-1">{job.client}</p>}
                      <p className="text-xs text-muted-foreground mt-2">
                        {job.start_date || '—'}{job.end_date ? ` • ${job.end_date}` : ''}
                      </p>
                    </CardContent>
                  </Card>
                ))}
                {jobs.length === 0 && (
                  <p className="text-sm text-muted-foreground">No jobs found.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Top Vendors by Job Count
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[].map(() => null)}
            <p className="text-sm text-muted-foreground">No vendors found for the selected period.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
