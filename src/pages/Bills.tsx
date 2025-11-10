import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, Building, CreditCard, FileText, DollarSign, Calendar, Filter, Trash2, CheckCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import PayablesViewSelector from "@/components/PayablesViewSelector";
import VendorAvatar from "@/components/VendorAvatar";
import { usePayablesViewPreference } from "@/hooks/usePayablesViewPreference";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActionPermissions } from "@/hooks/useActionPermissions";

interface Bill {
  id: string;
  invoice_number: string | null;
  vendor_name: string;
  vendor_logo_url: string | null;
  amount: number;
  status: string;
  issue_date: string;
  due_date: string;
  job_name: string;
  cost_code_description: string;
  description: string;
  payment_terms: string | null;
}

const calculateDaysOverdue = (dueDate: string): number => {
  const due = new Date(dueDate);
  const today = new Date();
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

const isOverdue = (bill: Bill): boolean => {
  const dueDate = new Date(bill.due_date);
  const today = new Date();
  return (bill.status === 'pending' || bill.status === 'pending_approval' || bill.status === 'approved' || bill.status === 'pending_payment') && dueDate < today;
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
    case "pending_approval":
      return "warning";
    case "pending_coding":
      return "secondary";
    case "approved":
    case "pending_payment":
      return "warning"; // Orange for awaiting payment
    case "overdue":
      return "destructive";
    case "draft":
      return "outline";
    default:
      return "default";
  }
};

const getStatusDisplayName = (status: string) => {
  switch (status) {
    case "pending":
      return "Pending Approval";
    case "pending_approval":
      return "Pending Approval";
    case "pending_coding":
      return "Pending Coding";
    case "approved":
      return "Awaiting Payment";
    case "pending_payment":
      return "Awaiting Payment";
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "draft":
      return "Draft";
    default:
      return status;
  }
};

const getJobColor = (jobName: string) => {
  // Generate consistent color based on job name
  let hash = 0;
  for (let i = 0; i < jobName.length; i++) {
    hash = jobName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
    'bg-violet-500',
    'bg-fuchsia-500',
    'bg-rose-500',
    'bg-amber-500'
  ];
  
  return colors[Math.abs(hash) % colors.length];
};

export default function Bills() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { canCreate, canDelete, canEdit } = useActionPermissions();
  
  // Initialize filters from navigation state if provided
  const initialVendorFilter = (location.state as any)?.vendorFilter || "all";
  const initialShowPaid = (location.state as any)?.vendorFilter ? true : false;
  
  const [jobFilter, setJobFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState(initialVendorFilter);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showPaidBills, setShowPaidBills] = useState(initialShowPaid);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentView, setCurrentView, setAsDefault, isDefault } = usePayablesViewPreference('bills');

  useEffect(() => {
    if (currentCompany) {
      loadBills();
    }
  }, [currentCompany]);

  const loadBills = async () => {
    if (!currentCompany) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          status,
          issue_date,
          due_date,
          description,
          payment_terms,
          vendors!inner(name, logo_url, company_id),
          jobs(name),
          cost_codes(description)
        `)
        .eq('vendors.company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedBills: Bill[] = data?.map(bill => ({
        id: bill.id,
        invoice_number: bill.invoice_number,
        vendor_name: (bill.vendors as any)?.name || 'Unknown Vendor',
        vendor_logo_url: (bill.vendors as any)?.logo_url || null,
        amount: bill.amount,
        status: bill.status,
        issue_date: bill.issue_date,
        due_date: bill.due_date,
        job_name: (bill.jobs as any)?.name || 'No Job',
        cost_code_description: (bill.cost_codes as any)?.description || 'No Cost Code',
        description: bill.description || '',
        payment_terms: bill.payment_terms
      })) || [];

      // Sync invoices that were paid via posted credit card transactions
      let finalBills = formattedBills;
      try {
        const idsToCheck = (data || []).filter((b: any) => b.status !== 'paid').map((b: any) => b.id);
        if (idsToCheck.length > 0) {
          const { data: postedTx, error: txErr } = await supabase
            .from('credit_card_transactions')
            .select('invoice_id')
            .in('invoice_id', idsToCheck)
            .not('journal_entry_id', 'is', null);

          if (!txErr && postedTx && postedTx.length > 0) {
            const idsPaid = Array.from(new Set((postedTx as any[]).map(t => t.invoice_id).filter(Boolean)));
            if (idsPaid.length > 0) {
              await supabase.from('invoices').update({ status: 'paid' }).in('id', idsPaid);
              finalBills = formattedBills.map(b => idsPaid.includes(b.id) ? { ...b, status: 'paid' } : b);
            }
          }
        }
      } catch (e) {
        console.warn('Invoice status sync skipped', e);
      }

      setBills(finalBills);
    } catch (error) {
      console.error('Error loading bills:', error);
      toast({
        title: "Error",
        description: "Failed to load bills",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const pendingCodingBills = bills.filter(bill => bill.status === 'pending_coding');
  const pendingApprovalBills = bills.filter(bill => bill.status === 'pending' || bill.status === 'pending_approval');
  const awaitingPaymentBills = bills.filter(bill => bill.status === 'approved' || bill.status === 'pending_payment');
  const overdueBills = bills.filter(bill => {
    const dueDate = new Date(bill.due_date);
    const today = new Date();
    return (bill.status === 'pending' || bill.status === 'pending_approval' || bill.status === 'approved' || bill.status === 'pending_payment' || bill.status === 'pending_coding') && dueDate < today;
  });

  // Apply status filter
  let statusFilteredBills = bills;
  if (statusFilter === "pending_coding") {
    statusFilteredBills = pendingCodingBills;
  } else if (statusFilter === "pending_approval") {
    statusFilteredBills = pendingApprovalBills;
  } else if (statusFilter === "awaiting_payment") {
    statusFilteredBills = awaitingPaymentBills;
  } else if (statusFilter === "overdue") {
    statusFilteredBills = overdueBills;
  }

  // Apply paid bills filter
  if (!showPaidBills) {
    statusFilteredBills = statusFilteredBills.filter(bill => bill.status !== 'paid');
  }

  // Apply job filter
  let jobFilteredBills = jobFilter === "all" 
    ? statusFilteredBills 
    : statusFilteredBills.filter(bill => bill.job_name === jobFilter);

  // Apply vendor filter
  let vendorFilteredBills = vendorFilter === "all"
    ? jobFilteredBills
    : jobFilteredBills.filter(bill => bill.vendor_name === vendorFilter);

  // Apply date filter
  let filteredBills = vendorFilteredBills;
  if (startDate) {
    filteredBills = filteredBills.filter(bill => new Date(bill.issue_date) >= new Date(startDate));
  }
  if (endDate) {
    filteredBills = filteredBills.filter(bill => new Date(bill.issue_date) <= new Date(endDate));
  }

  const uniqueJobs = [...new Set(bills.map(bill => bill.job_name))];
  const uniqueVendors = [...new Set(bills.map(bill => bill.vendor_name))];

  const totalPendingCoding = pendingCodingBills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalPendingApproval = pendingApprovalBills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalAwaitingPayment = awaitingPaymentBills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalOverdue = overdueBills.reduce((sum, bill) => sum + bill.amount, 0);

  const handleSelectAll = () => {
    if (selectedBills.length === filteredBills.length) {
      setSelectedBills([]);
    } else {
      setSelectedBills(filteredBills.map(b => b.id));
    }
  };

  const handleSelectBill = (billId: string) => {
    setSelectedBills(prev => 
      prev.includes(billId) 
        ? prev.filter(id => id !== billId)
        : [...prev, billId]
    );
  };

  const handleBulkApprove = async () => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'pending_payment' })
        .in('id', selectedBills);

      if (error) throw error;

      toast({
        title: "Bills approved",
        description: `${selectedBills.length} bill(s) have been approved`,
      });

      setSelectedBills([]);
      loadBills();
    } catch (error) {
      console.error('Error approving bills:', error);
      toast({
        title: "Error",
        description: "Failed to approve bills",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .in('id', selectedBills);

      if (error) throw error;

      toast({
        title: "Bills deleted",
        description: `${selectedBills.length} bill(s) have been deleted`,
      });

      setSelectedBills([]);
      loadBills();
    } catch (error) {
      console.error('Error deleting bills:', error);
      toast({
        title: "Error",
        description: "Failed to delete bills",
        variant: "destructive",
      });
    }
  };

  if (loading || !currentCompany) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading bills...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bills</h1>
            <p className="text-muted-foreground">Manage vendor bills and payments</p>
          </div>
          <div className="flex items-center gap-4">
            <PayablesViewSelector
              currentView={currentView}
              onViewChange={setCurrentView}
              onSetDefault={setAsDefault}
              isDefault={isDefault}
            />
            {canCreate('bills') && (
              <Button onClick={() => navigate("/invoices/add")}>
                <Plus className="h-4 w-4 mr-2" />
                Add Bill
              </Button>
            )}
          </div>
        </div>

        {/* Status Filter Counters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">All Bills</p>
                  <p className="text-2xl font-bold">{bills.length}</p>
                </div>
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'pending_coding' ? 'ring-2 ring-secondary' : ''}`}
            onClick={() => setStatusFilter('pending_coding')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Coding</p>
                  <p className="text-2xl font-bold">{pendingCodingBills.length}</p>
                  <p className="text-xs text-muted-foreground">${totalPendingCoding.toLocaleString()}</p>
                </div>
                <FileText className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'pending_approval' ? 'ring-2 ring-warning' : ''}`}
            onClick={() => setStatusFilter('pending_approval')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
                  <p className="text-2xl font-bold">{pendingApprovalBills.length}</p>
                  <p className="text-xs text-muted-foreground">${totalPendingApproval.toLocaleString()}</p>
                </div>
                <FileText className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'awaiting_payment' ? 'ring-2 ring-secondary' : ''}`}
            onClick={() => setStatusFilter('awaiting_payment')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Awaiting Payment</p>
                  <p className="text-2xl font-bold">{awaitingPaymentBills.length}</p>
                  <p className="text-xs text-muted-foreground">${totalAwaitingPayment.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'overdue' ? 'ring-2 ring-destructive' : ''}`}
            onClick={() => setStatusFilter('overdue')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold">{overdueBills.length}</p>
                  <p className="text-xs text-muted-foreground">${totalOverdue.toLocaleString()}</p>
                </div>
                <Calendar className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Actions */}
        {selectedBills.length > 0 && (canEdit('bills') || canDelete('bills')) && (() => {
          const selectedBillsData = bills.filter(b => selectedBills.includes(b.id));
          const hasUnapprovedBills = selectedBillsData.some(b => b.status === 'pending' || b.status === 'pending_approval');
          
          return (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all-bills"
                checked={selectedBills.length === filteredBills.length && filteredBills.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all-bills">
                Select All ({selectedBills.length} of {filteredBills.length})
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              {hasUnapprovedBills && canEdit('bills') && (
                <Button 
                  variant="outline" 
                  onClick={handleBulkApprove}
                  disabled={selectedBills.length === 0}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Selected ({selectedBills.length})
                </Button>
              )}
              {canDelete('bills') && (
                <Button 
                  variant="destructive" 
                  onClick={handleBulkDelete}
                  disabled={selectedBills.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedBills.length})
                </Button>
              )}
            </div>
          </div>
          );
        })()}

      <Card>
        <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle>All Bills</CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="show-paid" className="text-sm">Show Paid Bills</Label>
                  <Switch
                    id="show-paid"
                    checked={showPaidBills}
                    onCheckedChange={setShowPaidBills}
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                
                {uniqueJobs.length > 0 && (
                  <Select value={jobFilter} onValueChange={setJobFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by job" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Jobs</SelectItem>
                      {uniqueJobs.map(job => (
                        <SelectItem key={job} value={job}>{job}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {uniqueVendors.length > 0 && (
                  <Select value={vendorFilter} onValueChange={setVendorFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vendors</SelectItem>
                      {uniqueVendors.map(vendor => (
                        <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="Start Date"
                    className="w-40"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="End Date"
                    className="w-40"
                  />
                </div>

                {(jobFilter !== "all" || vendorFilter !== "all" || startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setJobFilter("all");
                      setVendorFilter("all");
                      setStartDate("");
                      setEndDate("");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentView === 'list' ? (
            // List View (Table)
            <Table className="border-separate border-spacing-0">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedBills.length === filteredBills.length && filteredBills.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No bills found</p>
                        <p className="text-sm">Upload your first bill to get started</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBills.map((bill) => {
                    const billIsOverdue = isOverdue(bill);
                    const daysOverdue = billIsOverdue ? calculateDaysOverdue(bill.due_date) : 0;
                    
                    return (
                    <TableRow 
                      key={bill.id} 
                      className="cursor-pointer hover:bg-primary/5 transition-colors border border-transparent hover:border-primary rounded-lg"
                      style={billIsOverdue ? { animation: 'pulse-red 2s ease-in-out infinite' } : undefined}
                     >
                       <TableCell onClick={(e) => e.stopPropagation()}>
                         <Checkbox
                           checked={selectedBills.includes(bill.id)}
                           onCheckedChange={() => handleSelectBill(bill.id)}
                         />
                       </TableCell>
                      <TableCell onClick={() => navigate(bill.status === 'draft' ? `/bills/${bill.id}/edit` : `/bills/${bill.id}`)} className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
                          <div className="flex items-center gap-3">
                            <VendorAvatar 
                              name={bill.vendor_name}
                              logoUrl={bill.vendor_logo_url}
                              size="sm"
                            />
                        <span className="font-medium group-hover:text-primary transition-colors">{bill.vendor_name}</span>
                        </div>
                       </TableCell>
                       <TableCell onClick={() => navigate(bill.status === 'draft' ? `/bills/${bill.id}/edit` : `/bills/${bill.id}`)} className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
                         <Badge className={`${getJobColor(bill.job_name)} text-white text-xs`}>
                           {bill.job_name}
                         </Badge>
                       </TableCell>
                         <TableCell onClick={() => navigate(bill.status === 'draft' ? `/bills/${bill.id}/edit` : `/bills/${bill.id}`)} className="font-semibold border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">${bill.amount.toLocaleString()}</TableCell>
                          <TableCell onClick={() => navigate(bill.status === 'draft' ? `/bills/${bill.id}/edit` : `/bills/${bill.id}`)} className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">{new Date(bill.issue_date).toLocaleDateString()}</TableCell>
                          <TableCell onClick={() => navigate(bill.status === 'draft' ? `/bills/${bill.id}/edit` : `/bills/${bill.id}`)} className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">{new Date(bill.due_date).toLocaleDateString()}</TableCell>
                          <TableCell onClick={() => navigate(bill.status === 'draft' ? `/bills/${bill.id}/edit` : `/bills/${bill.id}`)} className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
                           <div className="flex items-center gap-2">
                             <Badge variant={getStatusVariant(bill.status)}>
                               {getStatusDisplayName(bill.status)}
                            </Badge>
                            {billIsOverdue && (
                              <Badge variant="destructive" className="animate-pulse">
                                {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                    </TableRow>
                  );
                  })
                )}
              </TableBody>
            </Table>
          ) : currentView === 'compact' ? (
            // Compact View
            <div className="space-y-2">
              {filteredBills.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No bills found</p>
                  <p className="text-sm">Upload your first bill to get started</p>
                </div>
              ) : (
                filteredBills.map((bill) => {
                  const billIsOverdue = isOverdue(bill);
                  const daysOverdue = billIsOverdue ? calculateDaysOverdue(bill.due_date) : 0;
                  
                  return (
                  <div 
                    key={bill.id} 
                     className={`flex items-center justify-between p-4 border rounded-lg hover:bg-primary/5 hover:border-primary hover:shadow-md cursor-pointer transition-all duration-200 group ${
                       billIsOverdue ? 'bg-destructive/10' : ''
                     }`}
                     style={billIsOverdue ? { animation: 'pulse-red 2s infinite' } : undefined}
                     onClick={() => navigate(bill.status === 'draft' ? `/bills/${bill.id}/edit` : `/bills/${bill.id}`)}
                  >
                    <div className="flex items-center gap-4 flex-1" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedBills.includes(bill.id)}
                        onCheckedChange={() => handleSelectBill(bill.id)}
                      />
                      <Receipt className="h-8 w-8 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{bill.invoice_number || 'No Invoice #'}</p>
                        <p className="text-sm text-muted-foreground">
                          {bill.vendor_name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <p className="font-semibold text-foreground">${bill.amount.toLocaleString()}</p>
                      <Badge className={`${getJobColor(bill.job_name)} text-white text-xs`}>
                        {bill.job_name}
                      </Badge>
                      {billIsOverdue && (
                        <Badge variant="destructive" className="animate-pulse">
                          {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                        </Badge>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          ) : (
            // Super Compact View
            <div className="space-y-1">
              {filteredBills.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No bills found</p>
                  <p className="text-sm">Upload your first bill to get started</p>
                </div>
              ) : (
                filteredBills.map((bill) => {
                  const billIsOverdue = isOverdue(bill);
                  const daysOverdue = billIsOverdue ? calculateDaysOverdue(bill.due_date) : 0;
                  
                  return (
                  <div 
                     key={bill.id} 
                     className="flex items-center justify-between p-3 border rounded hover:bg-primary/5 hover:border-primary hover:shadow-md cursor-pointer transition-all duration-200 group"
                     style={billIsOverdue ? { animation: 'pulse-red 2s ease-in-out infinite' } : undefined}
                     onClick={() => navigate(bill.status === 'draft' ? `/bills/${bill.id}/edit` : `/bills/${bill.id}`)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedBills.includes(bill.id)}
                        onCheckedChange={() => handleSelectBill(bill.id)}
                      />
                      <Badge className={`${getJobColor(bill.job_name)} text-white flex-shrink-0 text-xs`}>
                        {bill.job_name}
                      </Badge>
                      <span className="font-medium text-foreground truncate">{bill.invoice_number || 'No Invoice #'}</span>
                      <span className="text-sm text-muted-foreground truncate">{bill.vendor_name}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold text-foreground whitespace-nowrap">
                        ${bill.amount.toLocaleString()}
                      </span>
                      {billIsOverdue && (
                        <Badge variant="destructive" className="animate-pulse text-xs">
                          {daysOverdue}d overdue
                        </Badge>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}