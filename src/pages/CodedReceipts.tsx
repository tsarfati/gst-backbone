import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useReceipts, CodedReceipt } from "@/contexts/ReceiptContext";
import { Calendar, DollarSign, Building, Code, Receipt as ReceiptIcon, User, Clock, FileImage, FileText, UserCheck, MessageSquare, Download, Search, Filter, X, LayoutGrid, List, AlignJustify, Grid3X3 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import CodedReceiptViewSelector from "@/components/CodedReceiptViewSelector";
import { CodedReceiptListView, CodedReceiptCompactView, CodedReceiptSuperCompactView, CodedReceiptIconView } from "@/components/CodedReceiptViews";
import { useCodedReceiptViewPreference } from "@/hooks/useCodedReceiptViewPreference";
import jsPDF from 'jspdf';


export default function CodedReceipts() {
  const { codedReceipts, messages } = useReceipts();
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterJob, setFilterJob] = useState("all");
  const [filterCostCode, setFilterCostCode] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const { currentView, setCurrentView, setDefaultView, isDefault } = useCodedReceiptViewPreference('coded-receipts', 'list');
  const [selectedReceipt, setSelectedReceipt] = useState<CodedReceipt | null>(null);
  const { toast } = useToast();

  // Create dynamic lists from coded receipts data
  const jobs = useMemo(() => Array.from(new Set(codedReceipts.map(r => r.job).filter(Boolean))) as string[], [codedReceipts]);
  const costCodes = useMemo(() => Array.from(new Set(codedReceipts.map(r => r.costCode).filter(Boolean))) as string[], [codedReceipts]);

  // Sort coded receipts
  const allReceipts = useMemo((): CodedReceipt[] => {
    return codedReceipts.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (sortBy === 'amount') {
        return parseFloat(b.amount.replace(/[^0-9.-]/g, '')) - parseFloat(a.amount.replace(/[^0-9.-]/g, ''));
      } else if (sortBy === 'vendor') {
        return (a.vendor || '').localeCompare(b.vendor || '');
      }
      return 0;
    });
  }, [codedReceipts, sortBy]);

  // Filter receipts based on search and filters
  const filteredReceipts = useMemo(() => {
    return allReceipts.filter(receipt => {
      const matchesSearch = searchTerm === "" || 
        receipt.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.amount.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesJob = filterJob === "all" || receipt.job === filterJob;
      const matchesCostCode = filterCostCode === "all" || receipt.costCode === filterCostCode;

      return matchesSearch && matchesJob && matchesCostCode;
    });
  }, [allReceipts, searchTerm, filterJob, filterCostCode]);

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

    // Calculate total amount for filename
    const totalAmount = selectedReceiptData.reduce((sum, receipt) => {
      const amount = parseFloat(receipt.amount.replace(/[^0-9.-]/g, '')) || 0;
      return sum + amount;
    }, 0);

    // Generate filename with GST, date, and amount
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
    const gstAmount = (totalAmount * 0.13).toFixed(2); // Assuming 13% GST
    const formattedTotal = totalAmount.toFixed(2);
    
    const filename = `CodedReceipts_GST${gstAmount}_Total$${formattedTotal}_${dateStr}_${timeStr}.pdf`;

    // Create PDF
    const pdf = new jsPDF();
    let yPosition = 20;
    const pageHeight = pdf.internal.pageSize.height;
    const lineHeight = 6;
    const sectionSpacing = 10;

    // Add title
    pdf.setFontSize(16);
    pdf.text('Coded Receipts Export Report', 20, yPosition);
    yPosition += 15;

    // Add export summary
    pdf.setFontSize(12);
    pdf.text(`Export Date: ${now.toLocaleDateString()}`, 20, yPosition);
    yPosition += lineHeight;
    pdf.text(`Total Receipts: ${selectedReceiptData.length}`, 20, yPosition);
    yPosition += lineHeight;
    pdf.text(`Total Amount: $${formattedTotal}`, 20, yPosition);
    yPosition += lineHeight;
    pdf.text(`GST (13%): $${gstAmount}`, 20, yPosition);
    yPosition += lineHeight;
    pdf.text(`Grand Total: $${(totalAmount + parseFloat(gstAmount)).toFixed(2)}`, 20, yPosition);
    yPosition += sectionSpacing;

    // Add receipts table
    pdf.setFontSize(14);
    pdf.text('Receipt Summary', 20, yPosition);
    yPosition += 10;

    // Table headers
    pdf.setFontSize(10);
    pdf.text('Filename', 20, yPosition);
    pdf.text('Amount', 80, yPosition);
    pdf.text('Date', 120, yPosition);
    pdf.text('Job', 160, yPosition);
    yPosition += lineHeight;

    // Add line under headers
    pdf.line(20, yPosition - 2, 190, yPosition - 2);
    yPosition += 2;

    // Add receipt data
    selectedReceiptData.forEach(receipt => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }

      const shortFilename = receipt.filename.length > 25 ? 
        receipt.filename.substring(0, 22) + '...' : receipt.filename;
      
      pdf.text(shortFilename, 20, yPosition);
      pdf.text(receipt.amount, 80, yPosition);
      pdf.text(receipt.date, 120, yPosition);
      pdf.text((receipt.job || '').substring(0, 15), 160, yPosition);
      yPosition += lineHeight;
    });

    yPosition += sectionSpacing;

    // Add detailed coding information and audit logs
    pdf.addPage();
    yPosition = 20;
    
    pdf.setFontSize(16);
    pdf.text('Coding Information & Audit Logs', 20, yPosition);
    yPosition += 15;

    selectedReceiptData.forEach((receipt, index) => {
      if (yPosition > pageHeight - 50) {
        pdf.addPage();
        yPosition = 20;
      }

      // Receipt header
      pdf.setFontSize(14);
      pdf.text(`Receipt ${index + 1}: ${receipt.filename}`, 20, yPosition);
      yPosition += 10;

      // Receipt details
      pdf.setFontSize(10);
      const details = [
        `Amount: ${receipt.amount}`,
        `Date: ${receipt.date}`,
        `Vendor: ${receipt.vendor || 'Not specified'}`,
        `Job: ${receipt.job}`,
        `Cost Code: ${receipt.costCode}`,
        `Coded By: ${receipt.codedBy}`,
        `Coded Date: ${receipt.codedDate ? new Date(receipt.codedDate).toLocaleDateString() : 'Not specified'}`,
        `Uploaded By: ${receipt.uploadedBy || 'Not specified'}`,
        `Upload Date: ${receipt.uploadedDate ? new Date(receipt.uploadedDate).toLocaleDateString() : 'Not specified'}`
      ];

      details.forEach(detail => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(detail, 20, yPosition);
        yPosition += lineHeight;
      });

      // Add assignment information if available
      if (receipt.assignedUser) {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(`Assigned To: ${receipt.assignedUser.name} (${receipt.assignedUser.role})`, 20, yPosition);
        yPosition += lineHeight;
        pdf.text(`Assigned Date: ${new Date(receipt.assignedUser.assignedDate).toLocaleDateString()}`, 20, yPosition);
        yPosition += lineHeight;
      }

      // Add audit trail
      const receiptMessages = messages.filter(msg => msg.receiptId === receipt.id);
      if (receiptMessages.length > 0) {
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = 20;
        }
        
        pdf.setFontSize(12);
        pdf.text('Audit Trail:', 20, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(9);
        receiptMessages
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .forEach(msg => {
            if (yPosition > pageHeight - 15) {
              pdf.addPage();
              yPosition = 20;
            }
            const msgText = `${new Date(msg.timestamp).toLocaleString()} - ${msg.userName} (${msg.type}):`;
            pdf.text(msgText, 20, yPosition);
            yPosition += lineHeight;
            
            // Split long messages into multiple lines
            const msgContent = msg.message;
            const maxWidth = 170;
            const lines = pdf.splitTextToSize(msgContent, maxWidth);
            lines.forEach((line: string) => {
              if (yPosition > pageHeight - 15) {
                pdf.addPage();
                yPosition = 20;
              }
              pdf.text(line, 25, yPosition);
              yPosition += lineHeight;
            });
          });
      }

      // Add separator between receipts
      yPosition += 5;
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.line(20, yPosition, 190, yPosition);
      yPosition += 10;
    });

    // Save the PDF
    pdf.save(filename);

    toast({
      title: "Export successful",
      description: `${selectedReceiptData.length} receipt(s) exported to PDF. Total: $${formattedTotal} (GST: $${gstAmount})`,
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterJob("all");
    setFilterCostCode("all");
  };

  const viewOptions = [
    { value: 'list' as const, label: 'List', icon: List },
    { value: 'compact' as const, label: 'Compact', icon: AlignJustify },
    { value: 'super-compact' as const, label: 'Super Compact', icon: Grid3X3 },
    { value: 'icons' as const, label: 'Icons', icon: LayoutGrid },
  ];

  const renderReceiptView = () => {
    const props = {
      receipts: filteredReceipts,
      selectedReceipts,
      onSelectReceipt: handleSelectReceipt,
      onReceiptClick: setSelectedReceipt,
    };

    switch (currentView) {
      case 'compact':
        return <CodedReceiptCompactView {...props} />;
      case 'super-compact':
        return <CodedReceiptSuperCompactView {...props} />;
      case 'icons':
        return <CodedReceiptIconView {...props} />;
      default:
        return <CodedReceiptListView {...props} />;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Coded Receipts</h1>
        <p className="text-muted-foreground">
          View and manage all receipts that have been coded with job and cost code information
        </p>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter & Organize
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search receipts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label>Job</Label>
              <Select value={filterJob} onValueChange={setFilterJob}>
                <SelectTrigger>
                  <SelectValue placeholder="All jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All jobs</SelectItem>
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
                  <SelectItem value="all">All cost codes</SelectItem>
                  {costCodes.map(code => (
                    <SelectItem key={code} value={code}>{code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="amount">Amount</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={clearFilters} className="w-auto">
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>

            <div className="flex items-center gap-4">
              <CodedReceiptViewSelector
                currentView={currentView}
                onViewChange={setCurrentView}
                onSetDefault={setDefaultView}
                isDefault={isDefault}
              />
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

      {/* Receipts Display */}
      {filteredReceipts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ReceiptIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No coded receipts found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || filterJob !== 'all' || filterCostCode !== 'all'
                ? 'Try adjusting your search criteria or filters.'
                : 'No receipts have been coded yet.'}
            </p>
            {searchTerm || filterJob !== 'all' || filterCostCode !== 'all' ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        renderReceiptView()
      )}

      {/* Receipt Details Dialog */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedReceipt(null)}>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold">Receipt Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedReceipt(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Filename</Label>
                <p className="font-medium">{selectedReceipt.filename}</p>
              </div>
              <div>
                <Label>Amount</Label>
                <p className="font-medium">{selectedReceipt.amount}</p>
              </div>
              <div>
                <Label>Date</Label>
                <p className="font-medium">{selectedReceipt.date}</p>
              </div>
              <div>
                <Label>Vendor</Label>
                <p className="font-medium">{selectedReceipt.vendor || 'Not specified'}</p>
              </div>
              <div>
                <Label>Job</Label>
                <Badge variant="secondary">{selectedReceipt.job}</Badge>
              </div>
              <div>
                <Label>Cost Code</Label>
                <Badge variant="outline">{selectedReceipt.costCode}</Badge>
              </div>
              <div>
                <Label>Uploaded By</Label>
                <p className="font-medium">{selectedReceipt.uploadedBy}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}