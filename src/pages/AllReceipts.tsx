import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useReceipts, Receipt, CodedReceipt } from "@/contexts/ReceiptContext";
import { Calendar, DollarSign, Building, Code, Receipt as ReceiptIcon, User, Clock, FileImage, FileText, UserCheck, MessageSquare, Download, Search, Filter, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Combined receipt type for the all receipts view
type CombinedReceipt = (Receipt | CodedReceipt) & {
  status: 'uncoded' | 'coded';
};

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

export default function AllReceipts() {
  const { uncodedReceipts, codedReceipts } = useReceipts();
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterJob, setFilterJob] = useState("");
  const [filterCostCode, setFilterCostCode] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<CombinedReceipt | null>(null);
  const { toast } = useToast();

  // Combine all receipts
  const allReceipts = useMemo((): CombinedReceipt[] => {
    const uncoded = uncodedReceipts.map(receipt => ({ ...receipt, status: 'uncoded' as const }));
    const coded = codedReceipts.map(receipt => ({ ...receipt, status: 'coded' as const }));
    return [...uncoded, ...coded].sort((a, b) => 
      new Date(b.uploadedDate || b.date).getTime() - new Date(a.uploadedDate || a.date).getTime()
    );
  }, [uncodedReceipts, codedReceipts]);

  // Filter receipts based on search and filters
  const filteredReceipts = useMemo(() => {
    return allReceipts.filter(receipt => {
      const matchesSearch = searchTerm === "" || 
        receipt.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.amount.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesJob = filterJob === "" || 
        (receipt.status === 'coded' && 'job' in receipt && receipt.job === filterJob);

      const matchesCostCode = filterCostCode === "" || 
        (receipt.status === 'coded' && 'costCode' in receipt && receipt.costCode === filterCostCode);

      const matchesStatus = filterStatus === "" || receipt.status === filterStatus;

      return matchesSearch && matchesJob && matchesCostCode && matchesStatus;
    });
  }, [allReceipts, searchTerm, filterJob, filterCostCode, filterStatus]);

  const handleSelectAll = () => {
    if (selectedReceipts.length === filteredReceipts.length) {
      setSelectedReceipts([]);
    } else {
      setSelectedReceipts(filteredReceipts.map(r => r.id));
    }
  };

  const handleSelectReceipt = (receiptId: string) => {
    setSelectedReceipts(prev => 
      prev.includes(receiptId) 
        ? prev.filter(id => id !== receiptId)
        : [...prev, receiptId]
    );
  };

  const handleExport = () => {
    const selectedReceiptData = filteredReceipts.filter(r => selectedReceipts.includes(r.id));
    
    if (selectedReceiptData.length === 0) {
      toast({
        title: "No receipts selected",
        description: "Please select receipts to export.",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = ["Filename", "Amount", "Date", "Vendor", "Status", "Job", "Cost Code", "Uploaded By"];
    const csvContent = [
      headers.join(","),
      ...selectedReceiptData.map(receipt => [
        receipt.filename,
        receipt.amount,
        receipt.date,
        receipt.vendor || "",
        receipt.status,
        receipt.status === 'coded' && 'job' in receipt ? receipt.job : "",
        receipt.status === 'coded' && 'costCode' in receipt ? receipt.costCode : "",
        receipt.uploadedBy || ""
      ].map(field => `"${field}"`).join(","))
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `receipts_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: "Export successful",
      description: `${selectedReceiptData.length} receipt(s) exported to CSV.`,
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterJob("");
    setFilterCostCode("");
    setFilterStatus("");
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">All Receipts</h1>
        <p className="text-muted-foreground">
          View and manage all receipts across your projects
        </p>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search receipts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="uncoded">Uncoded</SelectItem>
                  <SelectItem value="coded">Coded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Job</Label>
              <Select value={filterJob} onValueChange={setFilterJob}>
                <SelectTrigger>
                  <SelectValue placeholder="All jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All jobs</SelectItem>
                  {jobs.map(job => (
                    <SelectItem key={job} value={job}>{job}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Cost Code</Label>
              <Select value={filterCostCode} onValueChange={setFilterCostCode}>
                <SelectTrigger>
                  <SelectValue placeholder="All cost codes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All cost codes</SelectItem>
                  {costCodes.map(code => (
                    <SelectItem key={code} value={code}>{code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection and Export Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="select-all"
              checked={selectedReceipts.length === filteredReceipts.length && filteredReceipts.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <Label htmlFor="select-all">
              Select All ({selectedReceipts.length} of {filteredReceipts.length})
            </Label>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={selectedReceipts.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Selected ({selectedReceipts.length})
          </Button>
        </div>
      </div>

      {/* Receipt List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Receipts ({filteredReceipts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredReceipts.length === 0 ? (
              <div className="text-center py-8">
                <ReceiptIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No receipts found matching your criteria</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredReceipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedReceipt?.id === receipt.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                    onClick={() => setSelectedReceipt(receipt)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={selectedReceipts.includes(receipt.id)}
                          onCheckedChange={() => handleSelectReceipt(receipt.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center space-x-2">
                          {receipt.type === 'pdf' ? (
                            <FileText className="h-4 w-4 text-red-500" />
                          ) : (
                            <FileImage className="h-4 w-4 text-blue-500" />
                          )}
                          <span className="font-medium text-sm">{receipt.filename}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={receipt.status === 'coded' ? 'default' : 'warning'}>
                          {receipt.status === 'coded' ? 'Coded' : 'Uncoded'}
                        </Badge>
                        {receipt.assignedUser && (
                          <Badge variant="secondary" className="text-xs">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Assigned
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
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
                      
                      {receipt.status === 'coded' && 'job' in receipt && 'costCode' in receipt && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            <Code className="h-3 w-3 mr-1" />
                            {receipt.job}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {receipt.costCode}
                          </Badge>
                        </div>
                      )}
                      
                      <div className="flex items-center text-xs text-muted-foreground">
                        <User className="h-3 w-3 mr-1" />
                        Uploaded by: {receipt.uploadedBy || "Unknown"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Receipt Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedReceipt ? (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="font-semibold mb-2">{selectedReceipt.filename}</h3>
                  <div className="flex justify-center gap-4 text-sm text-muted-foreground mb-4">
                    <span>{selectedReceipt.amount}</span>
                    <span>•</span>
                    <span>{selectedReceipt.date}</span>
                  </div>
                </div>
                
                {selectedReceipt.type === 'pdf' ? (
                  <div className="bg-muted rounded-lg p-8 text-center">
                    <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">PDF Receipt</p>
                    <p className="text-sm text-muted-foreground mb-4">{selectedReceipt.filename}</p>
                    <Button variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      Open PDF
                    </Button>
                  </div>
                ) : selectedReceipt.previewUrl ? (
                  <div className="bg-muted rounded-lg overflow-hidden">
                    <img
                      src={selectedReceipt.previewUrl}
                      alt={`Receipt ${selectedReceipt.filename}`}
                      className="w-full h-auto max-h-96 object-contain mx-auto"
                      onError={(e) => {
                        e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%236b7280'%3EImage not available%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                ) : (
                  <div className="bg-muted rounded-lg p-8 text-center">
                    <FileImage className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">Image Receipt</p>
                    <p className="text-sm text-muted-foreground">Preview not available</p>
                  </div>
                )}

                {selectedReceipt.status === 'coded' && 'job' in selectedReceipt && 'costCode' in selectedReceipt && 'codedBy' in selectedReceipt && 'codedDate' in selectedReceipt && (
                  <div className="bg-accent rounded-lg p-4">
                    <h4 className="font-medium mb-2 flex items-center">
                      <Code className="h-4 w-4 mr-2" />
                      Coding Information
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Job:</span>
                        <span className="font-medium">{selectedReceipt.job}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cost Code:</span>
                        <span className="font-medium">{selectedReceipt.costCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Coded By:</span>
                        <span className="font-medium">{selectedReceipt.codedBy}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Coded Date:</span>
                        <span className="font-medium">
                          {new Date(selectedReceipt.codedDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <ReceiptIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Select a receipt to view preview</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}