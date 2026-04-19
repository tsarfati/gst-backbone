import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import ZoomableDocumentPreview from "@/components/ZoomableDocumentPreview";
import { useVendorPortalAccess } from "@/hooks/useVendorPortalAccess";
import { resolveStorageUrl } from "@/utils/storageUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BillVendorThread from "@/components/BillVendorThread";

interface InvoiceDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
}

const getVendorSubmissionMetadata = (value: any) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  if (value.generated_by_vendor_portal !== true) {
    return null;
  }
  return {
    paymentMethod: typeof value.payment_method === "string" ? value.payment_method : null,
    lineItems: Array.isArray(value.line_items) ? value.line_items : [],
  };
};

const getBillVendorThreadSubject = (invoiceId: string, invoiceNumber?: string | null) =>
  `Bill ${invoiceNumber || invoiceId.slice(0, 8)} Conversation`;

export default function VendorPortalInvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { roleCaps } = useVendorPortalAccess();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [documents, setDocuments] = useState<InvoiceDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleVendorResubmission = async () => {
    if (!invoice?.id || invoice?.status !== "revision_requested") return;
    try {
      await supabase
        .from("invoices")
        .update({ status: "pending_approval" })
        .eq("id", invoice.id);

      const authUser = await supabase.auth.getUser();
      const currentUserId = authUser.data.user?.id;
      if (currentUserId) {
        await supabase.from("invoice_audit_trail").insert({
          invoice_id: invoice.id,
          change_type: "status_change",
          field_name: "status",
          old_value: "revision_requested",
          new_value: "pending_approval",
          reason: "Vendor replied in bill conversation and marked the invoice ready for review again.",
          changed_by: currentUserId,
        });
      }

      const { error: notifyError } = await supabase.functions.invoke("send-bill-vendor-reply-notification", {
        body: {
          billId: invoice.id,
        },
      });
      if (notifyError) {
        console.warn("VendorPortalInvoiceDetails: vendor reply notification failed", notifyError);
      }

      setInvoice((prev: any) => prev ? { ...prev, status: "pending_approval" } : prev);
    } catch (error) {
      console.error("VendorPortalInvoiceDetails: failed updating resubmission state", error);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const [{ data: invoiceData, error: invoiceError }, { data: docsData, error: docsError }] = await Promise.all([
          supabase
            .from("invoices")
            .select(`
              id,
              invoice_number,
              amount,
              status,
              issue_date,
              due_date,
              created_at,
              description,
              internal_notes,
              job_id,
              jobs:job_id(id, name),
              vendors(name)
            `)
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("invoice_documents")
            .select("id, file_name, file_url, file_type, file_size, uploaded_at")
            .eq("invoice_id", id)
            .order("uploaded_at", { ascending: false }),
        ]);

        if (invoiceError) throw invoiceError;
        if (docsError) throw docsError;

        setInvoice(invoiceData);
        const nextDocs = (docsData || []) as InvoiceDocument[];
        setDocuments(nextDocs);
        setSelectedDocumentId(nextDocs[0]?.id || null);
      } catch (error) {
        console.error("VendorPortalInvoiceDetails: failed loading invoice", error);
        toast({
          title: "Could not load invoice",
          description: "The invoice details could not be loaded right now.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id, toast]);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) || null,
    [documents, selectedDocumentId],
  );

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!selectedDocument?.file_url) {
        setPreviewUrl(null);
        return;
      }
      const resolved = await resolveStorageUrl("receipts", selectedDocument.file_url);
      if (!cancelled) {
        setPreviewUrl(resolved || selectedDocument.file_url);
      }
    };
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [selectedDocument?.file_url]);

  const submissionMeta = useMemo(
    () => getVendorSubmissionMetadata(invoice?.internal_notes),
    [invoice?.internal_notes],
  );

  if (loading) {
    return <PremiumLoadingScreen text="Loading invoice..." />;
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

  if (!invoice) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Invoice not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" className="px-0" onClick={() => navigate("/vendor/bills")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Bills
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">
                {invoice.invoice_number || `INV-${String(invoice.id).slice(0, 8)}`}
              </h1>
              <Badge variant="outline">{invoice.status}</Badge>
              {submissionMeta ? <Badge>Submitted From Portal</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {invoice.jobs?.name || "No job assigned"}
              {invoice.vendors?.name ? ` • ${invoice.vendors.name}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Amount</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">${Number(invoice.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Issue Date</CardTitle></CardHeader>
          <CardContent><div className="text-sm font-medium">{invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : "Not set"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Due Date</CardTitle></CardHeader>
          <CardContent><div className="text-sm font-medium">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "Not set"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Attachments</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{documents.length}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-foreground">{invoice.description || "No description provided."}</p>
              </div>
              {submissionMeta?.paymentMethod ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requested Payment Method</p>
                  <p className="mt-1 text-foreground">{submissionMeta.paymentMethod.toUpperCase()}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {submissionMeta?.lineItems?.length ? (
                submissionMeta.lineItems.map((item: any, index: number) => (
                  <div key={`${item.description || "line"}-${index}`} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{item.description || `Line ${index + 1}`}</p>
                      <p className="text-sm font-semibold text-foreground">
                        ${Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No submitted line items were stored with this invoice.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attached Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {documents.length > 0 ? (
                documents.map((document) => (
                  <div
                    key={document.id}
                    className={`rounded-lg border p-3 ${selectedDocumentId === document.id ? "border-primary bg-primary/5" : ""}`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setSelectedDocumentId(document.id)}
                    >
                      <p className="truncate text-sm font-medium text-foreground">{document.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {document.uploaded_at ? new Date(document.uploaded_at).toLocaleDateString() : "Uploaded"}
                      </p>
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No supporting files were attached.</p>
              )}
            </CardContent>
          </Card>

          <BillVendorThread
            billId={invoice.id}
            subject={getBillVendorThreadSubject(invoice.id, invoice.invoice_number)}
            title="Builder Conversation"
            emptyMessage="No builder conversation has started on this invoice yet."
            composerPlaceholder={
              invoice.status === "revision_requested"
                ? "Reply here with your updated backup, clarification, or resubmission note."
                : "Reply to the builder about this invoice."
            }
            onMessageSent={handleVendorResubmission}
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Document Preview</CardTitle>
            {selectedDocument && previewUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={previewUrl} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {selectedDocument && previewUrl ? (
              <ZoomableDocumentPreview
                url={previewUrl}
                fileName={selectedDocument.file_name}
                className="min-h-[720px]"
              />
            ) : (
              <div className="flex min-h-[480px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                <div className="text-center">
                  <FileText className="mx-auto mb-3 h-10 w-10 opacity-60" />
                  {documents.length > 0 ? "Select a file to preview it." : "No preview available for this invoice yet."}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
