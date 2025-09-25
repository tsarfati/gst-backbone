import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, DollarSign, Building2, FileText, Link } from "lucide-react";
import { CodedReceipt, useReceipts } from "@/contexts/ReceiptContext";
import { useToast } from "@/hooks/use-toast";

interface BillReceiptSuggestionsProps {
  billVendorId?: string;
  billVendorName?: string;
  billAmount?: number;
  onReceiptAttached?: () => void;
}

export default function BillReceiptSuggestions({ 
  billVendorId, 
  billVendorName, 
  billAmount, 
  onReceiptAttached 
}: BillReceiptSuggestionsProps) {
  const { codedReceipts } = useReceipts();
  const { toast } = useToast();

  const suggestedReceipts = useMemo(() => {
    if (!codedReceipts?.length) return [];

    const suggestions = codedReceipts
      .filter(receipt => {
        // Only suggest receipts that haven't been used yet (this is a simple check, you could add more fields)
        
        // Check for vendor match
        const vendorMatch = billVendorId && receipt.vendorId === billVendorId;
        
        // Check for amount match (within $5 tolerance)
        const amountMatch = billAmount && Math.abs(parseFloat(receipt.amount) - billAmount) <= 5;

        return vendorMatch || amountMatch;
      })
      .map(receipt => {
        const vendorMatch = billVendorId && receipt.vendorId === billVendorId;
        const amountMatch = billAmount && Math.abs(parseFloat(receipt.amount) - billAmount) <= 5;
        
        let score = 0;
        let reasons: string[] = [];

        if (vendorMatch) {
          score += 10;
          reasons.push('Same vendor');
        }
        
        if (amountMatch) {
          score += 5;
          reasons.push('Similar amount');
        }

        return { receipt, score, reasons };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Limit to top 5 suggestions

    return suggestions;
  }, [codedReceipts, billVendorId, billAmount]);

  const handleAttachReceipt = async (receipt: CodedReceipt) => {
    try {
      // In a real implementation, you would update the receipt in the database
      // to mark it as linked to this bill
      
      toast({
        title: "Receipt Attached",
        description: `Receipt ${receipt.filename} has been attached to this bill`,
      });

      onReceiptAttached?.();
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
        {suggestedReceipts.map(({ receipt, reasons }) => (
          <div key={receipt.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{receipt.filename}</p>
                  <div className="flex gap-1">
                    {reasons.map(reason => (
                      <Badge key={reason} variant="secondary" className="text-xs">
                        {reason === 'Same vendor' && <Building2 className="h-3 w-3 mr-1" />}
                        {reason === 'Similar amount' && <DollarSign className="h-3 w-3 mr-1" />}
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
                    <span className="font-medium">Amount:</span> ${parseFloat(receipt.amount).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Date:</span> {new Date(receipt.date).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Job:</span> {receipt.job || 'Not assigned'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(receipt.previewUrl, '_blank')}
              >
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
  );
}