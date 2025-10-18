import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Link as LinkIcon } from "lucide-react";
import { CodedReceipt } from "@/contexts/ReceiptContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ReceiptPreviewModalProps {
  receipt: CodedReceipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAttach?: (receipt: CodedReceipt) => void;
}

export default function ReceiptPreviewModal({ 
  receipt, 
  open, 
  onOpenChange,
  onAttach 
}: ReceiptPreviewModalProps) {
  const [costDistributions, setCostDistributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (receipt?.id && open) {
      fetchCostDistributions();
    }
  }, [receipt?.id, open]);

  const fetchCostDistributions = async () => {
    if (!receipt?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('receipt_cost_distributions')
        .select(`
          *,
          job:jobs(id, job_name),
          cost_code:cost_codes(id, code, description)
        `)
        .eq('receipt_id', receipt.id);

      if (error) throw error;
      setCostDistributions(data || []);
    } catch (error) {
      console.error('Error fetching cost distributions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!receipt) return null;

  const isPdf = receipt.file_name?.toLowerCase().endsWith('.pdf') || receipt.type === 'pdf';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Receipt Preview: {receipt.filename || receipt.file_name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Coding Information - Top Section */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b overflow-y-auto max-h-48">
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Receipt Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Amount:</span>
                  <p className="text-base font-semibold">${Number(receipt.amount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Vendor:</span>
                  <p className="text-sm">{receipt.vendor || receipt.vendor_name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Date:</span>
                  <p className="text-sm">{new Date(receipt.date || receipt.receipt_date || '').toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Status:</span>
                  <div className="mt-1">
                    <Badge variant={receipt.status === 'coded' ? 'default' : 'secondary'} className="text-xs">
                      {receipt.status || 'Pending'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost Distributions */}
            {costDistributions.length > 0 && (
              <Card className="h-fit col-span-2 lg:col-span-3">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Cost Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {costDistributions.map((dist, index) => (
                      <div key={index} className="p-3 bg-muted rounded-lg space-y-2 text-xs">
                        <div>
                          <span className="font-medium text-muted-foreground">Job:</span>
                          <p className="font-medium text-sm">{dist.job?.job_name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">Cost Code:</span>
                          <p className="text-sm">{dist.cost_code?.code} - {dist.cost_code?.description}</p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">Amount:</span>
                          <p className="font-semibold text-sm">${Number(dist.amount || 0).toLocaleString()}</p>
                        </div>
                        {dist.notes && (
                          <div>
                            <span className="font-medium text-muted-foreground">Notes:</span>
                            <p className="text-xs">{dist.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          </div>

          {/* Receipt Preview - Full Width Bottom Section */}
          <div className="flex-1 border rounded-lg overflow-hidden bg-muted/30">
            {isPdf ? (
              <iframe
                src={receipt.file_url}
                className="w-full h-full"
                title="Receipt preview"
              />
            ) : (
              <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                <img
                  src={receipt.file_url}
                  alt="Receipt preview"
                  className="max-w-full h-auto"
                />
              </div>
            )}
          </div>

          {/* Action Button at Bottom */}
          {onAttach && (
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => {
                onAttach(receipt);
                onOpenChange(false);
              }}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Attach to Bill
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
