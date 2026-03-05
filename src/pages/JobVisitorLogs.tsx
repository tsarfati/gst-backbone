import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, LayoutDashboard, FileText, Settings } from "lucide-react";
import { VisitorDashboard } from "@/components/VisitorDashboard";
import { VisitorReportsPage } from "@/components/VisitorReportsPage";
import { VisitorLogSettingsEnhanced } from "@/components/VisitorLogSettingsEnhanced";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";
import { canAccessAssignedJobOnly } from "@/utils/jobAccess";

export default function JobVisitorLogs() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  const [jobName, setJobName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && !websiteJobAccessLoading) {
      loadJobDetails();
    }
  }, [id, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  const loadJobDetails = async () => {
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`
          name,
          company_id,
          companies (
            name
          )
        `)
        .eq('id', id)
        .single();

      if (jobError) throw jobError;

      if (!canAccessAssignedJobOnly([id], isPrivileged, allowedJobIds)) {
        toast({
          title: "Access denied",
          description: "You do not have access to this job.",
          variant: "destructive",
        });
        navigate("/jobs");
        return;
      }

      setJobName(jobData.name);
      setCompanyName(jobData.companies?.name || "");
    } catch (error) {
      console.error('Error loading job details:', error);
      toast({
        title: "Error",
        description: "Failed to load job details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!id) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12 text-muted-foreground">Invalid job ID</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center"><span className="loading-dots">Loading visitor logs</span></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(`/jobs/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Visitor Management</h1>
        </div>
      </div>

      {/* Tabbed Navigation */}
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="dashboard" className="flex items-center space-x-2">
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Reports</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <VisitorDashboard jobId={id!} companyName={companyName} jobName={jobName} />
        </TabsContent>

        <TabsContent value="reports">
          <VisitorReportsPage jobId={id!} jobName={jobName} />
        </TabsContent>

        <TabsContent value="settings">
          <VisitorLogSettingsEnhanced jobId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
