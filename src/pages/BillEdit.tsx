import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Vendor {
  id: string;
  name: string;
}

interface Job {
  id: string;
  name: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
}

export default function BillEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [bill, setBill] = useState<any>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    vendor_id: '',
    job_id: '',
    cost_code_id: '',
    invoice_number: '',
    amount: '',
    issue_date: '',
    due_date: '',
    description: '',
    payment_terms: '',
    bill_category: 'one_time'
  });

  useEffect(() => {
    if (id) {
      loadBillAndOptions();
    }
  }, [id]);

  const loadBillAndOptions = async () => {
    try {
      setLoading(true);
      
      // Load bill data
      const { data: billData, error: billError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();

      if (billError) throw billError;

      // Load vendors, jobs, and cost codes
      const [vendorsRes, jobsRes, costCodesRes] = await Promise.all([
        supabase.from('vendors').select('id, name, logo_url').eq('is_active', true),
        supabase.from('jobs').select('id, name'),
        supabase.from('cost_codes').select('id, code, description').eq('is_active', true)
      ]);

      if (vendorsRes.error) throw vendorsRes.error;
      if (jobsRes.error) throw jobsRes.error;
      if (costCodesRes.error) throw costCodesRes.error;

      setBill(billData);
      setVendors(vendorsRes.data || []);
      setJobs(jobsRes.data || []);
      setCostCodes(costCodesRes.data || []);
      
      // Populate form data
      setFormData({
        vendor_id: billData.vendor_id || '',
        job_id: billData.job_id || '',
        cost_code_id: billData.cost_code_id || '',
        invoice_number: billData.invoice_number || '',
        amount: billData.amount?.toString() || '',
        issue_date: billData.issue_date || '',
        due_date: billData.due_date || '',
        description: billData.description || '',
        payment_terms: billData.payment_terms || '',
        bill_category: billData.bill_category || 'one_time'
      });
      
    } catch (error) {
      console.error('Error loading bill:', error);
      toast({
        title: "Error",
        description: "Failed to load bill details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updateData = {
        ...formData,
        amount: parseFloat(formData.amount) || 0,
        vendor_id: formData.vendor_id || null,
        job_id: formData.job_id || null,
        cost_code_id: formData.cost_code_id || null
      };

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Bill updated successfully",
      });
      
      navigate(`/bills/${id}`);
    } catch (error) {
      console.error('Error saving bill:', error);
      toast({
        title: "Error",
        description: "Failed to save bill",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/bills")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bill Not Found</h1>
            <p className="text-muted-foreground">The requested bill could not be found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/bills/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Edit Bill</h1>
            <p className="text-muted-foreground">
              {formData.invoice_number || 'No Invoice Number'}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Form */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Bill Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vendor">Vendor</Label>
              <Select value={formData.vendor_id} onValueChange={(value) => setFormData({...formData, vendor_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map(vendor => (
                    <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                placeholder="Enter invoice number"
              />
            </div>

            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="bill_category">Bill Category</Label>
              <Select value={formData.bill_category} onValueChange={(value) => setFormData({...formData, bill_category: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bill category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reimbursable">Reimbursable</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="mt-2 text-xs"
                onClick={() => {
                  // TODO: Implement add type functionality
                  console.log('Add type clicked');
                }}
              >
                + Add Type
              </Button>
            </div>

            <div>
              <Label htmlFor="issue_date">Issue Date</Label>
              <Input
                id="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({...formData, issue_date: e.target.value})}
              />
            </div>

            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({...formData, due_date: e.target.value})}
              />
            </div>

            <div>
              <Label htmlFor="payment_terms">Payment Terms (days)</Label>
              <Input
                id="payment_terms"
                value={formData.payment_terms}
                onChange={(e) => setFormData({...formData, payment_terms: e.target.value})}
                placeholder="30"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="job">Job</Label>
              <Select value={formData.job_id} onValueChange={(value) => setFormData({...formData, job_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="cost_code">Cost Code</Label>
              <Select value={formData.cost_code_id} onValueChange={(value) => setFormData({...formData, cost_code_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cost code" />
                </SelectTrigger>
                <SelectContent>
                  {costCodes.map(costCode => (
                    <SelectItem key={costCode.id} value={costCode.id}>
                      {costCode.code} - {costCode.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Enter bill description"
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}