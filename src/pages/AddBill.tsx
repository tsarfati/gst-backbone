import { useState, useEffect } from "react";
import { getStoragePathForDb } from '@/utils/storageUtils';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, ArrowLeft, FileText, AlertCircle, Plus, X, AlertTriangle, Receipt, Search, Check, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useVendorCompliance } from "@/hooks/useComplianceWarnings";
import ReceiptLinkButton from "@/components/ReceiptLinkButton";
import PdfInlinePreview from "@/components/PdfInlinePreview";
import UrlPdfInlinePreview from "@/components/UrlPdfInlinePreview";
import CommitmentInfo from "@/components/CommitmentInfo";
import type { CodedReceipt } from "@/contexts/ReceiptContext";
import QuickAddVendor from "@/components/QuickAddVendor";
import BillReceiptSuggestions from "@/components/BillReceiptSuggestions";
import BillDistributionSection from "@/components/BillDistributionSection";
import BudgetStatusDisplay from "@/components/BudgetStatusDisplay";

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
    internal_notes: "", // For approval and job costing notes
    is_subcontract_invoice: false,
    is_commitment: false,
    commitment_type: "",
    is_reimbursement: false,
    use_terms: true, // toggle between due date and terms
    request_pm_help: false, // Request help from PM for coding
    retainage_amount: 0,
    retainage_percentage: 0
  });
  
  const [billType, setBillType] = useState<"non_commitment" | "commitment">("non_commitment");
  const [distributionItems, setDistributionItems] = useState<DistributionLineItem[]>([
    { id: crypto.randomUUID(), job_id: "", expense_account_id: "", cost_code_id: "", amount: "" }
  ]);
  const [lineItemCostCodes, setLineItemCostCodes] = useState<Record<string, any[]>>({});
  const [costCodeOpen, setCostCodeOpen] = useState<Record<string, boolean>>({});
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  
  const [billFiles, setBillFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [noAttachmentNeeded, setNoAttachmentNeeded] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
const [costCodes, setCostCodes] = useState<any[]>([]);
const [companyCostCodes, setCompanyCostCodes] = useState<any[]>([]);
const [subcontracts, setSubcontracts] = useState<any[]>([]);
const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [commitmentDistribution, setCommitmentDistribution] = useState<any[]>([]);
  const [billDistribution, setBillDistribution] = useState<any[]>([]);
  const [needsDistribution, setNeedsDistribution] = useState(false);
   const [previouslyBilled, setPreviouslyBilled] = useState<number>(0);
   const [commitmentTotals, setCommitmentTotals] = useState<any>(null);
   const [payNumber, setPayNumber] = useState<number>(0);
   const [loading, setLoading] = useState(true);
   const [payablesSettings, setPayablesSettings] = useState<any>(null);
   const [attachedReceipt, setAttachedReceipt] = useState<CodedReceipt | null>(null);
   const [duplicateInvoiceWarning, setDuplicateInvoiceWarning] = useState<string>("");
 
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
      const [vendorsRes, jobsRes, expenseAccountsRes, companyMasterCodesRes] = await Promise.all([
        supabase.from('vendors').select('id, name, logo_url, is_active, company_id, require_invoice_number, vendor_type').eq('is_active', true).eq('company_id', companyId),
        supabase.from('jobs').select('*').eq('company_id', companyId),
        supabase.from('chart_of_accounts')
          .select('id, account_number, account_name, account_type, require_attachment')
          .eq('company_id', companyId)
          .in('account_type', ['expense', 'cost_of_goods_sold', 'asset', 'other_expense'])
          .eq('is_active', true)
          .order('account_number'),
        supabase.from('cost_codes')
          .select('id, code, type, require_attachment')
          .eq('company_id', companyId)
          .is('job_id', null)
          .eq('is_active', true)
          .eq('is_dynamic_group', false)
      ]);

      if (vendorsRes.data) setVendors(vendorsRes.data);
      if (jobsRes.data) setJobs(jobsRes.data);
      if (expenseAccountsRes.data) setExpenseAccounts(expenseAccountsRes.data);
      if (companyMasterCodesRes.data) setCompanyCostCodes(companyMasterCodesRes.data);
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
        .select('id, code, description, job_id, type, is_dynamic_group, require_attachment, parent_cost_code_id')
        .eq('job_id', jobId)
        .eq('is_active', true)
        .eq('is_dynamic_group', false);
      
      // Filter out parent codes that have children (only show leaf nodes)
      const leafCodes = filterLeafCostCodes(data || []);
      const filtered = filterCostCodesByVendorType(leafCodes);
      const sorted = sortCostCodesNumerically(filtered);
      setCostCodes(sorted);
    } catch (error) {
      console.error('Error fetching cost codes:', error);
    }
  };

  const fetchCostCodesForLineItem = async (jobId: string, lineItemId: string) => {
    try {
      const { data } = await supabase
        .from('cost_codes')
        .select('id, code, description, job_id, type, is_dynamic_group, require_attachment, parent_cost_code_id')
        .eq('job_id', jobId)
        .eq('is_active', true)
        .eq('is_dynamic_group', false);
      
      // Filter out parent codes that have children (only show leaf nodes)
      const leafCodes = filterLeafCostCodes(data || []);
      const filtered = filterCostCodesByVendorType(leafCodes);
      const sorted = sortCostCodesNumerically(filtered);
      setLineItemCostCodes(prev => ({
        ...prev,
        [lineItemId]: sorted
      }));
    } catch (error) {
      console.error('Error fetching cost codes:', error);
    }
  };

  const isGroupingCodeText = (codeText: string) => {
    const t = (codeText || '').trim();
    return /^(\d{1,3}\.00)$/.test(t) || /^(\d+\.0)$/.test(t);
  };

  const filterLeafCostCodes = (codes: any[]) => {
    // Get all parent IDs that have children
    const parentIds = new Set(
      codes
        .filter(code => code.parent_cost_code_id)
        .map(code => code.parent_cost_code_id)
    );
    
    // Only return codes that are NOT parents of other codes
    // Also hide obvious grouping codes like "01.00" and legacy dynamic groups like "1.0"
    return codes.filter(code => !parentIds.has(code.id) && !isGroupingCodeText(code.code));
  };

  const sortCostCodesNumerically = (codes: any[]) => {
    return [...codes].sort((a, b) => {
      // Extract numeric parts from cost codes for proper numerical sorting
      const parseCode = (code: string) => {
        // Split by periods and dashes to get numeric segments
        const parts = code.split(/[.-]/).map(part => {
          const num = parseFloat(part);
          return isNaN(num) ? part : num;
        });
        return parts;
      };
      
      const aParts = parseCode(a.code);
      const bParts = parseCode(b.code);
      
      // Compare each segment
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] ?? '';
        const bPart = bParts[i] ?? '';
        
        // If both are numbers, compare numerically
        if (typeof aPart === 'number' && typeof bPart === 'number') {
          if (aPart !== bPart) return aPart - bPart;
        } else {
          // Otherwise compare as strings
          const aStr = String(aPart);
          const bStr = String(bPart);
          if (aStr !== bStr) return aStr.localeCompare(bStr);
        }
      }
      return 0;
    });
  };

  const filterCostCodesByVendorType = (codes: any[]) => {
    const vendorType = selectedVendor?.vendor_type;
    const allowedTypes = new Set(['labor','material','equipment','sub','other']);

    // Always drop codes without a valid category type
    let filtered = codes.filter(cc => cc.type && allowedTypes.has(String(cc.type).toLowerCase()));

    // If vendor type not selected yet, don't apply additional filtering
    if (!vendorType) return filtered;

    // If vendor is contractor or design professional, only show sub/other/labor
    if (vendorType === 'Contractor' || vendorType === 'Design Professional') {
      filtered = filtered.filter(cc => {
        const t = String(cc.type).toLowerCase();
        return t === 'sub' || t === 'other' || t === 'labor';
      });
    } else {
      // For other vendor types, exclude subcontractor cost codes
      filtered = filtered.filter(cc => String(cc.type).toLowerCase() !== 'sub');
    }

    return filtered;
  };

  const getCostCodeTypeLabel = (type: string) => {
    switch(type) {
      case 'labor': return 'Labor';
      case 'material': return 'Material';
      case 'equipment': return 'Equipment';
      case 'sub': return 'Subcontractor';
      case 'other': return 'Other';
      default: return type;
    }
  };

  const getCostCodeTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" | "destructive" => {
    switch(type) {
      case 'labor': return 'default';
      case 'material': return 'secondary';
      case 'equipment': return 'outline';
      case 'sub': return 'destructive';
      default: return 'outline';
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
      const hasJob = !!item.job_id; // job is required by DB schema
      const hasAmount = item.amount && parseFloat(item.amount) > 0;
      return hasJob && hasAmount;
    });
    
    return allItemsValid && Math.abs(billAmount - distributionTotal) < 0.01;
  };

  const fetchAllSubcontracts = async () => {
    if (!currentCompany?.id && !profile?.current_company_id) return;
    
    try {
      const { data } = await supabase
        .from('subcontracts')
        .select('*, vendors(name), jobs!inner(company_id), cost_distribution, total_distributed_amount, retainage_percentage')
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
        .select('*, vendors(name), jobs!inner(company_id), cost_distribution, total_distributed_amount, retainage_percentage')
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
        .select('*, vendors(name), retainage_percentage')
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
        .select('*, vendors(name), retainage_percentage')
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
      
      // Set retainage from subcontract
      const retainagePercentage = selectedSubcontract.retainage_percentage || 0;
      
      // Update retainage percentage first, amount will be calculated when bill amount changes
      setFormData(prev => {
        const billAmount = parseFloat(prev.amount) || 0;
        const retainageAmount = billAmount > 0 ? billAmount * (retainagePercentage / 100) : 0;
        return {
          ...prev,
          retainage_percentage: retainagePercentage,
          retainage_amount: retainageAmount
        };
      });
      
      // Fetch cost codes for the job FIRST before processing distribution
      await fetchCostCodesForJob(selectedSubcontract.job_id);
      
      // Ensure cost_distribution is always an array (handle JSON string or null)
      const raw = selectedSubcontract.cost_distribution as any;
      let distribution: any[] = [];
      try {
        distribution = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : []);
      } catch {
        distribution = [];
      }
      setCommitmentDistribution(distribution);
      
      console.log('Subcontract distribution loaded:', distribution);
      
      // Check if distribution is needed
      if (distribution.length === 1) {
        // Single cost code - auto-apply (fallback to lookup by code if id missing)
        const first = distribution[0] as any;
        let ccId = first.cost_code_id as string | undefined;
        
        // If no direct ID, look up by code from freshly fetched costCodes
        if (!ccId && (first.cost_code || first.code)) {
          // Wait a tick for state to update
          await new Promise(resolve => setTimeout(resolve, 100));
          const { data: freshCostCodes } = await supabase
            .from('cost_codes')
            .select('id, code')
            .eq('job_id', selectedSubcontract.job_id)
            .eq('is_active', true);
          
          const match = freshCostCodes?.find((c: any) => c.code === (first.cost_code || first.code));
          ccId = match?.id;
        }
        
        console.log('Auto-applying cost code ID:', ccId);
        handleInputChange("cost_code_id", ccId || "");
        setNeedsDistribution(false);
      } else if (distribution.length > 1) {
        // Multiple cost codes - need distribution
        setNeedsDistribution(true);
        handleInputChange("cost_code_id", "");
      } else {
        // No distribution
        setNeedsDistribution(false);
      }
      
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
      
      // Set retainage from purchase order
      const retainagePercentage = selectedPO.retainage_percentage || 0;
      
      // Update retainage percentage first, amount will be calculated when bill amount changes
      setFormData(prev => {
        const billAmount = parseFloat(prev.amount) || 0;
        const retainageAmount = billAmount > 0 ? billAmount * (retainagePercentage / 100) : 0;
        return {
          ...prev,
          retainage_percentage: retainagePercentage,
          retainage_amount: retainageAmount
        };
      });
      
      // Fetch cost codes for the job FIRST before processing distribution
      await fetchCostCodesForJob(selectedPO.job_id);
      
      // Ensure cost_distribution is always an array (handle JSON string or null)
      const raw = selectedPO.cost_distribution as any;
      let distribution: any[] = [];
      try {
        distribution = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : []);
      } catch {
        distribution = [];
      }
      setCommitmentDistribution(distribution);
      
      console.log('PO distribution loaded:', distribution);
      
      // Check if distribution is needed
      if (distribution.length === 1) {
        // Single cost code - auto-apply (fallback to lookup by code if id missing)
        const first = distribution[0] as any;
        let ccId = first.cost_code_id as string | undefined;
        
        // If no direct ID, look up by code from freshly fetched costCodes
        if (!ccId && (first.cost_code || first.code)) {
          // Wait a tick for state to update
          await new Promise(resolve => setTimeout(resolve, 100));
          const { data: freshCostCodes } = await supabase
            .from('cost_codes')
            .select('id, code')
            .eq('job_id', selectedPO.job_id)
            .eq('is_active', true);
          
          const match = freshCostCodes?.find((c: any) => c.code === (first.cost_code || first.code));
          ccId = match?.id;
        }
        
        console.log('Auto-applying cost code ID:', ccId);
        handleInputChange("cost_code_id", ccId || "");
        setNeedsDistribution(false);
      } else if (distribution.length > 1) {
        // Multiple cost codes - need distribution
        setNeedsDistribution(true);
        handleInputChange("cost_code_id", "");
      } else {
        // No distribution
        setNeedsDistribution(false);
      }
      
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
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Recalculate retainage if bill amount changes and we have a retainage percentage
      if (field === 'amount' && typeof value === 'string') {
        const billAmount = parseFloat(value) || 0;
        // Only calculate if we have a retainage percentage set
        if (updated.retainage_percentage > 0) {
          updated.retainage_amount = billAmount * (updated.retainage_percentage / 100);
        }
      }
      
      // Recalculate retainage if percentage changes and we have an amount
      if (field === 'retainage_percentage' && typeof value === 'string') {
        const percentage = parseFloat(value) || 0;
        const billAmount = parseFloat(updated.amount) || 0;
        if (percentage > 0 && billAmount > 0) {
          updated.retainage_amount = billAmount * (percentage / 100);
        }
      }
      
      return updated;
    });
    
    // Check for duplicate invoice number when it changes
    if (field === 'invoice_number' && typeof value === 'string' && formData.vendor_id) {
      checkDuplicateInvoice(value, formData.vendor_id);
    }
  };

  const checkDuplicateInvoice = async (invoiceNumber: string, vendorId: string) => {
    if (!invoiceNumber || !vendorId) {
      setDuplicateInvoiceWarning("");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('vendor_id', vendorId)
        .ilike('invoice_number', invoiceNumber.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDuplicateInvoiceWarning(`Warning: This invoice number already exists for this vendor.`);
      } else {
        setDuplicateInvoiceWarning("");
      }
    } catch (error) {
      console.error('Error checking duplicate invoice:', error);
    }
  };

  const handleFileUpload = (files: File[]) => {
    const validFiles = files.filter(file => {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} must be PDF or image`,
          variant: "destructive"
        });
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 10MB`,
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
      handleFileUpload(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFileUpload(Array.from(files));
    }
  };

  const handleReceiptAttach = async (receipt: CodedReceipt) => {
    try {
      // Set attached receipt for display
      setAttachedReceipt(receipt);
      
      // Fetch the receipt's cost distribution
      const { data: costDistData, error } = await supabase
        .from('receipt_cost_distributions')
        .select('*, jobs(name), cost_codes(code, description)')
        .eq('receipt_id', receipt.id);
      
      if (error) throw error;
      
      if (costDistData && costDistData.length > 0) {
        // Populate distribution items from receipt
        const newDistItems = costDistData.map(dist => ({
          id: crypto.randomUUID(),
          job_id: dist.job_id,
          expense_account_id: "",
          cost_code_id: dist.cost_code_id,
          amount: dist.amount.toString()
        }));
        
        setDistributionItems(newDistItems);
        
        // Load cost codes for each job
        for (const item of newDistItems) {
          if (item.job_id) {
            await fetchCostCodesForLineItem(item.job_id, item.id);
          }
        }
        
        toast({
          title: "Distribution populated",
          description: "Cost distribution from receipt has been applied to the bill"
        });
      } else {
        // Fallback: use top-level coded fields on the receipt
        const singleItem = {
          id: crypto.randomUUID(),
          job_id: receipt.job_id || "",
          expense_account_id: "",
          cost_code_id: receipt.cost_code_id || "",
          amount: (receipt.amount ?? "0").toString()
        } as DistributionLineItem;
        setDistributionItems([singleItem]);
        if (singleItem.job_id) await fetchCostCodesForLineItem(singleItem.job_id, singleItem.id);
        toast({
          title: "Distribution populated",
          description: "Used coded job and cost code from receipt",
        });
      }
    } catch (error) {
      console.error('Error attaching receipt:', error);
      toast({
        title: "Error",
        description: "Failed to load receipt distribution data",
        variant: "destructive"
      });
    }
  };

  const handleSaveAsDraft = async () => {
    if (!formData.vendor_id) {
      toast({
        title: "Vendor required",
        description: "Please select a vendor to save as draft",
        variant: "destructive"
      });
      return;
    }

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        toast({
          title: "Authentication required",
          description: "Please log in to save a draft",
          variant: "destructive"
        });
        return;
      }

      const companyId = currentCompany?.id || profile?.current_company_id;
      const { data: namingSettings } = await supabase
        .from('file_upload_settings')
        .select('bill_naming_pattern')
        .eq('company_id', companyId)
        .single();

      // Create the draft invoice
      const { data: inserted, error } = await supabase
        .from('invoices')
        .insert({
          vendor_id: formData.vendor_id,
          job_id: formData.job_id || null,
          cost_code_id: formData.cost_code_id || null,
          subcontract_id: formData.subcontract_id || null,
          purchase_order_id: formData.purchase_order_id || null,
          amount: parseFloat(formData.amount || '0') || 0,
          invoice_number: formData.invoice_number || null,
          issue_date: formData.issueDate || null,
          due_date: formData.dueDate || null,
          payment_terms: formData.payment_terms || null,
          description: formData.description || null,
          internal_notes: formData.internal_notes || null,
          is_subcontract_invoice: formData.is_subcontract_invoice,
          is_reimbursement: formData.is_reimbursement,
          file_url: attachedReceipt?.file_url || null,
          created_by: user.data.user.id,
          pending_coding: false,
          status: 'draft'
        })
        .select('id')
        .single();

      if (error) throw error;

      const invoiceId = inserted.id;

      // Upload bill files
      if (billFiles.length > 0) {
        for (const file of billFiles) {
          const fileExt = file.name.split('.').pop();
          let displayName = file.name;
          
          if (namingSettings?.bill_naming_pattern) {
            const vendor = vendors.find(v => v.id === formData.vendor_id);
            const job = jobs.find(j => j.id === formData.job_id);
            const dateStr = formData.issueDate || new Date().toISOString().split('T')[0];
            
            displayName = namingSettings.bill_naming_pattern
              .replace('{vendor}', vendor?.name || 'Unknown')
              .replace('{invoice_number}', formData.invoice_number || 'NoInvoiceNum')
              .replace('{date}', dateStr)
              .replace('{amount}', parseFloat(formData.amount || '0').toFixed(2))
              .replace('{job}', job?.name || 'NoJob')
              .replace('{original_filename}', file.name.replace(/\.[^/.]+$/, ''))
              + '.' + fileExt;
          }
          
          const storageFileName = `${companyId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(storageFileName, file);

          if (uploadError) {
            console.error('Error uploading bill file:', uploadError);
            continue;
          }

          const fileUrl = getStoragePathForDb('receipts', storageFileName);

          await supabase.from('invoice_documents').insert({
            invoice_id: invoiceId,
            file_url: fileUrl,
            file_name: displayName,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.data.user.id
          });
        }
      }

      // Save distribution items if any (skip for MVP - can be added later if needed)
      
      toast({
        title: "Draft saved",
        description: "Bill saved as draft. You can continue editing it later.",
      });
      
      navigate("/invoices");
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Error",
        description: "Failed to save draft",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if vendor requires invoice number
    if (selectedVendor?.require_invoice_number && !formData.invoice_number?.trim()) {
      toast({
        title: "Error",
        description: "Invoice number is required for this vendor",
        variant: "destructive",
      });
      return;
    }
    
    // Block submission if duplicate invoice exists
    if (duplicateInvoiceWarning) {
      toast({
        title: "Duplicate Invoice",
        description: "An invoice with this number already exists for this vendor. Please use a different invoice number.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if documents are required by payables settings
    const requireDocuments = payablesSettings?.require_bill_documents ?? false;
    
    if (requireDocuments && billFiles.length === 0 && !attachedReceipt && !(canBypassAttachment() && noAttachmentNeeded)) {
      toast({
        title: "Document required",
        description: "Company settings require a document unless the selected cost code or account allows no attachment",
        variant: "destructive"
      });
      return;
    }
    
    if (billFiles.length === 0 && !attachedReceipt && !(canBypassAttachment() && noAttachmentNeeded)) {
      toast({
        title: "Attachment required",
        description: "Upload a document or check 'No attachment needed' if allowed by the selected cost code/account",
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

      // Get project manager for the job and check if approval is required
      let assignedToPm = null;
      let requiresPmApproval = false;
      
      if (formData.job_id) {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('project_manager_user_id, require_pm_bill_approval')
          .eq('id', formData.job_id)
          .single();
        
        assignedToPm = jobData?.project_manager_user_id || null;
        requiresPmApproval = jobData?.require_pm_bill_approval || false;
      }
      
      // Subcontract bills should NOT be marked as pending coding
      // They should auto-apply cost codes from the subcontract distribution
      const isCommitmentBill = billType === "commitment" && (formData.subcontract_id || formData.purchase_order_id);
      
      // If job requires PM approval OR user requested PM help, mark as pending
      // BUT: Subcontract/PO bills with auto-applied cost codes should never be pending_coding
      const shouldPendCoding = !isCommitmentBill && (formData.request_pm_help || requiresPmApproval);

      // Validate distribution items only when not requesting PM help
      if (billType === "non_commitment" && !shouldPendCoding) {
        const missingJob = distributionItems.some(di => !di.job_id);
        if (missingJob) {
          toast({
            title: "Job required",
            description: "Each distribution line must have a job selected. Expense-only lines aren’t supported on this page.",
            variant: "destructive"
          });
          return;
        }
      }

      const { data: namingSettings } = await supabase
        .from('file_upload_settings')
        .select('bill_naming_pattern')
        .eq('company_id', currentCompany?.id || profile?.current_company_id)
        .single();

      let insertedInvoiceIds: string[] = [];

      if (billType === "non_commitment") {
        if (shouldPendCoding) {
          const amt = parseFloat(formData.amount || '0');
          if (!isFinite(amt) || amt <= 0) {
            toast({
              title: "Amount required",
              description: "Enter a valid bill amount before requesting PM help.",
              variant: "destructive"
            });
            return;
          }

          // Require a job for pending coding and use the first selected job if present
          const pendingJobId = (distributionItems.find(item => item.job_id)?.job_id) || formData.job_id || "";
          if (!pendingJobId) {
            toast({
              title: "Job required",
              description: "Select a job (or pick one on a distribution line) before requesting PM help.",
              variant: "destructive"
            });
            return;
          }

          const { data: inserted, error } = await supabase
            .from('invoices')
            .insert({
              vendor_id: formData.vendor_id,
              job_id: pendingJobId,
              cost_code_id: null,
              amount: amt,
              invoice_number: formData.invoice_number || null,
              issue_date: formData.issueDate,
              due_date: dueDate,
              payment_terms: formData.use_terms ? formData.payment_terms : null,
              description: formData.description,
              internal_notes: formData.internal_notes || null,
              is_subcontract_invoice: false,
              is_reimbursement: formData.is_reimbursement,
              file_url: attachedReceipt?.file_url || null,
              created_by: user.data.user.id,
              pending_coding: true,
              assigned_to_pm: assignedToPm,
              status: 'pending_coding'
            })
            .select('id');

          if (error) throw error;

          if (inserted && inserted.length) {
            insertedInvoiceIds = [inserted[0].id];
            if (attachedReceipt && insertedInvoiceIds.length) {
              const auditRows = insertedInvoiceIds.map((id) => ({
                invoice_id: id,
                change_type: 'update',
                field_name: 'attachment',
                old_value: null,
                new_value: attachedReceipt.id,
                reason: `Attached coded receipt: ${attachedReceipt.filename}`,
                changed_by: user.data.user!.id
              }));
              await supabase.from('invoice_audit_trail').insert(auditRows);
            }
          }
        } else {
          const validItems = distributionItems.filter(item => item.job_id && item.amount && isFinite(parseFloat(item.amount)) && parseFloat(item.amount) > 0);
          if (validItems.length === 0 || !isDistributionValid()) {
            toast({
              title: "Fix distribution",
              description: "Add at least one valid distribution line and ensure totals match.",
              variant: "destructive"
            });
            return;
          }

          // Create ONE invoice record with total amount
          const totalAmount = validItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
          
          const { data: inserted, error } = await supabase
            .from('invoices')
            .insert({
              vendor_id: formData.vendor_id,
              job_id: validItems[0].job_id, // Use first job as primary
              cost_code_id: null, // Will be distributed via invoice_cost_distributions
              amount: totalAmount,
              invoice_number: formData.invoice_number || null,
              issue_date: formData.issueDate,
              due_date: dueDate,
              payment_terms: formData.use_terms ? formData.payment_terms : null,
              description: formData.description,
              internal_notes: formData.internal_notes || null,
              is_subcontract_invoice: false,
              is_reimbursement: formData.is_reimbursement,
              file_url: attachedReceipt?.file_url || null,
              created_by: user.data.user.id,
              pending_coding: false,
              assigned_to_pm: assignedToPm,
              status: 'pending_approval'
            })
            .select('id')
            .single();

          if (error) throw error;
          
          if (inserted) {
            insertedInvoiceIds = [inserted.id];
            
            // Create distribution records
            const distributions = validItems.map(item => ({
              invoice_id: inserted.id,
              cost_code_id: item.cost_code_id || null,
              amount: parseFloat(item.amount),
              percentage: (parseFloat(item.amount) / totalAmount) * 100
            }));
            
            const { error: distError } = await supabase
              .from('invoice_cost_distributions')
              .insert(distributions);
            
            if (distError) throw distError;
            
            if (attachedReceipt) {
              await supabase.from('invoice_audit_trail').insert({
                invoice_id: inserted.id,
                change_type: 'update',
                field_name: 'attachment',
                old_value: null,
                new_value: attachedReceipt.id,
                reason: `Attached coded receipt: ${attachedReceipt.filename}`,
                changed_by: user.data.user!.id
              });
            }
          }
        }
      } else {
        // For commitment bills, determine cost code automatically
        let costCodeId = formData.cost_code_id || null;
        
        // If this is a subcontract/PO with multi-distribution, create one invoice with distributions
        if (isCommitmentBill && needsDistribution && billDistribution.length > 1) {
          const totalBillAmount = parseFloat(formData.amount) || 0;
          const retainagePercentage = formData.retainage_percentage || 0;
          const totalRetainageAmount = retainagePercentage > 0 ? totalBillAmount * (retainagePercentage / 100) : 0;
          
          const { data: inserted, error } = await supabase
            .from('invoices')
            .insert({
              vendor_id: formData.vendor_id,
              job_id: formData.job_id,
              cost_code_id: null, // Will be distributed via invoice_cost_distributions
              subcontract_id: formData.is_commitment && formData.commitment_type === 'subcontract' ? formData.subcontract_id : null,
              purchase_order_id: formData.is_commitment && formData.commitment_type === 'purchase_order' ? formData.purchase_order_id : null,
              amount: totalBillAmount,
              retainage_percentage: retainagePercentage,
              retainage_amount: totalRetainageAmount,
              invoice_number: formData.invoice_number || null,
              issue_date: formData.issueDate,
              due_date: dueDate,
              payment_terms: formData.use_terms ? formData.payment_terms : null,
              description: formData.description,
              internal_notes: formData.internal_notes || null,
              is_subcontract_invoice: formData.is_commitment && formData.commitment_type === 'subcontract',
              is_reimbursement: formData.is_reimbursement,
              created_by: user.data.user.id,
              pending_coding: false,
              assigned_to_pm: assignedToPm,
              file_url: attachedReceipt?.file_url || null,
              status: 'pending_approval'
            })
            .select('id')
            .single();

          if (error) throw error;
          
          if (inserted) {
            insertedInvoiceIds = [inserted.id];
            
            // Create distribution records
            const distributions = billDistribution.map(dist => ({
              invoice_id: inserted.id,
              cost_code_id: dist.cost_code_id,
              amount: parseFloat(dist.amount),
              percentage: (parseFloat(dist.amount) / totalBillAmount) * 100
            }));
            
            const { error: distError } = await supabase
              .from('invoice_cost_distributions')
              .insert(distributions);
            
            if (distError) throw distError;

            // Add audit trail for attached receipt
            if (attachedReceipt) {
              await supabase.from('invoice_audit_trail').insert({
                invoice_id: inserted.id,
                change_type: 'update',
                field_name: 'attachment',
                old_value: null,
                new_value: attachedReceipt.id,
                reason: `Attached coded receipt: ${attachedReceipt.filename}`,
                changed_by: user.data.user!.id
              });
            }
          }
        } else {
          // Single commitment bill or single cost code
          // If this is a subcontract/PO with cost distribution, auto-apply cost code if only one exists
          if (isCommitmentBill && commitmentDistribution && commitmentDistribution.length === 1) {
            costCodeId = commitmentDistribution[0].cost_code_id || null;
          }
          
          // For commitment bills, use the original single record approach
          const { data: inserted, error } = await supabase
            .from('invoices')
            .insert({
            vendor_id: formData.vendor_id,
            job_id: formData.job_id,
            cost_code_id: shouldPendCoding ? null : costCodeId,
            subcontract_id: formData.is_commitment && formData.commitment_type === 'subcontract' ? formData.subcontract_id : null,
            purchase_order_id: formData.is_commitment && formData.commitment_type === 'purchase_order' ? formData.purchase_order_id : null,
            amount: parseFloat(formData.amount),
            invoice_number: formData.invoice_number || null,
            issue_date: formData.issueDate,
            due_date: dueDate,
            payment_terms: formData.use_terms ? formData.payment_terms : null,
            description: formData.description,
            internal_notes: formData.internal_notes || null,
            is_subcontract_invoice: formData.is_commitment && formData.commitment_type === 'subcontract',
            is_reimbursement: formData.is_reimbursement,
            created_by: user.data.user.id,
            pending_coding: shouldPendCoding,
            assigned_to_pm: assignedToPm,
            retainage_amount: formData.retainage_amount || 0,
            retainage_percentage: formData.retainage_percentage || 0,
            file_url: attachedReceipt?.file_url || null,
            status: shouldPendCoding ? 'pending_coding' : 'pending_approval'
          })
          .select('id');

        if (error) throw error;
        
        if (inserted && inserted.length) {
          insertedInvoiceIds = [inserted[0].id];
        }

        // Add audit trail for attached receipt
        if (attachedReceipt && inserted && inserted.length) {
          await supabase.from('invoice_audit_trail').insert({
            invoice_id: inserted[0].id,
            change_type: 'update',
            field_name: 'attachment',
            old_value: null,
            new_value: attachedReceipt.id,
            reason: `Attached coded receipt: ${attachedReceipt.filename}`,
            changed_by: user.data.user.id
          });
        }
        }
      }

      // Upload bill files and create invoice_documents records
      if (billFiles.length > 0 && insertedInvoiceIds.length > 0) {
        for (const file of billFiles) {
          const fileExt = file.name.split('.').pop();
          
          // Apply naming pattern if available
          let displayName = file.name;
          if (namingSettings?.bill_naming_pattern) {
            const vendor = vendors.find(v => v.id === formData.vendor_id);
            const job = jobs.find(j => j.id === formData.job_id);
            const dateStr = formData.issueDate || new Date().toISOString().split('T')[0];
            
            displayName = namingSettings.bill_naming_pattern
              .replace('{vendor}', vendor?.name || 'Unknown')
              .replace('{invoice_number}', formData.invoice_number || 'NoInvoiceNum')
              .replace('{date}', dateStr)
              .replace('{amount}', parseFloat(formData.amount || '0').toFixed(2))
              .replace('{job}', job?.name || 'NoJob')
              .replace('{original_filename}', file.name.replace(/\.[^/.]+$/, ''))
              + '.' + fileExt;
          }
          
          const companyId = currentCompany?.id || profile?.current_company_id;
          const storageFileName = `${companyId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(storageFileName, file);

          if (uploadError) {
            console.error('Error uploading bill file:', uploadError);
            continue;
          }

          const fileUrl = getStoragePathForDb('receipts', storageFileName);

          // Create document records for each invoice
          for (const invoiceId of insertedInvoiceIds) {
            await supabase.from('invoice_documents').insert({
              invoice_id: invoiceId,
              file_url: fileUrl,
              file_name: displayName,
              file_type: file.type,
              file_size: file.size,
              uploaded_by: user.data.user.id
            });
          }
        }
      }

      toast({
        title: "Bill created",
        description: shouldPendCoding
          ? "Bill sent to project manager for coding assistance"
          : (billType === "non_commitment" 
            ? `Bill created with ${distributionItems.length} distribution line item(s)`
            : needsDistribution
            ? `Bill created with ${billDistribution.length} cost code distributions`
            : "Bill has been successfully created"),
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

  // Check if any selected account or cost code allows bypassing attachment requirement
  const canBypassAttachment = () => {
    const codeAllows = (cc?: any) => {
      if (!cc) return false;
      if (cc.require_attachment === false) return true;
      const master = companyCostCodes.find((m: any) => m.code === cc.code && ((m.type ?? null) === (cc.type ?? null)));
      return master?.require_attachment === false;
    };

    if (billType === "commitment") {
      // Check expense account
      if (formData.expense_account_id) {
        const account = expenseAccounts.find(a => a.id === formData.expense_account_id);
        if (account?.require_attachment === false) return true;
      }
      // Check cost code
      if (formData.cost_code_id) {
        const costCode = costCodes.find(c => c.id === formData.cost_code_id);
        if (codeAllows(costCode)) return true;
      }
      // Check bill distribution cost codes - if ANY allow bypass, then bypass is allowed
      if (needsDistribution && billDistribution.length > 0) {
        const hasNonRequiredCode = billDistribution.some(dist => {
          const costCode = costCodes.find(c => c.id === dist.cost_code_id);
          return codeAllows(costCode);
        });
        if (hasNonRequiredCode) return true;
      }
    } else {
      // Non-commitment: check distribution items - if ANY allow bypass, then bypass is allowed
      const hasNonRequiredItem = distributionItems.some(item => {
        // Check expense account
        if (item.expense_account_id) {
          const account = expenseAccounts.find(a => a.id === item.expense_account_id);
          if (account?.require_attachment === false) return true;
        }
        // Check cost code
        if (item.cost_code_id) {
          const codes = lineItemCostCodes[item.id] || [];
          const costCode = codes.find((c: any) => c.id === item.cost_code_id);
          if (codeAllows(costCode)) return true;
        }
        return false;
      });
      if (hasNonRequiredItem) return true;
    }
    return false;
  };

  const attachmentRequired = !canBypassAttachment();

  // Debug form validation
  console.log('Form validation debug:', {
    billType,
    vendor_id: formData.vendor_id,
    job_id: formData.job_id,
    expense_account_id: formData.expense_account_id,
    amount: formData.amount,
    issueDate: formData.issueDate,
    attachmentRequired,
    billFiles_length: billFiles.length,
    attachedReceipt: !!attachedReceipt,
    use_terms: formData.use_terms,
    payment_terms: formData.payment_terms,
    dueDate: formData.dueDate,
    cost_code_id: formData.cost_code_id,
    needsDistribution,
    billDistribution_length: billDistribution.length,
    commitmentDistribution_length: commitmentDistribution.length
  });

  const isFormValid = billType === "commitment" 
    ? formData.vendor_id && (formData.job_id || formData.expense_account_id) && formData.amount && 
      formData.issueDate && (attachmentRequired ? (billFiles.length > 0 || attachedReceipt) : true) && (formData.use_terms ? formData.payment_terms : formData.dueDate) &&
      (formData.cost_code_id || (needsDistribution && billDistribution.length > 0) || (commitmentDistribution.length === 1)) // Accept auto-applied single distribution
    : formData.vendor_id && formData.amount && formData.issueDate && (attachmentRequired ? (billFiles.length > 0 || attachedReceipt) : true) && 
      (formData.use_terms ? formData.payment_terms : formData.dueDate) && 
      isDistributionValid(); // Valid distribution required

  console.log('isFormValid:', isFormValid);

  if (loading) {
    return <div className="p-6 max-w-4xl mx-auto text-center">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Bill</h1>
          <p className="text-muted-foreground">Fill in the form below and upload the bill document at the bottom</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Fields - Compact Layout at Top */}
        <div className="space-y-6">
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendor">Vendor *</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={vendorOpen}
                              className="w-full justify-between"
                            >
                              {formData.vendor_id
                                ? vendors.find((v) => v.id === formData.vendor_id)?.name
                                : "Select a vendor"}
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0 bg-background z-50" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search vendors..." 
                                value={vendorSearch}
                                onValueChange={setVendorSearch}
                              />
                              <CommandList>
                                <CommandEmpty>No vendor found.</CommandEmpty>
                                <CommandGroup>
                                  {vendors
                                    .filter(v => v.name.toLowerCase().includes(vendorSearch.toLowerCase()))
                                    .map((vendor) => (
                                      <CommandItem
                                        key={vendor.id}
                                        value={vendor.name}
                                        onSelect={() => {
                                          handleInputChange("vendor_id", vendor.id);
                                          setVendorOpen(false);
                                          setVendorSearch("");
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${
                                            formData.vendor_id === vendor.id ? "opacity-100" : "opacity-0"
                                          }`}
                                        />
                                        {vendor.name}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <QuickAddVendor 
                        onVendorAdded={(vendorId) => {
                          handleInputChange("vendor_id", vendorId);
                          // Refresh vendors list
                          const fetchVendors = async () => {
                            const { data } = await supabase
                              .from('vendors')
                              .select('*')
                              .eq('company_id', currentCompany?.id)
                              .eq('is_active', true)
                              .order('name');
                            if (data) setVendors(data);
                          };
                          fetchVendors();
                        }}
                      />
                    </div>
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {selectedVendor?.require_invoice_number !== false && (
                    <div className="space-y-2">
                      <Label htmlFor="invoice_number">
                        Invoice # {selectedVendor?.require_invoice_number && <span className="text-destructive">*</span>}
                      </Label>
                      <Input
                        id="invoice_number"
                        value={formData.invoice_number}
                        onChange={(e) => handleInputChange("invoice_number", e.target.value)}
                        placeholder={selectedVendor?.require_invoice_number ? "Required" : "Optional"}
                        required={selectedVendor?.require_invoice_number}
                      />
                      {duplicateInvoiceWarning && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {duplicateInvoiceWarning}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 h-8">
                      <Checkbox
                        id="use_terms"
                        checked={formData.use_terms}
                        onCheckedChange={(checked) => handleInputChange("use_terms", checked)}
                      />
                      <Label htmlFor="use_terms" className="text-sm">Use terms</Label>
                    </div>
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
                  <div className="space-y-2">
                    <div className="h-8"></div>
                    <div className="flex items-center space-x-2 h-10">
                      <Checkbox
                        id="is_reimbursement"
                        checked={formData.is_reimbursement}
                        onCheckedChange={(checked) => handleInputChange("is_reimbursement", checked)}
                      />
                      <Label htmlFor="is_reimbursement" className="cursor-pointer">Reimbursement payment</Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Enter invoice description or notes"
                  />
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
                                  return !inRange; // Always exclude 50000-59000 from Job/Control menu
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

                        {item.job_id && (
                          <div className="space-y-2">
                            <Label>Cost Code</Label>
                            <Popover open={costCodeOpen[item.id]} onOpenChange={(open) => setCostCodeOpen(prev => ({ ...prev, [item.id]: open }))}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={costCodeOpen[item.id]}
                                  className="w-full justify-between"
                                >
                                  {item.cost_code_id ? (
                                    <div className="flex items-center gap-2">
                                      <span>
                                        {(() => {
                                          const code = (lineItemCostCodes[item.id] || []).find(c => c.id === item.cost_code_id);
                                          return code ? `${code.code} - ${code.description}` : "Select cost code";
                                        })()}
                                      </span>
                                      {(() => {
                                        const code = (lineItemCostCodes[item.id] || []).find(c => c.id === item.cost_code_id);
                                        return code ? (
                                          <Badge variant={getCostCodeTypeBadgeVariant(code.type)}>
                                            {getCostCodeTypeLabel(code.type)}
                                          </Badge>
                                        ) : null;
                                      })()}
                                    </div>
                                  ) : (
                                    "Select cost code"
                                  )}
                                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[500px] p-0 bg-background z-[60]" align="start">
                                <Command>
                                  <CommandInput placeholder="Search cost codes..." />
                                  <CommandEmpty>No cost code found.</CommandEmpty>
                                  <CommandList>
                                    {(lineItemCostCodes[item.id] || []).filter(c => !isGroupingCodeText(c.code) && !c.is_dynamic_group).map((code) => (
                                      <CommandItem
                                        key={`${code.id}-${code.type || 'unknown'}`}
                                        value={`${code.code} ${code.description} ${code.type} ${code.id}`}
                                        onSelect={() => {
                                          updateDistributionItem(item.id, 'cost_code_id', code.id);
                                          setCostCodeOpen(prev => ({ ...prev, [item.id]: false }));
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${
                                            item.cost_code_id === code.id ? "opacity-100" : "opacity-0"
                                          }`}
                                        />
                                        <div className="flex items-center gap-2 flex-1">
                                          <span>{code.code} - {code.description}</span>
                                          <Badge variant={getCostCodeTypeBadgeVariant(code.type)}>
                                            {getCostCodeTypeLabel(code.type)}
                                          </Badge>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
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
                      
                      {/* Budget Status Display */}
                      {item.job_id && item.cost_code_id && item.amount && (
                        <div className="pt-3 border-t">
                          <BudgetStatusDisplay
                            jobId={item.job_id}
                            costCodeId={item.cost_code_id}
                            billAmount={item.amount}
                            showWarning={true}
                          />
                        </div>
                      )}
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
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={vendorOpen}
                                className="w-full justify-between"
                              >
                                {formData.vendor_id
                                  ? getFilteredVendors().find((v) => v.id === formData.vendor_id)?.name
                                  : "Select a vendor"}
                                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0 bg-background z-50" align="start">
                              <Command>
                                <CommandInput 
                                  placeholder="Search vendors..." 
                                  value={vendorSearch}
                                  onValueChange={setVendorSearch}
                                />
                                <CommandList>
                                  <CommandEmpty>No vendor found.</CommandEmpty>
                                  <CommandGroup>
                                    {getFilteredVendors()
                                      .filter(v => v.name.toLowerCase().includes(vendorSearch.toLowerCase()))
                                      .map((vendor) => (
                                        <CommandItem
                                          key={vendor.id}
                                          value={vendor.name}
                                          onSelect={() => {
                                            handleInputChange("vendor_id", vendor.id);
                                            // Reset commitment selections when vendor changes
                                            handleInputChange("subcontract_id", "");
                                            handleInputChange("purchase_order_id", "");
                                            setCommitmentDistribution([]);
                                            setPreviouslyBilled(0);
                                            setVendorOpen(false);
                                            setVendorSearch("");
                                          }}
                                        >
                                          <Check
                                            className={`mr-2 h-4 w-4 ${
                                              formData.vendor_id === vendor.id ? "opacity-100" : "opacity-0"
                                            }`}
                                          />
                                          {vendor.name}
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <QuickAddVendor
                          onVendorAdded={(vendorId) => {
                            handleInputChange("vendor_id", vendorId);
                            // Refresh vendors list
                            const fetchVendors = async () => {
                              const { data } = await supabase
                                .from('vendors')
                                .select('*')
                                .eq('company_id', currentCompany?.id)
                                .eq('is_active', true)
                                .order('name');
                              if (data) setVendors(data);
                            };
                            fetchVendors();
                          }}
                        />
                      </div>
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
                  {selectedVendor?.require_invoice_number !== false && (
                    <div className="space-y-2">
                      <Label htmlFor="invoice_number">
                        Invoice # {selectedVendor?.require_invoice_number && <span className="text-destructive">*</span>}
                      </Label>
                      <Input
                        id="invoice_number"
                        value={formData.invoice_number}
                        onChange={(e) => handleInputChange("invoice_number", e.target.value)}
                        placeholder={selectedVendor?.require_invoice_number ? "Required" : "Optional"}
                        required={selectedVendor?.require_invoice_number}
                      />
                      {duplicateInvoiceWarning && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {duplicateInvoiceWarning}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Cost Distribution Display - Show if single distribution */}
                {billType === "commitment" && commitmentDistribution.length === 1 && (
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-success/5">
                      <Label className="text-sm font-medium mb-3 block">Cost Code (Auto-Applied)</Label>
                      <div className="flex justify-between items-center p-2 bg-background rounded">
                        <span className="text-sm font-medium">{commitmentDistribution[0].cost_code} - {commitmentDistribution[0].description}</span>
                        <Badge variant="secondary">100%</Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cost Distribution Section - Show for commitment bills with multiple distributions */}
                {billType === "commitment" && needsDistribution && commitmentDistribution.length > 1 && (
                  <BillDistributionSection
                    subcontractDistribution={commitmentDistribution}
                    billAmount={formData.amount}
                    onChange={setBillDistribution}
                    jobId={formData.job_id}
                  />
                )}

                {/* Retainage Display */}
                {formData.retainage_percentage > 0 && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <Label className="text-sm font-medium mb-3 block">Retainage</Label>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Retainage Percentage:</span>
                        <span className="font-medium">{formData.retainage_percentage}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Retainage Amount:</span>
                        <span className="font-medium">${(formData.retainage_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold border-t pt-2">
                        <span>Net Payable:</span>
                        <span>${((parseFloat(formData.amount) || 0) - (formData.retainage_amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Previously Billed Summary */}
                {previouslyBilled > 0 && (
                  <div className="border rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Previously Billed:</span>
                        <span>${previouslyBilled.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span>Current Bill:</span>
                        <span>${(parseFloat(formData.amount) || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium border-t pt-2">
                        <span>Total Billed:</span>
                        <span>${((parseFloat(formData.amount) || 0) + previouslyBilled).toLocaleString()}</span>
                      </div>
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

                <div className="space-y-2">
                  <Label htmlFor="internal_notes_commitment">Internal Notes</Label>
                  <Textarea
                    id="internal_notes_commitment"
                    value={formData.internal_notes}
                    onChange={(e) => handleInputChange("internal_notes", e.target.value)}
                    placeholder="Enter internal notes for approval and job costing (not visible to vendor)"
                    rows={3}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Receipt Suggestions */}
        {Boolean(formData.amount) && !attachedReceipt && (
          <BillReceiptSuggestions
            billVendorId={formData.vendor_id || undefined}
            billVendorName={selectedVendor?.name}
            billAmount={parseFloat(formData.amount) || 0}
            billJobId={billType === "commitment" ? formData.job_id : undefined}
            billDate={formData.issueDate}
            onReceiptAttached={handleReceiptAttach}
          />
        )}
        </div>
        
        {/* Bill File Upload & Preview - Full Width at Bottom */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bill Document
              {attachmentRequired && <Badge variant="destructive" className="text-xs">Required</Badge>}
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
              {billFiles.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto bg-success/10 rounded-full">
                    <FileText className="h-8 w-8 text-success" />
                  </div>
                  <p className="font-medium">{billFiles.length} file{billFiles.length > 1 ? 's' : ''} selected</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto bg-muted rounded-full">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">Upload Bill Document</p>
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
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileInputChange}
                      className="hidden"
                      id="bill-file-upload"
                    />
                    <Button type="button" asChild>
                      <label htmlFor="bill-file-upload" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Files
                      </label>
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Bill Preview - Full Width */}
            {(billFiles.length > 0 || attachedReceipt) && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Document Preview</Label>
                
                {/* Attached Receipt Preview */}
                {attachedReceipt && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-amber-50 border-b">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-amber-600" />
                        <span className="font-medium text-sm">Attached Receipt: {attachedReceipt.filename}</span>
                        <Badge variant="secondary" className="text-xs">
                          From Receipt System
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = attachedReceipt.file_url;
                            link.download = attachedReceipt.filename || 'receipt';
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAttachedReceipt(null);
                            toast({
                              title: "Receipt detached",
                              description: "Receipt has been removed from this bill"
                            });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-[800px] overflow-y-auto bg-gray-50">
                      {(attachedReceipt.file_name?.toLowerCase().endsWith('.pdf') || attachedReceipt.type === 'pdf') && attachedReceipt.file_url ? (
                        <UrlPdfInlinePreview url={attachedReceipt.file_url} className="w-full" />
                      ) : attachedReceipt.file_url ? (
                        <img
                          src={attachedReceipt.file_url}
                          alt="Receipt preview"
                          className="w-full h-auto"
                        />
                      ) : (
                        <div className="p-8 text-center text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-2" />
                          <p>Receipt preview not available</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Uploaded Bill Files */}
                {billFiles.map((file, index) => (
                  <div key={index} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-muted">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium text-sm">{file.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = URL.createObjectURL(file);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = file.name;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {file.type === 'application/pdf' ? (
                      <div className="max-h-[800px] overflow-y-auto bg-gray-50">
                        <PdfInlinePreview file={file} className="w-full" />
                      </div>
                    ) : (
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Bill preview"
                        className="w-full h-auto"
                      />
                    )}
                  </div>
                ))}
                
                {/* Additional document upload section - below preview */}
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Add More Documents</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Drag and drop additional files or click to browse
                      </p>
                    </div>
                    <div>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={handleFileInputChange}
                        className="hidden"
                        id="bill-file-upload-additional"
                      />
                      <Button type="button" asChild size="sm" variant="outline">
                        <label htmlFor="bill-file-upload-additional" className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-2" />
                          Choose More Files
                        </label>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {billFiles.length === 0 && !attachedReceipt && attachmentRequired && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>Bill document or receipt attachment is required before saving</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Help Option */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Checkbox
                id="request_pm_help"
                checked={formData.request_pm_help}
                onCheckedChange={(checked) => {
                  handleInputChange("request_pm_help", checked);
                  if (checked) {
                    // Clear cost codes when requesting help
                    if (billType === "non_commitment") {
                      setDistributionItems(distributionItems.map(item => ({ ...item, cost_code_id: "" })));
                    }
                    toast({
                      title: "Help requested",
                      description: "Bill will be sent to project manager for coding assistance"
                    });
                  }
                }}
              />
              <div className="space-y-1">
                <Label htmlFor="request_pm_help" className="cursor-pointer">
                  Request help from Project Manager for cost code assignment
                </Label>
                <p className="text-sm text-muted-foreground">
                  Check this box if you need assistance coding this bill to the correct cost codes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            <Button type="submit" disabled={!isFormValid || !!duplicateInvoiceWarning}>
              <FileText className="h-4 w-4 mr-2" />
              {formData.request_pm_help ? "Add Bill & Request Help" : "Add Bill"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleSaveAsDraft} disabled={!!duplicateInvoiceWarning}>
              Save as Draft
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/invoices")}>
              Cancel
            </Button>
          </div>
          {duplicateInvoiceWarning && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              This invoice number already exists for this vendor. Please use a different invoice number.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
