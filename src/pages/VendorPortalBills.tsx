import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { useVendorPortalData } from "@/hooks/useVendorPortalData";
import { useVendorPortalAccess } from "@/hooks/useVendorPortalAccess";

export default function VendorPortalBills() {
  const { loading, invoices, jobs } = useVendorPortalData();
  const { roleCaps } = useVendorPortalAccess();
  const billingEnabledJobs = useMemo(
    () => jobs.filter((job) => job.can_submit_bills),
    [jobs],
  );
  const billingJobIds = useMemo(
    () => new Set(billingEnabledJobs.map((job) => job.id)),
    [billingEnabledJobs],
  );
  const accessibleInvoices = useMemo(
    () =>
      invoices.filter((invoice) => !invoice.job_id || billingJobIds.has(invoice.job_id)),
    [billingJobIds, invoices],
  );

  const totals = useMemo(() => ({
    total: accessibleInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    open: accessibleInvoices.filter((invoice) => String(invoice.status || "").toLowerCase() !== "paid").length,
    paid: accessibleInvoices.filter((invoice) => String(invoice.status || "").toLowerCase() === "paid").length,
  }), [accessibleInvoices]);

  if (loading) {
    return <PremiumLoadingScreen text="Loading bills..." />;
  }

  if (!roleCaps.canAccessBills) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Billing access is not enabled for your vendor role.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Bills</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Billing-Enabled Jobs</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{billingEnabledJobs.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Open</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.open}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Amount</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {billingEnabledJobs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No builder has enabled invoice submission for your assigned jobs yet.</p>
          ) : (
            accessibleInvoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}</p>
                    <Badge variant={String(invoice.status || "").toLowerCase() === "paid" ? "default" : "outline"}>{invoice.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
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
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing Access By Job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {billingEnabledJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">As builders enable billing on shared jobs, they will appear here.</p>
          ) : (
            billingEnabledJobs.map((job) => (
              <div key={job.id} className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="font-medium text-foreground">{job.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {job.company_name || "Builder company"}
                    {job.project_number ? ` • #${job.project_number}` : ""}
                  </div>
                </div>
                <Badge>Invoice Submission Enabled</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
