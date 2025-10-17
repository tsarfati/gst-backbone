import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Building, Plus, FileText, Calculator, DollarSign, Package, Clock, Users, TrendingUp, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import CommittedCosts from "@/components/CommittedCosts";
import JobLocationMap from "@/components/JobLocationMap";
import JobCostBudgetView from "@/components/JobCostBudgetView";
import JobDeliveryTicketsView from "@/components/JobDeliveryTicketsView";
import JobVisitorLogsView from "@/components/JobVisitorLogsView";
import JobForecastingView from "@/components/JobForecastingView";
import JobPhotoAlbum from "@/components/JobPhotoAlbum";
import BillsNeedingCoding from "@/components/BillsNeedingCoding";


interface Job {
  id: string;
  name: string;
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
}

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [budgetTotal, setBudgetTotal] = useState<number>(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'details';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

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
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-12 text-muted-foreground">Loading job details...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate("/jobs")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{job.name}</h1>
          <p className="text-muted-foreground">Job Details</p>
        </div>
        <Button variant="outline" onClick={() => navigate(`/jobs/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Job
        </Button>
      </div>

      {/* Tabbed Content */}
      <Card>
        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); if (val === 'details') { setSearchParams(prev => { const sp = new URLSearchParams(prev); sp.delete('tab'); return sp; }); } else { setSearchParams(prev => { const sp = new URLSearchParams(prev); sp.set('tab', val); return sp; }); } }} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
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
            {(profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager') && (
              <TabsTrigger 
                value="delivery-tickets"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
              >
                <Package className="h-4 w-4 mr-2" />
                Delivery Tickets
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
              Photo Album
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="p-6">
            {/* Bills Needing Coding for this Job */}
            {(profile?.role === 'project_manager' || profile?.role === 'admin' || profile?.role === 'controller') && (
              <div className="mb-6">
                <BillsNeedingCoding jobId={id!} limit={3} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Job Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {job.client && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Client</label>
                      <p className="text-foreground">{job.client}</p>
                    </div>
                  )}
                  
                  {job.address && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Address</label>
                      <p className="text-foreground">{job.address}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Type</label>
                      <Badge variant="outline" className="ml-2">
                        {job.job_type?.charAt(0).toUpperCase() + job.job_type?.slice(1) || 'N/A'}
                      </Badge>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <Badge variant="outline" className="ml-2">
                        {job.status?.charAt(0).toUpperCase() + job.status?.slice(1) || 'N/A'}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Budget</label>
                    <p className="text-foreground">${budgetTotal.toLocaleString()}</p>
                  </div>

                  {(job.start_date || job.end_date) && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Timeline</label>
                      <p className="text-foreground">
                        {job.start_date && `Start: ${job.start_date}`}
                        {job.start_date && job.end_date && ' • '}
                        {job.end_date && `End: ${job.end_date}`}
                      </p>
                    </div>
                  )}

                  {job.description && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      <p className="text-foreground">{job.description}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Additional Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">QR Code</label>
                        <p className="text-foreground">{job.visitor_qr_code || 'Not generated'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Created</label>
                        <p className="text-foreground">{new Date().toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Location Map */}
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

          <TabsContent value="delivery-tickets" className="p-6">
            <JobDeliveryTicketsView />
          </TabsContent>

          <TabsContent value="visitor-logs" className="p-6">
            <JobVisitorLogsView />
          </TabsContent>

          <TabsContent value="photo-album" className="p-6">
            <JobPhotoAlbum jobId={id!} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}