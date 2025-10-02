import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";

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
  job_id?: string;
  type?: string;
}

export default function BillEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { profile } = useAuth();
  
  const [bill, setBill] = useState<any>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [allCostCodes, setAllCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subcontractInfo, setSubcontractInfo] = useState<any>(null);
  const [commitmentTotals, setCommitmentTotals] = useState<any>(null);
  
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
    is_subcontract_invoice: false,
    is_reimbursement: false
  });

  useEffect(() => {
    if (id) {
      loadBillAndOptions();
    }
  }, [id]);

  const loadBillAndOptions = async () => {
    try {
      setLoading(true);

      const companyId = currentCompany?.id || profile?.current_company_id;
      if (!companyId) {
        throw new Error('No company context available');
      }

      // Load bill data
      const { data: billData, error: billError } = await supabase
        .from('invoices')
        .select('*, vendors!inner(company_id)')
        .eq('id', id)
        .single();

      if (billError) throw billError;

      // Ensure billData has the correct type with is_reimbursement field
      const typedBillData = billData as typeof billData & { is_reimbursement?: boolean };

      // If this is a subcontract invoice, load subcontract and commitment details
      if (typedBillData.subcontract_id) {
        const { data: subcontractData } = await supabase
          .from('subcontracts')
          .select('*, vendors!inner(name)')
          .eq('id', typedBillData.subcontract_id)
          .single();

        if (subcontractData) {
          setSubcontractInfo(subcontractData);

          // Calculate commitment totals
          const { data: previousInvoices } = await supabase
            .from('invoices')
            .select('amount, status')
            .eq('subcontract_id', typedBillData.subcontract_id)
            .neq('id', id);

          const totalCommit = subcontractData.contract_amount || 0;
          const prevGross = previousInvoices
            ?.filter(inv => inv.status !== 'rejected')
            .reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
          const prevRetention = 0; // TODO: Calculate based on retention rules if needed
          const prevPayments = previousInvoices
            ?.filter(inv => inv.status === 'paid')
            .reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
          const contractBalance = totalCommit - prevGross;

          setCommitmentTotals({
            totalCommit,
            prevGross,
            prevRetention,
            prevPayments,
            contractBalance
          });
        }
      }

      // Load vendors, jobs, and cost codes for current company only
      const [vendorsData, jobsData, allCostCodesData] = await Promise.all([
        supabase
          .from('vendors')
          .select('id, name')
          .eq('company_id', companyId)
          .order('name'),
        supabase
          .from('jobs')
          .select('id, name')
          .eq('company_id', companyId)
          .order('name'),
        supabase
          .from('cost_codes')
          .select('id, code, description, job_id, type')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('code')
      ]);

      if (vendorsData.data) setVendors(vendorsData.data);
      if (jobsData.data) setJobs(jobsData.data);
      if (allCostCodesData.data) {
        setAllCostCodes(allCostCodesData.data);
        // Filter cost codes based on invoice type and job
        const filteredCodes = filterCostCodesByType(
          allCostCodesData.data,
          typedBillData.job_id,
          typedBillData.is_subcontract_invoice,
          typedBillData.purchase_order_id
        );
        setCostCodes(filteredCodes);
      }

      setBill(typedBillData);

      // Populate form data
      setFormData({
        vendor_id: typedBillData.vendor_id || '',
        job_id: typedBillData.job_id || '',
        cost_code_id: typedBillData.cost_code_id || '',
        invoice_number: typedBillData.invoice_number || '',
        amount: typedBillData.amount?.toString() || '',
        issue_date: typedBillData.issue_date || '',
        due_date: typedBillData.due_date || '',
        description: typedBillData.description || '',
        payment_terms: typedBillData.payment_terms || '',
        is_subcontract_invoice: typedBillData.is_subcontract_invoice || false,
        is_reimbursement: typedBillData.is_reimbursement || false
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

  const filterCostCodesByType = (
    codes: CostCode[],
    jobId: string,
    isSubcontract: boolean,
    purchaseOrderId?: string
  ) => {
    let filtered = codes.filter(cc => !cc.job_id || cc.job_id === jobId);
    
    // Filter by type based on invoice type
    if (isSubcontract) {
      filtered = filtered.filter(cc => cc.type === 'sub');
    } else if (purchaseOrderId) {
      filtered = filtered.filter(cc => cc.type === 'material');
    }
    
    return filtered;
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Update cost codes when job or invoice type changes
    if (field === 'job_id' || field === 'is_subcontract_invoice') {
      const filteredCodes = filterCostCodesByType(
        allCostCodes,
        field === 'job_id' ? value as string : formData.job_id,
        field === 'is_subcontract_invoice' ? value as boolean : formData.is_subcontract_invoice,
        bill?.purchase_order_id
      );
      setCostCodes(filteredCodes);
      // Clear cost code selection if it's no longer valid
      if (formData.cost_code_id && !filteredCodes.find(cc => cc.id === formData.cost_code_id)) {
        setFormData(prev => ({ ...prev, cost_code_id: '' }));
      }
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updateData = {
        vendor_id: formData.vendor_id || null,
        job_id: formData.job_id || null,
        cost_code_id: formData.cost_code_id || null,
        invoice_number: formData.invoice_number,
        amount: parseFloat(formData.amount) || 0,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        description: formData.description,
        payment_terms: formData.payment_terms,
        is_subcontract_invoice: formData.is_subcontract_invoice,
        is_reimbursement: formData.is_reimbursement
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
      
      navigate(`/invoices/${id}`);
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
          <Button variant="ghost" onClick={() => navigate("/invoices")}>
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
          <Button variant="ghost" onClick={() => navigate(`/invoices/${id}`)}>
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

      {/* Commitment Information (for subcontract invoices) */}
      {subcontractInfo && commitmentTotals && (
        <Card>
          <CardHeader>
            <CardTitle>Commitment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Total Commit:</div>
                <div className="text-right font-medium">${commitmentTotals.totalCommit.toFixed(2)}</div>
                
                <div className="text-muted-foreground">Prev Gross:</div>
                <div className="text-right font-medium">${commitmentTotals.prevGross.toFixed(2)}</div>
                
                <div className="text-muted-foreground">Prev Ret'd:</div>
                <div className="text-right font-medium">${commitmentTotals.prevRetention.toFixed(2)}</div>
                
                <div className="text-muted-foreground">Prev Pmts:</div>
                <div className="text-right font-medium">${commitmentTotals.prevPayments.toFixed(2)}</div>
                
                <div className="text-muted-foreground font-semibold">Contract Balance:</div>
                <div className="text-right font-bold bg-accent/10 px-2 py-1 rounded">${commitmentTotals.contractBalance.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Bill Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Select 
                  value={formData.vendor_id} 
                  onValueChange={(value) => handleInputChange("vendor_id", value)}
                  disabled={!!subcontractInfo}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  value={formData.amount}
                  onChange={(e) => handleInputChange("amount", e.target.value)}
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job">Job</Label>
                <Select 
                  value={formData.job_id} 
                  onValueChange={(value) => handleInputChange("job_id", value)}
                  disabled={!!subcontractInfo}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost_code">Cost Code</Label>
                <Select 
                  value={formData.cost_code_id} 
                  onValueChange={(value) => handleInputChange("cost_code_id", value)}
                  disabled={!!subcontractInfo}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cost code (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCodes.map((code) => (
                      <SelectItem key={code.id} value={code.id}>
                        {code.code} - {code.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice Number</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => handleInputChange("invoice_number", e.target.value)}
                  placeholder="Enter invoice number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_terms">Payment Terms (days)</Label>
                <Input
                  id="payment_terms"
                  value={formData.payment_terms}
                  onChange={(e) => handleInputChange("payment_terms", e.target.value)}
                  placeholder="30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issue_date">Issue Date</Label>
                <Input
                  id="issue_date"
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => handleInputChange("issue_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleInputChange("due_date", e.target.value)}
                />
              </div>
            </div>

            {!subcontractInfo && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_subcontract_invoice"
                    checked={formData.is_subcontract_invoice}
                    onCheckedChange={(checked) => handleInputChange("is_subcontract_invoice", checked)}
                  />
                  <Label htmlFor="is_subcontract_invoice">This is a subcontract invoice</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_reimbursement"
                    checked={formData.is_reimbursement}
                    onCheckedChange={(checked) => handleInputChange("is_reimbursement", checked)}
                  />
                  <Label htmlFor="is_reimbursement">Reimbursement payment</Label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter bill description"
              rows={4}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}