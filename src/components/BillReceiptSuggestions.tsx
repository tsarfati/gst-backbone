import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, DollarSign, Building2, FileText, Link, Eye, Check, ChevronDown, ChevronUp } from "lucide-react";
import { CodedReceipt, useReceipts } from "@/contexts/ReceiptContext";
import { useToast } from "@/hooks/use-toast";
import ReceiptPreviewModal from "./ReceiptPreviewModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BillReceiptSuggestionsProps {
  billVendorId?: string;
  billVendorName?: string;
  billAmount?: number;
  billJobId?: string;
  billDate?: string;
  onReceiptAttached?: (receipt: CodedReceipt) => void;
  attachedReceiptIds?: string[];
}

export default function BillReceiptSuggestions({ 
  billVendorId, 
  billVendorName, 
  billAmount,
  billJobId,
  billDate,
  onReceiptAttached,
  attachedReceiptIds = []
}: BillReceiptSuggestionsProps) {
  const { codedReceipts, uncodedReceipts } = useReceipts();
  const { toast } = useToast();
  const [previewReceipt, setPreviewReceipt] = useState<CodedReceipt | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [localAttachedIds, setLocalAttachedIds] = useState<Set<string>>(new Set(attachedReceiptIds));
  const [isOpen, setIsOpen] = useState(true);

  // Sync with external attachedReceiptIds
  useEffect(() => {
    setLocalAttachedIds(new Set(attachedReceiptIds));
  }, [attachedReceiptIds]);

  const suggestedReceipts = useMemo(() => {
    // Convert uncoded receipts to coded format for compatibility
    const uncodedAsCodedReceipts: CodedReceipt[] = (uncodedReceipts || []).map(receipt => ({
      ...receipt,
      jobName: receipt.job?.name || '',
      costCodeName: receipt.costCode?.description || '',
      codedBy: '',
      codedDate: new Date(),
      vendorId: undefined
    }));
    
    // Combine coded and converted uncoded receipts
    const allReceipts = [...(codedReceipts || []), ...uncodedAsCodedReceipts];
    
    if (!allReceipts.length) return [];
    
    console.log('BillReceiptSuggestions - Checking receipts:', {
      totalReceipts: allReceipts.length,
      codedCount: codedReceipts?.length || 0,
      uncodedCount: uncodedReceipts?.length || 0,
      billAmount,
      billVendorId,
      billJobId,
      billDate,
      sampleReceipt: allReceipts[0]
    });

    const suggestions = allReceipts
      .filter(receipt => {
        // Exclude receipts marked as credit card charges
        if ((receipt as any).is_credit_card_charge) {
          return false;
        }
        
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
          matches: amountMatch,
          isCreditCard: (receipt as any).is_credit_card_charge
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
          matchPercentage: Math.round(matchPercentage),
          isAttached: localAttachedIds.has(receipt.id)
        };
      })
      .sort((a, b) => {
        // Sort attached receipts to the bottom
        if (a.isAttached !== b.isAttached) {
          return a.isAttached ? 1 : -1;
        }
        return b.score - a.score;
      })
      .slice(0, 5); // Limit to top 5 suggestions

    return suggestions;
  }, [codedReceipts, uncodedReceipts, billVendorId, billAmount, billJobId, billDate, localAttachedIds]);

  // Auto-collapse when all receipts are attached
  const unattachedCount = suggestedReceipts.filter(s => !s.isAttached).length;
  useEffect(() => {
    if (unattachedCount === 0 && suggestedReceipts.length > 0) {
      setIsOpen(false);
    }
  }, [unattachedCount, suggestedReceipts.length]);

  const handleAttachReceipt = async (receipt: CodedReceipt) => {
    try {
      // Mark as attached locally
      setLocalAttachedIds(prev => new Set([...prev, receipt.id]));
      
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

  const attachedCount = suggestedReceipts.filter(s => s.isAttached).length;

  return (
    <>
      <ReceiptPreviewModal
        receipt={previewReceipt}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        onAttach={handleAttachReceipt}
      />
      
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="mb-6">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-amber-600">
                    <Lightbulb className="h-5 w-5" />
                    Suggested Receipts
                    {attachedCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {attachedCount} attached
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {unattachedCount > 0 
                      ? `Found ${unattachedCount} receipt${unattachedCount !== 1 ? 's' : ''} that might match this bill`
                      : 'All suggested receipts have been attached'}
                  </p>
                </div>
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {suggestedReceipts.map(({ receipt, reasons, matchPercentage, isAttached }) => (
                <div 
                  key={receipt.id} 
                  className={`flex items-center justify-between p-4 border rounded-lg ${isAttached ? 'bg-muted/50 border-green-200' : ''}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${isAttached ? 'bg-green-100' : 'bg-muted'}`}>
                      {isAttached ? (
                        <Check className="h-6 w-6 text-green-600" />
                      ) : (
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-medium ${isAttached ? 'text-muted-foreground' : ''}`}>{receipt.filename}</p>
                        {isAttached ? (
                          <Badge variant="default" className="bg-green-600 text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Attached
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            {matchPercentage}% Match
                          </Badge>
                        )}
                        {!isAttached && (
                          <div className="flex gap-1">
                            {reasons.map(reason => (
                              <Badge key={reason} variant="secondary" className="text-xs">
                                {reason === 'Same vendor' && <Building2 className="h-3 w-3 mr-1" />}
                                {(reason === 'Similar amount' || reason === 'Exact amount match' || reason === 'Very close amount') && <DollarSign className="h-3 w-3 mr-1" />}
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className={`grid grid-cols-2 gap-4 text-sm ${isAttached ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
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
                    {isAttached ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled
                        className="flex items-center gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Attached
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleAttachReceipt(receipt)}
                        className="flex items-center gap-2"
                      >
                        <Link className="h-4 w-4" />
                        Attach
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </>
  );
}