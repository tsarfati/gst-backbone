import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, Building, CreditCard, FileText, DollarSign, Calendar, Filter, MoreHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import UnifiedViewSelector from "@/components/ui/unified-view-selector";
import { useUnifiedViewPreference } from "@/hooks/useUnifiedViewPreference";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Bill {
  id: string;
  invoice_number: string | null;
  vendor_name: string;
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

export default function Bills() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jobFilter, setJobFilter] = useState("all");
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentView, setCurrentView, setDefaultView, isDefault } = useUnifiedViewPreference('bills-view');

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
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
          vendors(name),
          jobs(name),
          cost_codes(description)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedBills: Bill[] = data?.map(bill => ({
        id: bill.id,
        invoice_number: bill.invoice_number,
        vendor_name: (bill.vendors as any)?.name || 'Unknown Vendor',
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

  const updateBillStatus = async (billId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', billId);

      if (error) throw error;

      // Update local state
      setBills(bills.map(bill => 
        bill.id === billId 
          ? { ...bill, status: newStatus }
          : bill
      ));

      toast({
        title: "Success",
        description: `Bill status updated to ${getStatusDisplayName(newStatus)}`,
      });
    } catch (error) {
      console.error('Error updating bill status:', error);
      toast({
        title: "Error",
        description: "Failed to update bill status",
        variant: "destructive",
      });
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

  if (loading) {
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
            <UnifiedViewSelector
              currentView={currentView}
              onViewChange={setCurrentView}
              onSetDefault={setDefaultView}
              isDefault={isDefault}
            />
            <Button onClick={() => navigate("/bills/add")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          </div>
        </div>


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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
                
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
                    className={`cursor-pointer hover:bg-muted/50 ${
                      bill.status === 'overdue' ? 'animate-pulse-red' : ''
                    }`}
                    onClick={() => navigate(`/bills/${bill.id}`)}
                  >
                     <TableCell>
                       <div className="flex items-center">
                         <Building className="h-4 w-4 mr-2 text-muted-foreground" />
                         {bill.vendor_name}
                       </div>
                     </TableCell>
                     <TableCell>{bill.job_name}</TableCell>
                     <TableCell className="font-semibold">${bill.amount.toLocaleString()}</TableCell>
                     <TableCell>{new Date(bill.issue_date).toLocaleDateString()}</TableCell>
                     <TableCell>{new Date(bill.due_date).toLocaleDateString()}</TableCell>
                     <TableCell>
                       <Badge variant={getStatusVariant(bill.status)}>
                         {getStatusDisplayName(bill.status)}
                       </Badge>
                     </TableCell>
                     <TableCell>
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <Button variant="ghost" className="h-8 w-8 p-0">
                             <MoreHorizontal className="h-4 w-4" />
                           </Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end">
                           <DropdownMenuItem onClick={(e) => {
                             e.stopPropagation();
                             updateBillStatus(bill.id, 'pending_approval');
                           }}>
                             Mark as Pending Approval
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={(e) => {
                             e.stopPropagation();
                             updateBillStatus(bill.id, 'pending_payment');
                           }}>
                             Mark as Pending Payment
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={(e) => {
                             e.stopPropagation();
                             updateBillStatus(bill.id, 'paid');
                           }}>
                             Mark as Paid
                           </DropdownMenuItem>
                         </DropdownMenuContent>
                       </DropdownMenu>
                     </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}