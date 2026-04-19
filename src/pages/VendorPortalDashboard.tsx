import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, FileText, ShieldCheck, AlertTriangle, DollarSign, Building2, MessageSquare } from "lucide-react";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { useVendorPortalData } from "@/hooks/useVendorPortalData";
import { resolveCompanyLogoUrl } from "@/utils/resolveCompanyLogoUrl";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function VendorPortalDashboard() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { profile, user } = useAuth();
  const { loading, vendorInfo, jobs, invoices, complianceDocs, rfps, messages, paymentMethod } = useVendorPortalData();
  const [portalRequirements, setPortalRequirements] = useState({
    requireJobAssignmentForBills: true,
    requireProfileCompletion: true,
    requirePaymentMethod: true,
    requireW9: false,
    requireInsurance: false,
    requireCompanyLogo: false,
    requireUserAvatar: false,
  });
  const builderName = currentCompany?.display_name || currentCompany?.name || "BuilderLYNK";
  const vendorLogoUrl = resolveCompanyLogoUrl(vendorInfo?.logo_url);
  const openInvoices = useMemo(() => invoices.filter((invoice) => String(invoice.status || "").toLowerCase() !== "paid"), [invoices]);
  const revisionRequestedInvoices = useMemo(
    () => invoices.filter((invoice) => String(invoice.status || "").toLowerCase() === "revision_requested"),
    [invoices],
  );
  const openRfps = useMemo(() => rfps.filter((rfp) => String(rfp.status || "").toLowerCase() !== "closed"), [rfps]);
  const missingDocs = useMemo(() => complianceDocs.filter((doc) => doc.is_required && !doc.is_uploaded), [complianceDocs]);
  const unreadMessages = useMemo(() => messages.filter((message) => !message.read), [messages]);
  const billingEnabledJobs = useMemo(() => jobs.filter((job) => job.can_submit_bills), [jobs]);
  const hasCompanyInfo = useMemo(
    () => Boolean(
      vendorInfo?.name?.trim() &&
      vendorInfo?.email?.trim() &&
      vendorInfo?.phone?.trim() &&
      vendorInfo?.address?.trim(),
    ),
    [vendorInfo],
  );
  const hasPrimaryPaymentMethod = useMemo(() => Boolean(paymentMethod?.type?.trim()), [paymentMethod]);
  const hasUserAvatar = useMemo(() => Boolean(profile?.avatar_url), [profile?.avatar_url]);
  const isProfileComplete = useMemo(
    () => Boolean(profile?.first_name?.trim() && profile?.last_name?.trim() && (profile?.email || user?.email)),
    [profile?.first_name, profile?.last_name, profile?.email, user?.email],
  );
  const hasW9Doc = useMemo(
    () => complianceDocs.some((doc) => doc.is_uploaded && /w[\s_-]?9/i.test(doc.type)),
    [complianceDocs],
  );
  const hasInsuranceDoc = useMemo(
    () => complianceDocs.some((doc) => doc.is_uploaded && /insurance/i.test(doc.type)),
    [complianceDocs],
  );
  const onboardingChecklist = useMemo(() => ([
    { key: "job-access", label: "Billing-enabled job access", required: portalRequirements.requireJobAssignmentForBills, done: billingEnabledJobs.length > 0, href: "/vendor/jobs" },
    { key: "profile", label: "Complete user profile", required: portalRequirements.requireProfileCompletion, done: isProfileComplete, href: "/vendor/profile-settings" },
    { key: "company-profile", label: "Complete company profile", required: true, done: hasCompanyInfo, href: "/vendor/settings" },
    { key: "logo", label: "Upload company logo", required: portalRequirements.requireCompanyLogo, done: Boolean(vendorInfo?.logo_url), href: "/vendor/settings" },
    { key: "payment", label: "Set payment method", required: portalRequirements.requirePaymentMethod, done: hasPrimaryPaymentMethod, href: "/vendor/settings" },
    { key: "w9", label: "Upload W-9", required: portalRequirements.requireW9, done: hasW9Doc, href: "/vendor/compliance" },
    { key: "insurance", label: "Upload insurance", required: portalRequirements.requireInsurance, done: hasInsuranceDoc, href: "/vendor/compliance" },
    { key: "avatar", label: "Set user avatar", required: portalRequirements.requireUserAvatar, done: hasUserAvatar, href: "/vendor/profile-settings" },
  ]).filter((item) => item.required), [portalRequirements, billingEnabledJobs.length, isProfileComplete, hasCompanyInfo, vendorInfo?.logo_url, hasPrimaryPaymentMethod, hasW9Doc, hasInsuranceDoc, hasUserAvatar]);
  const checklistRemaining = useMemo(
    () => onboardingChecklist.filter((item) => !item.done),
    [onboardingChecklist],
  );
  const expiringDocs = useMemo(() => complianceDocs.filter((doc) => {
    if (!doc.expiration_date) return false;
    const days = Math.ceil((new Date(doc.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 30;
  }), [complianceDocs]);
  const attentionItems = useMemo(() => {
    const items: Array<{ id: string; title: string; detail: string; href: string; priority: number }> = [];
    checklistRemaining.forEach((item, index) => {
      items.push({
        id: `checklist-${item.key}`,
        title: item.label,
        detail: "Required before the vendor portal is fully ready.",
        href: item.href,
        priority: 100 - index,
      });
    });
    if (unreadMessages.length > 0) {
      items.push({
        id: "messages",
        title: "Unread messages",
        detail: `${unreadMessages.length} message${unreadMessages.length === 1 ? "" : "s"} need review.`,
        href: "/vendor/messages",
        priority: 80,
      });
    }
    if (openRfps.length > 0) {
      items.push({
        id: "rfps",
        title: "Open RFP invitations",
        detail: `${openRfps.length} invitation${openRfps.length === 1 ? "" : "s"} are waiting for action.`,
        href: "/vendor/rfps",
        priority: 70,
      });
    }
    if (openInvoices.length > 0) {
      items.push({
        id: "bills",
        title: "Open invoices",
        detail: `${openInvoices.length} invoice${openInvoices.length === 1 ? "" : "s"} still need tracking.`,
        href: "/vendor/bills",
        priority: 60,
      });
    }
    if (revisionRequestedInvoices.length > 0) {
      items.push({
        id: "bill-revisions",
        title: "Revision requests",
        detail: `${revisionRequestedInvoices.length} invoice${revisionRequestedInvoices.length === 1 ? "" : "s"} need updated backup or clarification.`,
        href: revisionRequestedInvoices[0] ? `/vendor/bills/${revisionRequestedInvoices[0].id}` : "/vendor/bills",
        priority: 95,
      });
    }
    if (missingDocs.length > 0 || expiringDocs.length > 0) {
      items.push({
        id: "compliance",
        title: "Compliance follow-up",
        detail: `${missingDocs.length} missing and ${expiringDocs.length} expiring document${missingDocs.length + expiringDocs.length === 1 ? "" : "s"}.`,
        href: "/vendor/compliance",
        priority: 90,
      });
    }
    return items.sort((a, b) => b.priority - a.priority).slice(0, 6);
  }, [checklistRemaining, unreadMessages.length, openRfps.length, openInvoices.length, revisionRequestedInvoices, missingDocs.length, expiringDocs.length]);

  useEffect(() => {
    const loadPortalRequirements = async () => {
      if (!currentCompany?.id) return;
      const { data, error } = await supabase
        .from("payables_settings")
        .select(`
          vendor_portal_require_job_assignment_for_bills,
          vendor_portal_require_profile_completion,
          vendor_portal_require_payment_method,
          vendor_portal_require_w9,
          vendor_portal_require_insurance,
          vendor_portal_require_company_logo,
          vendor_portal_require_user_avatar
        `)
        .eq("company_id", currentCompany.id)
        .maybeSingle();

      if (error) {
        console.error("VendorPortalDashboard: failed loading vendor portal requirements", error);
        return;
      }

      const typed = data as any;
      setPortalRequirements({
        requireJobAssignmentForBills: typed?.vendor_portal_require_job_assignment_for_bills ?? true,
        requireProfileCompletion: typed?.vendor_portal_require_profile_completion ?? true,
        requirePaymentMethod: typed?.vendor_portal_require_payment_method ?? true,
        requireW9: typed?.vendor_portal_require_w9 ?? false,
        requireInsurance: typed?.vendor_portal_require_insurance ?? false,
        requireCompanyLogo: typed?.vendor_portal_require_company_logo ?? false,
        requireUserAvatar: typed?.vendor_portal_require_user_avatar ?? false,
      });
    };

    void loadPortalRequirements();
  }, [currentCompany?.id]);

  if (loading) {
    return <PremiumLoadingScreen text="Loading vendor workspace..." />;
  }

  if (!vendorInfo) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">No Vendor Account Linked</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Your user account is not linked to a vendor profile yet. Ask the builder who invited you to finish your vendor setup.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {vendorLogoUrl ? (
            <img src={vendorLogoUrl} alt={vendorInfo.name || "Vendor"} className="h-14 w-auto max-w-[180px] object-contain" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              <Building2 className="h-7 w-7" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">{builderName} Vendor Portal</p>
            <h1 className="text-2xl font-bold text-foreground">Welcome back, {vendorInfo.name || "Vendor"}.</h1>
            <p className="text-sm text-muted-foreground">
              Manage the jobs, bills, and compliance items that {builderName} has shared with your vendor account.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/vendor/rfps")}>
            <FileText className="mr-2 h-4 w-4" />
            View RFPs
          </Button>
          <Button onClick={() => navigate("/vendor/jobs")}>
            <Briefcase className="mr-2 h-4 w-4" />
            View Jobs
          </Button>
        </div>
      </div>

      <Card className={checklistRemaining.length === 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">First Invoice Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {onboardingChecklist.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.href)}
                className="flex items-center justify-between rounded-lg border bg-background/80 px-3 py-2 text-left transition-colors hover:bg-background"
              >
                <span className="text-sm">{item.label}</span>
                <Badge variant={item.done ? "default" : "outline"}>{item.done ? "Done" : "Pending"}</Badge>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {checklistRemaining.length === 0
              ? "Everything needed for a clean first invoice setup is in place."
              : `Still needed: ${checklistRemaining.map((item) => item.label).join(", ")}.`}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-primary/15 bg-gradient-to-br from-background via-background to-primary/5">
          <CardHeader className="pb-3">
            <CardTitle>Action Center</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate("/vendor/rfps")}
              className="rounded-xl border bg-background/90 p-4 text-left transition-colors hover:border-primary hover:bg-background"
            >
              <p className="text-sm font-semibold">Review open RFPs</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {openRfps.length} invitation{openRfps.length === 1 ? "" : "s"} currently open for action.
              </p>
            </button>
            <button
              type="button"
              onClick={() => navigate(revisionRequestedInvoices[0] ? `/vendor/bills/${revisionRequestedInvoices[0].id}` : (openInvoices[0] ? `/vendor/bills/${openInvoices[0].id}` : "/vendor/bills"))}
              className="rounded-xl border bg-background/90 p-4 text-left transition-colors hover:border-primary hover:bg-background"
            >
              <p className="text-sm font-semibold">Check billing queue</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {revisionRequestedInvoices.length > 0
                  ? `${revisionRequestedInvoices.length} invoice${revisionRequestedInvoices.length === 1 ? "" : "s"} have requested revisions.`
                  : `${openInvoices.length} bill${openInvoices.length === 1 ? "" : "s"} still in progress or awaiting payment.`}
              </p>
            </button>
            <button
              type="button"
              onClick={() => navigate("/vendor/compliance")}
              className="rounded-xl border bg-background/90 p-4 text-left transition-colors hover:border-primary hover:bg-background"
            >
              <p className="text-sm font-semibold">Resolve compliance items</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {missingDocs.length} required document{missingDocs.length === 1 ? "" : "s"} missing.
              </p>
            </button>
            <button
              type="button"
              onClick={() => navigate("/vendor/messages")}
              className="rounded-xl border bg-background/90 p-4 text-left transition-colors hover:border-primary hover:bg-background"
            >
              <p className="text-sm font-semibold">Review messages</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {unreadMessages.length} unread message{unreadMessages.length === 1 ? "" : "s"} across the portal.
              </p>
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Portal Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Company profile</span>
              <Badge variant={hasCompanyInfo ? "default" : "outline"}>{hasCompanyInfo ? "Ready" : "Incomplete"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Primary payment method</span>
              <Badge variant={hasPrimaryPaymentMethod ? "default" : "outline"}>{hasPrimaryPaymentMethod ? "Ready" : "Missing"}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Billing-enabled jobs</span>
              <Badge variant={billingEnabledJobs.length > 0 ? "default" : "secondary"}>{billingEnabledJobs.length}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Unread messages</span>
              <Badge variant={unreadMessages.length > 0 ? "default" : "secondary"}>{unreadMessages.length}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Needs Attention Now</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {attentionItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Nothing urgent right now. The portal is in a healthy state.
            </div>
          ) : (
            attentionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.href)}
                className="flex w-full items-start justify-between gap-3 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-muted/20"
              >
                <div className="space-y-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <Badge variant="outline">Open</Badge>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => navigate("/vendor/jobs")}
          className="text-left"
        >
        <Card className="transition-colors hover:border-primary hover:bg-muted/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
            <p className="text-xs text-muted-foreground">Jobs shared with your vendor account</p>
          </CardContent>
        </Card>
        </button>

        <button
          type="button"
          onClick={() => navigate("/vendor/rfps")}
          className="text-left"
        >
        <Card className="transition-colors hover:border-primary hover:bg-muted/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open RFPs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openRfps.length}</div>
            <p className="text-xs text-muted-foreground">Bid invitations available in this portal</p>
          </CardContent>
        </Card>
        </button>

        <button
          type="button"
          onClick={() => navigate(revisionRequestedInvoices[0] ? `/vendor/bills/${revisionRequestedInvoices[0].id}` : (openInvoices[0] ? `/vendor/bills/${openInvoices[0].id}` : "/vendor/bills"))}
          className="text-left"
        >
        <Card className="transition-colors hover:border-primary hover:bg-muted/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Bills</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openInvoices.length}</div>
            <p className="text-xs text-muted-foreground">
              {revisionRequestedInvoices.length > 0
                ? `${revisionRequestedInvoices.length} need revisions right now`
                : "Invoices still in progress or awaiting payment"}
            </p>
          </CardContent>
        </Card>
        </button>

        <button
          type="button"
          onClick={() => navigate(revisionRequestedInvoices[0] ? `/vendor/bills/${revisionRequestedInvoices[0].id}` : "/vendor/bills")}
          className="text-left"
        >
        <Card className={`transition-colors hover:border-primary hover:bg-muted/20 ${revisionRequestedInvoices.length > 0 ? "border-amber-500 bg-amber-500/5" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revision Requested</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${revisionRequestedInvoices.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revisionRequestedInvoices.length}</div>
            <p className="text-xs text-muted-foreground">Invoices needing updates or clarification</p>
          </CardContent>
        </Card>
        </button>

        <button
          type="button"
          onClick={() => navigate("/vendor/compliance")}
          className="text-left"
        >
        <Card className={`transition-colors hover:border-primary hover:bg-muted/20 ${missingDocs.length > 0 ? "border-destructive bg-destructive/5" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Missing Compliance</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${missingDocs.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{missingDocs.length}</div>
            <p className="text-xs text-muted-foreground">Required items not uploaded yet</p>
          </CardContent>
        </Card>
        </button>

        <button
          type="button"
          onClick={() => navigate("/vendor/compliance")}
          className="text-left"
        >
        <Card className={`transition-colors hover:border-primary hover:bg-muted/20 ${expiringDocs.length > 0 ? "border-yellow-500 bg-yellow-500/5" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <ShieldCheck className={`h-4 w-4 ${expiringDocs.length > 0 ? "text-yellow-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringDocs.length}</div>
            <p className="text-xs text-muted-foreground">Compliance docs expiring in the next 30 days</p>
          </CardContent>
        </Card>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Revision Requested</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {revisionRequestedInvoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No invoices are waiting on revisions right now.
              </p>
            ) : (
              revisionRequestedInvoices.slice(0, 6).map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-left transition-colors hover:bg-amber-500/10"
                  onClick={() => navigate(`/vendor/bills/${invoice.id}`)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}</p>
                      <Badge variant="outline">Revision Requested</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {invoice.job_name || "No job assigned"}
                      {invoice.company_name ? ` • ${invoice.company_name}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${Number(invoice.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground">Open Invoice</p>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openInvoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No open invoices right now.
              </p>
            ) : (
              openInvoices.slice(0, 6).map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
                  onClick={() => navigate(`/vendor/bills/${invoice.id}`)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}</p>
                      <Badge variant="outline">{invoice.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {invoice.job_name || "No job assigned"}
                      {invoice.company_name ? ` • ${invoice.company_name}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${Number(invoice.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground">
                      {invoice.due_date ? `Due ${new Date(invoice.due_date).toLocaleDateString()}` : `Created ${new Date(invoice.created_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shared Jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No jobs have been shared with this vendor account yet.
              </p>
            ) : (
              jobs.slice(0, 6).map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
                  onClick={() => navigate(`/vendor/jobs/${job.id}`)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{job.name}</p>
                      {job.status && <Badge variant="outline">{job.status}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{job.company_name || "Builder company"}</p>
                  </div>
                  <Badge variant={job.can_submit_bills ? "default" : "secondary"}>
                    {job.can_submit_bills ? "Billing Enabled" : "View Only"}
                  </Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {complianceDocs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No compliance requirements configured yet.</p>
            ) : (
              complianceDocs.slice(0, 6).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="font-medium capitalize">{doc.type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.expiration_date ? `Expires ${new Date(doc.expiration_date).toLocaleDateString()}` : "No expiration date"}
                    </p>
                  </div>
                  <Badge variant={doc.is_uploaded ? "default" : "outline"}>{doc.is_uploaded ? "Uploaded" : "Missing"}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate("/vendor/messages")}>
            Open Messages
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No messages yet.
            </p>
          ) : (
            messages.slice(0, 5).map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => navigate("/vendor/messages", { state: { focusMessageId: message.id } })}
                className="flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{message.subject || "Message"}</p>
                    {!message.read ? <Badge>Unread</Badge> : null}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {message.content || "Open this message to view the full conversation."}
                  </p>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {new Date(message.created_at).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
          {unreadMessages.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {unreadMessages.length} unread message{unreadMessages.length === 1 ? "" : "s"}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Open RFP Invitations
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate("/vendor/rfps")}>
            View All
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {openRfps.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No active RFP invitations right now.
            </p>
          ) : (
            openRfps.slice(0, 5).map((rfp) => (
              <button
                key={rfp.id}
                type="button"
                onClick={() => navigate(`/vendor/rfps/${rfp.rfp_id}`)}
                className="flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{rfp.title}</p>
                    {rfp.rfp_number ? <Badge variant="outline">{rfp.rfp_number}</Badge> : null}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {rfp.job_name || "No job assigned"}
                    {rfp.company_name ? ` • ${rfp.company_name}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  {rfp.due_date ? `Due ${new Date(rfp.due_date).toLocaleDateString()}` : "Open"}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
