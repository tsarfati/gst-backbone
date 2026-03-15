import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Building2, Copy, Link2, Loader2, Plus, Send, Shuffle } from "lucide-react";

type JobRow = {
  id: string;
  name: string;
  client: string | null;
  description: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  company_id: string;
  created_at: string;
};

type SharedJobRow = {
  id: string;
  job_id: string;
  granted_at: string;
  granted_by: string;
  jobs: JobRow | null;
};

type CompanyRow = {
  id: string;
  name: string;
  display_name: string | null;
  logo_url: string | null;
};

const blankJobForm = {
  name: "",
  client: "",
  start_date: "",
  end_date: "",
  description: "",
};

export default function DesignProfessionalJobs() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [submittingHandoff, setSubmittingHandoff] = useState(false);
  const [ownedJobs, setOwnedJobs] = useState<JobRow[]>([]);
  const [sharedJobs, setSharedJobs] = useState<Array<JobRow & { granted_at: string; sourceCompany?: CompanyRow | null }>>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showHandoffDialog, setShowHandoffDialog] = useState(false);
  const [selectedJobForAction, setSelectedJobForAction] = useState<JobRow | null>(null);
  const [handoffMode, setHandoffMode] = useState<"copy" | "transfer">("copy");
  const [targetCompanyId, setTargetCompanyId] = useState("");
  const [jobForm, setJobForm] = useState(blankJobForm);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
  });
  const [availableCompanies, setAvailableCompanies] = useState<CompanyRow[]>([]);

  const selectedTargetCompany = useMemo(
    () => availableCompanies.find((company) => company.id === targetCompanyId) || null,
    [availableCompanies, targetCompanyId],
  );

  const loadData = async () => {
    if (!user?.id || !currentCompany?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [ownedRes, sharedRes, companiesRes, targetCompaniesRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id,name,client,description,status,start_date,end_date,company_id,created_at")
          .eq("company_id", currentCompany.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("user_job_access")
          .select("id,job_id,granted_at,granted_by,jobs(id,name,client,description,status,start_date,end_date,company_id,created_at)")
          .eq("user_id", user.id)
          .order("granted_at", { ascending: false }),
        supabase.from("companies").select("id,name,display_name,logo_url").eq("is_active", true),
        supabase
          .from("user_company_access")
          .select("company_id,companies!inner(id,name,display_name,company_type,is_active)")
          .eq("user_id", user.id)
          .eq("is_active", true),
      ]);

      if (ownedRes.error) throw ownedRes.error;
      if (sharedRes.error) throw sharedRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (targetCompaniesRes.error) throw targetCompaniesRes.error;

      const companies = (companiesRes.data || []) as CompanyRow[];
      const companyMap = new Map(companies.map((company) => [company.id, company]));

      const normalizedOwned = (ownedRes.data || []) as JobRow[];
      const normalizedShared = ((sharedRes.data || []) as unknown as SharedJobRow[])
        .map((row) => {
          if (!row.jobs) return null;
          if (row.jobs.company_id === currentCompany.id) return null;
          return {
            ...row.jobs,
            granted_at: row.granted_at,
            sourceCompany: companyMap.get(row.jobs.company_id) || null,
          };
        })
        .filter(Boolean) as Array<JobRow & { granted_at: string; sourceCompany?: CompanyRow | null }>;

      setOwnedJobs(normalizedOwned);
      setSharedJobs(normalizedShared);

      const targetCompanies = ((targetCompaniesRes.data || []) as any[])
        .map((row) => row.companies)
        .filter((company: any) =>
          company &&
          company.is_active !== false &&
          String(company.company_type || "").toLowerCase() === "construction" &&
          String(company.id) !== String(currentCompany.id),
        )
        .map((company: any) => ({
          id: String(company.id),
          name: String(company.name || ""),
          display_name: company.display_name ? String(company.display_name) : null,
          logo_url: null,
        }));
      const dedupedTargets = Array.from(new Map(targetCompanies.map((item) => [item.id, item])).values());
      setAvailableCompanies(dedupedTargets);
      if (dedupedTargets.length > 0) {
        setTargetCompanyId((prev) => prev || dedupedTargets[0].id);
      }
    } catch (error: any) {
      console.error("Error loading design professional jobs:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load Design Pro jobs.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id, currentCompany?.id]);

  const handleCreateJob = async () => {
    if (!user?.id || !currentCompany?.id || !jobForm.name.trim()) return;

    try {
      setCreating(true);
      const { error } = await supabase.from("jobs").insert({
        company_id: currentCompany.id,
        created_by: user.id,
        name: jobForm.name.trim(),
        client: jobForm.client.trim() || null,
        description: jobForm.description.trim() || null,
        start_date: jobForm.start_date || null,
        end_date: jobForm.end_date || null,
        status: "active" as any,
      });
      if (error) throw error;

      toast({
        title: "Project created",
        description: "Your design project is now available in your jobs list.",
      });
      setShowCreateDialog(false);
      setJobForm(blankJobForm);
      await loadData();
    } catch (error: any) {
      console.error("Error creating design pro job:", error);
      toast({
        title: "Error",
        description: error?.message || "Could not create project.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSendInvite = async () => {
    if (!currentCompany?.id || !selectedJobForAction?.id || !inviteForm.email.trim()) return;

    try {
      setSendingInvite(true);
      const { data, error } = await supabase.functions.invoke("send-design-professional-job-invite", {
        body: {
          companyId: currentCompany.id,
          jobId: selectedJobForAction.id,
          email: inviteForm.email.trim().toLowerCase(),
          firstName: inviteForm.first_name.trim() || null,
          lastName: inviteForm.last_name.trim() || null,
        },
      });
      if (error) throw error;

      toast({
        title: "Invite sent",
        description: data?.inviteToken
          ? "Invite email sent with job access token."
          : "Design professional invite sent.",
      });
      setInviteForm({ email: "", first_name: "", last_name: "" });
      setSelectedJobForAction(null);
      setShowInviteDialog(false);
    } catch (error: any) {
      console.error("Error sending design pro invite:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to send invite request.",
        variant: "destructive",
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const openShareDialog = (job: JobRow) => {
    setSelectedJobForAction(job);
    setInviteForm({ email: "", first_name: "", last_name: "" });
    setShowInviteDialog(true);
  };

  const openHandoffDialog = (job: JobRow, mode: "copy" | "transfer") => {
    setSelectedJobForAction(job);
    setHandoffMode(mode);
    setShowHandoffDialog(true);
  };

  const handleProjectHandoff = async () => {
    if (!selectedJobForAction?.id || !targetCompanyId) {
      toast({
        title: "Missing target company",
        description: "Select a builder company first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmittingHandoff(true);
      const { data, error } = await supabase.functions.invoke("design-pro-project-handoff", {
        body: {
          jobId: selectedJobForAction.id,
          targetCompanyId,
          mode: handoffMode,
        },
      });
      if (error) throw error;

      toast({
        title: handoffMode === "copy" ? "Project copied" : "Project transferred",
        description: data?.message || "Project handoff completed.",
      });
      setShowHandoffDialog(false);
      setSelectedJobForAction(null);
      await loadData();
    } catch (error: any) {
      console.error("Project handoff failed:", error);
      toast({
        title: "Handoff failed",
        description: error?.message || "Could not complete project handoff.",
        variant: "destructive",
      });
    } finally {
      setSubmittingHandoff(false);
    }
  };

  const renderJobCard = (job: JobRow & { granted_at?: string; sourceCompany?: CompanyRow | null }, isShared = false) => (
    <Card key={`${isShared ? "shared" : "owned"}-${job.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{job.name}</CardTitle>
            <CardDescription>
              {job.client ? `Client: ${job.client}` : "No client set"}
            </CardDescription>
          </div>
          <Badge variant="outline">{job.status || "active"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {job.description ? <p className="text-muted-foreground">{job.description}</p> : null}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Start</p>
            <p>{job.start_date || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">End</p>
            <p>{job.end_date || "-"}</p>
          </div>
          {isShared ? (
            <div>
              <p className="text-xs text-muted-foreground">Shared By</p>
              <p>{job.sourceCompany?.display_name || job.sourceCompany?.name || "External Company"}</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p>Owned Project</p>
            </div>
          )}
        </div>
        {!isShared && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => openShareDialog(job)}>
              <Link2 className="h-3.5 w-3.5 mr-1" />
              Share Invite
            </Button>
            <Button variant="outline" size="sm" onClick={() => openHandoffDialog(job, "copy")}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy To Builder
            </Button>
            <Button variant="outline" size="sm" onClick={() => openHandoffDialog(job, "transfer")}>
              <Shuffle className="h-3.5 w-3.5 mr-1" />
              Transfer Ownership
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Design Pro Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your own projects and external builder jobs shared to your account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      <Tabs defaultValue="owned" className="space-y-4">
        <TabsList>
          <TabsTrigger value="owned">My Projects ({ownedJobs.length})</TabsTrigger>
          <TabsTrigger value="shared">Shared With Me ({sharedJobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="owned" className="space-y-3">
          {loading ? (
            <Card>
              <CardContent className="py-8 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading projects...
              </CardContent>
            </Card>
          ) : ownedJobs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center space-y-2">
                <Briefcase className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="font-medium">No projects yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first design project to start managing plans and collaboration.
                </p>
              </CardContent>
            </Card>
          ) : (
            ownedJobs.map((job) => renderJobCard(job))
          )}
        </TabsContent>

        <TabsContent value="shared" className="space-y-3">
          {loading ? (
            <Card>
              <CardContent className="py-8 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading shared jobs...
              </CardContent>
            </Card>
          ) : sharedJobs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center space-y-2">
                <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="font-medium">No shared jobs yet</p>
                <p className="text-sm text-muted-foreground">
                  Jobs shared by builder companies will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            sharedJobs.map((job) => renderJobCard(job, true))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Design Project</DialogTitle>
            <DialogDescription>
              This creates an owned project in your Design Pro workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="design-job-name">Project Name</Label>
              <Input
                id="design-job-name"
                value={jobForm.name}
                onChange={(event) => setJobForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Enter project name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="design-job-client">Client</Label>
              <Input
                id="design-job-client"
                value={jobForm.client}
                onChange={(event) => setJobForm((prev) => ({ ...prev, client: event.target.value }))}
                placeholder="Client or owner"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="design-job-start">Start Date</Label>
                <Input
                  id="design-job-start"
                  type="date"
                  value={jobForm.start_date}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, start_date: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="design-job-end">End Date</Label>
                <Input
                  id="design-job-end"
                  type="date"
                  value={jobForm.end_date}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, end_date: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="design-job-description">Description</Label>
              <Textarea
                id="design-job-description"
                value={jobForm.description}
                onChange={(event) => setJobForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Project scope or context"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateJob} disabled={creating || !jobForm.name.trim()}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Job Invite</DialogTitle>
            <DialogDescription>
              Send an invite link for <strong>{selectedJobForAction?.name || "this job"}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="invite-first-name">First Name</Label>
                <Input
                  id="invite-first-name"
                  value={inviteForm.first_name}
                  onChange={(event) => setInviteForm((prev) => ({ ...prev, first_name: event.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-last-name">Last Name</Label>
                <Input
                  id="invite-last-name"
                  value={inviteForm.last_name}
                  onChange={(event) => setInviteForm((prev) => ({ ...prev, last_name: event.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-email">Invitee Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteForm.email}
                onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="name@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendInvite}
              disabled={sendingInvite || !selectedJobForAction?.id || !inviteForm.email.trim()}
            >
              {sendingInvite ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHandoffDialog} onOpenChange={setShowHandoffDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{handoffMode === "copy" ? "Copy Project To Builder" : "Transfer Ownership To Builder"}</DialogTitle>
            <DialogDescription>
              {selectedJobForAction?.name || "Selected project"} will be {handoffMode === "copy" ? "copied" : "transferred"} to the selected builder company.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Builder Company</Label>
              <Select value={targetCompanyId} onValueChange={setTargetCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select builder company" />
                </SelectTrigger>
                <SelectContent>
                  {availableCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.display_name || company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {handoffMode === "transfer" ? (
              <p className="text-sm text-amber-500">
                Transfer moves this project record and ownership to the selected builder company.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Copy creates a new project in the builder company and keeps your original project.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHandoffDialog(false)} disabled={submittingHandoff}>
              Cancel
            </Button>
            <Button onClick={handleProjectHandoff} disabled={submittingHandoff || !targetCompanyId}>
              {submittingHandoff ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : handoffMode === "copy" ? (
                <Copy className="h-4 w-4 mr-2" />
              ) : (
                <Shuffle className="h-4 w-4 mr-2" />
              )}
              {handoffMode === "copy" ? "Copy Project" : "Transfer Ownership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
