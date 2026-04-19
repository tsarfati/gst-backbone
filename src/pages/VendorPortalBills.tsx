import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { useVendorPortalData } from "@/hooks/useVendorPortalData";
import { useVendorPortalAccess } from "@/hooks/useVendorPortalAccess";
import { ArrowLeft, FilePlus2, Paperclip, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getStoragePathForDb, uploadFileWithProgress } from "@/utils/storageUtils";
import ZoomableDocumentPreview from "@/components/ZoomableDocumentPreview";

export default function VendorPortalBills() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { loading, invoices, jobs, vendorInfo, paymentMethod, reload } = useVendorPortalData();
  const { roleCaps } = useVendorPortalAccess();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "paid" | "overdue">("all");
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [selectedInvoiceFileIndex, setSelectedInvoiceFileIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: "",
    issueDate: "",
    dueDate: "",
    description: "",
    jobId: "",
    paymentMethod: paymentMethod?.type || "check",
    lineItems: [{ description: "", amount: "" }],
  });
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
  const filteredInvoices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accessibleInvoices.filter((invoice) => {
      const isPaid = String(invoice.status || "").toLowerCase() === "paid";
      const isOverdue = !isPaid && !!invoice.due_date && new Date(invoice.due_date).getTime() < Date.now();
      if (statusFilter === "paid" && !isPaid) return false;
      if (statusFilter === "open" && isPaid) return false;
      if (statusFilter === "overdue" && !isOverdue) return false;
      if (!q) return true;
      return [
        invoice.invoice_number,
        invoice.job_name,
        invoice.company_name,
        invoice.status,
        String(invoice.amount || ""),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [accessibleInvoices, query, statusFilter]);

  const totals = useMemo(() => ({
    total: accessibleInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    open: accessibleInvoices.filter((invoice) => String(invoice.status || "").toLowerCase() !== "paid").length,
    paid: accessibleInvoices.filter((invoice) => String(invoice.status || "").toLowerCase() === "paid").length,
    overdue: accessibleInvoices.filter((invoice) => String(invoice.status || "").toLowerCase() !== "paid" && !!invoice.due_date && new Date(invoice.due_date).getTime() < Date.now()).length,
  }), [accessibleInvoices]);
  const hasCompanyInfo = useMemo(
    () => Boolean(
      vendorInfo?.name?.trim() &&
      vendorInfo?.email?.trim() &&
      vendorInfo?.phone?.trim() &&
      vendorInfo?.address?.trim(),
    ),
    [vendorInfo],
  );
  const canSubmitInvoices = billingEnabledJobs.length > 0 && hasCompanyInfo && Boolean(paymentMethod?.type?.trim());
  const invoiceTotal = useMemo(
    () => invoiceForm.lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [invoiceForm.lineItems],
  );
  const selectedInvoiceFile = invoiceFiles[selectedInvoiceFileIndex] || null;
  const [selectedInvoiceFileUrl, setSelectedInvoiceFileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedInvoiceFile) {
      setSelectedInvoiceFileUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(selectedInvoiceFile);
    setSelectedInvoiceFileUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [selectedInvoiceFile]);

  useEffect(() => {
    if (selectedInvoiceFileIndex >= invoiceFiles.length) {
      setSelectedInvoiceFileIndex(invoiceFiles.length > 0 ? invoiceFiles.length - 1 : 0);
    }
  }, [invoiceFiles.length, selectedInvoiceFileIndex]);

  const updateInvoiceLineItem = (index: number, field: "description" | "amount", value: string) => {
    setInvoiceForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  };

  const addInvoiceLineItem = () => {
    setInvoiceForm((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, { description: "", amount: "" }],
    }));
  };

  const removeInvoiceLineItem = (index: number) => {
    setInvoiceForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const appendInvoiceFiles = (nextFiles: FileList | File[]) => {
    const asArray = Array.from(nextFiles || []);
    if (asArray.length === 0) return;
    setInvoiceFiles((prev) => {
      const existingKeys = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const deduped = asArray.filter((file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`));
      return [...prev, ...deduped];
    });
  };

  const removeInvoiceFile = (targetIndex: number) => {
    setInvoiceFiles((prev) => prev.filter((_, index) => index !== targetIndex));
  };

  const createVendorInvoice = async () => {
    if (!profile?.vendor_id || !user?.id) return;

    const validLineItems = invoiceForm.lineItems
      .map((item) => ({ description: item.description.trim(), amount: Number(item.amount) }))
      .filter((item) => item.description && item.amount > 0);

    if (validLineItems.length === 0) {
      toast({ title: "Missing line items", description: "Add at least one valid invoice line item.", variant: "destructive" });
      return;
    }

    if (!canSubmitInvoices) {
      toast({
        title: "Invoice submission not ready",
        description: "Set company info, billing-enabled job access, and a payment method first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingInvoice(true);
      const { data: insertedInvoice, error } = await supabase
        .from("invoices")
        .insert({
          vendor_id: profile.vendor_id,
          created_by: user.id,
          amount: validLineItems.reduce((sum, item) => sum + item.amount, 0),
          invoice_number: invoiceForm.invoiceNumber || null,
          description: invoiceForm.description || null,
          issue_date: invoiceForm.issueDate || null,
          due_date: invoiceForm.dueDate || null,
          job_id: invoiceForm.jobId || null,
          status: "pending_approval",
          pending_coding: true,
          internal_notes: {
            generated_by_vendor_portal: true,
            payment_method: invoiceForm.paymentMethod,
            line_items: validLineItems,
          },
        } as any)
        .select("id")
        .single();

      if (error) throw error;
      if (!insertedInvoice?.id) throw new Error("Invoice was created but no invoice id was returned.");

      if (invoiceFiles.length > 0) {
        const companyId =
          billingEnabledJobs.find((job) => job.id === invoiceForm.jobId)?.company_id ||
          jobs.find((job) => job.id === invoiceForm.jobId)?.company_id ||
          null;

        if (!companyId) {
          throw new Error("Missing builder company for invoice attachments.");
        }

        for (const file of invoiceFiles) {
          const fileExt = file.name.split(".").pop() || "file";
          const storagePath = `${companyId}/${insertedInvoice.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

          await uploadFileWithProgress({
            bucketName: "receipts",
            filePath: storagePath,
            file,
          });

          const fileUrl = getStoragePathForDb("receipts", storagePath);
          const { error: documentError } = await supabase.from("invoice_documents").insert({
            invoice_id: insertedInvoice.id,
            file_url: fileUrl,
            file_name: file.name,
            file_type: file.type || "application/octet-stream",
            file_size: file.size,
            uploaded_by: user.id,
          });

          if (documentError) throw documentError;
        }
      }

      toast({
        title: "Invoice submitted",
        description: "The invoice was created and sent for builder review.",
      });
      setInvoiceDialogOpen(false);
      setInvoiceForm({
        invoiceNumber: "",
        issueDate: "",
        dueDate: "",
        description: "",
        jobId: "",
        paymentMethod: paymentMethod?.type || "check",
        lineItems: [{ description: "", amount: "" }],
      });
      setInvoiceFiles([]);
      setSelectedInvoiceFileIndex(0);
      await reload();
    } catch (error: any) {
      toast({
        title: "Invoice submission failed",
        description: error?.message || "Could not create invoice.",
        variant: "destructive",
      });
    } finally {
      setSavingInvoice(false);
    }
  };

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
        <Button variant="ghost" className="px-0" onClick={() => navigate("/vendor/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bills</h1>
            <p className="text-sm text-muted-foreground">
              Track invoice status on jobs where the builder has enabled billing for your vendor account.
            </p>
          </div>
          <Button onClick={() => setInvoiceDialogOpen(true)} disabled={!canSubmitInvoices}>
            <FilePlus2 className="mr-2 h-4 w-4" />
            Submit Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Billing-Enabled Jobs</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{billingEnabledJobs.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Open</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.open}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Overdue</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.overdue}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Amount</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search invoice number, job, builder, amount, or status"
              className="max-w-xl"
            />
            <div className="flex flex-wrap gap-2">
              {(["all", "open", "paid", "overdue"] as const).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={statusFilter === value ? "default" : "outline"}
                  onClick={() => setStatusFilter(value)}
                >
                  {value === "all" ? "All" : value[0].toUpperCase() + value.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          {billingEnabledJobs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No builder has enabled invoice submission for your assigned jobs yet.
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No invoices match the current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((invoice) => {
                const isPaid = String(invoice.status || "").toLowerCase() === "paid";
                const isOverdue = !isPaid && !!invoice.due_date && new Date(invoice.due_date).getTime() < Date.now();
                return (
                  <div key={invoice.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}</p>
                        <Badge variant={isPaid ? "default" : isOverdue ? "destructive" : "outline"}>{invoice.status}</Badge>
                        {isOverdue ? <Badge variant="destructive">Overdue</Badge> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {invoice.job_name || "No job assigned"}
                        {invoice.company_name ? ` • ${invoice.company_name}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 md:items-end">
                      <div className="text-right">
                        <p className="font-semibold">${Number(invoice.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.due_date ? `Due ${new Date(invoice.due_date).toLocaleDateString()}` : `Created ${new Date(invoice.created_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      {invoice.job_id ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => navigate(`/vendor/bills/${invoice.id}`)}>
                            View Details
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => navigate(`/vendor/jobs/${invoice.job_id}`)}>
                            Open Job
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use the invoice queue above to search, filter, and jump to the related job. Billing access is still controlled per job by the builder.
          </p>
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

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-[92vw] w-[980px]">
          <DialogHeader>
            <DialogTitle>Submit Invoice</DialogTitle>
            <DialogDescription>
              Create and submit a vendor invoice directly from the portal.
            </DialogDescription>
          </DialogHeader>
          {!canSubmitInvoices ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Invoice submission requires at least one billing-enabled job, complete company information, and a primary payment method.
            </div>
          ) : null}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Invoice #</Label>
                <Input value={invoiceForm.invoiceNumber} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Total</Label>
                <Input value={invoiceTotal.toFixed(2)} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input type="date" value={invoiceForm.issueDate} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, issueDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Job</Label>
                <Select value={invoiceForm.jobId} onValueChange={(value) => setInvoiceForm((prev) => ({ ...prev, jobId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select billing-enabled job" />
                  </SelectTrigger>
                  <SelectContent>
                    {billingEnabledJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}{job.company_name ? ` - ${job.company_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Payment Method</Label>
                <Select value={invoiceForm.paymentMethod} onValueChange={(value) => setInvoiceForm((prev) => ({ ...prev, paymentMethod: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="wire">Wire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea value={invoiceForm.description} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, description: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Attachments</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      if (event.target.files) appendInvoiceFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="mr-2 h-4 w-4" />
                    Add Files
                  </Button>
                </div>
                <div
                  className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    appendInvoiceFiles(event.dataTransfer.files);
                  }}
                >
                  Drag invoice backup here or use Add Files.
                </div>
                {invoiceFiles.length > 0 ? (
                  <div className="space-y-2 rounded-lg border p-3">
                    {invoiceFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left ${selectedInvoiceFileIndex === index ? "bg-primary/10 ring-1 ring-primary/40" : "bg-muted/30"}`}
                        onClick={() => setSelectedInvoiceFileIndex(index)}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={(event) => {
                          event.stopPropagation();
                          removeInvoiceFile(index);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addInvoiceLineItem}>Add Line</Button>
                </div>
                <div className="space-y-2">
                  {invoiceForm.lineItems.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2">
                      <Input className="col-span-8" placeholder="Description" value={line.description} onChange={(e) => updateInvoiceLineItem(idx, "description", e.target.value)} />
                      <Input className="col-span-3" type="number" step="0.01" placeholder="Amount" value={line.amount} onChange={(e) => updateInvoiceLineItem(idx, "amount", e.target.value)} />
                      <Button type="button" variant="outline" className="col-span-1 px-0" onClick={() => removeInvoiceLineItem(idx)} disabled={invoiceForm.lineItems.length === 1}>×</Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Submission Check</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-muted-foreground">Billing-enabled jobs</span>
                  <Badge variant={billingEnabledJobs.length > 0 ? "default" : "outline"}>{billingEnabledJobs.length}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-muted-foreground">Company profile</span>
                  <Badge variant={hasCompanyInfo ? "default" : "outline"}>{hasCompanyInfo ? "Ready" : "Incomplete"}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-muted-foreground">Payment method</span>
                  <Badge variant={paymentMethod?.type ? "default" : "outline"}>{paymentMethod?.type || "Missing"}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-muted-foreground">Attachments</span>
                  <Badge variant={invoiceFiles.length > 0 ? "default" : "outline"}>
                    {invoiceFiles.length > 0 ? `${invoiceFiles.length} attached` : "Optional"}
                  </Badge>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current total</p>
                  <p className="mt-1 text-2xl font-bold">${invoiceTotal.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Attachment Preview</p>
                  <div className="mt-3 overflow-hidden rounded-lg border bg-muted/20">
                    <ZoomableDocumentPreview
                      url={selectedInvoiceFileUrl}
                      fileName={selectedInvoiceFile?.name}
                      className="h-[320px]"
                      showControls={Boolean(selectedInvoiceFileUrl)}
                      emptyMessage="No attachment selected"
                      emptySubMessage="Add a file to preview the invoice backup here."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>Cancel</Button>
            <Button onClick={createVendorInvoice} disabled={savingInvoice || !canSubmitInvoices}>
              {savingInvoice ? "Submitting..." : "Submit Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
