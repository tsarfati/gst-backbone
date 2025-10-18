import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, DollarSign, Receipt, FileText, Download, Search, Filter, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import UnifiedViewSelector, { UnifiedViewType } from "@/components/ui/unified-view-selector";
import { useUnifiedViewPreference } from "@/hooks/useUnifiedViewPreference";
import { cn } from "@/lib/utils";

interface ReceiptReportData {
  id: string;
  filename: string;
  amount: number;
  vendor: string;
  job: string;
  costCode: string;
  status: 'coded' | 'uncoded' | 'pending';
  uploadDate: string;
  uploadedBy: string;
  category: string;
}

// Mock data for now
const mockReceipts: ReceiptReportData[] = [
  {
    id: '1',
    filename: 'receipt-001.pdf',
    amount: 125.50,
    vendor: 'Home Depot',
    job: '123 Main St',
    costCode: 'MAT-001',
    status: 'coded',
    uploadDate: '2025-01-15',
    uploadedBy: 'John Doe',
    category: 'Materials'
  },
  {
    id: '2',
    filename: 'invoice-002.jpg',
    amount: 2500.00,
    vendor: 'ABC Construction',
    job: '456 Oak Ave',
    costCode: 'LAB-002',
    status: 'coded',
    uploadDate: '2025-01-14',
    uploadedBy: 'Jane Smith',
    category: 'Labor'
  },
];

export default function ReceiptReports() {
  const [receipts, setReceipts] = useState<ReceiptReportData[]>(mockReceipts);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  
  const { currentView, setCurrentView, setDefaultView, isDefault } = useUnifiedViewPreference('receipt-reports-view');

  const filteredReceipts = receipts.filter(receipt => {
    const matchesSearch = receipt.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         receipt.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         receipt.job.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || receipt.status === statusFilter;
    const matchesDateFrom = !dateFrom || new Date(receipt.uploadDate) >= dateFrom;
    const matchesDateTo = !dateTo || new Date(receipt.uploadDate) <= dateTo;
    
    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const totalAmount = filteredReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
  const codedReceipts = filteredReceipts.filter(r => r.status === 'coded').length;
  const uncodedReceipts = filteredReceipts.filter(r => r.status === 'uncoded').length;

  const renderReceiptItem = (receipt: ReceiptReportData) => {
    const baseClasses = "p-4 border rounded-lg hover:bg-primary/10 hover:border-primary transition-colors";
    
    switch (currentView) {
      case 'list':
        return (
          <div key={receipt.id} className={cn(baseClasses, "space-y-3")}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-medium">{receipt.filename}</h3>
                  <p className="text-sm text-muted-foreground">{receipt.vendor}</p>
                </div>
              </div>
              <Badge variant={receipt.status === 'coded' ? 'default' : 'secondary'}>
                {receipt.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium text-lg">${receipt.amount.toFixed(2)}</span>
              <span className="text-muted-foreground">{receipt.job}</span>
            </div>
          </div>
        );
      
      case 'compact':
        return (
          <div key={receipt.id} className={cn(baseClasses, "flex items-center justify-between")}>
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <h3 className="font-medium truncate">{receipt.filename}</h3>
                <p className="text-sm text-muted-foreground">{receipt.vendor} • {receipt.job}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">${receipt.amount.toFixed(2)}</span>
              <Badge variant={receipt.status === 'coded' ? 'default' : 'secondary'} className="text-xs">
                {receipt.status}
              </Badge>
            </div>
          </div>
        );
      
      case 'super-compact':
        return (
          <div key={receipt.id} className={cn(baseClasses, "flex items-center justify-between py-2")}>
            <div className="flex items-center gap-2">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm truncate">{receipt.filename}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">${receipt.amount.toFixed(2)}</span>
              <div className={cn("w-2 h-2 rounded-full", receipt.status === 'coded' ? 'bg-green-500' : 'bg-yellow-500')} />
            </div>
          </div>
        );
      
      case 'icons':
        return (
          <div key={receipt.id} className={cn(baseClasses, "text-center space-y-2")}>
            <div className="flex justify-center">
              <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <div>
              <h3 className="font-medium text-sm truncate">{receipt.filename}</h3>
              <p className="text-xs text-muted-foreground">{receipt.vendor}</p>
              <p className="text-sm font-medium">${receipt.amount.toFixed(2)}</p>
            </div>
            <Badge variant={receipt.status === 'coded' ? 'default' : 'secondary'} className="text-xs">
              {receipt.status}
            </Badge>
          </div>
        );
    }
  };

  const gridClasses = currentView === 'icons' 
    ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
    : "space-y-2";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Receipt Reports</h1>
          <p className="text-muted-foreground">
            Analyze and export receipt data across all projects
          </p>
        </div>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredReceipts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Coded Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{codedReceipts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Uncoded Receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{uncodedReceipts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search receipts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="coded">Coded</SelectItem>
                <SelectItem value="uncoded">Uncoded</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "PPP") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "PPP") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredReceipts.length} receipt{filteredReceipts.length !== 1 ? 's' : ''}
            </p>
            <UnifiedViewSelector
              currentView={currentView}
              onViewChange={setCurrentView}
              onSetDefault={setDefaultView}
              isDefault={isDefault}
            />
          </div>
        </CardContent>
      </Card>

      {/* Receipt List */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Details</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredReceipts.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No receipts found</h3>
              <p className="text-muted-foreground">
                Try adjusting your filters or search criteria
              </p>
            </div>
          ) : (
            <div className={gridClasses}>
              {filteredReceipts.map(renderReceiptItem)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}