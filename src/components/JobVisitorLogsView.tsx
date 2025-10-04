import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { VisitorDashboardEnhanced } from "@/components/VisitorDashboardEnhanced";
import { VisitorReportsPage } from "@/components/VisitorReportsPage";
import { VisitorLogSettingsEnhanced } from "@/components/VisitorLogSettingsEnhanced";

export default function JobVisitorLogsView() {
  const { id } = useParams();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [jobName, setJobName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadJobDetails();
    }
  }, [id]);

  const loadJobDetails = async () => {
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('name, company_id')
        .eq('id', id)
        .single();

      if (jobError) throw jobError;
      
      setJobName(jobData?.name || '');
      
      if (jobData?.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('name')
          .eq('id', jobData.company_id)
          .single();
        
        setCompanyName(companyData?.name || '');
      }
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
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Invalid job ID
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading visitor logs...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <VisitorDashboardEnhanced 
            jobId={id} 
            companyName={companyName} 
            jobName={jobName}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <VisitorReportsPage jobId={id} jobName={jobName} />
        </TabsContent>
      </Tabs>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visitor Log Settings</DialogTitle>
          </DialogHeader>
          <VisitorLogSettingsEnhanced jobId={id} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
