import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Plus, 
  Save, 
  DollarSign, 
  FileText, 
  Building,
  CreditCard,
  Printer,
  Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";

interface Vendor {
  id: string;
  name: string;
  payment_terms: string;
}

interface Job {
  id: string;
  name: string;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: string;
  vendor_id: string;
  vendor: Vendor;
  description: string;
  job_id: string;
  jobs?: Job;
}

interface Payment {
  id?: string;
  payment_number: string;
  vendor_id: string;
  payment_method: string;
  payment_date: string;
  amount: number;
  memo: string;
  status: string;
  check_number?: string;
  bank_account_id?: string;
  is_partial_payment?: boolean;
  payment_document_url?: string;
  bank_fee?: number;
}

interface CodedReceipt {
  id: string;
  file_url: string;
  amount: number;
  vendor_name: string;
  description: string;
  suggested_payment_amount: number;
}

export default function MakePayment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [codedReceipts, setCodedReceipts] = useState<CodedReceipt[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [paymentDocument, setPaymentDocument] = useState<File | null>(null);
  const [payment, setPayment] = useState<Payment>({
    payment_number: '',
    vendor_id: '',
    payment_method: 'check',
    payment_date: new Date().toISOString().split('T')[0],
    amount: 0,
    memo: '',
    status: 'draft',
    check_number: '',
    bank_account_id: '',
    is_partial_payment: false,
    payment_document_url: '',
    bank_fee: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPartialPayment, setIsPartialPayment] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      loadData();
      generatePaymentNumber();
    }
  }, [currentCompany]);

  // Handle pre-selected bill from navigation state
  useEffect(() => {
    if (location.state?.billId && allInvoices.length > 0) {
      const bill = allInvoices.find(inv => inv.id === location.state.billId);
      if (bill) {
        setSelectedVendor(bill.vendor_id);
        setSelectedInvoices([bill.id]);
        setIsPartialPayment(false);
        setPayment(prev => ({ ...prev, vendor_id: bill.vendor_id, amount: bill.amount }));
      }
    }
  }, [location.state, allInvoices]);

  useEffect(() => {
    if (selectedVendor || selectedJob) {
      filterInvoices();
    }
  }, [selectedVendor, selectedJob, allInvoices]);

  const loadData = async () => {
    try {
      if (!currentCompany) {
        toast({
          title: "Error",
          description: "No company selected",
          variant: "destructive",
        });
        return;
      }

      // Load all approved unpaid invoices for current company
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          vendors!inner (
            id,
            name,
            payment_terms,
            company_id
          ),
          jobs (
            id,
            name
          )
        `)
        .eq('status', 'approved')
        .eq('vendors.company_id', currentCompany.id)
        .order('due_date');

      if (invoicesError) throw invoicesError;
      const formattedInvoices = (invoicesData || []).map(invoice => ({
        ...invoice,
        vendor: invoice.vendors
      }));
      setAllInvoices(formattedInvoices);
      setInvoices(formattedInvoices);

      // Extract unique vendors from invoices
      const uniqueVendors = Array.from(
        new Map(formattedInvoices.map(inv => [inv.vendor.id, inv.vendor])).values()
      );
      setVendors(uniqueVendors);

      // Extract unique jobs from invoices
      const uniqueJobs = Array.from(
        new Map(
          formattedInvoices
            .filter(inv => inv.jobs)
            .map(inv => [inv.jobs!.id, inv.jobs!])
        ).values()
      );
      setJobs(uniqueJobs);

      // Load bank accounts
      const { data: bankAccountsData, error: bankAccountsError } = await supabase
        .from('bank_accounts')
        .select('id, account_name, bank_name')
        .eq('is_active', true)
        .order('account_name');

      if (bankAccountsError) throw bankAccountsError;
      setBankAccounts(bankAccountsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterInvoices = () => {
    let filtered = [...allInvoices];

    if (selectedVendor && selectedVendor !== "all") {
      filtered = filtered.filter(inv => inv.vendor_id === selectedVendor);
    }

    if (selectedJob && selectedJob !== "all") {
      filtered = filtered.filter(inv => inv.job_id === selectedJob);
    }

    setInvoices(filtered);
  };

  const generatePaymentNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('payment_number')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = parseInt(data[0].payment_number.replace('PAY-', ''));
        nextNumber = lastNumber + 1;
      }

      setPayment(prev => ({
        ...prev,
        payment_number: `PAY-${nextNumber.toString().padStart(6, '0')}`
      }));
    } catch (error) {
      console.error('Error generating payment number:', error);
    }
  };

  const handleVendorChange = (vendorId: string) => {
    setSelectedVendor(vendorId);
    if (vendorId) {
      setPayment(prev => ({ ...prev, vendor_id: vendorId }));
    }
    setSelectedInvoices([]);
    setIsPartialPayment(false);
    setPayment(prev => ({ ...prev, amount: 0 }));
  };
  
  const handleInvoiceSelection = (invoiceId: string, checked: boolean) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    
    let newSelectedInvoices: string[];
    
    if (checked) {
      // Check if we already have invoices from a different vendor
      if (selectedInvoices.length > 0) {
        const firstSelectedInvoice = invoices.find(inv => inv.id === selectedInvoices[0]);
        if (firstSelectedInvoice && firstSelectedInvoice.vendor_id !== invoice.vendor_id) {
          toast({
            title: "Different Vendor",
            description: "You can only pay bills from the same vendor in one payment",
            variant: "destructive",
          });
          return;
        }
      }
      newSelectedInvoices = [...selectedInvoices, invoiceId];
    } else {
      newSelectedInvoices = selectedInvoices.filter(id => id !== invoiceId);
    }
    
    setSelectedInvoices(newSelectedInvoices);
    
    // Calculate total amount from selected invoices
    if (newSelectedInvoices.length > 0) {
      const totalAmount = newSelectedInvoices.reduce((sum, id) => {
        const inv = invoices.find(i => i.id === id);
        return sum + (inv?.amount || 0);
      }, 0);
      
      setPayment(prev => ({ 
        ...prev, 
        vendor_id: invoice.vendor_id,
        amount: isPartialPayment ? prev.amount : totalAmount
      }));
      setSelectedVendor(invoice.vendor_id);
    } else {
      setPayment(prev => ({ ...prev, vendor_id: '', amount: 0 }));
      setIsPartialPayment(false);
    }
  };

  const handleJobChange = (jobId: string) => {
    setSelectedJob(jobId);
    setSelectedInvoices([]);
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPaymentDocument(file);
  };

  const uploadPaymentDocument = async (paymentId: string): Promise<string | null> => {
    if (!paymentDocument || !currentCompany) return null;

    try {
      setUploadingDocument(true);
      const fileExt = paymentDocument.name.split('.').pop();
      const fileName = `payment-${paymentId}-${Date.now()}.${fileExt}`;
      const filePath = `${currentCompany.id}/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('receipts')
        .upload(filePath, paymentDocument);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Warning",
        description: "Payment saved but document upload failed",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingDocument(false);
    }
  };

  const savePayment = async () => {
    if (!payment.vendor_id || selectedInvoices.length === 0) {
      toast({
        title: "Invalid Payment",
        description: "Please select at least one invoice to pay",
        variant: "destructive",
      });
      return;
    }

    // Validate bank account for certain payment methods
    const requiresBankAccount = ['check', 'ach', 'wire'].includes(payment.payment_method);
    if (requiresBankAccount && !payment.bank_account_id) {
      toast({
        title: "Invalid Payment",
        description: "Please select a pay from account",
        variant: "destructive",
      });
      return;
    }

    // Validate check number if payment method is check
    if (payment.payment_method === 'check' && !payment.check_number) {
      toast({
        title: "Invalid Payment",
        description: "Please enter a check number",
        variant: "destructive",
      });
      return;
    }

    // Validate payment amount
    if (payment.amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Payment amount must be greater than $0",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const user = await supabase.auth.getUser();
      
      // Create payment - all payments start as 'paid' until reconciled
      const paymentToInsert = {
        payment_number: payment.payment_number,
        vendor_id: payment.vendor_id,
        payment_method: payment.payment_method,
        payment_date: payment.payment_date,
        amount: payment.amount,
        memo: payment.memo,
        status: 'paid',
        check_number: payment.check_number,
        bank_account_id: payment.bank_account_id,
        is_partial_payment: isPartialPayment,
        bank_fee: payment.bank_fee || 0,
        company_id: currentCompany.id,
        created_by: user.data.user?.id
      };

      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert(paymentToInsert)
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Upload document if provided
      let documentUrl = null;
      if (paymentDocument) {
        documentUrl = await uploadPaymentDocument(paymentData.id);
        if (documentUrl) {
          await supabase
            .from('payments')
            .update({ payment_document_url: documentUrl })
            .eq('id', paymentData.id);
        }
      }

      // Create payment invoice lines for all selected invoices
      const paymentLines = selectedInvoices.map(invoiceId => {
        const invoice = invoices.find(inv => inv.id === invoiceId);
        return {
          payment_id: paymentData.id,
          invoice_id: invoiceId,
          amount_paid: invoice?.amount || 0
        };
      });

      const { error: linesError } = await supabase
        .from('payment_invoice_lines')
        .insert(paymentLines);

      if (linesError) throw linesError;

      // Update invoice statuses to paid (only if full payment)
      if (!isPartialPayment) {
        await supabase
          .from('invoices')
          .update({ status: 'paid' })
          .in('id', selectedInvoices);
      }

      toast({
        title: "Success",
        description: "Payment created successfully",
      });

      navigate('/invoices/payments');
    } catch (error) {
      console.error('Error saving payment:', error);
      toast({
        title: "Error",
        description: "Failed to create payment",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const printCheck = () => {
    // Navigate to print checks with this payment
    navigate('/banking/print-checks', { 
      state: { paymentId: payment.id } 
    });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/invoices/payments')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Make Payment</h1>
            <p className="text-muted-foreground">Create payments and manage vendor bills</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printCheck} disabled={!payment.id}>
            <Printer className="h-4 w-4 mr-2" />
            Print Check
          </Button>
          <Button onClick={savePayment} disabled={saving || selectedInvoices.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Create Payment'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Details */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="payment_number">Payment Number</Label>
                <Input
                  id="payment_number"
                  value={payment.payment_number}
                  disabled
                />
              </div>

              <div>
                <Label htmlFor="vendor">Vendor (Optional Filter)</Label>
                <Select value={selectedVendor || "all"} onValueChange={handleVendorChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All vendors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All vendors</SelectItem>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="job">Job (Optional Filter)</Label>
                <Select value={selectedJob || "all"} onValueChange={handleJobChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All jobs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All jobs</SelectItem>
                    {jobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select 
                  value={payment.payment_method} 
                  onValueChange={(value) => setPayment(prev => ({ ...prev, payment_method: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                    
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {['check', 'ach', 'wire'].includes(payment.payment_method) && (
                <div>
                  <Label htmlFor="bank_account_id">Pay From Account *</Label>
                  <Select 
                    value={payment.bank_account_id} 
                    onValueChange={(value) => setPayment(prev => ({ ...prev, bank_account_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_name} - {account.bank_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="payment_date">Payment Date</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={payment.payment_date}
                  onChange={(e) => setPayment(prev => ({ ...prev, payment_date: e.target.value }))}
                />
              </div>

              {payment.payment_method === 'check' && (
                <div>
                  <Label htmlFor="check_number">Check Number *</Label>
                  <Input
                    id="check_number"
                    value={payment.check_number || ''}
                    onChange={(e) => setPayment(prev => ({ ...prev, check_number: e.target.value }))}
                    placeholder="Enter check number"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="partial_payment"
                  checked={isPartialPayment}
                  onCheckedChange={(checked) => {
                    setIsPartialPayment(!!checked);
                    if (!checked && selectedInvoices.length > 0) {
                      const totalAmount = selectedInvoices.reduce((sum, id) => {
                        const invoice = invoices.find(inv => inv.id === id);
                        return sum + (invoice?.amount || 0);
                      }, 0);
                      setPayment(prev => ({ ...prev, amount: totalAmount }));
                    }
                  }}
                  disabled={selectedInvoices.length === 0}
                />
                <Label htmlFor="partial_payment" className="cursor-pointer">
                  Partial Payment
                </Label>
              </div>

              <div>
                <Label htmlFor="amount">Payment Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={payment.amount}
                  onChange={(e) => setPayment(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  disabled={selectedInvoices.length === 0 || !isPartialPayment}
                  className={selectedInvoices.length === 0 || !isPartialPayment ? 'bg-muted' : ''}
                />
              </div>

              {['ach', 'wire'].includes(payment.payment_method) && (
                <div>
                  <Label htmlFor="bank_fee">Bank Fee (Optional)</Label>
                  <Input
                    id="bank_fee"
                    type="number"
                    step="0.01"
                    value={payment.bank_fee || 0}
                    onChange={(e) => setPayment(prev => ({ ...prev, bank_fee: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter any transaction fee charged by the bank
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="memo">Memo</Label>
                <Textarea
                  id="memo"
                  value={payment.memo}
                  onChange={(e) => setPayment(prev => ({ ...prev, memo: e.target.value }))}
                  placeholder="Payment memo..."
                />
              </div>

              <div>
                <Label htmlFor="payment_document">Attach Document (Optional)</Label>
                <div className="space-y-2">
                  <Input
                    id="payment_document"
                    type="file"
                    onChange={handleDocumentUpload}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                  {paymentDocument && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {paymentDocument.name}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Select Bills to Pay
              </CardTitle>
              {selectedInvoices.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedInvoices.length} bill{selectedInvoices.length > 1 ? 's' : ''} selected. Select multiple bills from the same vendor to pay together.
                </p>
              )}
            </CardHeader>

            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <div className="mb-2">No approved unpaid invoices found</div>
                  <div className="text-sm">Select vendor or job filters to narrow results</div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map(invoice => {
                      const isSelected = selectedInvoices.includes(invoice.id);
                      const isFromDifferentVendor = selectedInvoices.length > 0 && 
                        selectedInvoices[0] !== invoice.id &&
                        invoices.find(inv => inv.id === selectedInvoices[0])?.vendor_id !== invoice.vendor_id;
                      
                      return (
                        <TableRow 
                          key={invoice.id}
                          className={isSelected ? "bg-muted/50" : isFromDifferentVendor ? "opacity-50" : "cursor-pointer hover:bg-muted/30"}
                          onClick={() => {
                            if (isFromDifferentVendor) return;
                            handleInvoiceSelection(invoice.id, !isSelected);
                          }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              disabled={isFromDifferentVendor}
                              onCheckedChange={(checked) => {
                                handleInvoiceSelection(invoice.id, !!checked);
                              }}
                            />
                          </TableCell>
                          <TableCell>{invoice.invoice_number || 'N/A'}</TableCell>
                          <TableCell>{invoice.vendor?.name || 'N/A'}</TableCell>
                          <TableCell>{invoice.jobs?.name || 'N/A'}</TableCell>
                          <TableCell className="max-w-xs truncate">{invoice.description}</TableCell>
                          <TableCell>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</TableCell>
                          <TableCell className="font-medium">${invoice.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Summary */}
      {selectedInvoices.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Payment Amount:</span>
                <span>${payment.amount.toFixed(2)}</span>
              </div>
              {payment.bank_fee && payment.bank_fee > 0 && (
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Bank Fee:</span>
                  <span>${payment.bank_fee.toFixed(2)}</span>
                </div>
              )}
              {payment.bank_fee && payment.bank_fee > 0 && (
                <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                  <span>Total Amount:</span>
                  <span>${(payment.amount + payment.bank_fee).toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {isPartialPayment ? 'Partial payment' : 'Full payment'} for {selectedInvoices.length} invoice(s)
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}