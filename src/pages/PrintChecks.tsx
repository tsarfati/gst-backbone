import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Download, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Payment {
  id: string;
  payment_number: string;
  amount: number;
  payment_date: string;
  check_number: string;
  status: string;
  memo: string;
  vendor: {
    name: string;
    address: string;
  };
}

export default function PrintChecks() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
    
    // If coming from a specific payment, pre-select it
    if (location.state?.paymentId) {
      setSelectedPayments([location.state.paymentId]);
    }
  }, [location.state]);

  const loadPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          vendors (
            name,
            address
          )
        `)
        .eq('payment_method', 'check')
        .in('status', ['draft', 'pending'])
        .order('payment_date');

      if (error) throw error;
      setPayments((data || []).map(payment => ({
        ...payment,
        vendor: payment.vendors
      })));
    } catch (error) {
      console.error('Error loading payments:', error);
      toast({
        title: "Error",
        description: "Failed to load payments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSelection = (paymentId: string, checked: boolean) => {
    if (checked) {
      setSelectedPayments([...selectedPayments, paymentId]);
    } else {
      setSelectedPayments(selectedPayments.filter(id => id !== paymentId));
    }
  };

  const printSelectedChecks = async () => {
    if (selectedPayments.length === 0) {
      toast({
        title: "No Checks Selected",
        description: "Please select payments to print checks for",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update payment status to 'sent'
      const { error } = await supabase
        .from('payments')
        .update({ status: 'sent' })
        .in('id', selectedPayments);

      if (error) throw error;

      // Here you would integrate with actual check printing
      window.print();

      toast({
        title: "Success",
        description: `${selectedPayments.length} check(s) sent to printer`,
      });

      loadPayments();
      setSelectedPayments([]);
    } catch (error) {
      console.error('Error printing checks:', error);
      toast({
        title: "Error",
        description: "Failed to print checks",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Loading payments...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/banking/make-payment")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Print Checks</h1>
            <p className="text-muted-foreground">Select and print checks for vendor payments</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            disabled={selectedPayments.length === 0}
            onClick={() => {
              // Generate PDF preview
              toast({
                title: "PDF Generation",
                description: "PDF generation feature coming soon",
              });
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button 
            onClick={printSelectedChecks}
            disabled={selectedPayments.length === 0}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print {selectedPayments.length} Check{selectedPayments.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5" />
            Payments Ready for Printing
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Check className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Payments Ready</h3>
              <p className="mb-4">No check payments are ready for printing</p>
              <Button onClick={() => navigate('/banking/make-payment')}>
                Create Payment
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Check #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Memo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPayments.includes(payment.id)}
                        onCheckedChange={(checked) => 
                          handlePaymentSelection(payment.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{payment.payment_number}</TableCell>
                    <TableCell>{payment.vendor.name}</TableCell>
                    <TableCell>${payment.amount.toFixed(2)}</TableCell>
                    <TableCell>{payment.check_number || 'Auto-assign'}</TableCell>
                    <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={payment.status === 'draft' ? 'secondary' : 'warning'}>
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{payment.memo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {selectedPayments.length > 0 && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">
                  {selectedPayments.length} payment{selectedPayments.length !== 1 ? 's' : ''} selected
                </p>
                <p className="text-lg font-semibold">
                  Total: ${payments
                    .filter(p => selectedPayments.includes(p.id))
                    .reduce((sum, p) => sum + p.amount, 0)
                    .toFixed(2)}
                </p>
              </div>
              <Button onClick={printSelectedChecks}>
                <Printer className="h-4 w-4 mr-2" />
                Print Selected Checks
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}