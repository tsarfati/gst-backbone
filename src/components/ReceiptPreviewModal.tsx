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
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Receipt Preview: {receipt.filename || receipt.file_name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Receipt Preview - Left Side */}
          <div className="flex-1 border rounded-lg overflow-hidden">
            {isPdf ? (
              <iframe
                src={receipt.file_url}
                className="w-full h-full"
                title="Receipt preview"
              />
            ) : (
              <img
                src={receipt.file_url}
                alt="Receipt preview"
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Coding Information - Right Side */}
          <div className="w-80 space-y-4 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receipt Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Amount:</span>
                  <p className="text-lg font-semibold">${Number(receipt.amount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Vendor:</span>
                  <p>{receipt.vendor || receipt.vendor_name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Date:</span>
                  <p>{new Date(receipt.date || receipt.receipt_date || '').toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Status:</span>
                  <Badge variant={receipt.status === 'coded' ? 'default' : 'secondary'}>
                    {receipt.status || 'Pending'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Cost Distributions */}
            {costDistributions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cost Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {costDistributions.map((dist, index) => (
                    <div key={index} className="p-3 bg-muted rounded-lg space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-muted-foreground">Job:</span>
                        <p className="font-medium">{dist.job?.job_name || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Cost Code:</span>
                        <p>{dist.cost_code?.code} - {dist.cost_code?.description}</p>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground">Amount:</span>
                        <p className="font-semibold">${Number(dist.amount || 0).toLocaleString()}</p>
                      </div>
                      {dist.notes && (
                        <div>
                          <span className="font-medium text-muted-foreground">Notes:</span>
                          <p className="text-xs">{dist.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {receipt.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{receipt.notes}</p>
                </CardContent>
              </Card>
            )}

            {onAttach && (
              <Button 
                className="w-full" 
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
