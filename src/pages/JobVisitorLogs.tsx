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

export default function JobVisitorLogs() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jobName, setJobName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadJobDetails();
    }
  }, [id]);

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
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-12 text-muted-foreground">Invalid job ID</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading visitor logs...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(`/jobs/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Visitor Management</h1>
          <p className="text-muted-foreground">{jobName}</p>
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
          <VisitorDashboard jobId={id!} companyName={companyName} />
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