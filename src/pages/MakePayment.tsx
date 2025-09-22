import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

interface Vendor {
  id: string;
  name: string;
  payment_terms: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: string;
  vendor: Vendor;
  description: string;
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
  const { toast } = useToast();
  
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [codedReceipts, setCodedReceipts] = useState<CodedReceipt[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [payment, setPayment] = useState<Payment>({
    payment_number: '',
    vendor_id: '',
    payment_method: 'check',
    payment_date: new Date().toISOString().split('T')[0],
    amount: 0,
    memo: '',
    status: 'draft',
    check_number: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    generatePaymentNumber();
  }, []);

  useEffect(() => {
    if (selectedVendor) {
      loadVendorInvoices();
      loadCodedReceipts();
    }
  }, [selectedVendor]);

  useEffect(() => {
    calculatePaymentAmount();
  }, [selectedInvoices, invoices]);

  const loadData = async () => {
    try {
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('id, name, payment_terms')
        .eq('is_active', true)
        .order('name');

      if (vendorsError) throw vendorsError;
      setVendors(vendorsData || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
      toast({
        title: "Error",
        description: "Failed to load vendors",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadVendorInvoices = async () => {
    try {
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          vendors (
            id,
            name,
            payment_terms
          )
        `)
        .eq('vendor_id', selectedVendor)
        .eq('status', 'pending')
        .order('due_date');

      if (invoicesError) throw invoicesError;
      setInvoices((invoicesData || []).map(invoice => ({
        ...invoice,
        vendor: invoice.vendors
      })));
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  const loadCodedReceipts = async () => {
    // This would load coded receipts from the receipt context
    // For now, using mock data structure
    setCodedReceipts([]);
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

  const calculatePaymentAmount = () => {
    const totalAmount = selectedInvoices.reduce((sum, invoiceId) => {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      return sum + (invoice?.amount || 0);
    }, 0);

    setPayment(prev => ({ ...prev, amount: totalAmount }));
  };

  const handleInvoiceSelection = (invoiceId: string, checked: boolean) => {
    if (checked) {
      setSelectedInvoices([...selectedInvoices, invoiceId]);
    } else {
      setSelectedInvoices(selectedInvoices.filter(id => id !== invoiceId));
    }
  };

  const handleVendorChange = (vendorId: string) => {
    setSelectedVendor(vendorId);
    setPayment(prev => ({ ...prev, vendor_id: vendorId }));
    setSelectedInvoices([]);
  };

  const savePayment = async () => {
    if (!selectedVendor || selectedInvoices.length === 0) {
      toast({
        title: "Invalid Payment",
        description: "Please select a vendor and at least one invoice",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const user = await supabase.auth.getUser();
      
      // Create payment
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert({
          ...payment,
          created_by: user.data.user?.id
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Create payment invoice lines
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

      // Update invoice statuses to 'paid'
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'paid' })
        .in('id', selectedInvoices);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Payment created successfully",
      });

      navigate('/banking');
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
          <Button variant="ghost" onClick={() => navigate('/banking')}>
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
                <Label htmlFor="vendor">Vendor</Label>
                <Select value={selectedVendor} onValueChange={handleVendorChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
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
                  <Label htmlFor="check_number">Check Number</Label>
                  <Input
                    id="check_number"
                    value={payment.check_number || ''}
                    onChange={(e) => setPayment(prev => ({ ...prev, check_number: e.target.value }))}
                    placeholder="Enter check number"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="amount">Total Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={payment.amount}
                  disabled
                />
              </div>

              <div>
                <Label htmlFor="memo">Memo</Label>
                <Textarea
                  id="memo"
                  value={payment.memo}
                  onChange={(e) => setPayment(prev => ({ ...prev, memo: e.target.value }))}
                  placeholder="Payment memo..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices and Receipts */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="invoices" className="space-y-4">
            <TabsList>
              <TabsTrigger value="invoices">Pending Invoices</TabsTrigger>
              <TabsTrigger value="receipts">Coded Receipts</TabsTrigger>
            </TabsList>

            <TabsContent value="invoices">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Select Invoices to Pay
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedVendor ? (
                    <div className="text-center text-muted-foreground py-8">
                      Select a vendor to view pending invoices
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No pending invoices for this vendor
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map(invoice => (
                          <TableRow key={invoice.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedInvoices.includes(invoice.id)}
                                onCheckedChange={(checked) => 
                                  handleInvoiceSelection(invoice.id, checked as boolean)
                                }
                              />
                            </TableCell>
                            <TableCell>{invoice.invoice_number || 'N/A'}</TableCell>
                            <TableCell>{invoice.description}</TableCell>
                            <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                            <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={invoice.status === 'overdue' ? 'destructive' : 'warning'}>
                                {invoice.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="receipts">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Coded Receipts (Payment Suggestions)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center text-muted-foreground py-8">
                    Coded receipts integration coming soon - receipts will suggest payment amounts based on coding
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Summary */}
      {selectedInvoices.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total Payment Amount:</span>
              <span>${payment.amount.toFixed(2)}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              Paying {selectedInvoices.length} invoice(s)
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}