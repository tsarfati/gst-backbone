import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2, Upload, FileText, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import CommitmentInfo from "@/components/CommitmentInfo";
import PdfInlinePreview from "@/components/PdfInlinePreview";
import UrlPdfInlinePreview from "@/components/UrlPdfInlinePreview";
import BillApprovalActions from "@/components/BillApprovalActions";
import BillDistributionSection from "@/components/BillDistributionSection";

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
  is_dynamic_group?: boolean;
  require_attachment?: boolean;
}

export default function BillEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { profile, user } = useAuth();
  
  const [bill, setBill] = useState<any>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [allCostCodes, setAllCostCodes] = useState<CostCode[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subcontractInfo, setSubcontractInfo] = useState<any>(null);
  const [commitmentTotals, setCommitmentTotals] = useState<any>(null);
  const [billFiles, setBillFiles] = useState<File[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<any[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [payNumber, setPayNumber] = useState<number>(0);
  const [jobData, setJobData] = useState<any>(null);
  const [commitmentDistribution, setCommitmentDistribution] = useState<any[]>([]);
  const [billDistribution, setBillDistribution] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    vendor_id: '',
    job_id: '',
    cost_code_id: '',
    invoice_number: '',
    amount: '',
    issue_date: '',
    due_date: '',
    description: '',
    internal_notes: '',
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

      // Load bill data and documents
      const { data: billData, error: billError } = await supabase
        .from('invoices')
        .select('*, vendors!inner(company_id, vendor_type), purchase_orders(id, po_number)')
        .eq('id', id)
        .maybeSingle();

      // Load existing documents
      const { data: documentsData } = await supabase
        .from('invoice_documents')
        .select('*')
        .eq('invoice_id', id)
        .order('uploaded_at', { ascending: false });
      
      if (documentsData) {
        setExistingDocuments(documentsData);
      }

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
          
          // Load cost distribution
          const costDist = subcontractData.cost_distribution;
          const distribution = Array.isArray(costDist) 
            ? costDist 
            : (typeof costDist === 'string' ? JSON.parse(costDist) : []);
          setCommitmentDistribution(distribution);

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

          // Calculate pay number - count all invoices for this subcontract
          const { data: allInvoices } = await supabase
            .from('invoices')
            .select('id, created_at')
            .eq('subcontract_id', typedBillData.subcontract_id)
            .neq('status', 'rejected')
            .order('created_at');

          if (allInvoices) {
            const currentInvoiceIndex = allInvoices.findIndex(inv => inv.id === id);
            setPayNumber(currentInvoiceIndex + 1);
          }
        }
      }

      // Load vendors, jobs, expense accounts, and cost codes for current company only
      const [vendorsData, jobsData, expenseAccountsData, allCostCodesData] = await Promise.all([
        supabase
          .from('vendors')
          .select('id, name, vendor_type')
          .eq('company_id', companyId)
          .order('name'),
        supabase
          .from('jobs')
          .select('id, name')
          .eq('company_id', companyId)
          .order('name'),
        supabase
          .from('chart_of_accounts')
          .select('id, account_number, account_name, account_type, require_attachment')
          .eq('company_id', companyId)
          .in('account_type', ['expense', 'cost_of_goods_sold', 'asset', 'other_expense'])
          .eq('is_active', true)
          .order('account_number'),
        supabase
          .from('cost_codes')
          .select('id, code, description, job_id, type, is_dynamic_group, require_attachment')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .eq('is_dynamic_group', false)
          .order('code')
      ]);

      if (vendorsData.data) setVendors(vendorsData.data);
      if (jobsData.data) setJobs(jobsData.data);
      if (expenseAccountsData.data) setExpenseAccounts(expenseAccountsData.data);
      
      // Load job data for PM approval settings
      if (typedBillData.job_id) {
        const { data: jobInfo } = await supabase
          .from('jobs')
          .select('project_manager_user_id, require_pm_bill_approval')
          .eq('id', typedBillData.job_id)
          .single();
        setJobData(jobInfo);
      }
      
      if (allCostCodesData.data) {
        setAllCostCodes(allCostCodesData.data);
      }

      setBill(typedBillData);
      
      // Load existing bill distribution if it exists
      const { data: existingDist } = await supabase
        .from('invoice_cost_distributions')
        .select('*')
        .eq('invoice_id', id);
      if (existingDist && existingDist.length > 0) {
        setBillDistribution(existingDist);
      }

      // Get commitment distribution to check for auto-population
      let loadedDistribution: any[] = [];
      if (typedBillData.subcontract_id) {
        const { data: subcontractData } = await supabase
          .from('subcontracts')
          .select('cost_distribution')
          .eq('id', typedBillData.subcontract_id)
          .single();
          
        if (subcontractData) {
          const costDist = subcontractData.cost_distribution;
          loadedDistribution = Array.isArray(costDist) 
            ? costDist 
            : (typeof costDist === 'string' ? JSON.parse(costDist) : []);
        }
      }
      
      // Auto-populate job and cost code if commitment has single distribution
      if (loadedDistribution.length === 1) {
        const singleDist = loadedDistribution[0];
        const needsPopulation = !typedBillData.job_id || !typedBillData.cost_code_id;
        
        if (needsPopulation && singleDist.cost_code_id) {
          // Find the job for this cost code
          const costCode = allCostCodesData.data?.find(cc => cc.id === singleDist.cost_code_id);
          const jobForCode = costCode?.job_id || singleDist.job_id;
          
          // Update values in memory so they persist to form state
          typedBillData.job_id = typedBillData.job_id || jobForCode || '';
          typedBillData.cost_code_id = typedBillData.cost_code_id || singleDist.cost_code_id || '';
        }
      }
      
      // Populate form data AFTER possible auto-population
      setFormData({
        vendor_id: typedBillData.vendor_id || '',
        job_id: typedBillData.job_id || '',
        cost_code_id: typedBillData.cost_code_id || '',
        invoice_number: typedBillData.invoice_number || '',
        amount: typedBillData.amount?.toString() || '',
        issue_date: typedBillData.issue_date || '',
        due_date: typedBillData.due_date || '',
        description: typedBillData.description || '',
        internal_notes: (typedBillData as any).internal_notes || '',
        payment_terms: typedBillData.payment_terms || '',
        is_subcontract_invoice: typedBillData.is_subcontract_invoice || false,
        is_reimbursement: typedBillData.is_reimbursement || false
      });
      
      // Filter cost codes AFTER formData and vendors are set
      if (allCostCodesData.data && vendorsData.data) {
        const filteredCodes = filterCostCodesByType(
          allCostCodesData.data,
          typedBillData.job_id,
          typedBillData.is_subcontract_invoice,
          typedBillData.purchase_order_id,
          typedBillData.vendor_id,
          vendorsData.data
        );
        setCostCodes(filteredCodes);
      }
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
    purchaseOrderId?: string,
    vendorId?: string,
    vendorsList?: any[]
  ) => {
    // Filter by job first
    let filtered = codes.filter(cc => !cc.job_id || cc.job_id === jobId);
    
    // Remove duplicates - prefer job-specific codes over company-level codes
    const codeMap = new Map<string, CostCode>();
    filtered.forEach(cc => {
      const existing = codeMap.get(cc.code);
      // If no existing or current has job_id and existing doesn't, use current
      if (!existing || (cc.job_id && !existing.job_id)) {
        codeMap.set(cc.code, cc);
      }
    });
    filtered = Array.from(codeMap.values());
    
    // Get vendor type - use vendorsList if provided, otherwise use state
    const vendorList = vendorsList || vendors;
    const vendor = vendorList.find(v => v.id === (vendorId || formData.vendor_id));
    const vendorType = (vendor as any)?.vendor_type;
    
    // Filter by vendor type
    if (vendorType === 'Contractor' || vendorType === 'Design Professional') {
      // For subcontractors/design professionals, only show sub, other, or labor cost codes
      filtered = filtered.filter(cc => cc.type === 'sub' || cc.type === 'other' || cc.type === 'labor');
    } else {
      // Filter by type based on invoice type for other vendors
      if (isSubcontract) {
        filtered = filtered.filter(cc => cc.type === 'sub');
      } else if (purchaseOrderId) {
        filtered = filtered.filter(cc => cc.type === 'material');
      } else {
        // For non-commitment bills from non-subcontractor vendors, exclude sub type
        filtered = filtered.filter(cc => cc.type !== 'sub');
      }
    }
    
    return filtered;
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Update cost codes when job, invoice type, or vendor changes
    if (field === 'job_id' || field === 'is_subcontract_invoice' || field === 'vendor_id') {
      const jobId = field === 'job_id' ? value as string : formData.job_id;
      const filteredCodes = filterCostCodesByType(
        allCostCodes,
        jobId,
        field === 'is_subcontract_invoice' ? value as boolean : formData.is_subcontract_invoice,
        bill?.purchase_order_id,
        field === 'vendor_id' ? value as string : formData.vendor_id
      );
      setCostCodes(filteredCodes);
      // Clear cost code selection if it's no longer valid
      if (formData.cost_code_id && !filteredCodes.find(cc => cc.id === formData.cost_code_id)) {
        setFormData(prev => ({ ...prev, cost_code_id: '' }));
      }
      
      // When job changes, also clear the cost_code_id to force reselection
      if (field === 'job_id') {
        setFormData(prev => ({ ...prev, cost_code_id: '' }));
      }
    }
  };

  const handleFileUpload = (files: File[]) => {
    const validFiles = files.filter(file => {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} must be PDF or image file`,
          variant: "destructive"
        });
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 10MB limit`,
          variant: "destructive"
        });
        return false;
      }
      return true;
    });
    setBillFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setBillFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingDocument = async (docId: string) => {
    try {
      const { error } = await supabase
        .from('invoice_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      setExistingDocuments(prev => prev.filter(doc => doc.id !== docId));
      toast({
        title: "Document removed",
        description: "Document has been removed successfully"
      });
    } catch (error) {
      console.error('Error removing document:', error);
      toast({
        title: "Error",
        description: "Failed to remove document",
        variant: "destructive"
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFileUpload(files);
  };

  // Check if attachments can be bypassed based on selected account/code
  const canBypassAttachment = () => {
    const codeAllowsById = (id?: string) => {
      if (!id) return false;
      // If this id is an expense account, honor its flag directly
      const account = expenseAccounts.find(a => a.id === id);
      if (account?.require_attachment === false) return true;
      // Otherwise treat as cost code and check company master override
      const cc = allCostCodes.find(c => c.id === id);
      if (!cc) return false;
      if (cc.require_attachment === false) return true;
      const master = allCostCodes.find(c => c.code === cc.code && ((c.type ?? null) === (cc.type ?? null)) && !c.job_id);
      return master?.require_attachment === false;
    };

    // Selected item (Job/Control field)
    if (formData.cost_code_id) {
      if (codeAllowsById(formData.cost_code_id)) return true;
    }
    
    // Check bill distribution cost codes if commitment has multiple distributions
    if (commitmentDistribution.length > 1 && billDistribution.length > 0) {
      return billDistribution.some(dist => codeAllowsById(dist.cost_code_id));
    }
    
    return false;
  };

  const attachmentRequired = !canBypassAttachment();

  const handleSave = async () => {
    try {
      // Validate attachments if required
      if (attachmentRequired && existingDocuments.length === 0 && billFiles.length === 0) {
        toast({
          title: "Validation Error",
          description: "At least one document is required for this bill",
          variant: "destructive",
        });
        return;
      }

      // Validate required fields for bills with distributions
      if (commitmentDistribution.length > 1) {
        // Multi-distribution bill - validate distribution
        if (billDistribution.length === 0) {
          toast({
            title: "Validation Error",
            description: "Please distribute the bill amount across the cost codes",
            variant: "destructive",
          });
          return;
        }
        
        const totalDistributed = billDistribution.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const billAmountNum = parseFloat(formData.amount) || 0;
        const diff = Math.abs(totalDistributed - billAmountNum);
        
        if (diff > 0.01) {
          toast({
            title: "Validation Error",
            description: `Distribution total ($${totalDistributed.toFixed(2)}) must equal bill amount ($${billAmountNum.toFixed(2)})`,
            variant: "destructive",
          });
          return;
        }
      } else if (formData.job_id && !formData.cost_code_id) {
        toast({
          title: "Validation Error",
          description: "Cost code is required when a job is selected",
          variant: "destructive",
        });
        return;
      }

      setSaving(true);

      // Determine new status - if bill is pending_coding and now has job + cost code, move to pending_approval
      let newStatus = bill?.status;
      let clearPendingCoding = false;
      if (bill?.status === 'pending_coding' && formData.job_id && formData.cost_code_id) {
        newStatus = 'pending_approval';
        clearPendingCoding = true;
      }

      // Upload new files if provided
      if (billFiles.length > 0) {
        const user = await supabase.auth.getUser();
        if (!user.data.user) throw new Error('Not authenticated');

        for (const file of billFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${id}_${Date.now()}.${fileExt}`;
          const filePath = `bills/${fileName}`;

          const { error: uploadError, data: uploadData } = await supabase.storage
            .from('receipts')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('receipts')
            .getPublicUrl(filePath);

          // Save document record
          await supabase.from('invoice_documents').insert({
            invoice_id: id,
            file_url: publicUrl,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.data.user.id
          });
        }
      }

      const updateData: any = {
        vendor_id: formData.vendor_id || null,
        job_id: formData.job_id || null,
        cost_code_id: formData.cost_code_id || null,
        invoice_number: formData.invoice_number,
        amount: parseFloat(formData.amount) || 0,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        description: formData.description,
        internal_notes: formData.internal_notes || null,
        payment_terms: formData.payment_terms,
        is_subcontract_invoice: formData.is_subcontract_invoice,
        is_reimbursement: formData.is_reimbursement
      };

      // Update status if it changed
      if (newStatus && newStatus !== bill?.status) {
        updateData.status = newStatus;
      }

      // Clear pending_coding flag when bill is fully coded
      if (clearPendingCoding) {
        updateData.pending_coding = false;
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      // Save distribution if this is a multi-distribution commitment bill
      if (commitmentDistribution.length > 1 && billDistribution.length > 0) {
        // Delete existing distributions
        await supabase
          .from('invoice_cost_distributions')
          .delete()
          .eq('invoice_id', id);
        
        // Insert new distributions
        const distributionRecords = billDistribution.map(dist => ({
          invoice_id: id,
          cost_code_id: dist.cost_code_id,
          amount: parseFloat(dist.amount),
          percentage: dist.percentage
        }));
        
        const { error: distError } = await supabase
          .from('invoice_cost_distributions')
          .insert(distributionRecords);
        
        if (distError) throw distError;
      }

      const successMessage = newStatus === 'pending_approval' && bill?.status === 'pending_coding'
        ? "Bill updated and sent to approval"
        : "Bill updated successfully";

      toast({
        title: "Success",
        description: successMessage,
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

      {/* Form */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {subcontractInfo || bill?.purchase_order_id ? "Commitment Bill Information" : "Bill Information"}
            </CardTitle>
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

            {/* Only show job/cost code selectors if single distribution or no commitment */}
            {commitmentDistribution.length <= 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="job_control">
                    Job / Control
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <Select 
                    value={formData.job_id || formData.cost_code_id} 
                    onValueChange={(value) => {
                      const isJob = jobs.find(j => j.id === value);
                      if (isJob) {
                        handleInputChange("job_id", value);
                        setFormData(prev => ({ ...prev, cost_code_id: '' }));
                      } else {
                        // It's an expense account - clear job and set as cost_code_id
                        setFormData(prev => ({ ...prev, job_id: '', cost_code_id: value }));
                      }
                    }}
                    disabled={!!subcontractInfo || commitmentDistribution.length === 1}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select job or expense" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Jobs</div>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name}
                        </SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">Expense Accounts</div>
                      {(() => {
                        const filtered = expenseAccounts.filter((account) => {
                          const match = String(account.account_number ?? '').match(/^\d+/);
                          const num = match ? Number(match[0]) : NaN;
                          const inRange = !Number.isNaN(num) && num >= 50000 && num <= 59000;
                          return !inRange; // Exclude 50000-59000 from Job/Control menu
                        });
                        return filtered.length === 0 ? (
                          <div className="px-2 py-2 text-sm text-muted-foreground">No expense accounts available</div>
                        ) : (
                          filtered.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.account_number} - {account.account_name}
                            </SelectItem>
                          ))
                        );
                      })()}
                    </SelectContent>
                  </Select>
                </div>

                {formData.job_id && (
                  <div className="space-y-2">
                    <Label htmlFor="cost_code">Cost Code</Label>
                    <Select 
                      value={formData.cost_code_id} 
                      onValueChange={(value) => handleInputChange("cost_code_id", value)}
                      disabled={!!subcontractInfo || commitmentDistribution.length === 1}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select cost code" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {costCodes.length > 0 ? (
                          costCodes.map((code) => (
                            <SelectItem key={code.id} value={code.id}>
                              <div className="flex items-center gap-2">
                                <span>{code.code} - {code.description}</span>
                                {code.type && (
                                  <Badge variant="outline">
                                    {code.type === 'labor' ? 'Labor' : 
                                     code.type === 'material' ? 'Material' : 
                                     code.type === 'equipment' ? 'Equipment' : 
                                     code.type === 'sub' ? 'Subcontractor' : 
                                     code.type === 'other' ? 'Other' : code.type}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-2 text-sm text-muted-foreground">No cost codes available for this job</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

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

            {/* Pay Number and Commitment Type for commitment bills */}
            {(subcontractInfo || bill?.purchase_order_id) && payNumber > 0 && (
              <div className="space-y-2">
                <Label>Pay Number</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <span className="font-medium">Pay #{payNumber}</span>
                </div>
              </div>
            )}

            {subcontractInfo && (
              <div className="space-y-2">
                <Label>Commitment</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <span className="font-medium">Subcontract: {subcontractInfo.name}</span>
                </div>
              </div>
            )}

            {bill?.purchase_order_id && !subcontractInfo && (
              <div className="space-y-2">
                <Label>Commitment</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <span className="font-medium">Purchase Order</span>
                </div>
              </div>
            )}

            {/* Commitment Information */}
            {subcontractInfo && commitmentTotals && (
              <div className="pt-4 border-t">
                <CommitmentInfo
                  totalCommit={commitmentTotals.totalCommit}
                  prevGross={commitmentTotals.prevGross}
                  prevRetention={commitmentTotals.prevRetention}
                  prevPayments={commitmentTotals.prevPayments}
                  contractBalance={commitmentTotals.contractBalance}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bill Distribution Section - Show if commitment has multiple cost distributions */}
        {commitmentDistribution.length > 1 && (
          <BillDistributionSection
            subcontractDistribution={commitmentDistribution}
            billAmount={formData.amount}
            onChange={setBillDistribution}
          />
        )}

        {/* Bill Approval Section */}
        {bill?.status && ['pending_approval', 'pending_coding'].includes(bill.status) && (
          <Card>
            <CardHeader>
              <CardTitle>Bill Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <BillApprovalActions
                billId={bill.id}
                currentStatus={bill.status}
                jobRequiresPmApproval={jobData?.require_pm_bill_approval}
                currentUserRole={profile?.role}
                currentUserId={user?.id}
                jobPmUserId={jobData?.project_manager_user_id}
                onStatusUpdate={loadBillAndOptions}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Description & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Enter bill description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal_notes">Internal Notes</Label>
              <Textarea
                id="internal_notes"
                value={formData.internal_notes}
                onChange={(e) => handleInputChange("internal_notes", e.target.value)}
                placeholder="Enter internal notes for approval and job costing (not visible to vendor)"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Document Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Bill Documents
              {attachmentRequired && existingDocuments.length === 0 && billFiles.length === 0 && (
                <Badge variant="destructive" className="text-xs">Required</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show info message when attachments are not required */}
            {!attachmentRequired && (existingDocuments.length > 0 || billFiles.length > 0 || true) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <FileText className="h-4 w-4" />
                <span>Attachments are optional for the selected cost code/account</span>
              </div>
            )}
            
            {/* Existing documents */}
            {existingDocuments.length > 0 && (
              <div className="space-y-3">
                <Label>Uploaded Documents</Label>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {existingDocuments.map((doc) => (
                    <div key={doc.id} className="border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between p-3 bg-muted">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm font-medium">{doc.file_name}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExistingDocument(doc.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {doc.file_url.endsWith('.pdf') ? (
                        <UrlPdfInlinePreview url={doc.file_url} className="w-full" />
                      ) : (
                        <img 
                          src={doc.file_url} 
                          alt={doc.file_name}
                          className="w-full h-auto"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New files preview */}
            {billFiles.length > 0 && (
              <div className="space-y-3">
                <Label>New Documents to Upload</Label>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {billFiles.map((file, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between p-3 bg-muted">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm font-medium">{file.name}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {file.type === 'application/pdf' ? (
                        <PdfInlinePreview file={file} />
                      ) : file.type.startsWith('image/') ? (
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="Preview"
                          className="w-full h-auto"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload area */}
            <div>
              {attachmentRequired && existingDocuments.length === 0 && billFiles.length === 0 && (
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>At least one document is required</span>
                </div>
              )}
              <Label>
                {existingDocuments.length > 0 || billFiles.length > 0 
                  ? 'Upload Additional Documents' 
                  : attachmentRequired 
                    ? 'Upload Documents *' 
                    : 'Upload Documents (Optional)'}
              </Label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
                onClick={() => document.getElementById('bill-file-input')?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-1">
                  Drag and drop or click to upload
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, JPG, PNG, or WEBP (max 10MB per file)
                </p>
                <input
                  id="bill-file-input"
                  type="file"
                  multiple
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files) handleFileUpload(Array.from(files));
                  }}
                  className="hidden"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}