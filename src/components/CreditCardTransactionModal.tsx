import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Paperclip, FileText, X, ChevronsUpDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import UrlPdfInlinePreview from "@/components/UrlPdfInlinePreview";
import { cn } from "@/lib/utils";
interface CreditCardTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  onComplete: () => void;
}

export function CreditCardTransactionModal({
  open,
  onOpenChange,
  transactionId,
  onComplete
}: CreditCardTransactionModalProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [transaction, setTransaction] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [costCodes, setCostCodes] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoders, setSelectedCoders] = useState<string[]>([]);
  const [requestedUsers, setRequestedUsers] = useState<any[]>([]);
  const [communications, setCommunications] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [selectedJobOrAccount, setSelectedJobOrAccount] = useState<string | null>(null);
  const [isJobSelected, setIsJobSelected] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [codingRequestDropdownOpen, setCodingRequestDropdownOpen] = useState(false);
  const [jobCostCodes, setJobCostCodes] = useState<any[]>([]);
  const [openPickers, setOpenPickers] = useState<{ jobControl: boolean; costCode: boolean }>({ jobControl: false, costCode: false });

  useEffect(() => {
    if (open && transactionId && currentCompany) {
      fetchData();
    }
  }, [open, transactionId, currentCompany]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch transaction
      const { data: transData, error: transError } = await supabase
        .from("credit_card_transactions")
        .select(`
          *,
          jobs:job_id(id, name),
          cost_codes:cost_code_id(id, code, description),
          vendors:vendor_id(id, name),
          chart_of_accounts:chart_account_id(id, account_number, account_name)
        `)
        .eq("id", transactionId)
        .single();

      if (transError) throw transError;
      setTransaction(transData);

      // Set initial selection: prefer job if present
      if (transData.job_id) {
        setSelectedJobOrAccount(`job_${transData.job_id}`);
        setIsJobSelected(true);
        // Preload cost codes for the job
        const { data: jobCodes } = await supabase
          .from('cost_codes')
          .select('*')
          .eq('job_id', transData.job_id)
          .eq('company_id', currentCompany?.id || '')
          .eq('is_active', true)
          .eq('is_dynamic_group', false)
          .order('code');
        setJobCostCodes(jobCodes || []);
      } else if (transData.chart_of_accounts?.id) {
        const acct = transData.chart_of_accounts;
        const isJobAcct = acct.account_number >= '50000' && acct.account_number <= '58000';
        if (!isJobAcct) {
          setSelectedJobOrAccount(`account_${acct.id}`);
          setIsJobSelected(false);
          setJobCostCodes([]);
        }
      }

      // Set vendor if exists
      if (transData.vendor_id) {
        setSelectedVendorId(transData.vendor_id);
      }

      // Fetch jobs from jobs table only
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, name')
        .eq('company_id', currentCompany?.id)
        .order('name');
      setJobs(jobsData || []);

      // Fetch expense accounts from chart of accounts (exclude 50000-58000 job range)
      const { data: expenseAccountsData } = await supabase
        .from('chart_of_accounts')
        .select('id, account_number, account_name, account_type')
        .eq('company_id', currentCompany?.id)
        .eq('is_active', true)
        .in('account_type', ['expense', 'operating_expense', 'cost_of_goods_sold'])
        .or('account_number.lt.50000,account_number.gt.58000')
        .order('account_number');

       setExpenseAccounts(expenseAccountsData || []);
 
       // Fetch cost codes
       const { data: costCodesData } = await supabase
         .from("cost_codes")
         .select("*")
         .eq("company_id", currentCompany?.id)
         .eq("is_active", true)
         .eq("is_dynamic_group", false)
         .order("code");
 
       const uniqueAll = Array.from(new Map((costCodesData || []).map((cc: any) => [cc.id, cc])).values());
       setCostCodes(uniqueAll);

      // Fetch vendors
      const { data: vendorsData } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("company_id", currentCompany?.id)
        .eq("is_active", true)
        .order("name");

      setVendors(vendorsData || []);

      // Fetch users for coding requests
      const { data: usersData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, role")
        .in("role", ["admin", "controller", "project_manager"])
        .order("first_name");

      setUsers(usersData || []);

      // Fetch coding requests
      const { data: requests } = await supabase
        .from("credit_card_coding_requests")
        .select("requested_coder_id")
        .eq("transaction_id", transactionId)
        .eq("status", "pending");

      if (requests && requests.length > 0) {
        const coderIds = requests.map(r => r.requested_coder_id);
        setSelectedCoders(coderIds);

        const { data: userDetails } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", coderIds);

        setRequestedUsers(userDetails || []);
      }

      // Fetch communications (without FK join), then hydrate with profile names
      const { data: commsRaw } = await supabase
        .from("credit_card_transaction_communications")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });

      let comms = commsRaw || [];
      const userIds = Array.from(new Set((comms as any[]).map(c => c.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);
        const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
        comms = (comms as any[]).map(c => ({ ...c, user: profileMap.get(c.user_id) || null }));
      }

      setCommunications(comms as any[]);

      // Set attachment preview (normalize storage paths and legacy formats)
      if (transData.attachment_url) {
        const toPublicUrl = (raw: string): string => {
          try {
            if (!raw) return raw;
            // Already a public URL
            if (raw.includes('/storage/v1/object/public/')) return raw;
            // Pattern: bucket/path
            if (!raw.startsWith('http') && raw.includes('/')) {
              const [bucket, ...rest] = raw.split('/');
              const filePath = rest.join('/');
              const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
              return data.publicUrl || raw;
            }
            // Pattern: signed URL
            const m = raw.match(/storage\/v1\/object\/(?:sign|auth\/signed)\/([^/]+)\/(.+?)(?:\?|$)/);
            if (m) {
              const bucket = m[1];
              const filePath = decodeURIComponent(m[2]);
              const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
              return data.publicUrl || raw;
            }
            return raw;
          } catch {
            return raw;
          }
        };
        const normalized = toPublicUrl(transData.attachment_url as string);
        setAttachmentPreview(normalized);
        if (normalized !== transData.attachment_url) {
          // persist normalized URL for consistency
          await supabase
            .from('credit_card_transactions')
            .update({ attachment_url: normalized })
            .eq('id', transactionId);
          setTransaction((prev: any) => ({ ...prev, attachment_url: normalized }));
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateCodingStatus = async () => {
    if (!transaction) return;

    const hasVendor = !!selectedVendorId;
    const hasJobOrAccount = !!selectedJobOrAccount;
    const hasCostCode = isJobSelected ? !!transaction.cost_code_id : true; // Cost code only required for jobs
    const hasAttachment = !!transaction.attachment_url;

    // All fields including vendor are required for coded status
    const isCoded = hasVendor && hasJobOrAccount && hasCostCode && hasAttachment;
    const newStatus = isCoded ? 'coded' : 'uncoded';

    await supabase
      .from("credit_card_transactions")
      .update({ coding_status: newStatus })
      .eq("id", transactionId);

    setTransaction((prev: any) => ({ ...prev, coding_status: newStatus }));
  };

  const handleJobOrAccountChange = async (value: string | null) => {
    if (!value || value === "none") {
      setSelectedJobOrAccount(null);
      setIsJobSelected(false);
      setJobCostCodes([]);
      setOpenPickers({ ...openPickers, jobControl: false });
      await supabase
        .from("credit_card_transactions")
        .update({
          job_id: null,
          chart_account_id: null,
          cost_code_id: null,
        })
        .eq("id", transactionId);
      setTransaction({ ...transaction, job_id: null, chart_account_id: null, cost_code_id: null });
      await updateCodingStatus();
      return;
    }

    const [type, id] = value.split("_");
    setSelectedJobOrAccount(value);
    setOpenPickers({ ...openPickers, jobControl: false });

    if (type === "job") {
      setIsJobSelected(true);
      
      // Fetch cost codes directly by job_id
      const { data: jobCostCodesData } = await supabase
        .from("cost_codes")
        .select("*")
        .eq("job_id", id)
        .eq("company_id", currentCompany?.id)
        .eq("is_active", true)
        .eq("is_dynamic_group", false)
        .order("code");
      
       setJobCostCodes(jobCostCodesData || []);
      
      await supabase
        .from("credit_card_transactions")
        .update({
          job_id: id,
          chart_account_id: null,
          cost_code_id: null,
        })
        .eq("id", transactionId);
      setTransaction((prev: any) => ({ ...prev, job_id: id, chart_account_id: null, cost_code_id: null }));
    } else if (type === "account") {
      setIsJobSelected(false);
      setJobCostCodes([]);
      await supabase
        .from("credit_card_transactions")
        .update({
          job_id: null,
          chart_account_id: id,
          cost_code_id: null,
        })
        .eq("id", transactionId);
      setTransaction((prev: any) => ({ ...prev, job_id: null, chart_account_id: id, cost_code_id: null }));
    }

    await updateCodingStatus();
  };

  const handleCostCodeChange = async (costCodeId: string | null) => {
    // Optimistic UI update so the selection sticks immediately
    setTransaction((prev: any) => ({ ...prev, cost_code_id: costCodeId }));
    setOpenPickers(prev => ({ ...prev, costCode: false }));

    try {
      await supabase
        .from("credit_card_transactions")
        .update({ cost_code_id: costCodeId })
        .eq("id", transactionId);
      await updateCodingStatus();
    } catch (e) {
      // revert on failure
      setTransaction((prev: any) => ({ ...prev, cost_code_id: null }));
    }
  };

  const handleVendorChange = async (vendorId: string | null) => {
    setSelectedVendorId(vendorId);
    
    await supabase
      .from("credit_card_transactions")
      .update({ 
        vendor_id: vendorId,
        merchant_name: vendorId ? vendors.find(v => v.id === vendorId)?.name : null
      })
      .eq("id", transactionId);

    setTransaction((prev: any) => ({ 
      ...prev, 
      vendor_id: vendorId,
      merchant_name: vendorId ? vendors.find(v => v.id === vendorId)?.name : null
    }));
    await updateCodingStatus();
  };

  const handleAttachmentUpload = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany?.id}/${transactionId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("credit-card-attachments")
        .upload(fileName, file, { upsert: true, contentType: file.type || undefined });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("credit-card-attachments")
        .getPublicUrl(fileName);

      // Optimistically show the preview immediately using the public URL
      setAttachmentPreview(publicUrl);

      await supabase
        .from("credit_card_transactions")
        .update({ attachment_url: publicUrl })
        .eq("id", transactionId);

      setTransaction((prev: any) => ({ ...prev, attachment_url: publicUrl }));
      await updateCodingStatus();

      toast({
        title: "Success",
        description: "Attachment uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      // Insert the message
      const { error } = await supabase
        .from("credit_card_transaction_communications")
        .insert({
          transaction_id: transactionId,
          company_id: currentCompany?.id,
          user_id: user?.id,
          message: newMessage.trim(),
        });

      if (error) throw error;

      // Refresh communications list (without FK join), then hydrate with profile names
      const { data: commsRaw } = await supabase
        .from("credit_card_transaction_communications")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });

      let comms = commsRaw || [];
      const userIds = Array.from(new Set((comms as any[]).map(c => c.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);
        const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
        comms = (comms as any[]).map(c => ({ ...c, user: profileMap.get(c.user_id) || null }));
      }

      setCommunications(comms as any[]);
      setNewMessage("");

      toast({
        title: "Success",
        description: "Message sent to all administrators, controllers, and assigned coders",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMarkComplete = async () => {
    try {
      await supabase
        .from("credit_card_coding_requests")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("transaction_id", transactionId);

      toast({
        title: "Success",
        description: "Coding request completed",
      });

      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRequestCoding = async () => {
    if (selectedCoders.length === 0) {
      toast({
        title: "No coders selected",
        description: "Please select at least one person to request coding assistance",
        variant: "destructive",
      });
      return;
    }

    try {
      // Delete existing requests
      await supabase
        .from("credit_card_coding_requests")
        .delete()
        .eq("transaction_id", transactionId);

      // Create new requests
      const requests = selectedCoders.map(coderId => ({
        transaction_id: transactionId,
        company_id: currentCompany?.id,
        requested_by: user?.id,
        requested_coder_id: coderId,
        status: "pending",
      }));

      const { error } = await supabase
        .from("credit_card_coding_requests")
        .insert(requests);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Coding assistance requested",
      });

      fetchData();
      setCodingRequestDropdownOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleCoderSelection = (userId: string) => {
    setSelectedCoders(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleAllCoders = () => {
    if (selectedCoders.length === users.length) {
      setSelectedCoders([]);
    } else {
      setSelectedCoders(users.map(u => u.user_id));
    }
  };

  const filteredCostCodes = () => {
    if (!isJobSelected) return [];
    return [...jobCostCodes]
      .filter(Boolean)
      .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  };
  const getCostCodeCategoryBadge = (type: string) => {
    const labels: Record<string, string> = {
      labor: "Labor",
      material: "Material",
      equipment: "Equipment",
      subcontractor: "Sub",
      other: "Other",
    };
    return labels[type] || labels.other;
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!transaction) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Code Transaction</DialogTitle>
          <DialogDescription>
            Set vendor, select a Job or a Chart of Accounts (expense). If a Job is selected, a Cost Code is required.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Transaction Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <Label className="text-sm text-muted-foreground">Date</Label>
              <p className="font-medium">
                {new Date(transaction.transaction_date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Amount</Label>
              <p className="text-lg font-semibold">
                ${Number(transaction.amount).toLocaleString()}
              </p>
            </div>
            <div className="col-span-2">
              <Label className="text-sm text-muted-foreground">Description</Label>
              <p className="font-medium">{transaction.description}</p>
            </div>
            {requestedUsers.length > 0 && (
              <div className="col-span-2">
                <Label className="text-sm text-muted-foreground">Requested Coders</Label>
                <div className="flex gap-1 flex-wrap mt-1">
                  {requestedUsers.map((u: any) => (
                    <Badge key={u.user_id} variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                      {u.first_name} {u.last_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Vendor Selection */}
          <div>
            <Label>Vendor *</Label>
            <Select
              value={(selectedVendorId || undefined) as unknown as string}
              onValueChange={(value) => handleVendorChange(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select vendor" />
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

          {/* Job/Control Selection */}
          <div>
            <Label>Job/Control *</Label>
            <Popover 
              open={openPickers.jobControl} 
              onOpenChange={(open) => setOpenPickers({ ...openPickers, jobControl: open })}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedJobOrAccount 
                    ? (() => {
                        const [type, id] = selectedJobOrAccount.split("_");
                        if (type === "job") {
                          const job = jobs.find(j => j.id === id);
                          return job?.name || 'Select job or expense account';
                        } else {
                          const account = expenseAccounts.find(a => a.id === id);
                          return account ? `${account.account_number} - ${account.account_name}` : 'Select job or expense account';
                        }
                      })()
                    : 'Select job or expense account'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0 z-50">
                <Command>
                  <CommandInput placeholder="Search jobs or accounts..." />
                  <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    {jobs.length > 0 && (
                      <CommandGroup heading="Jobs">
                        {jobs.map((job) => (
                          <CommandItem
                            key={`job_${job.id}`}
                            value={job.name}
                            onSelect={() => handleJobOrAccountChange(`job_${job.id}`)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedJobOrAccount === `job_${job.id}` ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {job.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {jobs.length > 0 && expenseAccounts.length > 0 && <CommandSeparator />}
                    {expenseAccounts.length > 0 && (
                      <CommandGroup heading="Expense Accounts">
                        {expenseAccounts.map((account) => (
                          <CommandItem
                            key={`account_${account.id}`}
                            value={`${account.account_number} ${account.account_name}`}
                            onSelect={() => handleJobOrAccountChange(`account_${account.id}`)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedJobOrAccount === `account_${account.id}` ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {account.account_number} - {account.account_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Cost Code Selection - only shown for jobs */}
          {isJobSelected && (
            <div>
              <Label>Cost Code *</Label>
              <Popover 
                open={openPickers.costCode} 
                onOpenChange={(open) => setOpenPickers({ ...openPickers, costCode: open })}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {transaction.cost_code_id 
                      ? (() => {
                          const ccSel = jobCostCodes.find((c:any) => c.id === transaction.cost_code_id) 
                            || costCodes.find((c:any) => c.id === transaction.cost_code_id);
                          return ccSel ? `${ccSel.code} - ${ccSel.description}` : 'Select cost code';
                        })()
                      : 'Select cost code'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                 <PopoverContent className="w-[400px] p-0 z-50">
                  <Command>
                    <CommandInput placeholder="Search cost codes..." />
                    <CommandList>
                      <CommandEmpty>No cost codes found.</CommandEmpty>
                      <CommandGroup>
                        {filteredCostCodes().map((cc) => (
                          <CommandItem
                            key={cc.id}
                            value={`${cc.code} ${cc.description}`}
                            onSelect={() => handleCostCodeChange(cc.id)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                transaction.cost_code_id === cc.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="flex-1">{cc.code} - {cc.description}</span>
                            <Badge variant="secondary" className="ml-2">{getCostCodeCategoryBadge(cc.type)}</Badge>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Request Coding Assistance */}
          <div>
            <Label>Request Coding Assistance</Label>
            <Select
              open={codingRequestDropdownOpen}
              onOpenChange={setCodingRequestDropdownOpen}
            >
              <SelectTrigger>
                <SelectValue>
                  {selectedCoders.length === 0
                    ? "Select users to request assistance"
                    : `${selectedCoders.length} user${selectedCoders.length > 1 ? 's' : ''} selected`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <div className="p-2 space-y-2">
                  <div className="flex items-center space-x-2 pb-2 border-b">
                    <Checkbox
                      checked={selectedCoders.length === users.length && users.length > 0}
                      onCheckedChange={toggleAllCoders}
                      id="select-all"
                    />
                    <label htmlFor="select-all" className="text-sm font-semibold cursor-pointer">
                      Select All
                    </label>
                  </div>
                  {users.map((user) => (
                    <div key={user.user_id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={selectedCoders.includes(user.user_id)}
                        onCheckedChange={() => toggleCoderSelection(user.user_id)}
                        id={`coder-${user.user_id}`}
                      />
                      <label
                        htmlFor={`coder-${user.user_id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {user.first_name} {user.last_name}
                        <span className="text-xs text-muted-foreground ml-2">({user.role})</span>
                      </label>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No users available
                    </p>
                  )}
                </div>
                <div className="border-t p-2">
                  <Button
                    onClick={handleRequestCoding}
                    size="sm"
                    className="w-full"
                    disabled={selectedCoders.length === 0}
                  >
                    Send Request
                  </Button>
                </div>
              </SelectContent>
            </Select>
          </div>

          {/* Attachment */}
          <div>
            <Label>Attachment *</Label>
            {(transaction.attachment_url || attachmentPreview) ? (
              <div className="space-y-3 mt-2">
                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                  >
                    <a href={(attachmentPreview || transaction.attachment_url) as string} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-4 w-4 mr-2" />
                      View Full Size
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      supabase
                        .from("credit_card_transactions")
                        .update({ attachment_url: null })
                        .eq("id", transactionId)
                        .then(() => {
                          setTransaction((prev: any) => ({ ...prev, attachment_url: null }));
                          setAttachmentPreview(null);
                          updateCodingStatus();
                        });
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>

                { (attachmentPreview || transaction.attachment_url) && (
                  <div key={(attachmentPreview || transaction.attachment_url) as string} className="border rounded-lg overflow-hidden bg-muted">
                    {String(attachmentPreview || transaction.attachment_url).toLowerCase().includes('.pdf') ? (
                      <iframe
                        src={(attachmentPreview || transaction.attachment_url) as string}
                        className="w-full h-[480px] border-0 bg-background"
                        title="Attachment Preview"
                      />
                    ) : (
                      <img
                        src={(attachmentPreview || transaction.attachment_url) as string}
                        alt="Attachment preview"
                        className="w-full h-auto max-h-96 object-contain"
                      />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAttachmentUpload(file);
                  }}
                />
                <Button size="sm" variant="outline" asChild className="mt-2">
                  <span>
                    <Paperclip className="h-4 w-4 mr-2" />
                    Upload Attachment
                  </span>
                </Button>
              </label>
            )}
          </div>

          {/* Communication Section */}
          <div className="border-t pt-6">
            <Label className="text-lg font-semibold">Discussion</Label>
            <div className="mt-3 space-y-3 max-h-64 overflow-y-auto border rounded-lg p-3 bg-muted/30">
              {communications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No messages yet. Start the discussion below.
                </p>
              ) : (
                communications.map((comm: any) => (
                  <div key={comm.id} className="bg-background p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">
                        {comm.user?.first_name} {comm.user?.last_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comm.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{comm.message}</p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="resize-none"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                size="sm"
              >
                Send
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleMarkComplete}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
