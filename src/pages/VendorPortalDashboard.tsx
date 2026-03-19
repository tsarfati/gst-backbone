import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, FileText, ShieldCheck, AlertTriangle, DollarSign, Building2, Settings2 } from "lucide-react";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { useVendorPortalData } from "@/hooks/useVendorPortalData";
import { resolveCompanyLogoUrl } from "@/utils/resolveCompanyLogoUrl";

export default function VendorPortalDashboard() {
  const navigate = useNavigate();
  const { loading, vendorInfo, jobs, invoices, complianceDocs } = useVendorPortalData();

  const vendorLogoUrl = resolveCompanyLogoUrl(vendorInfo?.logo_url);
  const openInvoices = useMemo(() => invoices.filter((invoice) => String(invoice.status || "").toLowerCase() !== "paid"), [invoices]);
  const missingDocs = useMemo(() => complianceDocs.filter((doc) => doc.is_required && !doc.is_uploaded), [complianceDocs]);
  const expiringDocs = useMemo(() => complianceDocs.filter((doc) => {
    if (!doc.expiration_date) return false;
    const days = Math.ceil((new Date(doc.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 30;
  }), [complianceDocs]);

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
            <img src={vendorLogoUrl} alt={vendorInfo.name} className="h-14 w-auto max-w-[180px] object-contain" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              <Building2 className="h-7 w-7" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome back, {vendorInfo.name || "Vendor"}! 👋</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/vendor/settings")}>
            <Settings2 className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button onClick={() => navigate("/vendor/jobs")}>
            <Briefcase className="mr-2 h-4 w-4" />
            View Jobs
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
            <p className="text-xs text-muted-foreground">Jobs shared with your vendor account</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Bills</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openInvoices.length}</div>
            <p className="text-xs text-muted-foreground">Invoices still in progress or awaiting payment</p>
          </CardContent>
        </Card>

        <Card className={missingDocs.length > 0 ? "border-destructive bg-destructive/5" : undefined}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Missing Compliance</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${missingDocs.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{missingDocs.length}</div>
            <p className="text-xs text-muted-foreground">Required items not uploaded yet</p>
          </CardContent>
        </Card>

        <Card className={expiringDocs.length > 0 ? "border-yellow-500 bg-yellow-500/5" : undefined}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <ShieldCheck className={`h-4 w-4 ${expiringDocs.length > 0 ? "text-yellow-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringDocs.length}</div>
            <p className="text-xs text-muted-foreground">Compliance docs expiring in the next 30 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
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
    </div>
  );
}
