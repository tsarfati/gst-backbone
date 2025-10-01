import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Link as LinkIcon, Search, Building2, DollarSign, Briefcase, ExternalLink } from "lucide-react";
import { useReceipts, CodedReceipt } from "@/contexts/ReceiptContext";

interface ReceiptLinkButtonProps {
  vendorName?: string;
  amount?: number;
  jobIds?: string[]; // from distribution items
  onAttach: (receipt: CodedReceipt) => void;
}

export default function ReceiptLinkButton({ vendorName, amount, jobIds = [], onAttach }: ReceiptLinkButtonProps) {
  const { codedReceipts } = useReceipts();
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    if (!codedReceipts?.length) return [] as Array<{ receipt: CodedReceipt; score: number; reasons: string[] }>;

    const vn = vendorName?.trim().toLowerCase();
    const jobSet = new Set(jobIds.filter(Boolean));

    return codedReceipts
      .filter((r) => {
        const vendorMatch = vn && r.vendor_name?.trim().toLowerCase() === vn;
        const amountMatch = typeof amount === 'number' && r.amount && Math.abs(Number(r.amount) - amount) <= 5;
        const jobMatch = r.job_id && jobSet.has(r.job_id);
        return Boolean(vendorMatch || amountMatch || jobMatch);
      })
      .map((r) => {
        const vendorMatch = vn && r.vendor_name?.trim().toLowerCase() === vn;
        const amountMatch = typeof amount === 'number' && r.amount && Math.abs(Number(r.amount) - amount) <= 5;
        const jobMatch = r.job_id && jobSet.has(r.job_id);
        let score = 0;
        const reasons: string[] = [];
        if (vendorMatch) { score += 10; reasons.push('Same vendor'); }
        if (amountMatch) { score += 6; reasons.push('Similar amount'); }
        if (jobMatch)    { score += 5; reasons.push('Same job'); }
        return { receipt: r, score, reasons };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [codedReceipts, vendorName, amount, jobIds]);

  const hasMatches = suggestions.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={hasMatches ? "default" : "outline"}
          size="sm"
          className={hasMatches ? "relative shadow-sm" : ""}
          onClick={() => setOpen(true)}
        >
          <LinkIcon className="h-4 w-4 mr-2" />
          Receipt Link
          {hasMatches && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs">
              <Badge variant="secondary">{suggestions.length} match{suggestions.length !== 1 ? 'es' : ''}</Badge>
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Suggested Receipts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!hasMatches ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No matching coded receipts found yet. Try adjusting vendor, amount, or job.
            </div>
          ) : (
            <div className="space-y-2">
              {suggestions.map(({ receipt, reasons }) => (
                <div key={receipt.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate max-w-[260px]" title={receipt.file_name || receipt.filename}>{receipt.file_name || receipt.filename}</p>
                        <div className="flex gap-1">
                          {reasons.map((r) => (
                            <Badge key={r} variant="secondary" className="text-[10px]">
                              {r === 'Same vendor' && <Building2 className="h-3 w-3 mr-1" />}
                              {r === 'Similar amount' && <DollarSign className="h-3 w-3 mr-1" />}
                              {r === 'Same job' && <Briefcase className="h-3 w-3 mr-1" />}
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div><span className="font-medium">Vendor:</span> {receipt.vendor_name || receipt.vendor || 'Unknown'}</div>
                        <div><span className="font-medium">Amount:</span> ${Number(receipt.amount || 0).toLocaleString()}</div>
                        <div><span className="font-medium">Date:</span> {receipt.date ? new Date(receipt.date).toLocaleDateString() : '-'}</div>
                        <div><span className="font-medium">Job:</span> {receipt.job?.name || receipt.jobName || 'Not assigned'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {receipt.previewUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={receipt.previewUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" /> Preview
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => { onAttach(receipt); setOpen(false); }}
                      className="flex items-center gap-2"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Attach
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
