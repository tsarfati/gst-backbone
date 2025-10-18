import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileText, Link as LinkIcon, User, Calendar, Undo2 } from "lucide-react";
import { CodedReceipt } from "@/contexts/ReceiptContext";
import UrlPdfInlinePreview from "./UrlPdfInlinePreview";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";

interface ReceiptPreviewModalProps {
  receipt: CodedReceipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAttach?: (receipt: CodedReceipt) => void;
  onUncode?: (receipt: CodedReceipt) => void;
}

export default function ReceiptPreviewModal({ 
  receipt, 
  open, 
  onOpenChange,
  onAttach,
  onUncode
}: ReceiptPreviewModalProps) {
  const [costDistributions, setCostDistributions] = useState<any[]>([]);
  const [uploadedByProfile, setUploadedByProfile] = useState<any>(null);
  const [codedByProfile, setCodedByProfile] = useState<any>(null);
  const [internalNotes, setInternalNotes] = useState<any[]>([]);
  const [receiptDbData, setReceiptDbData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (receipt?.id && open) {
      fetchReceiptDetails();
    }
  }, [receipt?.id, open]);

  const fetchReceiptDetails = async () => {
    if (!receipt?.id) return;
    
    setLoading(true);
    try {
      // Fetch cost distributions
      const { data: distributions, error: distError } = await supabase
        .from('receipt_cost_distributions')
        .select(`
          *,
          job:jobs(id, name),
          cost_code:cost_codes(id, code, description)
        `)
        .eq('receipt_id', receipt.id);

      if (distError) throw distError;
      setCostDistributions(distributions || []);

      // Fetch receipt data with created_by info
      const { data: receiptData } = await supabase
        .from('receipts')
        .select('created_by, created_at, notes')
        .eq('id', receipt.id)
        .single();

      if (receiptData?.created_by) {
        const { data: uploadProfile } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, display_name, avatar_url')
          .eq('user_id', receiptData.created_by)
          .single();
        setUploadedByProfile(uploadProfile);
      }

      // Check for coded_by from cost distributions (who created them)
      if (distributions && distributions.length > 0) {
        const codedByUserId = distributions[0].created_by;
        if (codedByUserId) {
          const { data: codeProfile } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name, display_name, avatar_url')
            .eq('user_id', codedByUserId)
            .single();
          setCodedByProfile(codeProfile);
        }
      }

      // Handle notes as internal notes
      if (receiptData?.notes) {
        setInternalNotes([receiptData.notes]);
      }
      
      setReceiptDbData(receiptData);
    } catch (error) {
      console.error('Error fetching receipt details:', error);
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
          <DialogDescription className="sr-only">Preview the receipt and its coding information. Press Esc to close.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Receipt Preview - 70% */}
          <div className="flex-[0.7] border rounded-lg overflow-hidden bg-muted/30 min-h-0">
            <div className="w-full h-full overflow-auto">
              {isPdf ? (
                <UrlPdfInlinePreview url={receipt.file_url} className="h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img
                    src={receipt.file_url}
                    alt="Receipt preview"
                    className="max-w-full h-auto"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Receipt Data - 30% */}
          <div className="flex-[0.3] flex flex-col gap-4 overflow-y-auto">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Details</CardTitle>
                {onUncode && receipt.status === 'coded' && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      onUncode(receipt);
                      onOpenChange(false);
                    }}
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Uncode
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {receipt.amount && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Amount</span>
                    <p className="text-base font-semibold">${Number(receipt.amount).toLocaleString()}</p>
                  </div>
                )}
                {(receipt.vendor || receipt.vendor_name) && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Vendor</span>
                    <p className="text-sm">{receipt.vendor || receipt.vendor_name}</p>
                  </div>
                )}
                {(receipt.date || receipt.receipt_date) && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Date</span>
                    <p className="text-sm">{new Date((receipt.date || receipt.receipt_date) as any).toLocaleDateString()}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Status</span>
                  <Badge variant={receipt.status === 'coded' ? 'default' : 'secondary'} className="text-xs">
                    {receipt.status || 'Pending'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* User Information */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Receipt Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Uploaded By */}
                {uploadedByProfile && (
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={uploadedByProfile.avatar_url} />
                      <AvatarFallback>
                        {uploadedByProfile.first_name?.[0]}{uploadedByProfile.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Uploaded by</p>
                      <p className="text-sm font-medium truncate">
                        {uploadedByProfile.display_name || `${uploadedByProfile.first_name} ${uploadedByProfile.last_name}`}
                      </p>
                      {receiptDbData?.created_at && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(receiptDbData.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {codedByProfile && (
                  <>
                    <Separator />
                    {/* Coded By */}
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={codedByProfile.avatar_url} />
                        <AvatarFallback>
                          {codedByProfile.first_name?.[0]}{codedByProfile.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">Coded by</p>
                        <p className="text-sm font-medium truncate">
                          {codedByProfile.display_name || `${codedByProfile.first_name} ${codedByProfile.last_name}`}
                        </p>
                        {costDistributions.length > 0 && costDistributions[0].created_at && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(costDistributions[0].created_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Internal Notes */}
            {internalNotes.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Internal Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {internalNotes.map((note, index) => (
                      <div key={index} className="p-2 bg-muted rounded text-xs">
                        {typeof note === 'string' ? note : note.note || note.message}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cost Distributions */}
            {costDistributions.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Cost Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {costDistributions.map((dist, index) => (
                      <div key={index} className="p-3 bg-muted rounded-lg space-y-2 text-xs">
                        <div>
                          <span className="font-medium text-muted-foreground">Job:</span>
                          <p className="font-medium text-sm">{dist.job?.name || 'N/A'}</p>
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

            {/* Action Button at Bottom */}
            {onAttach && (
              <Button 
                className="w-full mt-auto" 
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
