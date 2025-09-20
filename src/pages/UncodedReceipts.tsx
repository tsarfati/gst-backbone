import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useReceipts } from "@/contexts/ReceiptContext";
import { Calendar, DollarSign, Building, Code, Receipt, User, Clock, FileImage, FileText } from "lucide-react";

const jobs = [
  "Office Renovation", 
  "Warehouse Project", 
  "Retail Buildout", 
  "Kitchen Remodel",
  "Parking Lot Repair"
];

const costCodes = [
  "Materials", 
  "Labor", 
  "Equipment", 
  "Subcontractors", 
  "Travel",
  "Permits & Fees",
  "Utilities",
  "Safety Equipment"
];

export default function UncodedReceipts() {
  const { uncodedReceipts, codeReceipt } = useReceipts();
  const [selectedReceipt, setSelectedReceipt] = useState(uncodedReceipts[0] || null);
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedCostCode, setSelectedCostCode] = useState("");
  const { toast } = useToast();

  // Update selected receipt when receipts change
  React.useEffect(() => {
    if (!selectedReceipt && uncodedReceipts.length > 0) {
      setSelectedReceipt(uncodedReceipts[0]);
    } else if (selectedReceipt && !uncodedReceipts.find(r => r.id === selectedReceipt.id)) {
      setSelectedReceipt(uncodedReceipts[0] || null);
    }
  }, [uncodedReceipts, selectedReceipt]);

  const handleCodeReceipt = () => {
    if (!selectedReceipt || !selectedJob || !selectedCostCode) {
      toast({
        title: "Missing information",
        description: "Please select a job and cost code.",
        variant: "destructive",
      });
      return;
    }

    // Code the receipt using context
    codeReceipt(selectedReceipt.id, selectedJob, selectedCostCode, "Current User");
    
    setSelectedJob("");
    setSelectedCostCode("");
    
    toast({
      title: "Receipt coded successfully",
      description: `Receipt assigned to ${selectedJob} - ${selectedCostCode}`,
    });
  };

  return (
    <div className="flex h-full">
      {/* Receipt List Sidebar */}
      <div className="w-80 border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center">
            <Receipt className="h-5 w-5 mr-2" />
            Uncoded Receipts ({uncodedReceipts.length})
          </h2>
        </div>
        
        <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
          {uncodedReceipts.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-muted-foreground">All receipts have been coded!</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {uncodedReceipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                    selectedReceipt?.id === receipt.id
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-accent"
                  }`}
                  onClick={() => setSelectedReceipt(receipt)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {receipt.type === 'pdf' ? (
                        <FileText className="h-4 w-4 text-red-500" />
                      ) : (
                        <FileImage className="h-4 w-4 text-blue-500" />
                      )}
                      <span className="font-medium text-sm truncate">{receipt.filename}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">Uncoded</Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center text-muted-foreground">
                        <DollarSign className="h-3 w-3 mr-1" />
                        {receipt.amount}
                      </div>
                      <div className="flex items-center text-muted-foreground">
                        <Calendar className="h-3 w-3 mr-1" />
                        {receipt.date}
                      </div>
                    </div>
                    {receipt.vendor && (
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Building className="h-3 w-3 mr-1" />
                        {receipt.vendor}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coding Controls */}
        {selectedReceipt && (
          <div className="p-4 border-t border-border bg-background">
            <h3 className="font-medium mb-3 flex items-center">
              <Code className="h-4 w-4 mr-2" />
              Code Receipt
            </h3>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="job-select" className="text-xs">Assign to Job</Label>
                <Select value={selectedJob} onValueChange={setSelectedJob}>
                  <SelectTrigger id="job-select" className="h-8">
                    <SelectValue placeholder="Select a job" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-md z-50">
                    {jobs.map((job) => (
                      <SelectItem key={job} value={job} className="cursor-pointer">
                        {job}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="cost-code-select" className="text-xs">Cost Code</Label>
                <Select value={selectedCostCode} onValueChange={setSelectedCostCode}>
                  <SelectTrigger id="cost-code-select" className="h-8">
                    <SelectValue placeholder="Select cost code" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-md z-50">
                    {costCodes.map((code) => (
                      <SelectItem key={code} value={code} className="cursor-pointer">
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleCodeReceipt} 
                className="w-full h-8"
                disabled={!selectedJob || !selectedCostCode}
              >
                Code Receipt
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Preview Area */}
      <div className="flex-1 bg-background">
        {selectedReceipt ? (
          <div className="h-full flex flex-col">
            {/* Preview Header */}
            <div className="p-4 border-b border-border bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold">Receipt Preview</h1>
                  <p className="text-sm text-muted-foreground">
                    {selectedReceipt.filename} • {selectedReceipt.amount}
                  </p>
                </div>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    {selectedReceipt.date}
                  </div>
                  {selectedReceipt.vendor && (
                    <div className="flex items-center">
                      <Building className="h-4 w-4 mr-2" />
                      {selectedReceipt.vendor}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 p-6 flex items-center justify-center bg-accent/20">
              <div className="max-w-2xl w-full">
                {selectedReceipt.type === 'pdf' ? (
                  <div className="bg-white rounded-lg shadow-lg p-8 aspect-[8.5/11]">
                    <div className="flex items-center justify-center h-full border-2 border-dashed border-muted">
                      <div className="text-center">
                        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium">PDF Receipt</p>
                        <p className="text-sm text-muted-foreground">{selectedReceipt.filename}</p>
                        <Button variant="outline" className="mt-4">
                          <FileText className="h-4 w-4 mr-2" />
                          Open PDF
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <img
                      src={selectedReceipt.previewUrl}
                      alt={`Receipt ${selectedReceipt.filename}`}
                      className="w-full h-auto max-h-[70vh] object-contain"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Receipt Info Footer */}
            <div className="p-4 border-t border-border bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>Uploaded by: {selectedReceipt.uploadedBy || "Controller"}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>Uploaded: {selectedReceipt.uploadedDate ? new Date(selectedReceipt.uploadedDate).toLocaleDateString() : selectedReceipt.date}</span>
                  </div>
                </div>
                <Badge variant="warning">
                  Awaiting Code Assignment
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Receipt className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Receipts to Code</h2>
              <p className="text-muted-foreground">
                All receipts have been successfully coded!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}