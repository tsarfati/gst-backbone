import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Building, Plus, FileText, Calculator, DollarSign, Package, Clock, Users, TrendingUp, Camera, ClipboardList, LayoutTemplate, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useActionPermissions } from "@/hooks/useActionPermissions";
import CommittedCosts from "@/components/CommittedCosts";
import JobLocationMap from "@/components/JobLocationMap";
import JobCostBudgetView from "@/components/JobCostBudgetView";
import JobFilingCabinet from "@/components/JobFilingCabinet";
import JobVisitorLogsView from "@/components/JobVisitorLogsView";
import JobForecastingView from "@/components/JobForecastingView";
import JobPhotoAlbum from "@/components/JobPhotoAlbum";
import BillsNeedingCoding from "@/components/BillsNeedingCoding";
import JobPlans from "@/components/JobPlans";
import JobBillingSetup from "@/components/JobBillingSetup";
import JobRFIs from "@/components/JobRFIs";
import JobProjectTeam from "@/components/JobProjectTeam";
import JobExportModal from "@/components/JobExportModal";

interface Job {
  id: string;
  name: string;
  project_number?: string | null;
  customer_id?: string | null;
  client?: string;
  address?: string;
  job_type?: string;
  status?: string;
  budget?: number;
  budget_total?: number;
  start_date?: string;
  end_date?: string;
  description?: string;
  visitor_qr_code?: string;
  created_at?: string;
  customer?: {
    id: string;
    name: string;
    display_name?: string | null;
  } | null;
}

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const permissions = useActionPermissions();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [budgetTotal, setBudgetTotal] = useState<number>(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'details';
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('jobs')
          .select(`
            *,
            customer:customers(id, name, display_name)
          `)
          .eq('id', id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching job:', error);
          toast({
            title: "Error",
            description: "Failed to load job details",
            variant: "destructive",
          });
        } else {
          setJob(data);
          
          // Fetch budget total from job_budgets table
          const { data: budgetData } = await supabase
            .from('job_budgets')
            .select('budgeted_amount')
            .eq('job_id', id);
          
          const total = budgetData?.reduce((sum, item) => sum + Number(item.budgeted_amount || 0), 0) || 0;
          setBudgetTotal(total);
        }
      } catch (err) {
        console.error('Error:', err);
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchJob();

    // Realtime updates for this job
    const channel = supabase
      .channel('job-details-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter: id ? `id=eq.${id}` : undefined,
      }, (payload) => {
        if (payload.new) setJob(payload.new as Job);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, toast]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Loading job details...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/jobs")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Job Not Found</h1>
            <p className="text-muted-foreground">The requested job could not be found</p>
          </div>
        </div>
        
        <Card>
          <CardContent className="p-8 text-center">
            <Building className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">No Job Available</h2>
            <p className="text-muted-foreground mb-4">
              This job doesn&apos;t exist or you don&apos;t have permission to view it.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate("/jobs")}>
                Return to Jobs
              </Button>
              <Button variant="outline" onClick={() => navigate("/jobs/add")}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Job
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate("/jobs")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{job.name}</h1>
          <p className="text-muted-foreground">Job Details</p>
        </div>
        {job.status === 'completed' && (
          <Button variant="outline" size="sm" onClick={() => setExportModalOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Archive Job
          </Button>
        )}
      </div>

      {/* Tabbed Content */}
      <Card>
        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); if (val === 'details') { setSearchParams(prev => { const sp = new URLSearchParams(prev); sp.delete('tab'); return sp; }); } else { setSearchParams(prev => { const sp = new URLSearchParams(prev); sp.set('tab', val); return sp; }); } }} className="w-full">
          <TabsList className="w-full flex-wrap h-auto justify-start rounded-none border-b bg-transparent p-0 gap-0">
            <TabsTrigger 
              value="details" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <FileText className="h-4 w-4 mr-2" />
              Job Details
            </TabsTrigger>
            <TabsTrigger 
              value="committed-costs" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Committed Costs
            </TabsTrigger>
            <TabsTrigger 
              value="cost-budget"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Cost Codes & Budget
            </TabsTrigger>
            <TabsTrigger 
              value="forecasting"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Forecasting
            </TabsTrigger>
            <TabsTrigger 
              value="plans"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <LayoutTemplate className="h-4 w-4 mr-2" />
              Plans
            </TabsTrigger>
            <TabsTrigger 
              value="rfis"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              RFIs
            </TabsTrigger>
            <TabsTrigger 
              value="billing"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Billing
            </TabsTrigger>
            {(profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager') && (
              <TabsTrigger 
                value="filing-cabinet"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
              >
                <FileText className="h-4 w-4 mr-2" />
                Filing Cabinet
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="visitor-logs"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <Users className="h-4 w-4 mr-2" />
              Visitor Logs
            </TabsTrigger>
            <TabsTrigger 
              value="photo-album"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <Camera className="h-4 w-4 mr-2" />
              Photos
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="p-6">
            <div className="mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Job Information</CardTitle>
                  {permissions.canEditJobs() && (
                    <Button variant="outline" size="sm" onClick={() => navigate(`/jobs/${id}/edit`)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job / Project Number</label>
                      <p className="text-foreground mt-1">{job.project_number || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</label>
                      <p className="text-foreground mt-1">
                        {job.customer?.display_name || job.customer?.name || 'Not set'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client Contact</label>
                      <p className="text-foreground mt-1">{job.client || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                      <div className="mt-1">
                        <Badge variant="outline">
                          {job.status?.charAt(0).toUpperCase() + job.status?.slice(1) || 'N/A'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Type</label>
                      <div className="mt-1">
                        <Badge variant="outline">
                          {job.job_type?.charAt(0).toUpperCase() + job.job_type?.slice(1) || 'N/A'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Budget</label>
                      <p className="text-foreground mt-1">${budgetTotal.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start Date</label>
                      <p className="text-foreground mt-1">{job.start_date || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End Date</label>
                      <p className="text-foreground mt-1">{job.end_date || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created</label>
                      <p className="text-foreground mt-1">
                        {job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4 pt-1">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</label>
                      <p className="text-foreground mt-1 break-words">{job.address || 'Not set'}</p>
                    </div>
                    <div className="min-w-0 xl:min-w-[220px]">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Visitor QR Code</label>
                      <p className="text-foreground mt-1 truncate">{job.visitor_qr_code || 'Not generated'}</p>
                    </div>
                  </div>

                  {job.description && (
                    <div className="pt-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
                      <p className="text-foreground mt-1 whitespace-pre-wrap">{job.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {(profile?.role === 'project_manager' || profile?.role === 'admin' || profile?.role === 'controller') && (
              <div className="mb-6">
                <BillsNeedingCoding jobId={id!} limit={3} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-6">
              <JobProjectTeam jobId={id!} />
              <JobLocationMap address={job.address} />
            </div>

          </TabsContent>
          
          <TabsContent value="committed-costs" className="p-6">
            <CommittedCosts jobId={id!} />
          </TabsContent>

          <TabsContent value="cost-budget" className="p-6">
            <JobCostBudgetView />
          </TabsContent>

          <TabsContent value="forecasting" className="p-6">
            <JobForecastingView />
          </TabsContent>

          <TabsContent value="plans" className="p-6">
            <JobPlans jobId={id!} />
          </TabsContent>

          <TabsContent value="rfis" className="p-6">
            <JobRFIs jobId={id!} />
          </TabsContent>

          <TabsContent value="billing" className="p-6">
            <JobBillingSetup jobId={id!} />
          </TabsContent>

          <TabsContent value="filing-cabinet" className="p-6">
            <JobFilingCabinet jobId={id!} />
          </TabsContent>


          <TabsContent value="visitor-logs" className="p-6">
            <JobVisitorLogsView />
          </TabsContent>

          <TabsContent value="photo-album" className="p-6">
            <JobPhotoAlbum jobId={id!} />
          </TabsContent>
        </Tabs>
      </Card>

      <JobExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        jobId={id!}
        jobName={job.name}
      />
    </div>
  );
}
