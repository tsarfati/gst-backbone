import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, Loader2, Save } from "lucide-react";

interface UserWebsiteJobAssignmentsProps {
  userId: string;
  canManage?: boolean;
}

interface Job {
  id: string;
  name: string;
  status?: string;
}

export default function UserWebsiteJobAssignments({ userId, canManage = true }: UserWebsiteJobAssignmentsProps) {
  const { currentCompany } = useCompany();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobAccess, setJobAccess] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, [userId, currentCompany?.id]);

  const loadData = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const [{ data: jobsData, error: jobsError }, { data: accessData, error: accessError }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, name, status")
          .eq("company_id", currentCompany.id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("user_job_access")
          .select("job_id")
          .eq("user_id", userId),
      ]);

      if (jobsError) throw jobsError;
      if (accessError) throw accessError;

      setJobs((jobsData as Job[]) || []);
      const nextMap: Record<string, boolean> = {};
      (accessData || []).forEach((row: any) => {
        nextMap[row.job_id] = true;
      });
      setJobAccess(nextMap);
    } catch (error) {
      console.error("Error loading website job access:", error);
      toast({
        title: "Error",
        description: "Failed to load website job assignments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from("user_job_access").delete().eq("user_id", userId);

      const rows = Object.entries(jobAccess)
        .filter(([_, checked]) => checked)
        .map(([jobId]) => ({
          user_id: userId,
          job_id: jobId,
          granted_by: profile?.user_id,
        }));

      if (rows.length > 0) {
        const { error: insertError } = await supabase.from("user_job_access").insert(rows);
        if (insertError) throw insertError;
      }

      toast({
        title: "Saved",
        description: "Website / PM Lynk job access updated successfully",
      });
    } catch (error) {
      console.error("Error saving website job access:", error);
      const e = error as any;
      toast({
        title: "Error",
        description: e?.message ? `Failed to save website job access: ${e.message}` : "Failed to save website job access",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading website job access...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Website / PM Lynk Job Access
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select which jobs this user can access in the BuilderLYNK website and PM Lynk. This is separate from Punch Clock cost code assignments.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {jobs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No active jobs found</div>
          ) : (
            jobs.map((job) => (
              <label
                key={job.id}
                className="flex items-center justify-between gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/20"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!jobAccess[job.id]}
                    onChange={() =>
                      setJobAccess((prev) => ({ ...prev, [job.id]: !prev[job.id] }))
                    }
                    className="rounded"
                    disabled={!canManage}
                  />
                  <span className="font-medium">{job.name}</span>
                </div>
                {job.status && (
                  <Badge variant="outline" className="text-xs">
                    {job.status.replaceAll("_", " ")}
                  </Badge>
                )}
              </label>
            ))
          )}
        </div>

        {!canManage && (
          <p className="text-xs text-muted-foreground">
            Only administrators/controllers can edit website job access.
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !canManage}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Website Job Access"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
