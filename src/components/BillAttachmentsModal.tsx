import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Loader2, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ZoomableDocumentPreview from "@/components/ZoomableDocumentPreview";
import { resolveStorageUrl } from "@/utils/storageUtils";
import { evaluateInvoiceCoding } from "@/utils/invoiceCoding";

interface BillAttachmentsModalProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface InvoiceDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type?: string | null;
  uploaded_at?: string;
}

interface InvoiceDetails {
  id: string;
  invoice_number: string | null;
  amount: number;
  issue_date: string | null;
  due_date: string | null;
  status: string | null;
  description: string | null;
  job_id: string | null;
  cost_code_id: string | null;
  file_url: string | null;
  vendors?: { name: string | null } | null;
  jobs?: { id: string; name: string } | null;
  cost_codes?: { code: string; description: string; type: string | null } | null;
}

interface DistributionLine {
  id?: string;
  amount?: number | null;
  percentage?: number | null;
  cost_code_id?: string | null;
  cost_codes?: {
    code?: string | null;
    description?: string | null;
    type?: string | null;
    job_id?: string | null;
    jobs?: { id?: string | null; name?: string | null } | null;
  } | null;
}

interface AuditEntry {
  id: string;
  change_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
  changed_by: string;
  userName?: string;
}

export default function BillAttachmentsModal({ invoiceId, open, onOpenChange }: BillAttachmentsModalProps) {
  const [docs, setDocs] = useState<InvoiceDocument[]>([]);
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [distributions, setDistributions] = useState<DistributionLine[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedPreviewKey, setSelectedPreviewKey] = useState<string | null>(null);
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !invoiceId) return;

    const load = async () => {
      try {
        setLoading(true);

        const [invoiceRes, docsRes, distributionRes, auditRes] = await Promise.all([
          supabase
            .from("invoices")
            .select(`
              id,
              invoice_number,
              amount,
              issue_date,
              due_date,
              status,
              description,
              job_id,
              cost_code_id,
              file_url,
              vendors(name),
              jobs(id, name),
              cost_codes(code, description, type)
            `)
            .eq("id", invoiceId)
            .maybeSingle(),
          supabase
            .from("invoice_documents")
            .select("id, file_name, file_url, file_type, uploaded_at")
            .eq("invoice_id", invoiceId)
            .order("uploaded_at", { ascending: false }),
          supabase
            .from("invoice_cost_distributions")
            .select(`
              id,
              amount,
              percentage,
              cost_code_id,
              cost_codes(code, description, type, job_id, jobs(id, name))
            `)
            .eq("invoice_id", invoiceId)
            .order("created_at", { ascending: true }),
          supabase
            .from("invoice_audit_trail")
            .select("id, change_type, field_name, old_value, new_value, reason, created_at, changed_by")
            .eq("invoice_id", invoiceId)
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

        if (invoiceRes.error) throw invoiceRes.error;
        if (docsRes.error) throw docsRes.error;
        if (distributionRes.error) throw distributionRes.error;
        if (auditRes.error) throw auditRes.error;

        const invoiceData = (invoiceRes.data as any) || null;
        const docsData = (docsRes.data as InvoiceDocument[]) || [];
        const distributionData = (distributionRes.data as DistributionLine[]) || [];
        const auditData = (auditRes.data as AuditEntry[]) || [];

        setInvoice(invoiceData);
        setDocs(docsData);
        setDistributions(distributionData);

        const userIds = [...new Set(auditData.map((entry) => entry.changed_by).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, first_name, last_name")
            .in("user_id", userIds);

          const userNameMap = new Map<string, string>();
          (profiles || []).forEach((profile: any) => {
            const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "System";
            userNameMap.set(profile.user_id, name);
          });

          setAuditEntries(
            auditData.map((entry) => ({
              ...entry,
              userName: userNameMap.get(entry.changed_by) || "System",
            })),
          );
        } else {
          setAuditEntries(auditData);
        }

        if (docsData.length > 0) {
          setSelectedPreviewKey(docsData[0].id);
        } else if (invoiceData?.file_url) {
          setSelectedPreviewKey("bill");
        } else {
          setSelectedPreviewKey(null);
        }
      } catch (error) {
        console.error("Failed to load bill preview details", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, invoiceId]);

  const selectedDocument = selectedPreviewKey && selectedPreviewKey !== "bill"
    ? docs.find((doc) => doc.id === selectedPreviewKey)
    : null;
  const activePreviewUrl = selectedDocument?.file_url || (selectedPreviewKey === "bill" ? invoice?.file_url : null) || null;
  const activePreviewName = selectedDocument?.file_name || "Bill Document";

  useEffect(() => {
    let cancelled = false;
    const resolvePreview = async () => {
      if (!activePreviewUrl) {
        if (!cancelled) setResolvedPreviewUrl(null);
        return;
      }
      const resolved = await resolveStorageUrl("receipts", activePreviewUrl);
      if (!cancelled) setResolvedPreviewUrl(resolved || activePreviewUrl);
    };
    resolvePreview();
    return () => {
      cancelled = true;
    };
  }, [activePreviewUrl]);

  const codingValidation = useMemo(
    () =>
      evaluateInvoiceCoding({
        amount: invoice?.amount,
        job_id: invoice?.job_id,
        cost_code_id: invoice?.cost_code_id,
        distributions: distributions as any[],
      }),
    [invoice, distributions],
  );

  const latestCodingEntry = useMemo(
    () =>
      auditEntries.find((entry) => {
        const reason = (entry.reason || "").toLowerCase();
        return entry.field_name === "cost_code_id" || entry.field_name === "job_id" || reason.includes("coding");
      }) || null,
    [auditEntries],
  );

  const handleDownload = async (doc: { id: string; file_url: string; file_name: string }) => {
    setDownloading(doc.id);
    try {
      const resolved = await resolveStorageUrl("receipts", doc.file_url);
      if (!resolved) return;
      const response = await fetch(resolved);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed", error);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[1500px] h-[92vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bill Review {invoice?.invoice_number ? `#${invoice.invoice_number}` : ""}
          </DialogTitle>
          <DialogDescription className="sr-only">Embedded bill preview with coding and audit trail</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading bill review...
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-full min-h-0">
            <div className="xl:col-span-2 min-h-0 flex flex-col border rounded-lg overflow-hidden">
              <div className="flex-1 min-h-0">
                <ZoomableDocumentPreview
                  url={resolvedPreviewUrl}
                  fileName={activePreviewName}
                  className="h-full"
                  emptyMessage="No bill documents available"
                  emptySubMessage="Attach a document to preview it here"
                />
              </div>
              {(docs.length > 0 || invoice?.file_url) && (
                <div className="border-t p-3 max-h-52 overflow-y-auto space-y-2">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex items-center justify-between gap-2 p-2 border rounded-md cursor-pointer ${selectedPreviewKey === doc.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                      onClick={() => setSelectedPreviewKey(doc.id)}
                    >
                      <div className="min-w-0">
                        <div className="text-sm truncate">{doc.file_name}</div>
                        {doc.uploaded_at && (
                          <div className="text-xs text-muted-foreground">
                            Uploaded {new Date(doc.uploaded_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(doc);
                        }}
                        disabled={downloading === doc.id}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {downloading === doc.id ? "Downloading..." : "Download"}
                      </Button>
                    </div>
                  ))}
                  {invoice?.file_url && (
                    <div
                      className={`flex items-center justify-between gap-2 p-2 border rounded-md cursor-pointer ${selectedPreviewKey === "bill" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                      onClick={() => setSelectedPreviewKey("bill")}
                    >
                      <div className="text-sm">Primary Bill Document</div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload({
                            id: "bill-file",
                            file_url: invoice.file_url || "",
                            file_name: `bill-${invoice.invoice_number || invoice.id}.pdf`,
                          });
                        }}
                        disabled={downloading === "bill-file"}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {downloading === "bill-file" ? "Downloading..." : "Download"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="xl:col-span-1 min-h-0 overflow-y-auto space-y-4 pr-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bill Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Vendor:</span> {invoice?.vendors?.name || "N/A"}</div>
                  <div><span className="text-muted-foreground">Amount:</span> ${Number(invoice?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div><span className="text-muted-foreground">Status:</span> {invoice?.status?.replace(/_/g, " ") || "N/A"}</div>
                  <div><span className="text-muted-foreground">Issue Date:</span> {invoice?.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : "N/A"}</div>
                  <div><span className="text-muted-foreground">Due Date:</span> {invoice?.due_date ? new Date(invoice.due_date).toLocaleDateString() : "N/A"}</div>
                  {invoice?.description && <div><span className="text-muted-foreground">Description:</span> {invoice.description}</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Coding</span>
                    <Badge variant={codingValidation.isComplete ? "default" : "destructive"}>
                      {codingValidation.isComplete ? "Complete" : "Incomplete"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {latestCodingEntry && (
                    <div className="text-xs text-muted-foreground">
                      Last coded by {latestCodingEntry.userName || "System"} on{" "}
                      {new Date(latestCodingEntry.created_at).toLocaleString()}
                    </div>
                  )}

                  {distributions.length > 0 ? (
                    <div className="space-y-2">
                      {distributions.map((line, idx) => (
                        <div key={line.id || idx} className="rounded-md border p-2 space-y-1">
                          <div className="text-xs text-muted-foreground">
                            {line.cost_codes?.jobs?.name || "No Job"}
                          </div>
                          <div className="text-sm font-medium">
                            {line.cost_codes?.code || "No Cost Code"}{line.cost_codes?.description ? ` - ${line.cost_codes.description}` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ${Number(line.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({Number(line.percentage || 0).toFixed(1)}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border p-2 text-sm">
                      <div><span className="text-muted-foreground">Job:</span> {invoice?.jobs?.name || "N/A"}</div>
                      <div>
                        <span className="text-muted-foreground">Cost Code:</span>{" "}
                        {invoice?.cost_codes?.code ? `${invoice.cost_codes.code} - ${invoice.cost_codes.description || ""}` : "N/A"}
                      </div>
                    </div>
                  )}

                  {!codingValidation.isComplete && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                      {codingValidation.issues[0] || "Coding is incomplete."}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Audit Trail ({auditEntries.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {auditEntries.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No audit entries found.</div>
                  ) : (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {auditEntries.map((entry) => (
                        <div key={entry.id} className="rounded-md border p-2">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline">{entry.change_type.replace(/_/g, " ")}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{entry.userName || "System"}</div>
                          {(entry.field_name || entry.reason) && (
                            <div className="mt-1 text-sm">
                              {entry.field_name ? `Field: ${entry.field_name}` : entry.reason}
                            </div>
                          )}
                          {entry.old_value && entry.new_value && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {entry.old_value} → {entry.new_value}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

