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
import { Briefcase, Building2, Copy, Link2, Loader2, Plus, Search, Send, Shuffle } from "lucide-react";
import { sendDesignProfessionalJobInvite } from "@/utils/sendDesignProfessionalJobInvite";
import { acceptDesignProfessionalJobInvite } from "@/utils/acceptDesignProfessionalJobInvite";
import { searchDesignProfessionalAccounts, type DesignProfessionalAccountSearchResult } from "@/utils/searchDesignProfessionalAccounts";

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

type PendingInviteRow = {
  companyId: string;
  companyName: string;
  jobId: string;
  jobName: string;
  invitedAt: string;
  inviteToken: string | null;
};

const safeParseNotes = (value: unknown): Record<string, any> => {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, any>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
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
  const [acceptingInviteJobId, setAcceptingInviteJobId] = useState<string | null>(null);
  const [designProfessionalSearch, setDesignProfessionalSearch] = useState("");
  const [designProfessionalSearchLoading, setDesignProfessionalSearchLoading] = useState(false);
  const [designProfessionalSearchResults, setDesignProfessionalSearchResults] = useState<DesignProfessionalAccountSearchResult[]>([]);
  const [ownedJobs, setOwnedJobs] = useState<JobRow[]>([]);
  const [sharedJobs, setSharedJobs] = useState<Array<JobRow & { granted_at: string; sourceCompany?: CompanyRow | null }>>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteRow[]>([]);
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

      const [ownedRes, sharedRes, companiesRes, targetCompaniesRes, pendingRequestRes] = await Promise.all([
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
        supabase
          .from("company_access_requests")
          .select("company_id, notes, status, requested_at")
          .eq("user_id", user.id)
          .in("status", ["pending", "approved"]),
      ]);

      if (ownedRes.error) throw ownedRes.error;
      if (sharedRes.error) throw sharedRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (targetCompaniesRes.error) throw targetCompaniesRes.error;
      if (pendingRequestRes.error) throw pendingRequestRes.error;

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

      const pendingInviteCandidates = (pendingRequestRes.data || [])
        .flatMap((row: any) => {
          const parsed = safeParseNotes(row.notes);
          if (String(parsed?.requestedRole || "").toLowerCase() !== "design_professional") {
            return [];
          }

          const jobInvites = Array.isArray(parsed?.pendingJobInvites)
            ? parsed.pendingJobInvites
            : parsed?.invitedJobId
              ? [{
                  jobId: parsed.invitedJobId,
                  companyId: parsed.externalCompanyId || row.company_id,
                  inviteToken: parsed.jobInviteToken || null,
                  invitedAt: parsed.requestedAt || row.requested_at,
                }]
              : [];

          return jobInvites.map((invite: any) => ({
            companyId: String(invite?.companyId || parsed?.externalCompanyId || row.company_id || ""),
            jobId: String(invite?.jobId || ""),
            inviteToken: invite?.inviteToken ? String(invite.inviteToken) : null,
            invitedAt: String(invite?.invitedAt || parsed?.requestedAt || row.requested_at || ""),
          }));
        })
        .filter((invite: any) => invite.companyId && invite.jobId);

      const uniquePendingInvites = Array.from(
        new Map(
          pendingInviteCandidates.map((invite: any) => [`${invite.companyId}:${invite.jobId}`, invite]),
        ).values(),
      );

      if (uniquePendingInvites.length > 0) {
        const inviteCompanyIds = Array.from(new Set(uniquePendingInvites.map((invite) => invite.companyId)));
        const inviteJobIds = Array.from(new Set(uniquePendingInvites.map((invite) => invite.jobId)));
        const [{ data: inviteCompanies }, { data: inviteJobs }] = await Promise.all([
          supabase.from("companies").select("id,name,display_name").in("id", inviteCompanyIds),
          supabase.from("jobs").select("id,name,company_id").in("id", inviteJobIds),
        ]);

        const inviteCompanyMap = new Map((inviteCompanies || []).map((company: any) => [
          String(company.id),
          String(company.display_name || company.name || "Builder Company"),
        ]));
        const inviteJobMap = new Map((inviteJobs || []).map((job: any) => [
          String(job.id),
          String(job.name || "Shared Job"),
        ]));
        const existingSharedJobIds = new Set(normalizedShared.map((job) => String(job.id)));

        setPendingInvites(
          uniquePendingInvites
            .filter((invite) => !existingSharedJobIds.has(String(invite.jobId)))
            .map((invite) => ({
              companyId: invite.companyId,
              companyName: inviteCompanyMap.get(invite.companyId) || "Builder Company",
              jobId: invite.jobId,
              jobName: inviteJobMap.get(invite.jobId) || "Shared Job",
              invitedAt: invite.invitedAt,
              inviteToken: invite.inviteToken,
            })),
        );
      } else {
        setPendingInvites([]);
      }

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

  useEffect(() => {
    if (!showInviteDialog || !currentCompany?.id) return;

    const query = designProfessionalSearch.trim();
    if (query.length < 2) {
      setDesignProfessionalSearchResults([]);
      setDesignProfessionalSearchLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setDesignProfessionalSearchLoading(true);
        const results = await searchDesignProfessionalAccounts(currentCompany.id, query);
        setDesignProfessionalSearchResults(results);
      } catch (error) {
        console.error("Error searching design professional accounts:", error);
        setDesignProfessionalSearchResults([]);
      } finally {
        setDesignProfessionalSearchLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [showInviteDialog, currentCompany?.id, designProfessionalSearch]);

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
      const data = await sendDesignProfessionalJobInvite({
        companyId: currentCompany.id,
        jobId: selectedJobForAction.id,
        email: inviteForm.email.trim().toLowerCase(),
        firstName: inviteForm.first_name.trim() || null,
        lastName: inviteForm.last_name.trim() || null,
      });

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
    setDesignProfessionalSearch("");
    setDesignProfessionalSearchResults([]);
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

  const handleAcceptInvite = async (invite: PendingInviteRow) => {
    try {
      setAcceptingInviteJobId(invite.jobId);
      await acceptDesignProfessionalJobInvite({
        companyId: invite.companyId,
        jobId: invite.jobId,
        inviteToken: invite.inviteToken,
      });
      toast({
        title: "Invitation accepted",
        description: `${invite.jobName} was added to your shared jobs.`,
      });
      await loadData();
    } catch (error: any) {
      console.error("Error accepting design professional invite:", error);
      toast({
        title: "Accept failed",
        description: error?.message || "Could not accept this job invitation.",
        variant: "destructive",
      });
    } finally {
      setAcceptingInviteJobId(null);
    }
  };

  const selectDesignProfessionalSearchResult = (result: DesignProfessionalAccountSearchResult) => {
    setInviteForm({
      email: result.email || "",
      first_name: result.firstName || "",
      last_name: result.lastName || "",
    });
    setDesignProfessionalSearch(result.email || result.displayName || result.companyName || "");
    setDesignProfessionalSearchResults([]);
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
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {pendingInvites.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Pending Job Invitations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvites.map((invite) => (
              <div
                key={`${invite.companyId}-${invite.jobId}`}
                className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{invite.jobName}</p>
                    <Badge>New</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Invited by {invite.companyName}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.invitedAt ? `Invited ${new Date(invite.invitedAt).toLocaleDateString()}` : "Pending invitation"}
                  </p>
                </div>
                <Button
                  onClick={() => void handleAcceptInvite(invite)}
                  disabled={acceptingInviteJobId === invite.jobId}
                >
                  {acceptingInviteJobId === invite.jobId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Accept Invitation
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="owned" className="space-y-4">
        <TabsList>
          <TabsTrigger value="owned">My Projects ({ownedJobs.length})</TabsTrigger>
          <TabsTrigger value="shared">Shared With Me ({sharedJobs.length + pendingInvites.length})</TabsTrigger>
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
                <p className="font-medium">{pendingInvites.length > 0 ? "Invitation pending" : "No shared jobs yet"}</p>
                <p className="text-sm text-muted-foreground">
                  {pendingInvites.length > 0
                    ? "Accept your invitation above to add this job to your workspace."
                    : "Jobs shared by builder companies will appear here."}
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

      <Dialog open={showInviteDialog} onOpenChange={(open) => {
        setShowInviteDialog(open);
        if (!open) {
          setDesignProfessionalSearch("");
          setDesignProfessionalSearchResults([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Job Invite</DialogTitle>
            <DialogDescription>
              Send an invite link for <strong>{selectedJobForAction?.name || "this job"}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="design-pro-search">Search Existing Design Pro Accounts</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="design-pro-search"
                  value={designProfessionalSearch}
                  onChange={(event) => setDesignProfessionalSearch(event.target.value)}
                  placeholder="Search by firm, name, or email"
                  className="pl-9"
                />
                {designProfessionalSearchLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>
              {designProfessionalSearch.trim().length >= 2 && (
                <div className="rounded-md border bg-background">
                  {designProfessionalSearchResults.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto p-1">
                      {designProfessionalSearchResults.map((result) => (
                        <button
                          key={`${result.userId || result.companyId || result.email}`}
                          type="button"
                          onClick={() => selectDesignProfessionalSearchResult(result)}
                          className="flex w-full items-start justify-between rounded-md px-3 py-2 text-left hover:bg-muted"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{result.displayName}</p>
                            <p className="truncate text-xs text-muted-foreground">{result.companyName || "Design Pro Account"}</p>
                            <p className="truncate text-xs text-muted-foreground">{result.email}</p>
                          </div>
                          <Badge variant="outline" className="ml-3 shrink-0">Has Account</Badge>
                        </button>
                      ))}
                    </div>
                  ) : !designProfessionalSearchLoading ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No existing DesignProLYNK account found. You can still send a new invite below.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
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
