import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Edit,
  Loader2, 
  Wrench, 
  Hammer, 
  Users, 
  Truck, 
  Package, 
  Search,
  Link,
  Building
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CostCode {
  id: string;
  code: string;
  description: string;
  type: 'material' | 'labor' | 'sub' | 'equipment' | 'other';
  is_active: boolean;
  job_id?: string | null;
  chart_account_id?: string | null;
  chart_account_number?: string | null;
}

interface Job {
  id: string;
  name: string;
  job_number?: string;
}

interface ChartAccount {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
}

export default function JobCostManagement() {
  const { toast } = useToast();
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterJob, setFilterJob] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<CostCode | null>(null);

  const [newCode, setNewCode] = useState<{
    code: string;
    description: string;
    type: 'material' | 'labor' | 'sub' | 'equipment' | 'other';
    job_id?: string;
    chart_account_id?: string;
    chart_account_number?: string;
  }>({
    code: "",
    description: "",
    type: "other"
  });

  const costTypeOptions = [
    { value: 'material', label: 'Material', icon: Package, color: 'bg-blue-100 text-blue-800' },
    { value: 'labor', label: 'Labor', icon: Users, color: 'bg-green-100 text-green-800' },
    { value: 'sub', label: 'Subcontractor', icon: Hammer, color: 'bg-purple-100 text-purple-800' },
    { value: 'equipment', label: 'Equipment', icon: Truck, color: 'bg-orange-100 text-orange-800' },
    { value: 'other', label: 'Other', icon: Wrench, color: 'bg-gray-100 text-gray-800' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load cost codes with chart account info
      const { data: costCodesData, error: costCodesError } = await supabase
        .from('cost_codes')
        .select(`
          *,
          chart_of_accounts:chart_account_id (
            account_number,
            account_name
          )
        `)
        .eq('is_active', true)
        .eq('is_dynamic_group', false)
        .neq('type', 'dynamic_group')
        .neq('type', 'dynamic_parent')
        .order('code');

      if (costCodesError) throw costCodesError;

      const transformedCostCodes = (costCodesData || [])
        .filter((code: any) => code.is_dynamic_group === false && code.type !== 'dynamic_group' && code.type !== 'dynamic_parent' && !/^\d+\.0$/.test(code.code))
        .map((code: any) => ({
          id: code.id,
          code: code.code,
          description: code.description,
          type: (['material','labor','sub','equipment','other'].includes((code.type || 'other') as string) ? (code.type || 'other') : 'other') as CostCode['type'],
          is_active: code.is_active,
          job_id: code.job_id,
          chart_account_id: code.chart_account_id || null,
          chart_account_number: code.chart_of_accounts?.account_number || code.chart_account_number || null
        }));

      setCostCodes(transformedCostCodes as CostCode[]);

      // Load jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('id, name')
        .order('name');

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);

      // Load chart of accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('chart_of_accounts')
        .select('id, account_number, account_name, account_type')
        .eq('is_active', true)
        .in('account_type', ['expense', 'cost_of_goods_sold'])
        .order('account_number');

      if (accountsError) throw accountsError;
      setChartAccounts(accountsData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load job cost data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCode = async () => {
    if (!newCode.code || !newCode.description) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const insertData: any = {
        code: newCode.code,
        description: newCode.description,
        type: newCode.type,
        is_active: true,
        job_id: newCode.job_id || null,
        chart_account_id: newCode.chart_account_id || null,
        chart_account_number: newCode.chart_account_number || null
      };

      const { error } = await supabase
        .from('cost_codes')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Cost Code Added",
        description: "Job cost code has been added successfully",
      });

      setNewCode({
        code: "",
        description: "",
        type: "other"
      });
      setAddDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error adding cost code:', error);
      toast({
        title: "Error",
        description: "Failed to add cost code",
        variant: "destructive",
      });
    }
  };

  const handleEditCode = async () => {
    if (!editingCode) return;

    try {
      const { error } = await supabase
        .from('cost_codes')
        .update({
          code: editingCode.code,
          description: editingCode.description,
          type: editingCode.type,
          job_id: editingCode.job_id || null,
          chart_account_id: editingCode.chart_account_id || null,
          chart_account_number: editingCode.chart_account_number || null
        })
        .eq('id', editingCode.id);

      if (error) throw error;

      toast({
        title: "Cost Code Updated",
        description: "Job cost code has been updated successfully",
      });

      setEditDialogOpen(false);
      setEditingCode(null);
      loadData();
    } catch (error) {
      console.error('Error updating cost code:', error);
      toast({
        title: "Error",
        description: "Failed to update cost code",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    try {
      const { error } = await supabase
        .from('cost_codes')
        .update({ is_active: false })
        .eq('id', codeId);

      if (error) throw error;

      toast({
        title: "Cost Code Deactivated",
        description: "Job cost code has been deactivated",
      });

      loadData();
    } catch (error) {
      console.error('Error deactivating cost code:', error);
      toast({
        title: "Error",
        description: "Failed to deactivate cost code",
        variant: "destructive",
      });
    }
  };

  const getCostTypeIcon = (type: string) => {
    const typeOption = costTypeOptions.find(option => option.value === type);
    return typeOption ? <typeOption.icon className="h-4 w-4" /> : <FileText className="h-4 w-4" />;
  };

  const getCostTypeColor = (type: string) => {
    const typeOption = costTypeOptions.find(option => option.value === type);
    return typeOption ? typeOption.color : 'bg-gray-100 text-gray-800';
  };

  const filteredCostCodes = costCodes.filter(code => {
    const matchesSearch = code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         code.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesJob = filterJob === 'all' || code.job_id === filterJob;
    const matchesType = filterType === 'all' || code.type === filterType;
    return matchesSearch && matchesJob && matchesType;
  });

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading job cost data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Job Cost Management</h1>
          <p className="text-muted-foreground">Manage job cost codes and their chart of account associations</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Cost Code
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Cost Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={newCode.code}
                    onChange={(e) => setNewCode({ ...newCode, code: e.target.value })}
                    placeholder="e.g., 01-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={newCode.type} onValueChange={(value: any) => setNewCode({ ...newCode, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {costTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center space-x-2">
                            <option.icon className="h-4 w-4" />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={newCode.description}
                  onChange={(e) => setNewCode({ ...newCode, description: e.target.value })}
                  placeholder="Enter description"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job">Job (Optional)</Label>
                <Select value={newCode.job_id || undefined} onValueChange={(value) => setNewCode({ ...newCode, job_id: value || undefined })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job (or leave blank for all jobs)" />
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
                <Label htmlFor="chart_account">Chart of Account</Label>
                <Select value={newCode.chart_account_id || ''} onValueChange={(value) => {
                  const selectedAccount = chartAccounts.find(acc => acc.id === value);
                  setNewCode({ 
                    ...newCode, 
                    chart_account_id: value || undefined,
                    chart_account_number: selectedAccount?.account_number || undefined
                  });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select chart account (Optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {chartAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.account_number} - {account.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCode}>
                  Add Cost Code
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search cost codes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterJob} onValueChange={setFilterJob}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by job" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {costTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cost Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Codes ({filteredCostCodes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Chart Account</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCostCodes.map((code) => (
                <TableRow key={code.id}>
                  <TableCell className="font-mono font-medium">{code.code}</TableCell>
                  <TableCell>{code.description}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getCostTypeColor(code.type)}>
                      <span className="flex items-center space-x-1">
                        {getCostTypeIcon(code.type)}
                        <span>{costTypeOptions.find(t => t.value === code.type)?.label}</span>
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {code.job_id ? (
                      <Badge variant="outline">
                        <Building className="h-3 w-3 mr-1" />
                        {jobs.find(j => j.id === code.job_id)?.name || 'Unknown Job'}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">General</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {code.chart_account_number ? (
                      <Badge variant="outline">
                        <Link className="h-3 w-3 mr-1" />
                        {code.chart_account_number}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingCode(code);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deactivate Cost Code</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to deactivate this cost code? This action will hide it from active lists but preserve historical data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteCode(code.id)}>
                              Deactivate
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredCostCodes.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No cost codes found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingCode && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Cost Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_code">Code</Label>
                  <Input
                    id="edit_code"
                    value={editingCode.code}
                    onChange={(e) => setEditingCode({ ...editingCode, code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_type">Type</Label>
                  <Select value={editingCode.type} onValueChange={(value: any) => setEditingCode({ ...editingCode, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {costTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center space-x-2">
                            <option.icon className="h-4 w-4" />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_description">Description</Label>
                <Textarea
                  id="edit_description"
                  value={editingCode.description}
                  onChange={(e) => setEditingCode({ ...editingCode, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_job">Job</Label>
                <Select value={editingCode.job_id || undefined} onValueChange={(value) => setEditingCode({ ...editingCode, job_id: value || null })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job (or leave blank for all jobs)" />
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
                <Label htmlFor="edit_chart_account">Chart of Account</Label>
                <Select value={editingCode.chart_account_id || ''} onValueChange={(value) => {
                  const selectedAccount = chartAccounts.find(acc => acc.id === value);
                  setEditingCode({ 
                    ...editingCode, 
                    chart_account_id: value || null,
                    chart_account_number: selectedAccount?.account_number || null
                  });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select chart account (Optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {chartAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.account_number} - {account.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditCode}>
                  Update Cost Code
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}