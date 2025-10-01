import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, Building, CreditCard, FileText, DollarSign, Calendar, Filter, Trash2, CheckCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import PayablesViewSelector from "@/components/PayablesViewSelector";
import VendorAvatar from "@/components/VendorAvatar";
import { usePayablesViewPreference } from "@/hooks/usePayablesViewPreference";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

const getStatusVariant = (status: string) => {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
    case "pending_approval":
      return "warning";
    case "pending_payment":
      return "secondary";
    case "overdue":
      return "destructive";
    default:
      return "default";
  }
};

const getStatusDisplayName = (status: string) => {
  switch (status) {
    case "pending":
      return "pending approval";
    case "pending_approval":
      return "pending approval";
    case "pending_payment":
      return "pending payment";
    case "paid":
      return "paid";
    case "overdue":
      return "overdue";
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
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [jobFilter, setJobFilter] = useState("all");
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

      setBills(formattedBills);
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

  const filteredBills = jobFilter === "all" 
    ? bills 
    : bills.filter(bill => bill.job_name === jobFilter);

  const uniqueJobs = [...new Set(bills.map(bill => bill.job_name))];

  const pendingApprovalBills = bills.filter(bill => bill.status === 'pending' || bill.status === 'pending_approval');
  const pendingPaymentBills = bills.filter(bill => bill.status === 'pending_payment');
  const overdueBills = bills.filter(bill => {
    const dueDate = new Date(bill.due_date);
    const today = new Date();
    return (bill.status === 'pending' || bill.status === 'pending_approval') && dueDate < today;
  });
  const paidThisMonthBills = bills.filter(bill => {
    const issueDate = new Date(bill.issue_date);
    const thisMonth = new Date();
    thisMonth.setDate(1);
    return bill.status === 'paid' && issueDate >= thisMonth;
  });

  const totalPendingApproval = pendingApprovalBills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalPendingPayment = pendingPaymentBills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalOverdue = overdueBills.reduce((sum, bill) => sum + bill.amount, 0);
  const totalPaidThisMonth = paidThisMonthBills.reduce((sum, bill) => sum + bill.amount, 0);

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
        <div className="flex items-center justify-between">
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
            <Button onClick={() => navigate("/bills/add")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedBills.length > 0 && (
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
              <Button 
                variant="outline" 
                onClick={handleBulkApprove}
                disabled={selectedBills.length === 0}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Selected ({selectedBills.length})
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleBulkDelete}
                disabled={selectedBills.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected ({selectedBills.length})
              </Button>
            </div>
          </div>
        )}

      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Bills</CardTitle>
              {uniqueJobs.length > 0 && (
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
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
                </div>
              )}
          </div>
        </CardHeader>
        <CardContent>
          {currentView === 'list' ? (
            // List View (Table)
            <Table>
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
                  filteredBills.map((bill) => (
                    <TableRow 
                      key={bill.id} 
                      className={`cursor-pointer hover:bg-muted/50 hover:shadow-sm hover:scale-[1.005] transition-all duration-200 ${
                        bill.status === 'overdue' ? 'animate-pulse-red' : ''
                      }`}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedBills.includes(bill.id)}
                          onCheckedChange={() => handleSelectBill(bill.id)}
                        />
                      </TableCell>
                     <TableCell onClick={() => navigate(`/invoices/${bill.id}`)}>
                         <div className="flex items-center gap-3">
                           <VendorAvatar 
                             name={bill.vendor_name}
                             logoUrl={bill.vendor_logo_url}
                             size="sm"
                           />
                       <span className="font-medium">{bill.vendor_name}</span>
                       </div>
                     </TableCell>
                     <TableCell onClick={() => navigate(`/invoices/${bill.id}`)}>
                       <Badge className={`${getJobColor(bill.job_name)} text-white text-xs`}>
                         {bill.job_name}
                       </Badge>
                     </TableCell>
                       <TableCell onClick={() => navigate(`/invoices/${bill.id}`)} className="font-semibold">${bill.amount.toLocaleString()}</TableCell>
                       <TableCell onClick={() => navigate(`/invoices/${bill.id}`)}>{new Date(bill.issue_date).toLocaleDateString()}</TableCell>
                       <TableCell onClick={() => navigate(`/invoices/${bill.id}`)}>{new Date(bill.due_date).toLocaleDateString()}</TableCell>
                       <TableCell onClick={() => navigate(`/invoices/${bill.id}`)}>
                         <Badge variant={getStatusVariant(bill.status)}>
                           {getStatusDisplayName(bill.status)}
                         </Badge>
                       </TableCell>
                    </TableRow>
                  ))
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
                filteredBills.map((bill) => (
                  <div 
                    key={bill.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 hover:shadow-md hover:scale-[1.01] cursor-pointer transition-all duration-200"
                    onClick={() => navigate(`/invoices/${bill.id}`)}
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
                    </div>
                  </div>
                ))
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
                filteredBills.map((bill) => (
                  <div 
                    key={bill.id} 
                    className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 hover:shadow-md hover:scale-[1.01] cursor-pointer transition-all duration-200"
                    onClick={() => navigate(`/invoices/${bill.id}`)}
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
                    <span className="font-semibold text-foreground whitespace-nowrap ml-4">
                      ${bill.amount.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}