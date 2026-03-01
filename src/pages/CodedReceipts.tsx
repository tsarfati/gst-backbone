import React, { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useReceipts, CodedReceipt } from "@/contexts/ReceiptContext";
import { Calendar, DollarSign, Building, Code, Receipt as ReceiptIcon, User, Clock, FileImage, FileText, UserCheck, MessageSquare, Download, Search, Filter, X, LayoutGrid, List, AlignJustify, Grid3X3, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import CodedReceiptViewSelector from "@/components/CodedReceiptViewSelector";
import { CodedReceiptListView, CodedReceiptCompactView, CodedReceiptSuperCompactView, CodedReceiptIconView } from "@/components/CodedReceiptViews";
import { useCodedReceiptViewPreference } from "@/hooks/useCodedReceiptViewPreference";
import { useSettings } from "@/contexts/SettingsContext";
import ReceiptPreviewModal from "@/components/ReceiptPreviewModal";
import jsPDF from 'jspdf';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

// Bundle worker locally (avoids relying on external CDNs that may be blocked)
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Use bundled worker for reliability
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;


export default function CodedReceipts() {
  const { codedReceipts, messages, uncodeReceipt } = useReceipts();
  const { settings } = useSettings();
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterJob, setFilterJob] = useState("all");
  const [filterCostCode, setFilterCostCode] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const { currentView, setCurrentView, setDefaultView, isDefault } = useCodedReceiptViewPreference('coded-receipts', 'list');
  const [selectedReceipt, setSelectedReceipt] = useState<CodedReceipt | null>(null);
  const [linkedReceiptIds, setLinkedReceiptIds] = useState<Set<string>>(new Set());
  const [receiptDetails, setReceiptDetails] = useState<any>(null);
  const { toast } = useToast();

  // Fetch receipts that are linked to bills via audit trail
  React.useEffect(() => {
    const fetchLinkedReceipts = async () => {
      const { data, error } = await supabase
        .from('invoice_audit_trail')
        .select('new_value')
        .eq('change_type', 'update')
        .eq('field_name', 'attachment');
      
      if (!error && data) {
        const linkedIds = new Set(
          data
            .map(entry => entry.new_value)
            .filter(Boolean)
        );
        setLinkedReceiptIds(linkedIds);
      }
    };
    
    fetchLinkedReceipts();
  }, [codedReceipts]);

  // Fetch detailed receipt information when selected
  React.useEffect(() => {
    const fetchReceiptDetails = async () => {
      if (!selectedReceipt) {
        setReceiptDetails(null);
        return;
      }

      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', selectedReceipt.id)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching receipt details:', error);
        setReceiptDetails(null);
        return;
      }

      // Open modal immediately with base data
      setReceiptDetails(data);

      const uploadedById = (data as any).uploaded_by;
      const codedById = (data as any).coded_by;
      const jobId = (data as any).job_id;
      const costCodeId = (data as any).cost_code_id;

      const [uploadedByProfile, codedByProfile, jobRes, costCodeRes] = await Promise.all([
        uploadedById ? supabase.from('profiles').select('first_name, last_name').eq('user_id', uploadedById).maybeSingle() : Promise.resolve({ data: null }),
        codedById ? supabase.from('profiles').select('first_name, last_name').eq('user_id', codedById).maybeSingle() : Promise.resolve({ data: null }),
        jobId ? supabase.from('jobs').select('id, name').eq('id', jobId).maybeSingle() : Promise.resolve({ data: null }),
        costCodeId ? supabase.from('cost_codes').select('id, code, description').eq('id', costCodeId).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      setReceiptDetails({
        ...data,
        job: jobRes?.data || null,
        cost_code: costCodeRes?.data || null,
        uploaded_by_profile: uploadedByProfile?.data || null,
        coded_by_profile: codedByProfile?.data || null,
      } as any);
    };

    fetchReceiptDetails();
  }, [selectedReceipt]);

  // Filter out receipts that are linked to bills
  const unlinkedCodedReceipts = useMemo(() => {
    return codedReceipts.filter(receipt => !linkedReceiptIds.has(receipt.id));
  }, [codedReceipts, linkedReceiptIds]);

  // Create dynamic lists from coded receipts data
  const jobs = useMemo(() => Array.from(new Set(unlinkedCodedReceipts.map(r => r.jobName).filter(Boolean))) as string[], [unlinkedCodedReceipts]);
  const costCodes = useMemo(() => Array.from(new Set(unlinkedCodedReceipts.map(r => r.costCodeName).filter(Boolean))) as string[], [unlinkedCodedReceipts]);

  // Sort coded receipts
  const allReceipts = useMemo((): CodedReceipt[] => {
    return unlinkedCodedReceipts.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (sortBy === 'amount') {
        const aAmount = typeof a.amount === 'string' ? parseFloat(a.amount.replace(/[^0-9.-]/g, '')) : Number(a.amount) || 0;
        const bAmount = typeof b.amount === 'string' ? parseFloat(b.amount.replace(/[^0-9.-]/g, '')) : Number(b.amount) || 0;
        return bAmount - aAmount;
      } else if (sortBy === 'vendor') {
        return (a.vendor || '').localeCompare(b.vendor || '');
      }
      return 0;
    });
  }, [unlinkedCodedReceipts, sortBy]);

  // Filter receipts based on search and filters
  const filteredReceipts = useMemo(() => {
    return allReceipts.filter(receipt => {
      const matchesSearch = searchTerm === "" || 
        receipt.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.amount?.toString().toLowerCase().includes(searchTerm.toLowerCase());

      const matchesJob = filterJob === "all" || receipt.jobName === filterJob;
      const matchesCostCode = filterCostCode === "all" || receipt.costCodeName === filterCostCode;

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

  const handleExport = async () => {
    const selectedReceiptData = filteredReceipts.filter(r => selectedReceipts.includes(r.id));
    
    if (selectedReceiptData.length === 0) {
      toast({
        title: "No receipts selected",
        description: "Please select receipts to export.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Calculate total amount for filename
      const totalAmount = selectedReceiptData.reduce((sum, receipt) => {
        const amount = parseFloat(receipt.amount.replace(/[^0-9.-]/g, '')) || 0;
        return sum + amount;
      }, 0);

      // Generate filename with date and amount
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const formattedTotal = totalAmount.toFixed(2);
      
      const filename = `CodedReceipts_${dateStr}_$${formattedTotal}.pdf`;

      // Create PDF
      const pdf = new jsPDF();
      let pageNumber = 1;

      // Helper function to add original receipt document as-is
      const addReceiptDocument = async (receipt: CodedReceipt, receiptIndex: number) => {
        if (pageNumber > 1) {
          pdf.addPage();
        }

        try {
          if (receipt.previewUrl) {
            // Fetch the original file directly
            const response = await fetch(receipt.previewUrl, { mode: 'cors' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const contentType = response.headers.get('content-type') || '';

            // If it's a PDF, add all pages as-is
            if (contentType.includes('pdf') || receipt.filename.toLowerCase().endsWith('.pdf')) {
              const buffer = await blob.arrayBuffer();
              const srcPdf = await getDocument({ data: buffer }).promise;

              for (let p = 1; p <= srcPdf.numPages; p++) {
                const page = await srcPdf.getPage(p);
                
                // Get the original page size
                const viewport = page.getViewport({ scale: 1 });
                
                // Create canvas with original dimensions
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Canvas context not available');
                
                // Use higher scale for better quality
                const scale = 2;
                const scaledViewport = page.getViewport({ scale });
                canvas.width = scaledViewport.width;
                canvas.height = scaledViewport.height;
                
                // Render the page
                await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas }).promise;

                // Add a new page for each PDF page
                if (!(pageNumber === 1 && p === 1)) {
                  pdf.addPage();
                }

                // Add the rendered page as image, fitting to PDF page
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const pdfWidth = pdf.internal.pageSize.width;
                const pdfHeight = pdf.internal.pageSize.height;
                
                // Calculate scaling to fit while maintaining aspect ratio
                const imgAspect = canvas.width / canvas.height;
                const pdfAspect = pdfWidth / pdfHeight;
                
                let finalWidth, finalHeight, x, y;
                if (imgAspect > pdfAspect) {
                  // Image is wider, fit to width
                  finalWidth = pdfWidth;
                  finalHeight = pdfWidth / imgAspect;
                  x = 0;
                  y = (pdfHeight - finalHeight) / 2;
                } else {
                  // Image is taller, fit to height
                  finalHeight = pdfHeight;
                  finalWidth = pdfHeight * imgAspect;
                  x = (pdfWidth - finalWidth) / 2;
                  y = 0;
                }
                
                pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
                pageNumber++;
              }
            } else {
              // It's an image - add it as-is
              const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });

              const img = new Image();
              await new Promise((resolve) => {
                img.onload = () => {
                  try {
                    // Get PDF page dimensions
                    const pdfWidth = pdf.internal.pageSize.width;
                    const pdfHeight = pdf.internal.pageSize.height;
                    
                    // Calculate scaling to fit while maintaining aspect ratio
                    const imgAspect = img.width / img.height;
                    const pdfAspect = pdfWidth / pdfHeight;
                    
                    let finalWidth, finalHeight, x, y;
                    if (imgAspect > pdfAspect) {
                      // Image is wider, fit to width
                      finalWidth = pdfWidth;
                      finalHeight = pdfWidth / imgAspect;
                      x = 0;
                      y = (pdfHeight - finalHeight) / 2;
                    } else {
                      // Image is taller, fit to height
                      finalHeight = pdfHeight;
                      finalWidth = pdfHeight * imgAspect;
                      x = (pdfWidth - finalWidth) / 2;
                      y = 0;
                    }
                    
                    const format = contentType.includes('png') ? 'PNG' : 'JPEG';
                    pdf.addImage(dataUrl, format as any, x, y, finalWidth, finalHeight);
                  } catch (e) {
                    console.error('Error adding image to PDF:', e);
                    pdf.setFontSize(12);
                    pdf.text('Receipt image could not be embedded', 20, 60);
                  }
                  resolve(true);
                };
                img.onerror = () => {
                  console.error('Failed to load receipt image');
                  pdf.setFontSize(12);
                  pdf.text('Receipt image could not be loaded', 20, 60);
                  resolve(false);
                };
                img.src = dataUrl;
              });
              pageNumber++;
            }
          } else {
            // No preview available
            pdf.setFontSize(12);
            pdf.text('No preview available for this receipt', 20, 60);
            pageNumber++;
          }
        } catch (error) {
          console.error('Error processing receipt file:', error);
          pdf.setFontSize(12);
          pdf.text(`Error loading receipt file: ${error.message}`, 20, 60);
          pageNumber++;
        }
      };
      for (let i = 0; i < selectedReceiptData.length; i++) {
        await addReceiptDocument(selectedReceiptData[i], i);
      }

      // Add coding information and audit logs as final pages
      pdf.addPage();
      let yPosition = 20;
      const pageHeight = pdf.internal.pageSize.height;
      const lineHeight = 6;
      const sectionSpacing = 10;

      // Add header logo if available
      if (settings.headerLogo) {
        try {
          pdf.addImage(settings.headerLogo, 'JPEG', 20, yPosition, 40, 0, '', 'FAST');
          yPosition += 30;
        } catch (error) {
          console.error('Error adding header logo to PDF:', error);
        }
      }

      // Add title for coding section
      pdf.setFontSize(16);
      pdf.text('Coding Information & Audit Summary', 20, yPosition);
      yPosition += 15;

      // Add export summary
      pdf.setFontSize(12);
      pdf.text(`Export Date: ${now.toLocaleDateString()}`, 20, yPosition);
      yPosition += lineHeight;
      pdf.text(`Total Receipts: ${selectedReceiptData.length}`, 20, yPosition);
      yPosition += lineHeight;
      pdf.text(`Total Amount: $${formattedTotal}`, 20, yPosition);
      yPosition += sectionSpacing * 2;

      // Add detailed coding information for each receipt
      selectedReceiptData.forEach((receipt, index) => {
        if (yPosition > pageHeight - 80) {
          pdf.addPage();
          yPosition = 20;
        }

        // Receipt coding header
        pdf.setFontSize(14);
        pdf.text(`Receipt ${index + 1} - Coding Details`, 20, yPosition);
        yPosition += 12;

        // Create a form-like layout for coding information
        pdf.setFontSize(10);
        
        // Left column
        const leftColX = 20;
        const rightColX = 110;
        let leftY = yPosition;
        let rightY = yPosition;

        // Receipt basic info
        pdf.text('RECEIPT INFORMATION:', leftColX, leftY);
        leftY += 8;
        pdf.text(`Filename: ${receipt.filename}`, leftColX, leftY);
        leftY += lineHeight;
        pdf.text(`Date: ${receipt.date}`, leftColX, leftY);
        leftY += lineHeight;
        pdf.text(`Vendor: ${receipt.vendor || 'Not specified'}`, leftColX, leftY);
        leftY += lineHeight;

        // Receipt Amount (editable field representation)
        pdf.text('RECEIPT AMOUNT:', leftColX, leftY);
        leftY += 6;
        pdf.rect(leftColX, leftY, 80, 10); // Draw a box for amount
        pdf.text(`$ ${receipt.amount}`, leftColX + 2, leftY + 7);
        leftY += 16;

        // Coding information (right column)
        pdf.text('CODING INFORMATION:', rightColX, rightY);
        rightY += 8;
        pdf.text(`Job: ${receipt.jobName || 'Unknown'}`, rightColX, rightY);
        rightY += lineHeight;
        pdf.text(`Cost Code: ${receipt.costCodeName || 'Unknown'}`, rightColX, rightY);
        rightY += lineHeight;
        
        // User information
        pdf.text(`Uploaded By: ${receipt.uploadedBy || 'Unknown User'}`, rightColX, rightY);
        rightY += lineHeight;
        pdf.text(`Upload Date: ${receipt.uploadedDate ? new Date(receipt.uploadedDate).toLocaleDateString() : 'Not specified'}`, rightColX, rightY);
        rightY += lineHeight;
        pdf.text(`Coded By: ${receipt.codedBy || 'Unknown User'}`, rightColX, rightY);
        rightY += lineHeight;
        pdf.text(`Coded Date: ${receipt.codedDate ? new Date(receipt.codedDate).toLocaleDateString() : 'Not specified'}`, rightColX, rightY);
        rightY += lineHeight;

        yPosition = Math.max(leftY, rightY) + 5;

        // Add assignment information if available
        if (receipt.assignedUser) {
          if (yPosition > pageHeight - 30) {
            pdf.addPage();
            yPosition = 20;
          }
          
          pdf.text('ASSIGNMENT INFORMATION:', leftColX, yPosition);
          yPosition += 8;
          pdf.text(`Assigned To: ${receipt.assignedUser.name} (${receipt.assignedUser.role})`, leftColX, yPosition);
          yPosition += lineHeight;
          pdf.text(`Assigned Date: ${new Date(receipt.assignedUser.assignedDate).toLocaleDateString()}`, leftColX, yPosition);
          yPosition += lineHeight;
        }

        // Add audit trail
        const receiptMessages = messages.filter(msg => msg.receiptId === receipt.id);
        if (receiptMessages.length > 0) {
          if (yPosition > pageHeight - 40) {
            pdf.addPage();
            yPosition = 20;
          }
          
          pdf.setFontSize(12);
          pdf.text('AUDIT TRAIL:', leftColX, yPosition);
          yPosition += 10;
          
          pdf.setFontSize(9);
          receiptMessages
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .forEach(msg => {
              if (yPosition > pageHeight - 20) {
                pdf.addPage();
                yPosition = 20;
              }
              const msgText = `${new Date(msg.timestamp).toLocaleString()} - ${msg.userName} (${msg.type}):`;
              pdf.text(msgText, leftColX, yPosition);
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
                pdf.text(line, leftColX + 5, yPosition);
                yPosition += lineHeight;
              });
              yPosition += 2; // Small gap between messages
            });
        }

        // Add separator between receipts
        yPosition += 10;
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.line(20, yPosition, 190, yPosition);
        yPosition += 15;
      });

      // Save the PDF
      pdf.save(filename);

      toast({
        title: "Export successful",
        description: `${selectedReceiptData.length} receipt(s) exported to PDF. Total: $${formattedTotal}`,
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting the receipts. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUncodeReceipt = (receipt: CodedReceipt) => {
    try {
      uncodeReceipt(receipt.id);
      toast({
        title: "Receipt uncoded",
        description: `Receipt moved back to uncoded receipts.`,
      });
    } catch (error) {
      toast({
        title: "Uncode failed",
        description: "Failed to uncode receipt.",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      // Get the selected receipts data
      const selectedReceiptsData = filteredReceipts.filter(r => selectedReceipts.includes(r.id));
      
      // Delete each selected receipt (this will depend on your ReceiptContext implementation)
      for (const receipt of selectedReceiptsData) {
        await uncodeReceipt(receipt.id); // This moves them back to uncoded, effectively "deleting" from coded
      }

      toast({
        title: "Receipts deleted",
        description: `${selectedReceipts.length} receipt(s) have been moved to uncoded receipts`,
      });

      setSelectedReceipts([]);
    } catch (error) {
      console.error('Error deleting receipts:', error);
      toast({
        title: "Error",
        description: "Failed to delete receipts",
        variant: "destructive",
      });
    }
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
          <Button 
            variant="secondary" 
            onClick={async () => {
              try {
                const selectedReceiptsData = filteredReceipts.filter(r => selectedReceipts.includes(r.id));
                for (const receipt of selectedReceiptsData) {
                  await uncodeReceipt(receipt.id);
                }
                toast({
                  title: "Receipts uncoded",
                  description: `${selectedReceipts.length} receipt(s) moved to uncoded receipts`,
                });
                setSelectedReceipts([]);
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to uncode receipts",
                  variant: "destructive",
                });
              }
            }}
            disabled={selectedReceipts.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Uncode Selected ({selectedReceipts.length})
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleBulkDelete}
            disabled={selectedReceipts.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected ({selectedReceipts.length})
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

      {/* Receipt Preview Modal */}
      <ReceiptPreviewModal
        receipt={receiptDetails ? {
          ...receiptDetails,
          id: receiptDetails.id,
          filename: receiptDetails.filename || receiptDetails.file_name,
          file_name: receiptDetails.filename || receiptDetails.file_name,
          file_url: receiptDetails.file_url || receiptDetails.previewUrl,
          previewUrl: receiptDetails.file_url || receiptDetails.previewUrl,
          type: receiptDetails.file_name?.toLowerCase().endsWith('.pdf') ? 'pdf' as const : 'image' as const,
          amount: receiptDetails.amount,
          date: receiptDetails.date || receiptDetails.receipt_date,
          receipt_date: receiptDetails.date || receiptDetails.receipt_date,
          vendor: receiptDetails.vendor || receiptDetails.vendor_name,
          vendor_name: receiptDetails.vendor || receiptDetails.vendor_name,
          status: 'coded',
          jobName: receiptDetails.job?.name,
          costCodeName: receiptDetails.cost_code 
            ? `${receiptDetails.cost_code.code} - ${receiptDetails.cost_code.description}`
            : undefined,
          uploadedBy: receiptDetails.uploaded_by_profile 
            ? `${receiptDetails.uploaded_by_profile.first_name || ''} ${receiptDetails.uploaded_by_profile.last_name || ''}`.trim() || 'User'
            : 'User',
          uploadedDate: new Date(receiptDetails.created_at),
          codedBy: receiptDetails.coded_by_profile 
            ? `${receiptDetails.coded_by_profile.first_name || ''} ${receiptDetails.coded_by_profile.last_name || ''}`.trim() || 'User'
            : 'User',
          codedDate: receiptDetails.coded_at ? new Date(receiptDetails.coded_at) : new Date(),
        } : null}
        open={!!receiptDetails}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedReceipt(null);
            setReceiptDetails(null);
          }
        }}
      />
    </div>
  );
}