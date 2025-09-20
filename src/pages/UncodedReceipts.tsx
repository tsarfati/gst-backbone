import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar, DollarSign, Building, Code, Receipt } from "lucide-react";

interface ReceiptItem {
  id: string;
  filename: string;
  amount: string;
  date: string;
  vendor?: string;
}

const mockReceipts: ReceiptItem[] = [
  { id: "1", filename: "receipt_001.jpg", amount: "$245.50", date: "2024-01-15", vendor: "Home Depot" },
  { id: "2", filename: "receipt_002.pdf", amount: "$89.99", date: "2024-01-14", vendor: "Office Supply Co" },
  { id: "3", filename: "receipt_003.jpg", amount: "$1,250.00", date: "2024-01-13", vendor: "ABC Materials" },
];

const jobs = ["Office Renovation", "Warehouse Project", "Retail Buildout"];
const costCodes = ["Materials", "Labor", "Equipment", "Subcontractors", "Travel"];

export default function UncodedReceipts() {
  const [receipts, setReceipts] = useState<ReceiptItem[]>(mockReceipts);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptItem | null>(null);
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedCostCode, setSelectedCostCode] = useState("");
  const { toast } = useToast();

  const handleCodeReceipt = () => {
    if (!selectedReceipt || !selectedJob || !selectedCostCode) {
      toast({
        title: "Missing information",
        description: "Please select a job and cost code.",
        variant: "destructive",
      });
      return;
    }

    setReceipts(prev => prev.filter(r => r.id !== selectedReceipt.id));
    setSelectedReceipt(null);
    setSelectedJob("");
    setSelectedCostCode("");
    
    toast({
      title: "Receipt coded successfully",
      description: `Receipt assigned to ${selectedJob} - ${selectedCostCode}`,
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Uncoded Receipts</h1>
        <p className="text-muted-foreground">
          Assign receipts to jobs and cost codes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Receipt className="h-5 w-5 mr-2" />
              Receipts Awaiting Coding ({receipts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {receipts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                All receipts have been coded!
              </p>
            ) : (
              <div className="space-y-3">
                {receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedReceipt?.id === receipt.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedReceipt(receipt)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{receipt.filename}</span>
                      <Badge variant="outline">Uncoded</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <DollarSign className="h-3 w-3 mr-1" />
                        {receipt.amount}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {receipt.date}
                      </div>
                      {receipt.vendor && (
                        <div className="flex items-center col-span-2">
                          <Building className="h-3 w-3 mr-1" />
                          {receipt.vendor}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Code className="h-5 w-5 mr-2" />
              Code Receipt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedReceipt ? (
              <>
                <div className="p-4 bg-accent rounded-lg">
                  <h3 className="font-medium mb-2">Selected Receipt</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedReceipt.filename} • {selectedReceipt.amount}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="job-select">Assign to Job</Label>
                    <Select value={selectedJob} onValueChange={setSelectedJob}>
                      <SelectTrigger id="job-select">
                        <SelectValue placeholder="Select a job" />
                      </SelectTrigger>
                      <SelectContent>
                        {jobs.map((job) => (
                          <SelectItem key={job} value={job}>
                            {job}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="cost-code-select">Cost Code</Label>
                    <Select value={selectedCostCode} onValueChange={setSelectedCostCode}>
                      <SelectTrigger id="cost-code-select">
                        <SelectValue placeholder="Select cost code" />
                      </SelectTrigger>
                      <SelectContent>
                        {costCodes.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleCodeReceipt} 
                    className="w-full"
                    disabled={!selectedJob || !selectedCostCode}
                  >
                    Code Receipt
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Select a receipt to begin coding
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}