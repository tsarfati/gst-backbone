import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Edit, Building, Plus, FileText, Calculator, DollarSign, Package, Clock, Users, TrendingUp, Camera, ClipboardList, LayoutTemplate, Download, FileCheck, Link2, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useActionPermissions } from "@/hooks/useActionPermissions";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
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
import JobSubmittals from "@/components/JobSubmittals";
import JobSecurityCameras from "@/components/JobSecurityCameras";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";
import { useVendorPortalAccess } from "@/hooks/useVendorPortalAccess";

interface Job {
  id: string;
  company_id?: string;
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
  jobsitelynk_project_id?: string | null;
  created_at?: string;
  customer?: {
    id: string;
    name: string;
    display_name?: string | null;
  } | null;
}

interface JobRfp {
  id: string;
  rfp_number: string;
  title: string;
  status: string;
  due_date: string | null;
  created_at: string;
  response_status?: string | null;
  my_bid?: {
    id: string;
    bid_amount: number | null;
    status: string | null;
    submitted_at: string | null;
  } | null;
}

interface VendorSubcontract {
  id: string;
  name: string;
  status: string | null;
  contract_amount: number | null;
  contract_negotiation_status: string | null;
  signature_status: string | null;
}

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { currentCompany, switchCompany } = useCompany();
  const permissions = useActionPermissions();
  const { hasAccess } = useMenuPermissions();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [budgetTotal, setBudgetTotal] = useState<number>(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'details';
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [jobRfps, setJobRfps] = useState<JobRfp[]>([]);
  const [rfpsLoading, setRfpsLoading] = useState(false);
  const [vendorRfps, setVendorRfps] = useState<JobRfp[]>([]);
  const [vendorRfpsLoading, setVendorRfpsLoading] = useState(false);
  const [vendorSubcontracts, setVendorSubcontracts] = useState<VendorSubcontract[]>([]);
  const [vendorSubcontractsLoading, setVendorSubcontractsLoading] = useState(false);
  const [vendorBidDialogOpen, setVendorBidDialogOpen] = useState(false);
  const [selectedVendorRfp, setSelectedVendorRfp] = useState<JobRfp | null>(null);
  const [submittingVendorBid, setSubmittingVendorBid] = useState(false);
  const [vendorBidForm, setVendorBidForm] = useState({
    bid_amount: "",
    proposed_timeline: "",
    notes: "",
  });
  const [contractFeedbackDialogOpen, setContractFeedbackDialogOpen] = useState(false);
  const [signatureUploadDialogOpen, setSignatureUploadDialogOpen] = useState(false);
  const [selectedVendorSubcontract, setSelectedVendorSubcontract] = useState<VendorSubcontract | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [submittingContractAction, setSubmittingContractAction] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signatureSignerName, setSignatureSignerName] = useState("");
  const [signatureConsent, setSignatureConsent] = useState(false);
  const { loading: jobAccessLoading, canAccessJob, hasGlobalJobAccess, isPrivileged } = useWebsiteJobAccess();
  const [handoffDialogOpen, setHandoffDialogOpen] = useState(false);
  const [handoffMode, setHandoffMode] = useState<"copy" | "transfer">("copy");
  const [targetCompanyId, setTargetCompanyId] = useState<string>("");
  const [targetCompanies, setTargetCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingTargetCompanies, setLoadingTargetCompanies] = useState(false);
  const [submittingHandoff, setSubmittingHandoff] = useState(false);
  const [jobSiteLynkConfigured, setJobSiteLynkConfigured] = useState(false);
  const [hasSecurityCameraMappings, setHasSecurityCameraMappings] = useState(false);
  const [jobSiteLynkLinkDialogOpen, setJobSiteLynkLinkDialogOpen] = useState(false);
  const [savingJobSiteLynkLink, setSavingJobSiteLynkLink] = useState(false);
  const [selectedJobSiteLynkProjectId, setSelectedJobSiteLynkProjectId] = useState("");
  const [jobSiteLynkModalOpen, setJobSiteLynkModalOpen] = useState(false);
  const [jobSiteLynkLaunchUrl, setJobSiteLynkLaunchUrl] = useState("");
  const [jobSiteLynkLaunching, setJobSiteLynkLaunching] = useState(false);
  const [jobSiteLynkReady, setJobSiteLynkReady] = useState(false);
  const [jobSiteLynkError, setJobSiteLynkError] = useState<string | null>(null);
  const isVendorView = String(profile?.role || "").toLowerCase() === "vendor";
  const isDesignProfessionalView = String(profile?.role || "").toLowerCase() === "design_professional";
  const isExternalView = isDesignProfessionalView || isVendorView;
  const {
    loading: vendorAccessLoading,
    effectiveJobAccess,
  } = useVendorPortalAccess(id);
  const isDesignProfessionalOwnedContext =
    isDesignProfessionalView && String(currentCompany?.company_type || "").toLowerCase() === "design_professional";
  const canManageDesignProfessionalJob = !isExternalView || isDesignProfessionalOwnedContext;
  const canHandoffProject =
    canManageDesignProfessionalJob && (
      String(profile?.role || "").toLowerCase() === "design_professional"
      || String(currentCompany?.company_type || "").toLowerCase() === "design_professional"
    );
  const canManageJobSiteLynkLink = permissions.canEditJobs() && canManageDesignProfessionalJob && !isVendorView;
  const returnToJobsPath = isDesignProfessionalView ? "/design-professional/jobs" : isVendorView ? "/vendor/jobs" : "/jobs";
  const showSecurityCamerasTab = !isExternalView && hasSecurityCameraMappings;
  const visibleTabs = isDesignProfessionalView
    ? ["details", "plans", "rfis", "submittals", "filing-cabinet", "photo-album"]
    : isVendorView
    ? [
        effectiveJobAccess.canViewJobDetails && "details",
        effectiveJobAccess.canViewPlans && "plans",
        (effectiveJobAccess.canViewRfis || effectiveJobAccess.canSubmitRfis) && "rfis",
        (effectiveJobAccess.canViewSubmittals || effectiveJobAccess.canSubmitSubmittals) && "submittals",
        effectiveJobAccess.canAccessFilingCabinet && "filing-cabinet",
        effectiveJobAccess.canViewPhotos && "photo-album",
        (effectiveJobAccess.canViewRfps || effectiveJobAccess.canSubmitBids) && "rfps",
        effectiveJobAccess.canViewSubcontracts && "subcontracts",
      ].filter(Boolean) as string[]
    : [
        "details",
        "cost-budget",
        "forecasting",
        "committed-costs",
        "billing",
        "plans",
        "rfis",
        "rfps",
        "submittals",
        "filing-cabinet",
        "photo-album",
        ...(showSecurityCamerasTab ? ["security-cameras"] : []),
        "visitor-logs",
      ];
  useEffect(() => {
    const fetchJob = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      if (jobAccessLoading) {
        return;
      }

      if (!isPrivileged && !hasGlobalJobAccess && !canAccessJob(id)) {
        setJob(null);
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

          if (currentCompany?.id) {
            setRfpsLoading(true);
            const { data: rfpData, error: rfpError } = await supabase
              .from('rfps')
              .select('id, rfp_number, title, status, due_date, created_at')
              .eq('company_id', currentCompany.id)
              .eq('job_id', id)
              .order('created_at', { ascending: false });
            if (rfpError) {
              console.error('Error loading job RFPs:', rfpError);
            } else {
              setJobRfps((rfpData || []) as JobRfp[]);
            }
          } else {
            setJobRfps([]);
          }
        }
      } catch (err) {
        console.error('Error:', err);
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        setRfpsLoading(false);
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
  }, [id, toast, jobAccessLoading, canAccessJob, hasGlobalJobAccess, isPrivileged, currentCompany?.id]);

  useEffect(() => {
    const loadTargetCompanies = async () => {
      if (!handoffDialogOpen || !canHandoffProject) return;
      if (!user?.id) return;

      try {
        setLoadingTargetCompanies(true);
        const { data, error } = await supabase
          .from("user_company_access")
          .select("company_id, companies!inner(id, name, display_name, company_type, is_active)")
          .eq("user_id", user.id)
          .eq("is_active", true);
        if (error) throw error;

        const options = ((data || []) as any[])
          .map((row) => row.companies)
          .filter((company: any) =>
            company
            && company.is_active !== false
            && String(company.company_type || "").toLowerCase() === "construction"
            && String(company.id) !== String(currentCompany?.id || ""),
          )
          .map((company: any) => ({
            id: String(company.id),
            name: String(company.display_name || company.name || "Construction Company"),
          }));

        const deduped = Array.from(new Map(options.map((item) => [item.id, item])).values());
        setTargetCompanies(deduped);
        if (deduped.length > 0) {
          setTargetCompanyId((prev) => prev || deduped[0].id);
        }
      } catch (error) {
        console.error("Failed to load target companies:", error);
        toast({
          title: "Error",
          description: "Could not load target builder companies.",
          variant: "destructive",
        });
      } finally {
        setLoadingTargetCompanies(false);
      }
    };

    loadTargetCompanies();
  }, [handoffDialogOpen, canHandoffProject, user?.id, currentCompany?.id, toast]);

  useEffect(() => {
    const loadJobSiteLynkConfig = async () => {
      if (!currentCompany?.id) return;
      try {
        const { data, error } = await (supabase as any)
          .from("company_jobsitelynk_integrations")
          .select("jobsitelynk_base_url")
          .eq("company_id", currentCompany.id)
          .maybeSingle();
        if (error) throw error;
        setJobSiteLynkConfigured(!!data?.jobsitelynk_base_url);
      } catch (error) {
        console.error("Error loading JobSiteLynk integration:", error);
        setJobSiteLynkConfigured(false);
      }
    };

    void loadJobSiteLynkConfig();
  }, [currentCompany?.id]);

  useEffect(() => {
    const loadSecurityCameraMappings = async () => {
      if (!id) {
        setHasSecurityCameraMappings(false);
        return;
      }

      const companyId = job?.company_id || currentCompany?.id;
      if (!companyId || isExternalView) {
        setHasSecurityCameraMappings(false);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from("job_security_camera_mappings")
          .select("id")
          .eq("company_id", companyId)
          .eq("job_id", id)
          .eq("is_active", true)
          .limit(1);
        if (error) throw error;
        setHasSecurityCameraMappings((data || []).length > 0);
      } catch (error) {
        console.error("Error loading security camera mappings:", error);
        setHasSecurityCameraMappings(false);
      }
    };

    void loadSecurityCameraMappings();
  }, [id, currentCompany?.id, job?.company_id, isExternalView]);
  useEffect(() => {
    if (!jobSiteLynkModalOpen || !jobSiteLynkLaunchUrl) return;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== "jobsitelynk-embed") return;

      if (data.type === "embed-ready") {
        console.log("JobSiteLynk embed ready");
        setJobSiteLynkReady(true);
        setJobSiteLynkLaunching(false);
      } else if (data.type === "embed-error") {
        const message = String(data.message || data.error || "JobSiteLynk reported an embed error.");
        console.error("JobSiteLynk embed error:", message, data);
        setJobSiteLynkError(message);
        setJobSiteLynkLaunching(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [jobSiteLynkModalOpen, jobSiteLynkLaunchUrl]);

  useEffect(() => {
    let ignore = false;

    async function loadVendorModules() {
      if (!isVendorView || !id || !profile?.vendor_id) {
        setVendorRfps([]);
        setVendorSubcontracts([]);
        return;
      }

      if (effectiveJobAccess.canViewRfps || effectiveJobAccess.canSubmitBids) {
        try {
          setVendorRfpsLoading(true);
          const { data: invitedRows, error: invitedError } = await supabase
            .from("rfp_invited_vendors")
            .select(`
              invited_at,
              response_status,
              rfp:rfps!inner(
                id,
                rfp_number,
                title,
                status,
                due_date,
                created_at,
                job_id
              )
            `)
            .eq("vendor_id", profile.vendor_id)
            .eq("rfp.job_id", id)
            .order("invited_at", { ascending: false });

          if (invitedError) throw invitedError;

          const rfpIds = ((invitedRows || []) as any[])
            .map((row) => row?.rfp?.id as string | undefined)
            .filter((value): value is string => Boolean(value));

          let bidByRfpId = new Map<string, JobRfp["my_bid"]>();
          if (rfpIds.length > 0) {
            const { data: bidRows, error: bidError } = await supabase
              .from("bids")
              .select("id, rfp_id, bid_amount, status, submitted_at")
              .eq("vendor_id", profile.vendor_id)
              .in("rfp_id", rfpIds);

            if (bidError) throw bidError;
            bidByRfpId = new Map(
              ((bidRows || []) as any[]).map((bid) => [
                String(bid.rfp_id),
                {
                  id: String(bid.id),
                  bid_amount: bid.bid_amount ?? null,
                  status: bid.status || null,
                  submitted_at: bid.submitted_at || null,
                },
              ]),
            );
          }

          if (!ignore) {
            setVendorRfps(
              ((invitedRows || []) as any[])
                .map((row) => {
                  if (!row?.rfp?.id) return null;
                  return {
                    id: String(row.rfp.id),
                    rfp_number: String(row.rfp.rfp_number || ""),
                    title: String(row.rfp.title || "Untitled RFP"),
                    status: String(row.rfp.status || "draft"),
                    due_date: row.rfp.due_date || null,
                    created_at: String(row.rfp.created_at),
                    response_status: row.response_status || null,
                    my_bid: bidByRfpId.get(String(row.rfp.id)) || null,
                  } as JobRfp;
                })
                .filter((value): value is JobRfp => Boolean(value)),
            );
          }
        } catch (error) {
          console.error("Error loading vendor RFPs:", error);
          if (!ignore) {
            setVendorRfps([]);
          }
        } finally {
          if (!ignore) {
            setVendorRfpsLoading(false);
          }
        }
      } else {
        setVendorRfps([]);
      }

      if (effectiveJobAccess.canViewSubcontracts) {
        try {
          setVendorSubcontractsLoading(true);
          const { data, error } = await supabase
            .from("subcontracts")
            .select("id, name, status, contract_amount, contract_negotiation_status, signature_status")
            .eq("vendor_id", profile.vendor_id)
            .eq("job_id", id)
            .order("created_at", { ascending: false });

          if (error) throw error;
          if (!ignore) {
            setVendorSubcontracts(((data || []) as unknown as VendorSubcontract[]) || []);
          }
        } catch (error) {
          console.error("Error loading vendor subcontracts:", error);
          if (!ignore) {
            setVendorSubcontracts([]);
          }
        } finally {
          if (!ignore) {
            setVendorSubcontractsLoading(false);
          }
        }
      } else {
        setVendorSubcontracts([]);
      }
    }

    void loadVendorModules();
    return () => {
      ignore = true;
    };
  }, [
    effectiveJobAccess.canSubmitBids,
    effectiveJobAccess.canViewRfps,
    effectiveJobAccess.canViewSubcontracts,
    id,
    isVendorView,
    profile?.vendor_id,
  ]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] || "details");
    }
  }, [activeTab, visibleTabs]);

  const handleProjectHandoff = async () => {
    if (!id || !targetCompanyId) {
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
          jobId: id,
          targetCompanyId,
          mode: handoffMode,
        },
      });
      if (error) throw error;

      toast({
        title: handoffMode === "copy" ? "Project copied" : "Project transferred",
        description: data?.message || "Project handoff completed.",
      });

      setHandoffDialogOpen(false);

      if ((handoffMode === "transfer" || handoffMode === "copy") && targetCompanyId && data?.resultJobId) {
        await switchCompany(targetCompanyId);
        navigate(`/jobs/${data.resultJobId}`);
      }
    } catch (error: any) {
      console.error("Project handoff failed:", error);
      toast({
        title: "Handoff failed",
        description: error?.message || "Could not complete the handoff.",
        variant: "destructive",
      });
    } finally {
      setSubmittingHandoff(false);
    }
  };

  const openVendorBidDialog = (rfp: JobRfp) => {
    setSelectedVendorRfp(rfp);
    setVendorBidForm({
      bid_amount: rfp.my_bid?.bid_amount ? String(rfp.my_bid.bid_amount) : "",
      proposed_timeline: "",
      notes: "",
    });
    setVendorBidDialogOpen(true);
  };

  const submitVendorBid = async () => {
    if (!selectedVendorRfp || !profile?.vendor_id || !currentCompany?.id) return;
    const amount = Number(vendorBidForm.bid_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        title: "Invalid bid amount",
        description: "Enter a valid bid amount greater than 0.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmittingVendorBid(true);
      const { error } = await supabase
        .from("bids")
        .upsert(
          {
            rfp_id: selectedVendorRfp.id,
            company_id: currentCompany.id,
            vendor_id: profile.vendor_id,
            bid_amount: amount,
            proposed_timeline: vendorBidForm.proposed_timeline.trim() || null,
            notes: vendorBidForm.notes.trim() || null,
            status: "submitted",
          } as any,
          { onConflict: "rfp_id,vendor_id" },
        );
      if (error) throw error;

      toast({
        title: selectedVendorRfp.my_bid ? "Bid updated" : "Bid submitted",
        description: "Your bid has been saved.",
      });
      setVendorRfps((prev) =>
        prev.map((rfp) =>
          rfp.id === selectedVendorRfp.id
            ? {
                ...rfp,
                my_bid: {
                  id: rfp.my_bid?.id || crypto.randomUUID(),
                  bid_amount: amount,
                  status: "submitted",
                  submitted_at: new Date().toISOString(),
                },
              }
            : rfp,
        ),
      );
      setVendorBidDialogOpen(false);
      setSelectedVendorRfp(null);
    } catch (error: any) {
      console.error("Error submitting vendor bid:", error);
      toast({
        title: "Bid submission failed",
        description: error?.message || "Unable to submit bid at this time.",
        variant: "destructive",
      });
    } finally {
      setSubmittingVendorBid(false);
    }
  };

  const openFeedbackDialog = (subcontract: VendorSubcontract) => {
    setSelectedVendorSubcontract(subcontract);
    setFeedbackNotes("");
    setContractFeedbackDialogOpen(true);
  };

  const submitContractFeedback = async () => {
    if (!selectedVendorSubcontract?.id) return;
    try {
      setSubmittingContractAction(true);
      const { error } = await (supabase as any).rpc("vendor_submit_subcontract_feedback", {
        _subcontract_id: selectedVendorSubcontract.id,
        _negotiation_notes: feedbackNotes || null,
        _vendor_sov_proposal: null,
      });
      if (error) throw error;
      toast({
        title: "Feedback submitted",
        description: "Contract feedback was sent for internal review.",
      });
      setVendorSubcontracts((prev) =>
        prev.map((subcontract) =>
          subcontract.id === selectedVendorSubcontract.id
            ? { ...subcontract, contract_negotiation_status: "feedback_submitted" }
            : subcontract,
        ),
      );
      setContractFeedbackDialogOpen(false);
    } catch (error: any) {
      console.error("Failed to submit contract feedback:", error);
      toast({
        title: "Submit failed",
        description: error?.message || "Could not submit contract feedback.",
        variant: "destructive",
      });
    } finally {
      setSubmittingContractAction(false);
    }
  };

  const openSignatureDialog = (subcontract: VendorSubcontract) => {
    setSelectedVendorSubcontract(subcontract);
    setSignatureFile(null);
    setSignatureConsent(false);
    setSignatureSignerName(`${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || profile?.display_name || "");
    setSignatureUploadDialogOpen(true);
  };

  const submitSignedContractUpload = async () => {
    if (!selectedVendorSubcontract?.id || !signatureFile || !signatureSignerName.trim()) {
      toast({
        title: "Missing data",
        description: "Signer name and signed contract file are required.",
        variant: "destructive",
      });
      return;
    }
    if (!signatureConsent) {
      toast({
        title: "Consent required",
        description: "You must agree that your uploaded signature is binding.",
        variant: "destructive",
      });
      return;
    }
    if (!currentCompany?.id) return;
    try {
      setSubmittingContractAction(true);
      const ext = signatureFile.name.split(".").pop() || "pdf";
      const storagePath = `${currentCompany.id}/executed-contracts/${selectedVendorSubcontract.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("subcontract-files")
        .upload(storagePath, signatureFile, { upsert: false });
      if (uploadError) throw uploadError;

      const { error } = await (supabase as any).rpc("vendor_submit_subcontract_signature", {
        _subcontract_id: selectedVendorSubcontract.id,
        _executed_contract_file_url: storagePath,
        _signed_by_name: signatureSignerName.trim(),
        _signer_ip: null,
        _signer_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        _consent_text_version: "v1",
      });
      if (error) throw error;

      toast({
        title: "Signed contract submitted",
        description: "Your signed contract was uploaded for company review.",
      });
      setVendorSubcontracts((prev) =>
        prev.map((subcontract) =>
          subcontract.id === selectedVendorSubcontract.id
            ? { ...subcontract, signature_status: "signed_uploaded" }
            : subcontract,
        ),
      );
      setSignatureUploadDialogOpen(false);
    } catch (error: any) {
      console.error("Failed uploading signed contract:", error);
      toast({
        title: "Upload failed",
        description: error?.message || "Could not upload signed contract.",
        variant: "destructive",
      });
    } finally {
      setSubmittingContractAction(false);
    }
  };

  const openJobSiteLynk = async () => {
    if (!id) return;

    if (!jobSiteLynkConfigured) {
      toast({
        title: "Integration not configured",
        description: "Configure JobSiteLynk in Company Settings first.",
        variant: "destructive",
      });
      return;
    }
    if (!job?.jobsitelynk_project_id) {
      toast({
        title: "Project not linked",
        description: "Link this job to a JobSiteLynk project first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setJobSiteLynkModalOpen(true);
      setJobSiteLynkLaunching(true);
      setJobSiteLynkReady(false);
      setJobSiteLynkError(null);
      setJobSiteLynkLaunchUrl("");

      const { data, error } = await supabase.functions.invoke("jobsitelynk-embed-session", {
        body: { jobId: id },
      });

      if (error) {
        let detailedMessage = error.message || "Could not open JobSiteLynk.";
        try {
          const context = (error as any)?.context;
          if (context?.json) {
            const payload = await context.json();
            detailedMessage =
              payload?.error ||
              payload?.message ||
              payload?.details?.error ||
              payload?.details?.message ||
              detailedMessage;
          }
        } catch (contextError) {
          console.warn("Could not read JobSiteLynk error details:", contextError);
        }
        throw new Error(detailedMessage);
      }
      if (!data?.launch_url) {
        throw new Error("JobSiteLynk did not return a launch URL.");
      }

      setJobSiteLynkLaunchUrl(String(data.launch_url));
    } catch (error: any) {
      console.error("Error launching JobSiteLynk:", error);
      setJobSiteLynkError(error?.message || "Could not open JobSiteLynk.");
      setJobSiteLynkLaunching(false);
    }
  };

  const openJobSiteLynkLinkDialog = async () => {
    if (!jobSiteLynkConfigured) {
      toast({
        title: "Integration not configured",
        description: "Configure JobSiteLynk in Company Settings first.",
        variant: "destructive",
      });
      return;
    }

    setSelectedJobSiteLynkProjectId(job?.jobsitelynk_project_id || "");
    setJobSiteLynkLinkDialogOpen(true);
  };

  const saveJobSiteLynkProjectLink = async () => {
    const trimmedProjectId = selectedJobSiteLynkProjectId.trim();

    if (!id || !trimmedProjectId) {
      toast({
        title: "Enter a project code",
        description: "Paste the JobSiteLynk project code or link code for this job.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingJobSiteLynkLink(true);
      const { error } = await supabase
        .from("jobs")
        .update({ jobsitelynk_project_id: trimmedProjectId })
        .eq("id", id);

      if (error) throw error;

      setJob((prev) => (prev ? { ...prev, jobsitelynk_project_id: trimmedProjectId } : prev));
      setJobSiteLynkLinkDialogOpen(false);
      toast({
        title: "JobSiteLynk linked",
        description: `${job?.name || "This job"} is now linked to JobSiteLynk project code ${trimmedProjectId}.`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not save the JobSiteLynk link.";
      console.error("Error saving JobSiteLynk project link:", error);
      toast({
        title: "Link failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSavingJobSiteLynkLink(false);
    }
  };

  if (loading || (isVendorView && vendorAccessLoading)) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground"><span className="loading-dots">Loading job details</span></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate(returnToJobsPath)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Job Not Found</h1>
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
              <Button onClick={() => navigate(returnToJobsPath)}>
                Return to Jobs
              </Button>
              {!isExternalView && (
                <Button variant="outline" onClick={() => navigate("/jobs/add")}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Job
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isVendorView && !vendorAccessLoading && visibleTabs.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate(returnToJobsPath)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{job.name}</h1>
          </div>
        </div>

        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            This job has been shared with your vendor account, but no viewable job modules are enabled for your current access level yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(returnToJobsPath)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{job.name}</h1>
        </div>
        {job.status === 'completed' && canManageDesignProfessionalJob && (
          <Button variant="outline" size="sm" onClick={() => setExportModalOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Archive Job
          </Button>
        )}
        {canHandoffProject && (
          <Button variant="outline" size="sm" onClick={() => setHandoffDialogOpen(true)}>
            Share / Handoff
          </Button>
        )}
        {jobSiteLynkConfigured && job?.jobsitelynk_project_id && (
          <Button variant="outline" size="sm" onClick={() => void openJobSiteLynk()}>
            {jobSiteLynkLaunching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
            Open JobSiteLynk
          </Button>
        )}
      </div>

      {/* Tabbed Content */}
      <Card className="border-0 bg-transparent shadow-none">
        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); if (val === 'details') { setSearchParams(prev => { const sp = new URLSearchParams(prev); sp.delete('tab'); return sp; }); } else { setSearchParams(prev => { const sp = new URLSearchParams(prev); sp.set('tab', val); return sp; }); } }} className="w-full">
          <TabsList className="w-full flex-wrap h-auto justify-start rounded-none border-b bg-transparent p-0 gap-0">
            {visibleTabs.includes("details") && <TabsTrigger 
              value="details" 
              className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <FileText className="h-4 w-4 mr-2" />
              Job Details
            </TabsTrigger>}
            {!isExternalView && <TabsTrigger 
              value="cost-budget"
              className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Budget
            </TabsTrigger>}
            {!isExternalView && <TabsTrigger 
              value="forecasting"
              className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Forecasting
            </TabsTrigger>}
            {!isExternalView && <TabsTrigger 
              value="committed-costs" 
              className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Committed Costs
            </TabsTrigger>}
            {!isExternalView && <TabsTrigger 
              value="billing"
              className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Billing
            </TabsTrigger>}
            {visibleTabs.includes("plans") && <TabsTrigger 
              value="plans"
              className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <LayoutTemplate className="h-4 w-4 mr-2" />
              Plans
            </TabsTrigger>}
            {visibleTabs.includes("rfis") && <TabsTrigger 
              value="rfis"
              className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              RFIs
            </TabsTrigger>}
            {visibleTabs.includes("rfps") && <TabsTrigger
              value="rfps"
              className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <FileText className="h-4 w-4 mr-2" />
              {isVendorView ? "RFPs / Bids" : "RFPs"}
            </TabsTrigger>}
            {visibleTabs.includes("subcontracts") && <TabsTrigger
              value="subcontracts"
              className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <Package className="h-4 w-4 mr-2" />
              Subcontracts
            </TabsTrigger>}
            {visibleTabs.includes("submittals") && <TabsTrigger
              value="submittals"
              className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <FileCheck className="h-4 w-4 mr-2" />
              Submittals
            </TabsTrigger>}
            {visibleTabs.includes("filing-cabinet") && (hasAccess("jobs-view-filing-cabinet") || isExternalView) && (
              <TabsTrigger 
                value="filing-cabinet"
                className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
              >
                <FileText className="h-4 w-4 mr-2" />
                Filing Cabinet
              </TabsTrigger>
            )}
            {visibleTabs.includes("photo-album") && <TabsTrigger 
              value="photo-album"
              className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <Camera className="h-4 w-4 mr-2" />
              Photos
            </TabsTrigger>}
            {showSecurityCamerasTab && <TabsTrigger
              value="security-cameras"
              className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <Camera className="h-4 w-4 mr-2" />
              Security Cameras
            </TabsTrigger>}
            {!isExternalView && <TabsTrigger 
              value="visitor-logs"
              className="rounded-none border-b-2 border-transparent px-2.5 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-foreground"
            >
              <Users className="h-4 w-4 mr-2" />
              Visitor Logs
            </TabsTrigger>}
          </TabsList>
          
          {visibleTabs.includes("details") && <TabsContent value="details" className="p-6">
            <div className="mb-6">
              <Card className="border-0 bg-transparent shadow-none">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Job Information</CardTitle>
                  {permissions.canEditJobs() && canManageDesignProfessionalJob && !isVendorView && (
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
                    {!isExternalView && <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Budget</label>
                      <p className="text-foreground mt-1">${budgetTotal.toLocaleString()}</p>
                    </div>}
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

                  {!isExternalView && jobSiteLynkConfigured && (
                    <Card className="border-dashed">
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Link2 className="h-4 w-4" />
                            JobSiteLynk
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Launch the linked JobSiteLynk project inside BuilderLynk.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {job?.jobsitelynk_project_id && <Badge variant="outline">Project ID: {job.jobsitelynk_project_id}</Badge>}
                          {jobSiteLynkConfigured && job?.jobsitelynk_project_id ? (
                            <Button size="sm" variant="outline" onClick={() => void openJobSiteLynk()}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Launch JobSiteLynk
                            </Button>
                          ) : null}
                          {canManageJobSiteLynkLink ? (
                            <Button size="sm" variant="outline" onClick={() => void openJobSiteLynkLinkDialog()}>
                              <Link2 className="h-4 w-4 mr-2" />
                              {job?.jobsitelynk_project_id ? "Edit Code" : "Add Code"}
                            </Button>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        {job?.jobsitelynk_project_id
                          ? "This job is linked and ready to open in the embedded JobSiteLynk viewer."
                          : "Paste the JobSiteLynk project code from the matching JobSiteLynk job here to connect it to this BuilderLynk job."}
                      </CardContent>
                    </Card>
                  )}

                  {isExternalView ? (
                    <div className="pt-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</label>
                      <p className="text-foreground mt-1 break-words">{job.address || 'Not set'}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4 pt-1">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</label>
                        <p className="text-foreground mt-1 break-words">{job.address || 'Not set'}</p>
                      </div>
                      <div className="min-w-0 xl:min-w-[220px]">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Visitor QR Code</label>
                        <p className="text-foreground mt-1 truncate">
                          {job.visitor_qr_code || 'Not generated'}
                        </p>
                      </div>
                    </div>
                  )}

                  {job.description && (
                    <div className="pt-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
                      <p className="text-foreground mt-1 whitespace-pre-wrap">{job.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {!isExternalView && (profile?.role === 'project_manager' || profile?.role === 'admin' || profile?.role === 'controller') && (
              <div className="mb-6">
                <BillsNeedingCoding jobId={id!} limit={3} />
              </div>
            )}

            {!isExternalView && (
              <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-6">
                <JobProjectTeam jobId={id!} />
                <JobLocationMap address={job.address} />
              </div>
            )}

          </TabsContent>}
          
          <TabsContent value="committed-costs" className="p-6">
            <CommittedCosts jobId={id!} />
          </TabsContent>

          <TabsContent value="cost-budget" className="p-6">
            <JobCostBudgetView />
          </TabsContent>

          <TabsContent value="forecasting" className="p-6">
            <JobForecastingView />
          </TabsContent>

          {visibleTabs.includes("plans") && <TabsContent value="plans" className="p-6">
            <JobPlans jobId={id!} canUpload={!isVendorView} />
          </TabsContent>}

          {visibleTabs.includes("rfis") && <TabsContent value="rfis" className="p-6">
            <JobRFIs jobId={id!} canCreate={!isVendorView || effectiveJobAccess.canSubmitRfis} />
          </TabsContent>}

          {visibleTabs.includes("rfps") && <TabsContent value="rfps" className="p-6">
            {isVendorView ? (
              <Card>
                <CardHeader>
                  <CardTitle>RFPs / Bids</CardTitle>
                </CardHeader>
                <CardContent>
                  {vendorRfpsLoading ? (
                    <div className="py-6 text-sm text-muted-foreground">
                      <span className="loading-dots">Loading RFPs</span>
                    </div>
                  ) : vendorRfps.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">
                      No RFPs have been shared with this vendor account for this job yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {vendorRfps.map((rfp) => (
                        <div key={rfp.id} className="rounded-lg border p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-1">
                              <div className="font-medium text-foreground">{rfp.title}</div>
                              <div className="text-sm text-muted-foreground">
                                {rfp.rfp_number} • Created {new Date(rfp.created_at).toLocaleDateString()}
                                {rfp.due_date ? ` • Due ${new Date(rfp.due_date).toLocaleDateString()}` : ""}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="capitalize">{rfp.status || "draft"}</Badge>
                              {rfp.response_status ? <Badge variant="secondary" className="capitalize">{rfp.response_status}</Badge> : null}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="text-sm text-muted-foreground">
                              {rfp.my_bid ? (
                                <>
                                  Your bid: ${Number(rfp.my_bid.bid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  {rfp.my_bid.status ? ` • ${rfp.my_bid.status}` : ""}
                                  {rfp.my_bid.submitted_at ? ` • Submitted ${new Date(rfp.my_bid.submitted_at).toLocaleDateString()}` : ""}
                                </>
                              ) : effectiveJobAccess.canSubmitBids ? (
                                "No bid has been submitted from this vendor account yet."
                              ) : (
                                "Bid submission is not enabled for this vendor assignment."
                              )}
                            </div>
                            {effectiveJobAccess.canSubmitBids && (
                              <Button size="sm" variant="outline" onClick={() => openVendorBidDialog(rfp)}>
                                {rfp.my_bid ? "Update Bid" : "Submit Bid"}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>RFPs</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => navigate(`/construction/rfps?jobId=${id}`)}>
                      View All
                    </Button>
                    <Button onClick={() => navigate(`/construction/rfps/add?jobId=${id}`)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New RFP
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {rfpsLoading ? (
                    <div className="py-6 text-sm text-muted-foreground">
                      <span className="loading-dots">Loading RFPs</span>
                    </div>
                  ) : jobRfps.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">
                      No RFPs for this job yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {jobRfps.map((rfp) => (
                        <button
                          key={rfp.id}
                          type="button"
                          onClick={() => navigate(`/construction/rfps/${rfp.id}`)}
                          className="w-full rounded-md border px-3 py-2 text-left hover:bg-muted/50"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="font-medium">{rfp.title}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {rfp.rfp_number} • Created {new Date(rfp.created_at).toLocaleDateString()}
                                {rfp.due_date ? ` • Due ${new Date(rfp.due_date).toLocaleDateString()}` : ''}
                              </div>
                            </div>
                            <Badge variant="outline" className="capitalize">
                              {rfp.status || 'draft'}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>}

          {visibleTabs.includes("subcontracts") && <TabsContent value="subcontracts" className="p-6">
            <Card>
              <CardHeader>
                <CardTitle>Subcontracts</CardTitle>
              </CardHeader>
              <CardContent>
                {vendorSubcontractsLoading ? (
                  <div className="py-6 text-sm text-muted-foreground">
                    <span className="loading-dots">Loading subcontracts</span>
                  </div>
                ) : vendorSubcontracts.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    No subcontracts are available for this vendor account on this job yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vendorSubcontracts.map((subcontract) => (
                      <div key={subcontract.id} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">{subcontract.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Contract amount: ${Number(subcontract.contract_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {subcontract.status ? <Badge variant="outline" className="capitalize">{subcontract.status}</Badge> : null}
                            {subcontract.contract_negotiation_status ? <Badge variant="secondary" className="capitalize">{subcontract.contract_negotiation_status}</Badge> : null}
                            {subcontract.signature_status ? <Badge variant="secondary" className="capitalize">{subcontract.signature_status}</Badge> : null}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {effectiveJobAccess.canNegotiateContracts && (
                            <Button size="sm" variant="outline" onClick={() => openFeedbackDialog(subcontract)}>
                              Submit Feedback
                            </Button>
                          )}
                          {effectiveJobAccess.canUploadSignedContracts && (
                            <Button size="sm" variant="outline" onClick={() => openSignatureDialog(subcontract)}>
                              Upload Signed Contract
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>}

          {visibleTabs.includes("submittals") && <TabsContent value="submittals" className="p-6">
            <JobSubmittals jobId={id!} canCreate={!isVendorView || effectiveJobAccess.canSubmitSubmittals} />
          </TabsContent>}

          <TabsContent value="billing" className="p-6">
            <JobBillingSetup jobId={id!} />
          </TabsContent>

          {visibleTabs.includes("filing-cabinet") && <TabsContent value="filing-cabinet" className="p-6">
            <JobFilingCabinet jobId={id!} />
          </TabsContent>}


          <TabsContent value="visitor-logs" className="p-6">
            <JobVisitorLogsView />
          </TabsContent>

          {visibleTabs.includes("photo-album") && <TabsContent value="photo-album" className="p-6">
            <JobPhotoAlbum
              jobId={id!}
              jobSiteLynkConfigured={!isExternalView && jobSiteLynkConfigured}
              jobSiteLynkProjectId={job?.jobsitelynk_project_id || null}
              onOpenJobSiteLynk={() => void openJobSiteLynk()}
            />
          </TabsContent>}

          {showSecurityCamerasTab && <TabsContent value="security-cameras" className="p-6">
            <JobSecurityCameras
              companyId={job?.company_id || currentCompany?.id}
              jobId={id!}
              canManage={permissions.canEditJobs() && !isVendorView}
            />
          </TabsContent>}
        </Tabs>
      </Card>

      <JobExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        jobId={id!}
        jobName={job.name}
      />

      <Dialog open={handoffDialogOpen} onOpenChange={setHandoffDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Or Transfer Project</DialogTitle>
            <DialogDescription>
              Copy this project to a builder company, or transfer ownership to that builder company.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={handoffMode} onValueChange={(value: "copy" | "transfer") => setHandoffMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="copy">Copy Project To Builder</SelectItem>
                  <SelectItem value="transfer">Transfer Ownership To Builder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Builder Company</Label>
              <Select value={targetCompanyId} onValueChange={setTargetCompanyId} disabled={loadingTargetCompanies || targetCompanies.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingTargetCompanies ? "Loading builder companies..." : "Select builder company"} />
                </SelectTrigger>
                <SelectContent>
                  {targetCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {handoffMode === "transfer" ? (
              <p className="text-sm text-amber-500">
                Transfer moves this project record to the selected builder company.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Copy creates a new project in the selected builder company and keeps your original.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHandoffDialogOpen(false)} disabled={submittingHandoff}>
              Cancel
            </Button>
            <Button onClick={handleProjectHandoff} disabled={submittingHandoff || !targetCompanyId || targetCompanies.length === 0}>
              {submittingHandoff ? "Processing..." : handoffMode === "copy" ? "Copy Project" : "Transfer Ownership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vendorBidDialogOpen} onOpenChange={setVendorBidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedVendorRfp?.my_bid ? "Update Bid" : "Submit Bid"}</DialogTitle>
            <DialogDescription>
              {selectedVendorRfp ? `${selectedVendorRfp.rfp_number} • ${selectedVendorRfp.title}` : "Enter your bid details."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Bid Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={vendorBidForm.bid_amount}
                onChange={(e) => setVendorBidForm((prev) => ({ ...prev, bid_amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Proposed Timeline</Label>
              <Input
                value={vendorBidForm.proposed_timeline}
                onChange={(e) => setVendorBidForm((prev) => ({ ...prev, proposed_timeline: e.target.value }))}
                placeholder="6 weeks"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={vendorBidForm.notes}
                onChange={(e) => setVendorBidForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={5}
                placeholder="Add bid notes or inclusions/exclusions"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVendorBidDialogOpen(false)} disabled={submittingVendorBid}>
              Cancel
            </Button>
            <Button onClick={submitVendorBid} disabled={submittingVendorBid}>
              {submittingVendorBid ? "Saving..." : selectedVendorRfp?.my_bid ? "Update Bid" : "Submit Bid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contractFeedbackDialogOpen} onOpenChange={setContractFeedbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Contract Feedback</DialogTitle>
            <DialogDescription>
              Share negotiation notes or requested revisions for {selectedVendorSubcontract?.name || "this subcontract"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Feedback Notes</Label>
            <Textarea
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
              rows={6}
              placeholder="Describe requested revisions, clarifications, or negotiation notes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractFeedbackDialogOpen(false)} disabled={submittingContractAction}>
              Cancel
            </Button>
            <Button onClick={submitContractFeedback} disabled={submittingContractAction}>
              {submittingContractAction ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signatureUploadDialogOpen} onOpenChange={setSignatureUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Signed Contract</DialogTitle>
            <DialogDescription>
              Upload the signed contract for {selectedVendorSubcontract?.name || "this subcontract"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Signer Name</Label>
              <Input
                value={signatureSignerName}
                onChange={(e) => setSignatureSignerName(e.target.value)}
                placeholder="Full legal name"
              />
            </div>
            <div className="space-y-2">
              <Label>Signed Contract File</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="signature-consent"
                checked={signatureConsent}
                onCheckedChange={(checked) => setSignatureConsent(checked === true)}
              />
              <Label htmlFor="signature-consent" className="text-sm leading-5">
                I confirm this uploaded signed contract is authorized and binding on behalf of the vendor.
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignatureUploadDialogOpen(false)} disabled={submittingContractAction}>
              Cancel
            </Button>
            <Button onClick={submitSignedContractUpload} disabled={submittingContractAction}>
              {submittingContractAction ? "Uploading..." : "Submit Signed Contract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={jobSiteLynkLinkDialogOpen}
        onOpenChange={(open) => {
          setJobSiteLynkLinkDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Set JobSiteLynk Project Code</DialogTitle>
            <DialogDescription>
              Open the matching job in JobSiteLynk, copy its project code or link code, and paste it here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jobsitelynk-project-code">JobSiteLynk Project Code</Label>
              <Input
                id="jobsitelynk-project-code"
                value={selectedJobSiteLynkProjectId}
                onChange={(e) => setSelectedJobSiteLynkProjectId(e.target.value)}
                placeholder="Paste the JobSiteLynk project code"
                autoFocus
              />
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              This code is stored on the BuilderLynk job record and used when launching the embedded JobSiteLynk viewer.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setJobSiteLynkLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveJobSiteLynkProjectLink()} disabled={savingJobSiteLynkLink || !selectedJobSiteLynkProjectId.trim()}>
              {savingJobSiteLynkLink && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={jobSiteLynkModalOpen}
        onOpenChange={(open) => {
          setJobSiteLynkModalOpen(open);
          if (!open) {
            setJobSiteLynkLaunchUrl("");
            setJobSiteLynkError(null);
            setJobSiteLynkLaunching(false);
            setJobSiteLynkReady(false);
          }
        }}
      >
        <DialogContent className="max-w-[98vw] w-[98vw] h-[94vh] p-0 overflow-hidden">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <DialogTitle className="text-base">JobSiteLynk Viewer</DialogTitle>
                <DialogDescription>{job?.name}</DialogDescription>
              </div>
            </div>
            <div className="relative flex-1 bg-background">
              {jobSiteLynkLaunchUrl ? (
                <iframe
                  src={jobSiteLynkLaunchUrl}
                  title="JobSiteLynk Embedded Project"
                  className="h-full w-full border-0"
                  allow="clipboard-read; clipboard-write"
                />
              ) : null}

              {(jobSiteLynkLaunching || !jobSiteLynkReady) && !jobSiteLynkError && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/95">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="loading-dots">Loading JobSiteLynk</span>
                  </div>
                </div>
              )}

              {jobSiteLynkError && (
                <div className="absolute inset-0 flex items-center justify-center bg-background p-6">
                  <Card className="max-w-lg w-full">
                    <CardHeader>
                      <CardTitle>Unable to open JobSiteLynk</CardTitle>
                      <p className="text-sm text-muted-foreground">{jobSiteLynkError}</p>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" onClick={() => void openJobSiteLynk()}>
                        Retry
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
