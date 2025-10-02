import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, ArrowLeft, FileText, AlertCircle, Plus, X, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useVendorCompliance } from "@/hooks/useComplianceWarnings";
import ReceiptLinkButton from "@/components/ReceiptLinkButton";
import PdfInlinePreview from "@/components/PdfInlinePreview";
import CommitmentInfo from "@/components/CommitmentInfo";
import type { CodedReceipt } from "@/contexts/ReceiptContext";

interface DistributionLineItem {
  id: string;
  job_id?: string;
  expense_account_id?: string;
  cost_code_id?: string;
  amount: string;
}

export default function AddBill() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  
  const [formData, setFormData] = useState({
    vendor_id: "",
    job_id: "", // Used for commitment bills
    expense_account_id: "", // Used for commitment bills
    cost_code_id: "", // Used for commitment bills
    subcontract_id: "",
    purchase_order_id: "",
    amount: "",
    invoice_number: "",
    dueDate: "",
    issueDate: "",
    payment_terms: "",
    description: "",
    is_subcontract_invoice: false,
    is_commitment: false,
    commitment_type: "",
    is_reimbursement: false,
    use_terms: true // toggle between due date and terms
  });
  
  const [billType, setBillType] = useState<"non_commitment" | "commitment">("non_commitment");
  const [distributionItems, setDistributionItems] = useState<DistributionLineItem[]>([
    { id: crypto.randomUUID(), job_id: "", expense_account_id: "", cost_code_id: "", amount: "" }
  ]);
  const [lineItemCostCodes, setLineItemCostCodes] = useState<Record<string, any[]>>({});
  
  const [billFile, setBillFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
  const [costCodes, setCostCodes] = useState<any[]>([]);
  const [subcontracts, setSubcontracts] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [commitmentDistribution, setCommitmentDistribution] = useState<any[]>([]);
   const [previouslyBilled, setPreviouslyBilled] = useState<number>(0);
   const [commitmentTotals, setCommitmentTotals] = useState<any>(null);
   const [payNumber, setPayNumber] = useState<number>(0);
   const [loading, setLoading] = useState(true);
   const [payablesSettings, setPayablesSettings] = useState<any>(null);
   const [attachedReceipt, setAttachedReceipt] = useState<CodedReceipt | null>(null);
 
   const { missingCount: vendorComplianceMissing } = useVendorCompliance(formData.vendor_id);

  useEffect(() => {
    fetchInitialData();
    fetchPayablesSettings();
  }, []);

  useEffect(() => {
    if (formData.job_id && billType === "commitment") {
      fetchCostCodesForJob(formData.job_id);
    }
  }, [formData.job_id, billType]);

  useEffect(() => {
    if (formData.commitment_type && billType === "commitment") {
      // Fetch all commitments when commitment type is selected
      if (formData.commitment_type === "subcontract") {
        fetchAllSubcontracts();
      } else if (formData.commitment_type === "purchase_order") {
        fetchAllPurchaseOrders();
      }
    }
  }, [formData.commitment_type, billType]);

  useEffect(() => {
    if (formData.vendor_id) {
      const vendor = vendors.find(v => v.id === formData.vendor_id);
      setSelectedVendor(vendor);
      if (vendor?.payment_terms && formData.use_terms) {
        setFormData(prev => ({ ...prev, payment_terms: vendor.payment_terms }));
      }
    }
  }, [formData.vendor_id, vendors, formData.use_terms]);

  const fetchInitialData = async () => {
    if (!user || !(currentCompany?.id || profile?.current_company_id)) return;
    
    try {
      const companyId = currentCompany?.id || profile?.current_company_id;
      const [vendorsRes, jobsRes, expenseAccountsRes] = await Promise.all([
        supabase.from('vendors').select('id, name, logo_url').eq('company_id', companyId),
        supabase.from('jobs').select('*').eq('company_id', companyId),
        supabase.from('chart_of_accounts')
          .select('id, account_number, account_name, account_type')
          .eq('company_id', companyId)
          .eq('account_type', 'expense')
          .eq('is_active', true)
          .order('account_number')
      ]);

      if (vendorsRes.data) setVendors(vendorsRes.data);
      if (jobsRes.data) setJobs(jobsRes.data);
      if (expenseAccountsRes.data) setExpenseAccounts(expenseAccountsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load vendors and jobs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPayablesSettings = async () => {
    if (!currentCompany?.id) return;
    
    try {
      const { data } = await supabase
        .from('payables_settings')
        .select('require_bill_documents')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      
      setPayablesSettings(data);
    } catch (error) {
      console.error('Error fetching payables settings:', error);
    }
  };

  const fetchCostCodesForJob = async (jobId: string) => {
    try {
      const { data } = await supabase
        .from('cost_codes')
        .select('*')
        .eq('job_id', jobId)
        .eq('is_active', true)
        .neq('type', 'sub'); // Exclude subcontractor cost codes
      
      setCostCodes(data || []);
    } catch (error) {
      console.error('Error fetching cost codes:', error);
    }
  };

  const fetchCostCodesForLineItem = async (jobId: string, lineItemId: string) => {
    try {
      const { data } = await supabase
        .from('cost_codes')
        .select('*')
        .eq('job_id', jobId)
        .eq('is_active', true)
        .neq('type', 'sub');
      
      setLineItemCostCodes(prev => ({
        ...prev,
        [lineItemId]: data || []
      }));
    } catch (error) {
      console.error('Error fetching cost codes:', error);
    }
  };

  const addDistributionItem = () => {
    setDistributionItems([
      ...distributionItems,
      { id: crypto.randomUUID(), job_id: "", expense_account_id: "", cost_code_id: "", amount: "" }
    ]);
  };

  const removeDistributionItem = (id: string) => {
    if (distributionItems.length > 1) {
      setDistributionItems(distributionItems.filter(item => item.id !== id));
      setLineItemCostCodes(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    }
  };

  const updateDistributionItem = (id: string, field: keyof DistributionLineItem, value: string) => {
    setDistributionItems(items =>
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );

    // If job changed, fetch cost codes for this line item
    if (field === 'job_id' && value) {
      fetchCostCodesForLineItem(value, id);
    }

    // Clear cost code if switching to expense account
    if (field === 'expense_account_id' && value) {
      setDistributionItems(items =>
        items.map(item =>
          item.id === id ? { ...item, cost_code_id: "", job_id: "" } : item
        )
      );
    }

    // Clear expense account if switching to job
    if (field === 'job_id' && value) {
      setDistributionItems(items =>
        items.map(item =>
          item.id === id ? { ...item, expense_account_id: "" } : item
        )
      );
    }
  };

  const getDistributionTotal = () => {
    return distributionItems.reduce((sum, item) => {
      return sum + (parseFloat(item.amount) || 0);
    }, 0);
  };

  const isDistributionValid = () => {
    const billAmount = parseFloat(formData.amount) || 0;
    const distributionTotal = getDistributionTotal();
    
    // Check if all line items have job/control and amount
    const allItemsValid = distributionItems.every(item => {
      const hasJobOrAccount = item.job_id || item.expense_account_id;
      const hasAmount = item.amount && parseFloat(item.amount) > 0;
      return hasJobOrAccount && hasAmount;
    });
    
    return allItemsValid && Math.abs(billAmount - distributionTotal) < 0.01;
  };

  const fetchAllSubcontracts = async () => {
    if (!currentCompany?.id && !profile?.current_company_id) return;
    
    try {
      const { data } = await supabase
        .from('subcontracts')
        .select('*, vendors(name), jobs!inner(company_id), cost_distribution, total_distributed_amount')
        .eq('jobs.company_id', currentCompany?.id || profile?.current_company_id)
        .eq('status', 'active');
      
      setSubcontracts(data || []);
    } catch (error) {
      console.error('Error fetching subcontracts:', error);
    }
  };

  const fetchAllPurchaseOrders = async () => {
    if (!currentCompany?.id && !profile?.current_company_id) return;
    
    try {
      const { data } = await supabase
        .from('purchase_orders')
        .select('*, vendors(name), jobs!inner(company_id), cost_distribution, total_distributed_amount')
        .eq('jobs.company_id', currentCompany?.id || profile?.current_company_id)
        .eq('status', 'approved');
      
      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  };

  const fetchSubcontractsForJob = async (jobId: string) => {
    try {
      const { data } = await supabase
        .from('subcontracts')
        .select('*, vendors(name)')
        .eq('job_id', jobId)
        .eq('status', 'active');
      
      setSubcontracts(data || []);
    } catch (error) {
      console.error('Error fetching subcontracts:', error);
    }
  };

  const fetchPurchaseOrdersForJob = async (jobId: string) => {
    try {
      const { data } = await supabase
        .from('purchase_orders')
        .select('*, vendors(name)')
        .eq('job_id', jobId)
        .eq('status', 'approved');
      
      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  };

  // Handle subcontract selection to auto-populate vendor and job
  const handleSubcontractChange = async (subcontractId: string) => {
    handleInputChange("subcontract_id", subcontractId);
    const selectedSubcontract = subcontracts.find(s => s.id === subcontractId);
    if (selectedSubcontract) {
      handleInputChange("vendor_id", selectedSubcontract.vendor_id);
      handleInputChange("job_id", selectedSubcontract.job_id);
      
      // Ensure cost_distribution is always an array
      const costDist = selectedSubcontract.cost_distribution;
      const distribution = Array.isArray(costDist) ? costDist : [];
      setCommitmentDistribution(distribution);
      
      await fetchPreviouslyBilledAmount('subcontract', subcontractId);
      await fetchCommitmentTotals('subcontract', subcontractId, selectedSubcontract);
      await fetchPayNumber('subcontract', subcontractId);
    }
  };

  // Handle purchase order selection to auto-populate vendor and job
  const handlePurchaseOrderChange = async (poId: string) => {
    handleInputChange("purchase_order_id", poId);
    const selectedPO = purchaseOrders.find(po => po.id === poId);
    if (selectedPO) {
      handleInputChange("vendor_id", selectedPO.vendor_id);
      handleInputChange("job_id", selectedPO.job_id);
      
      // Ensure cost_distribution is always an array
      const costDist = selectedPO.cost_distribution;
      const distribution = Array.isArray(costDist) ? costDist : [];
      setCommitmentDistribution(distribution);
      
      await fetchPreviouslyBilledAmount('purchase_order', poId);
      await fetchCommitmentTotals('purchase_order', poId, selectedPO);
    }
  };

  // Filter subcontracts based on selected vendor and job
  const getFilteredSubcontracts = () => {
    return subcontracts.filter(subcontract => {
      const matchesVendor = !formData.vendor_id || subcontract.vendor_id === formData.vendor_id;
      const matchesJob = !formData.job_id || subcontract.job_id === formData.job_id;
      return matchesVendor && matchesJob;
    });
  };

  // Filter purchase orders based on selected vendor and job
  const getFilteredPurchaseOrders = () => {
    return purchaseOrders.filter(po => {
      const matchesVendor = !formData.vendor_id || po.vendor_id === formData.vendor_id;
      const matchesJob = !formData.job_id || po.job_id === formData.job_id;
      return matchesVendor && matchesJob;
    });
  };

  // Get vendors that have commitments of the selected type
  const getFilteredVendors = () => {
    if (billType !== "commitment" || !formData.commitment_type) {
      return vendors;
    }
    
    const commitments = formData.commitment_type === "subcontract" ? subcontracts : purchaseOrders;
    const vendorIds = new Set(commitments.map(c => c.vendor_id));
    
    return vendors.filter(vendor => vendorIds.has(vendor.id));
  };

  // Get jobs that have commitments of the selected type
  const getFilteredJobs = () => {
    if (billType !== "commitment" || !formData.commitment_type) {
      return jobs;
    }
    
    const commitments = formData.commitment_type === "subcontract" ? subcontracts : purchaseOrders;
    
    // If vendor is selected, filter by vendor too
    const filteredCommitments = formData.vendor_id 
      ? commitments.filter(c => c.vendor_id === formData.vendor_id)
      : commitments;
    
    const jobIds = new Set(filteredCommitments.map(c => c.job_id));
    
    return jobs.filter(job => jobIds.has(job.id));
  };

  // Fetch previously billed amount for commitment
  const fetchPreviouslyBilledAmount = async (type: 'subcontract' | 'purchase_order', commitmentId: string) => {
    try {
      const column = type === 'subcontract' ? 'subcontract_id' : 'purchase_order_id';
      const { data } = await supabase
        .from('invoices')
        .select('amount')
        .eq(column, commitmentId)
        .neq('status', 'rejected');
      
      const total = data?.reduce((sum, invoice) => sum + Number(invoice.amount), 0) || 0;
      setPreviouslyBilled(total);
    } catch (error) {
      console.error('Error fetching previously billed amount:', error);
      setPreviouslyBilled(0);
    }
  };

  // Fetch commitment totals for display
  const fetchCommitmentTotals = async (type: 'subcontract' | 'purchase_order', commitmentId: string, commitment: any) => {
    try {
      const column = type === 'subcontract' ? 'subcontract_id' : 'purchase_order_id';
      const { data: previousInvoices } = await supabase
        .from('invoices')
        .select('amount, status')
        .eq(column, commitmentId)
        .neq('status', 'rejected');

      const totalCommit = commitment.contract_amount || commitment.amount || 0;
      const prevGross = previousInvoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
      const prevRetention = 0;
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
    } catch (error) {
      console.error('Error fetching commitment totals:', error);
      setCommitmentTotals(null);
    }
  };

  // Fetch pay number for subcontract invoices
  const fetchPayNumber = async (type: 'subcontract' | 'purchase_order', commitmentId: string) => {
    try {
      const column = type === 'subcontract' ? 'subcontract_id' : 'purchase_order_id';
      const { data, error } = await supabase
        .from('invoices')
        .select('id')
        .eq(column, commitmentId)
        .neq('status', 'rejected');

      if (error) throw error;
      
      // Pay number is count of existing invoices + 1
      const nextPayNumber = (data?.length || 0) + 1;
      setPayNumber(nextPayNumber);
    } catch (error) {
      console.error('Error fetching pay number:', error);
      setPayNumber(1);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (file: File) => {
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or image file (JPG, PNG, WEBP)",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    setBillFile(file);
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
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if documents are required by payables settings
    const requireDocuments = payablesSettings?.require_bill_documents ?? false;
    
    if (requireDocuments && !billFile && !attachedReceipt) {
      toast({
        title: "Document required",
        description: "Company settings require all bills to have a document or attachment",
        variant: "destructive"
      });
      return;
    }
    
    if (!billFile && !attachedReceipt) {
      toast({
        title: "Attachment required",
        description: "Upload a bill file or attach a coded receipt before submitting",
        variant: "destructive"
      });
      return;
    }

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        toast({
          title: "Authentication required",
          description: "Please log in to create an invoice",
          variant: "destructive"
        });
        return;
      }

      // Calculate due date from terms if using terms
      let dueDate = formData.dueDate;
      if (formData.use_terms && formData.payment_terms && formData.issueDate) {
        const issueDate = new Date(formData.issueDate);
        const terms = parseInt(formData.payment_terms);
        if (!isNaN(terms)) {
          const calculatedDueDate = new Date(issueDate);
          calculatedDueDate.setDate(calculatedDueDate.getDate() + terms);
          dueDate = calculatedDueDate.toISOString().split('T')[0];
        }
      }

      if (billType === "non_commitment") {
        // For non-commitment bills with distribution, create multiple invoice records
        const invoicesToInsert = distributionItems.map(item => ({
          vendor_id: formData.vendor_id,
          job_id: item.job_id || null,
          cost_code_id: item.cost_code_id || null,
          amount: parseFloat(item.amount),
          invoice_number: formData.invoice_number || null,
          issue_date: formData.issueDate,
          due_date: dueDate,
          payment_terms: formData.use_terms ? formData.payment_terms : null,
          description: formData.description,
          is_subcontract_invoice: false,
          is_reimbursement: formData.is_reimbursement,
          file_url: attachedReceipt?.previewUrl || (attachedReceipt as any)?.file_url || null,
          created_by: user.data.user.id
        }));

        const { data: inserted, error } = await supabase
          .from('invoices')
          .insert(invoicesToInsert)
          .select('id');
 
        if (error) throw error;

        if (attachedReceipt && inserted && inserted.length) {
          const auditRows = inserted.map((row: any) => ({
            invoice_id: row.id,
            change_type: 'update',
            field_name: 'attachment',
            old_value: null,
            new_value: attachedReceipt.id,
            reason: 'Attached coded receipt',
            changed_by: user.data.user!.id
          }));
          await supabase.from('invoice_audit_trail').insert(auditRows);
        }
      } else {
        // For commitment bills, use the original single record approach
        const { error } = await supabase
          .from('invoices')
          .insert({
            vendor_id: formData.vendor_id,
            job_id: formData.job_id,
            cost_code_id: formData.cost_code_id || null,
            subcontract_id: formData.is_commitment && formData.commitment_type === 'subcontract' ? formData.subcontract_id : null,
            purchase_order_id: formData.is_commitment && formData.commitment_type === 'purchase_order' ? formData.purchase_order_id : null,
            amount: parseFloat(formData.amount),
            invoice_number: formData.invoice_number || null,
            issue_date: formData.issueDate,
            due_date: dueDate,
            payment_terms: formData.use_terms ? formData.payment_terms : null,
            description: formData.description,
            is_subcontract_invoice: formData.is_commitment && formData.commitment_type === 'subcontract',
            is_reimbursement: formData.is_reimbursement,
            created_by: user.data.user.id
          });

        if (error) throw error;
      }

      toast({
        title: "Bill created",
        description: billType === "non_commitment" 
          ? `Bill created with ${distributionItems.length} distribution line item(s)`
          : "Bill has been successfully created",
      });
      
      navigate("/invoices");
    } catch (error) {
      console.error('Error creating bill:', error);
      toast({
        title: "Error",
        description: "Failed to create bill",
        variant: "destructive"
      });
    }
  };

  const isFormValid = billType === "commitment" 
    ? formData.vendor_id && (formData.job_id || formData.expense_account_id) && formData.amount && 
      formData.issueDate && billFile && (formData.use_terms ? formData.payment_terms : formData.dueDate)
    : formData.vendor_id && formData.amount && formData.issueDate && (billFile || attachedReceipt) && 
      (formData.use_terms ? formData.payment_terms : formData.dueDate) && isDistributionValid();

  if (loading) {
    return <div className="p-6 max-w-4xl mx-auto text-center">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Bill</h1>
          <p className="text-muted-foreground">Upload and create a new bill record</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Invoice Information */}
        <Card>
          <CardHeader>
            <CardTitle>
              {billType === "commitment" ? "Commitment Bill Information" : "Bill Information"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={billType} onValueChange={(value) => {
              setBillType(value as "non_commitment" | "commitment");
              const isCommitment = value === "commitment";
              handleInputChange("is_commitment", isCommitment);
              if (!isCommitment) {
                handleInputChange("commitment_type", "");
                handleInputChange("subcontract_id", "");
                handleInputChange("purchase_order_id", "");
              }
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="non_commitment" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Non Commitment</TabsTrigger>
                <TabsTrigger value="commitment" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Commitment</TabsTrigger>
              </TabsList>
              
              <TabsContent value="non_commitment" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendor">Vendor *</Label>
                    <Select value={formData.vendor_id} onValueChange={(value) => handleInputChange("vendor_id", value)}>
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
                    <Label htmlFor="amount">Amount *</Label>
                    <CurrencyInput
                      id="amount"
                      value={formData.amount}
                      onChange={(value) => handleInputChange("amount", value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {/* Vendor Compliance Warning */}
                {payablesSettings?.show_vendor_compliance_warnings !== false && formData.vendor_id && vendorComplianceMissing > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      This vendor has {vendorComplianceMissing} missing required compliance document{vendorComplianceMissing !== 1 ? 's' : ''}. 
                      Please review vendor compliance before proceeding.
                    </AlertDescription>
                  </Alert>
                )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoice_number">Invoice #</Label>
                    <Input
                      id="invoice_number"
                      value={formData.invoice_number}
                      onChange={(e) => handleInputChange("invoice_number", e.target.value)}
                      placeholder="Enter invoice number (optional)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issueDate">Issue Date *</Label>
                    <Input
                      id="issueDate"
                      type="date"
                      value={formData.issueDate}
                      onChange={(e) => handleInputChange("issueDate", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      id="use_terms"
                      checked={formData.use_terms}
                      onCheckedChange={(checked) => handleInputChange("use_terms", checked)}
                    />
                    <Label htmlFor="use_terms">Use payment terms instead of due date</Label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.use_terms ? (
                      <div className="space-y-2">
                        <Label htmlFor="payment_terms">Payment Terms *</Label>
                        <Select value={formData.payment_terms} onValueChange={(value) => handleInputChange("payment_terms", value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment terms" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asap">ASAP</SelectItem>
                            <SelectItem value="15">Net 15</SelectItem>
                            <SelectItem value="30">Net 30</SelectItem>
                            <SelectItem value="45">Net 45</SelectItem>
                            <SelectItem value="60">Net 60</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="dueDate">Due Date *</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={formData.dueDate}
                          onChange={(e) => handleInputChange("dueDate", e.target.value)}
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Cost Distribution Section */}
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Cost Distribution *</Label>
                    <Badge variant={isDistributionValid() ? "default" : "destructive"}>
                      Total: ${getDistributionTotal().toFixed(2)} / ${(parseFloat(formData.amount) || 0).toFixed(2)}
                    </Badge>
                  </div>

                  {distributionItems.map((item, index) => (
                    <div key={item.id} className="border rounded-md p-4 space-y-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Line Item {index + 1}</span>
                        {distributionItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDistributionItem(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label>Job / Control *</Label>
                          <Select 
                            value={item.job_id || item.expense_account_id} 
                            onValueChange={(value) => {
                              const isJob = jobs.find(j => j.id === value);
                              if (isJob) {
                                updateDistributionItem(item.id, 'job_id', value);
                              } else {
                                updateDistributionItem(item.id, 'expense_account_id', value);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select job or expense" />
                            </SelectTrigger>
                            <SelectContent>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Jobs</div>
                              {jobs.map((job) => (
                                <SelectItem key={job.id} value={job.id}>
                                  {job.name}
                                </SelectItem>
                              ))}
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">Expense Accounts</div>
                              {expenseAccounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.account_number} - {account.account_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {item.job_id && (
                          <div className="space-y-2">
                            <Label>Cost Code</Label>
                            <Select 
                              value={item.cost_code_id} 
                              onValueChange={(value) => updateDistributionItem(item.id, 'cost_code_id', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select cost code" />
                              </SelectTrigger>
                              <SelectContent>
                                {(lineItemCostCodes[item.id] || []).map((code) => (
                                  <SelectItem key={code.id} value={code.id}>
                                    {code.code} - {code.description}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Amount *</Label>
                          <CurrencyInput
                            value={item.amount}
                            onChange={(value) => updateDistributionItem(item.id, 'amount', value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDistributionItem}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line Item
                  </Button>

                  {!isDistributionValid() && formData.amount && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>Distribution total must match bill amount</span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_reimbursement"
                      checked={formData.is_reimbursement}
                      onCheckedChange={(checked) => handleInputChange("is_reimbursement", checked)}
                    />
                    <Label htmlFor="is_reimbursement">Reimbursement payment</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Enter invoice description or notes"
                    rows={3}
                  />
                </div>
              </TabsContent>

              <TabsContent value="commitment" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="commitment_type">Commitment Type *</Label>
                  <Select 
                    value={formData.commitment_type} 
                    onValueChange={(value) => {
                      handleInputChange("commitment_type", value);
                      // Reset all related fields when commitment type changes
                      handleInputChange("vendor_id", "");
                      handleInputChange("job_id", "");
                      handleInputChange("subcontract_id", "");
                      handleInputChange("purchase_order_id", "");
                      setCommitmentDistribution([]);
                      setPreviouslyBilled(0);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select commitment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subcontract">Subcontract</SelectItem>
                      <SelectItem value="purchase_order">Purchase Order</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.commitment_type && (
                  <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vendor">Vendor *</Label>
                      <Select value={formData.vendor_id} onValueChange={(value) => {
                        handleInputChange("vendor_id", value);
                        // Reset commitment selections when vendor changes
                        handleInputChange("subcontract_id", "");
                        handleInputChange("purchase_order_id", "");
                        setCommitmentDistribution([]);
                        setPreviouslyBilled(0);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          {getFilteredVendors().map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="job">Job *</Label>
                      <Select value={formData.job_id} onValueChange={(value) => {
                        handleInputChange("job_id", value);
                        // Reset commitment selections when job changes
                        handleInputChange("subcontract_id", "");
                        handleInputChange("purchase_order_id", "");
                        setCommitmentDistribution([]);
                        setPreviouslyBilled(0);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a job" />
                        </SelectTrigger>
                        <SelectContent>
                          {getFilteredJobs().map((job) => (
                            <SelectItem key={job.id} value={job.id}>
                              {job.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Vendor Compliance Warning */}
                  {payablesSettings?.show_vendor_compliance_warnings !== false && formData.vendor_id && vendorComplianceMissing > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        This vendor has {vendorComplianceMissing} missing required compliance document{vendorComplianceMissing !== 1 ? 's' : ''}. 
                        Please review vendor compliance before proceeding.
                      </AlertDescription>
                    </Alert>
                   )}
                   </>
                 )}

                {formData.commitment_type === 'subcontract' && (
                  <div className="space-y-2">
                    <Label htmlFor="subcontract">Subcontract *</Label>
                    <Select value={formData.subcontract_id} onValueChange={handleSubcontractChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a subcontract" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredSubcontracts().map((subcontract) => (
                          <SelectItem key={subcontract.id} value={subcontract.id}>
                            {subcontract.name} - {subcontract.vendors?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.subcontract_id && payNumber > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label>Pay Number</Label>
                      <div className="p-3 bg-muted rounded-lg">
                        <span className="font-medium">Pay #{payNumber}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Commitment</Label>
                      <div className="p-3 bg-muted rounded-lg">
                        <span className="font-medium">Subcontract</span>
                      </div>
                    </div>
                  </>
                )}

                {formData.commitment_type === 'purchase_order' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="purchase_order">Purchase Order *</Label>
                      <Select value={formData.purchase_order_id} onValueChange={handlePurchaseOrderChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a purchase order" />
                        </SelectTrigger>
                        <SelectContent>
                          {getFilteredPurchaseOrders().map((po) => (
                            <SelectItem key={po.id} value={po.id}>
                              {po.po_number} - {po.vendors?.name} (${Number(po.amount).toLocaleString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.purchase_order_id && (
                      <div className="space-y-2">
                        <Label>Commitment</Label>
                        <div className="p-3 bg-muted rounded-lg">
                          <span className="font-medium">Purchase Order</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount *</Label>
                    <CurrencyInput
                      id="amount"
                      value={formData.amount}
                      onChange={(value) => handleInputChange("amount", value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice_number">Invoice #</Label>
                    <Input
                      id="invoice_number"
                      value={formData.invoice_number}
                      onChange={(e) => handleInputChange("invoice_number", e.target.value)}
                      placeholder="Enter invoice number (optional)"
                    />
                  </div>
                </div>

                {/* Cost Distribution Display */}
                {commitmentDistribution.length > 0 && (
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4">
                      <Label className="text-sm font-medium mb-3 block">Cost Code Distribution</Label>
                      <div className="space-y-2">
                        {commitmentDistribution.map((dist: any, index: number) => {
                          const billAmount = parseFloat(formData.amount) || 0;
                          const distributedAmount = billAmount * (dist.percentage / 100);
                          return (
                            <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                              <span className="text-sm">{dist.cost_code} - {dist.description}</span>
                              <div className="text-right">
                                <div className="text-sm font-medium">${distributedAmount.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">{dist.percentage}%</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {previouslyBilled > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex justify-between text-sm">
                            <span>Previously Billed:</span>
                            <span>${previouslyBilled.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm font-medium">
                            <span>Current Bill:</span>
                            <span>${(parseFloat(formData.amount) || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm font-medium border-t pt-1">
                            <span>Total Billed:</span>
                            <span>${((parseFloat(formData.amount) || 0) + previouslyBilled).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issueDate">Issue Date *</Label>
                    <Input
                      id="issueDate"
                      type="date"
                      value={formData.issueDate}
                      onChange={(e) => handleInputChange("issueDate", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <Checkbox
                        id="use_terms"
                        checked={formData.use_terms}
                        onCheckedChange={(checked) => handleInputChange("use_terms", checked)}
                      />
                      <Label htmlFor="use_terms">Use payment terms instead of due date</Label>
                    </div>
                    {formData.use_terms ? (
                      <div>
                        <Label htmlFor="payment_terms">Payment Terms *</Label>
                        <Select value={formData.payment_terms} onValueChange={(value) => handleInputChange("payment_terms", value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment terms" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asap">ASAP</SelectItem>
                            <SelectItem value="15">Net 15</SelectItem>
                            <SelectItem value="30">Net 30</SelectItem>
                            <SelectItem value="45">Net 45</SelectItem>
                            <SelectItem value="60">Net 60</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="dueDate">Due Date *</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={formData.dueDate}
                          onChange={(e) => handleInputChange("dueDate", e.target.value)}
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Reimbursement checkbox removed from commitment tab */}

                {/* Commitment Information Display */}
                {commitmentTotals && (formData.subcontract_id || formData.purchase_order_id) && (
                  <div className="border-t pt-4">
                    <CommitmentInfo
                      totalCommit={commitmentTotals.totalCommit}
                      prevGross={commitmentTotals.prevGross}
                      prevRetention={commitmentTotals.prevRetention}
                      prevPayments={commitmentTotals.prevPayments}
                      contractBalance={commitmentTotals.contractBalance}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Enter invoice description or notes"
                    rows={3}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* File Upload Section - Moved to Bottom */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bill File Upload
              <Badge variant="destructive" className="text-xs">Required</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {billFile ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto bg-success/10 rounded-full">
                    <FileText className="h-8 w-8 text-success" />
                  </div>
                  <div>
                    <p className="font-medium">{billFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(billFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBillFile(null)}
                  >
                    Remove File
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto bg-muted rounded-full">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">Upload Bill File</p>
                    <p className="text-sm text-muted-foreground">
                      Drag and drop your bill file here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Supported formats: PDF, JPG, PNG, WEBP (Max 10MB)
                    </p>
                  </div>
                  <div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileInputChange}
                      className="hidden"
                      id="bill-file-upload"
                    />
                    <Button type="button" asChild>
                      <label htmlFor="bill-file-upload" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        Choose File
                      </label>
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* File Preview */}
            {billFile && (
              <div className="space-y-2">
                <Label className="text-base font-semibold">Preview</Label>
                <div className="border rounded-lg overflow-hidden bg-muted/20">
                  {billFile.type === 'application/pdf' ? (
                    <PdfInlinePreview file={billFile} height={600} />
                  ) : (
                    <img
                      src={URL.createObjectURL(billFile)}
                      alt="Bill preview"
                      className="w-full h-auto max-h-[600px] object-contain"
                    />
                  )}
                </div>
              </div>
            )}
            
            {!billFile && !attachedReceipt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>Bill file or receipt attachment is required before saving</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex gap-3">
          <Button type="submit" disabled={!isFormValid}>
            <FileText className="h-4 w-4 mr-2" />
            Add Bill
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/invoices")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}