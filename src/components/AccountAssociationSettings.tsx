import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Code, CreditCard, Save, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

interface Job {
  id: string;
  name: string;
  client: string;
  revenue_account_id?: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
  job_id: string;
  chart_account_id?: string;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  chart_account_id?: string;
}

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
}

interface Association {
  id: string;
  association_type: string;
  job_id?: string;
  cost_code_id?: string;
  account_id: string;
}

export default function AccountAssociationSettings() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  
  // Selection states
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [selectedRevenueAccount, setSelectedRevenueAccount] = useState<string>('');
  const [selectedJobForCostCodes, setSelectedJobForCostCodes] = useState<string>('');
  const [selectedConstructionAccount, setSelectedConstructionAccount] = useState<string>('');
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
  const [selectedGLAccount, setSelectedGLAccount] = useState<string>('');

  useEffect(() => {
    if (currentCompany) {
      loadData();
    }
  }, [currentCompany]);

  const loadData = async () => {
    if (!currentCompany) return;
    
    try {
      setLoading(true);
      
      // Load all data in parallel
      const [jobsData, costCodesData, bankAccountsData, accountsData, associationsData] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, name, client, revenue_account_id')
          .eq('company_id', currentCompany.id),
        supabase
          .from('cost_codes')
          .select('id, code, description, job_id, chart_account_id')
          .eq('company_id', currentCompany.id)
          .eq('is_active', true),
        supabase
          .from('bank_accounts')
          .select('id, account_name, bank_name, chart_account_id')
          .eq('company_id', currentCompany.id)
          .eq('is_active', true),
        supabase
          .from('chart_of_accounts')
          .select('id, account_number, account_name, account_type')
          .eq('company_id', currentCompany.id)
          .eq('is_active', true)
          .order('account_number'),
        supabase
          .from('account_associations')
          .select('*')
          .eq('company_id', currentCompany.id)
      ]);

      if (jobsData.error) throw jobsData.error;
      if (costCodesData.error) throw costCodesData.error;
      if (bankAccountsData.error) throw bankAccountsData.error;
      if (accountsData.error) throw accountsData.error;
      if (associationsData.error) throw associationsData.error;

      setJobs(jobsData.data || []);
      setCostCodes(costCodesData.data || []);
      setBankAccounts(bankAccountsData.data || []);
      setAccounts(accountsData.data || []);
      setAssociations(associationsData.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load account association data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJobRevenueAssociation = async () => {
    if (!selectedJob || !selectedRevenueAccount || !currentCompany) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Update job revenue account directly
      const { error: jobError } = await supabase
        .from('jobs')
        .update({ revenue_account_id: selectedRevenueAccount })
        .eq('id', selectedJob);

      if (jobError) throw jobError;

      // Create/update association record
      const { error: assocError } = await supabase
        .from('account_associations')
        .upsert({
          company_id: currentCompany.id,
          association_type: 'job_revenue',
          job_id: selectedJob,
          account_id: selectedRevenueAccount,
          created_by: userData.user?.id
        });

      if (assocError) throw assocError;

      toast({
        title: "Association Created",
        description: "Job revenue account association has been saved",
      });

      setSelectedJob('');
      setSelectedRevenueAccount('');
      loadData();
    } catch (error) {
      console.error('Error creating job revenue association:', error);
      toast({
        title: "Error",
        description: "Failed to create job revenue association",
        variant: "destructive",
      });
    }
  };

  const handleCostCodeAssociation = async () => {
    if (!selectedJobForCostCodes || !selectedConstructionAccount || !currentCompany) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Get all cost codes for the selected job
      const { data: jobCostCodes, error: costCodesError } = await supabase
        .from('cost_codes')
        .select('id')
        .eq('job_id', selectedJobForCostCodes)
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (costCodesError) throw costCodesError;

      if (!jobCostCodes || jobCostCodes.length === 0) {
        toast({
          title: "No Cost Codes Found",
          description: "This job has no active cost codes to associate",
          variant: "destructive",
        });
        return;
      }

      // Update all cost codes for this job
      const { error: updateError } = await supabase
        .from('cost_codes')
        .update({ chart_account_id: selectedConstructionAccount })
        .eq('job_id', selectedJobForCostCodes)
        .eq('company_id', currentCompany.id);

      if (updateError) throw updateError;

      // Create individual association records for each cost code (required by constraint)
      const associationInserts = jobCostCodes.map(cc => ({
        company_id: currentCompany.id,
        association_type: 'cost_code_construction',
        cost_code_id: cc.id,
        account_id: selectedConstructionAccount,
        created_by: userData.user?.id
      }));

      // Delete existing associations for these cost codes first
      const { error: deleteError } = await supabase
        .from('account_associations')
        .delete()
        .in('cost_code_id', jobCostCodes.map(cc => cc.id));

      if (deleteError) console.error('Error deleting old associations:', deleteError);

      // Insert new associations
      const { error: assocError } = await supabase
        .from('account_associations')
        .insert(associationInserts);

      if (assocError) throw assocError;

      toast({
        title: "Associations Created",
        description: `${jobCostCodes.length} cost code(s) associated with the construction account`,
      });

      setSelectedJobForCostCodes('');
      setSelectedConstructionAccount('');
      loadData();
    } catch (error) {
      console.error('Error creating job cost codes association:', error);
      toast({
        title: "Error",
        description: "Failed to create job cost codes association",
        variant: "destructive",
      });
    }
  };

  const handleBankAccountAssociation = async () => {
    if (!selectedBankAccount || !selectedGLAccount) return;

    try {
      // Update bank account chart account
      const { error } = await supabase
        .from('bank_accounts')
        .update({ chart_account_id: selectedGLAccount })
        .eq('id', selectedBankAccount);

      if (error) throw error;

      toast({
        title: "Association Created",
        description: "Bank account GL association has been saved",
      });

      setSelectedBankAccount('');
      setSelectedGLAccount('');
      loadData();
    } catch (error) {
      console.error('Error creating bank account association:', error);
      toast({
        title: "Error",
        description: "Failed to create bank account association",
        variant: "destructive",
      });
    }
  };

  const removeAssociation = async (associationId: string, type: string) => {
    try {
      // Remove from association table
      const { error: assocError } = await supabase
        .from('account_associations')
        .delete()
        .eq('id', associationId);

      if (assocError) throw assocError;

      // Also clear the reference in the main table
      if (type === 'job_revenue') {
        const association = associations.find(a => a.id === associationId);
        if (association?.job_id) {
          await supabase
            .from('jobs')
            .update({ revenue_account_id: null })
            .eq('id', association.job_id);
        }
      } else if (type === 'cost_code_construction') {
        const association = associations.find(a => a.id === associationId);
        if (association?.cost_code_id) {
          await supabase
            .from('cost_codes')
            .update({ chart_account_id: null })
            .eq('id', association.cost_code_id);
        }
      }

      toast({
        title: "Association Removed",
        description: "Account association has been removed",
      });

      loadData();
    } catch (error) {
      console.error('Error removing association:', error);
      toast({
        title: "Error",
        description: "Failed to remove association",
        variant: "destructive",
      });
    }
  };

  const removeBankAssociation = async (bankAccountId: string) => {
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ chart_account_id: null })
        .eq('id', bankAccountId);

      if (error) throw error;

      toast({
        title: "Association Removed",
        description: "Bank account GL association has been removed",
      });

      loadData();
    } catch (error) {
      console.error('Error removing bank association:', error);
      toast({
        title: "Error",
        description: "Failed to remove bank association",
        variant: "destructive",
      });
    }
  };

  // Filter accounts by type
  const revenueAccounts = accounts.filter(acc => 
    acc.account_number >= '41000' && acc.account_number <= '49970'
  );
  const constructionAccounts = accounts.filter(acc => 
    acc.account_number >= '51000' && acc.account_number <= '59970'
  );
  const cashAccounts = accounts.filter(acc => acc.account_type === 'cash');

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Loading account associations...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Account Associations</h2>
        <p className="text-muted-foreground">Configure account associations for jobs, cost codes, and bank accounts</p>
      </div>

      <Tabs defaultValue="job-revenue" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="job-revenue" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Job Revenue
          </TabsTrigger>
          <TabsTrigger value="cost-codes" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Cost Codes
          </TabsTrigger>
          <TabsTrigger value="bank-accounts" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Bank Accounts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="job-revenue" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Available Revenue Accounts (41000-49970)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Number</TableHead>
                      <TableHead>Account Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono">{account.account_number}</TableCell>
                        <TableCell>{account.account_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Link Jobs to Revenue Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="job-select">Select Job</Label>
                  <Select value={selectedJob} onValueChange={setSelectedJob}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a job" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name} - {job.client}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="revenue-account-select">Revenue Account</Label>
                  <Select value={selectedRevenueAccount} onValueChange={setSelectedRevenueAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose revenue account" />
                    </SelectTrigger>
                    <SelectContent>
                      {revenueAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_number} - {account.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleJobRevenueAssociation}
                    disabled={!selectedJob || !selectedRevenueAccount}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Associate
                  </Button>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium mb-3">Current Job Revenue Associations</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Revenue Account</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.filter(job => job.revenue_account_id).map((job) => {
                      const account = accounts.find(acc => acc.id === job.revenue_account_id);
                      const association = associations.find(a => a.job_id === job.id && a.association_type === 'job_revenue');
                      return (
                        <TableRow key={job.id}>
                          <TableCell>{job.name} - {job.client}</TableCell>
                          <TableCell>
                            {account ? `${account.account_number} - ${account.account_name}` : 'Unknown Account'}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => association && removeAssociation(association.id, 'job_revenue')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost-codes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Available Construction Accounts (51000-59970)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Number</TableHead>
                      <TableHead>Account Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {constructionAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono">{account.account_number}</TableCell>
                        <TableCell>{account.account_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Link Job Cost Codes to Construction Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="job-for-cost-codes-select">Select Job</Label>
                  <Select value={selectedJobForCostCodes} onValueChange={setSelectedJobForCostCodes}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a job" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name} - {job.client}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="construction-account-select">Construction Account</Label>
                  <Select value={selectedConstructionAccount} onValueChange={setSelectedConstructionAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose construction account" />
                    </SelectTrigger>
                    <SelectContent>
                      {constructionAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_number} - {account.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleCostCodeAssociation}
                    disabled={!selectedJobForCostCodes || !selectedConstructionAccount}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Associate All Cost Codes
                  </Button>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium mb-3">Current Job Cost Code Associations</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Construction Account</TableHead>
                      <TableHead>Cost Codes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs
                      .filter(job => costCodes.some(cc => cc.job_id === job.id && cc.chart_account_id))
                      .map((job) => {
                        const jobCostCodes = costCodes.filter(cc => cc.job_id === job.id && cc.chart_account_id);
                        const accountId = jobCostCodes[0]?.chart_account_id;
                        const account = accounts.find(acc => acc.id === accountId);
                        return (
                          <TableRow key={job.id}>
                            <TableCell>{job.name} - {job.client}</TableCell>
                            <TableCell>
                              {account ? `${account.account_number} - ${account.account_name}` : 'Unknown Account'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{jobCostCodes.length} cost code(s)</Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={async () => {
                                  // Delete all associations for this job's cost codes
                                  const costCodeIds = jobCostCodes.map(cc => cc.id);
                                  await supabase
                                    .from('account_associations')
                                    .delete()
                                    .in('cost_code_id', costCodeIds);
                                  
                                  // Clear chart_account_id for these cost codes
                                  await supabase
                                    .from('cost_codes')
                                    .update({ chart_account_id: null })
                                    .in('id', costCodeIds);
                                  
                                  toast({
                                    title: "Associations Removed",
                                    description: "Cost code associations have been removed",
                                  });
                                  loadData();
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank-accounts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Available Cash Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Number</TableHead>
                      <TableHead>Account Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono">{account.account_number}</TableCell>
                        <TableCell>{account.account_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Link Bank Accounts to GL Cash Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="bank-account-select">Select Bank Account</Label>
                  <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((bankAccount) => (
                        <SelectItem key={bankAccount.id} value={bankAccount.id}>
                          {bankAccount.account_name} - {bankAccount.bank_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="gl-account-select">GL Cash Account</Label>
                  <Select value={selectedGLAccount} onValueChange={setSelectedGLAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose GL cash account" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_number} - {account.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleBankAccountAssociation}
                    disabled={!selectedBankAccount || !selectedGLAccount}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Associate
                  </Button>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium mb-3">Current Bank Account Associations</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank Account</TableHead>
                      <TableHead>GL Cash Account</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bankAccounts.filter(ba => ba.chart_account_id).map((bankAccount) => {
                      const account = accounts.find(acc => acc.id === bankAccount.chart_account_id);
                      return (
                        <TableRow key={bankAccount.id}>
                          <TableCell>{bankAccount.account_name} - {bankAccount.bank_name}</TableCell>
                          <TableCell>
                            {account ? `${account.account_number} - ${account.account_name}` : 'Unknown Account'}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeBankAssociation(bankAccount.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}