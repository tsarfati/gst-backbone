import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, DollarSign, Building2, FileText, Link, Eye } from "lucide-react";
import { CodedReceipt, useReceipts } from "@/contexts/ReceiptContext";
import { useToast } from "@/hooks/use-toast";
import ReceiptPreviewModal from "./ReceiptPreviewModal";

interface BillReceiptSuggestionsProps {
  billVendorId?: string;
  billVendorName?: string;
  billAmount?: number;
  billJobId?: string;
  billDate?: string;
  onReceiptAttached?: (receipt: CodedReceipt) => void;
}

export default function BillReceiptSuggestions({ 
  billVendorId, 
  billVendorName, 
  billAmount,
  billJobId,
  billDate,
  onReceiptAttached 
}: BillReceiptSuggestionsProps) {
  const { codedReceipts } = useReceipts();
  const { toast } = useToast();
  const [previewReceipt, setPreviewReceipt] = useState<CodedReceipt | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const suggestedReceipts = useMemo(() => {
    if (!codedReceipts?.length) return [];
    
    console.log('BillReceiptSuggestions - Checking receipts:', {
      totalReceipts: codedReceipts.length,
      billAmount,
      billVendorId,
      billJobId,
      billDate,
      sampleReceipt: codedReceipts[0]
    });

    const suggestions = codedReceipts
      .filter(receipt => {
        // Primary filter: amount must match (within $10 tolerance) - this is the main match point
        const receiptAmount = typeof receipt.amount === 'string' 
          ? parseFloat(receipt.amount.replace(/[^0-9.\-]/g, '')) 
          : Number(receipt.amount || 0);
        const amountMatch = billAmount && Math.abs(receiptAmount - billAmount) <= 10;
        
        console.log('Receipt amount check:', {
          filename: receipt.filename,
          receiptAmount,
          billAmount,
          diff: Math.abs(receiptAmount - billAmount),
          matches: amountMatch
        });
        
        return amountMatch;
      })
      .map(receipt => {
        let score = 0;
        let reasons: string[] = [];
        let matchPercentage = 0;

        // Amount matching is the main factor (50% weight)
        if (billAmount) {
          const amountDiff = Math.abs(Number(receipt.amount) - billAmount);
          const amountMatchScore = Math.max(0, 50 - (amountDiff / billAmount) * 50);
          score += amountMatchScore;
          matchPercentage += amountMatchScore;
          
          if (amountDiff < 0.01) {
            reasons.push('Exact amount match');
          } else if (amountDiff <= 5) {
            reasons.push('Very close amount');
          } else {
            reasons.push('Similar amount');
          }
        }

        // Vendor match (25% weight)
        if (billVendorId && receipt.vendorId === billVendorId) {
          score += 25;
          matchPercentage += 25;
          reasons.push('Same vendor');
        }
        
        // Job match (15% weight)
        if (billJobId && receipt.job_id === billJobId) {
          score += 15;
          matchPercentage += 15;
          reasons.push('Same job');
        }

        // Date proximity (10% weight) - within 30 days
        if (billDate && receipt.date) {
          const billDateObj = new Date(billDate);
          const receiptDateObj = new Date(receipt.date);
          const daysDiff = Math.abs((billDateObj.getTime() - receiptDateObj.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff <= 30) {
            const dateScore = Math.max(0, 10 - (daysDiff / 30) * 10);
            score += dateScore;
            matchPercentage += dateScore;
            
            if (daysDiff <= 7) {
              reasons.push('Recent date');
            } else {
              reasons.push('Similar timeframe');
            }
          }
        }

        return { 
          receipt, 
          score, 
          reasons,
          matchPercentage: Math.round(matchPercentage)
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Limit to top 5 suggestions

    return suggestions;
  }, [codedReceipts, billVendorId, billAmount, billJobId, billDate]);

  const handleAttachReceipt = async (receipt: CodedReceipt) => {
    try {
      toast({
        title: "Receipt Attached",
        description: `Receipt ${receipt.filename} has been attached to this bill`,
      });

      onReceiptAttached?.(receipt);
    } catch (error) {
      console.error('Error attaching receipt:', error);
      toast({
        title: "Error",
        description: "Failed to attach receipt to bill",
        variant: "destructive",
      });
    }
  };

  if (suggestedReceipts.length === 0) {
    return null;
  }

  return (
    <>
      <ReceiptPreviewModal
        receipt={previewReceipt}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        onAttach={handleAttachReceipt}
      />
      
      <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-600">
          <Lightbulb className="h-5 w-5" />
          Suggested Receipts
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Found {suggestedReceipts.length} coded receipt{suggestedReceipts.length !== 1 ? 's' : ''} that might match this bill
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestedReceipts.map(({ receipt, reasons, matchPercentage }) => (
          <div key={receipt.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{receipt.filename}</p>
                  <Badge variant="default" className="text-xs">
                    {matchPercentage}% Match
                  </Badge>
                  <div className="flex gap-1">
                    {reasons.map(reason => (
                      <Badge key={reason} variant="secondary" className="text-xs">
                        {reason === 'Same vendor' && <Building2 className="h-3 w-3 mr-1" />}
                        {(reason === 'Similar amount' || reason === 'Exact amount match' || reason === 'Very close amount') && <DollarSign className="h-3 w-3 mr-1" />}
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium">Vendor:</span> {receipt.vendor || 'Unknown'}
                  </div>
                  <div>
                    <span className="font-medium">Amount:</span> ${Number(receipt.amount || 0).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Date:</span> {new Date(receipt.date).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Job:</span> {receipt.jobName || 'Not assigned'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewReceipt(receipt);
                  setIsPreviewOpen(true);
                }}
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
              <Button
                size="sm"
                onClick={() => handleAttachReceipt(receipt)}
                className="flex items-center gap-2"
              >
                <Link className="h-4 w-4" />
                Attach
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
    </>
  );
}