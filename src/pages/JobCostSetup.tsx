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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  Building,
  Settings,
  DollarSign,
  Calculator,
  Upload,
  Download
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

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

interface CostCodeTemplate {
  id: string;
  code: string;
  description: string;
  type: string;
  is_default: boolean;
}

export default function JobCostSetup() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodeTemplates, setCostCodeTemplates] = useState<CostCodeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [addTemplateDialogOpen, setAddTemplateDialogOpen] = useState(false);
  const [editTemplateDialogOpen, setEditTemplateDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [csvUploadDialogOpen, setCsvUploadDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [editingCode, setEditingCode] = useState<CostCode | null>(null);
  
  // Settings state
  const [autoCreateCostCodes, setAutoCreateCostCodes] = useState(true);
  const [csvUploadMode, setCsvUploadMode] = useState<'replace' | 'add' | 'update'>('add');

  const [newTemplate, setNewTemplate] = useState<{
    code: string;
    description: string;
    type: 'material' | 'labor' | 'sub' | 'equipment' | 'other';
    is_default: boolean;
  }>({
    code: "",
    description: "",
    type: "other",
    is_default: false
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
  }, [currentCompany?.id]);

  const loadData = async () => {
    if (!currentCompany?.id) {
      setLoading(false);
      return;
    }
    
    try {
      // Load general cost codes (not job-specific) for current company - ALL codes
      const { data: costCodesData, error: costCodesError } = await supabase
        .from('cost_codes')
        .select('*')
        .is('job_id', null)
        .eq('company_id', currentCompany?.id)
        .eq('is_active', true)
        .eq('is_dynamic_group', false)
        .order('code');

      if (costCodesError) throw costCodesError;
      setCostCodes((costCodesData || []) as CostCode[]);

      // Load jobs for current company
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('id, name')
        .eq('company_id', currentCompany?.id)
        .order('name');

      if (jobsError) throw jobsError;
      setJobs(jobsData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error", 
        description: "Failed to load job cost setup data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.code || !newTemplate.description) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const insertData: any = {
        code: newTemplate.code,
        description: newTemplate.description,
        type: newTemplate.type,
        company_id: currentCompany?.id,
        is_active: true,
        job_id: null // General cost code template
      };

      const { error } = await supabase
        .from('cost_codes')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Cost Code Template Added",
        description: "General cost code template has been added successfully",
      });

      setNewTemplate({
        code: "",
        description: "",
        type: "other",
        is_default: false
      });
      setAddTemplateDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error adding cost code template:', error);
      toast({
        title: "Error",
        description: "Failed to add cost code template",
        variant: "destructive",
      });
    }
  };

  const handleEditTemplate = async () => {
    if (!editingCode || !editingCode.code || !editingCode.description) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const updateData: any = {
        code: editingCode.code,
        description: editingCode.description,
        type: editingCode.type,
      };

      const { error } = await supabase
        .from('cost_codes')
        .update(updateData)
        .eq('id', editingCode.id);

      if (error) throw error;

      toast({
        title: "Cost Code Template Updated",
        description: "Cost code template has been updated successfully",
      });

      setEditingCode(null);
      setEditTemplateDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error updating cost code template:', error);
      toast({
        title: "Error",
        description: "Failed to update cost code template",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (codeId: string) => {
    try {
      const { error } = await supabase
        .from('cost_codes')
        .update({ is_active: false })
        .eq('id', codeId);

      if (error) throw error;

      toast({
        title: "Cost Code Template Deactivated",
        description: "Cost code template has been deactivated",
      });

      loadData();
    } catch (error) {
      console.error('Error deactivating cost code template:', error);
      toast({
        title: "Error",
        description: "Failed to deactivate cost code template",
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
    const matchesType = filterType === 'all' || code.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload",
        variant: "destructive",
      });
      return;
    }

    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Validate headers
      const requiredHeaders = ['code', 'description', 'type'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        toast({
          title: "Invalid CSV format",
          description: `Missing required columns: ${missingHeaders.join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      const costCodesToProcess = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const costCode: any = {};
        
        headers.forEach((header, index) => {
          costCode[header] = values[index];
        });

        if (costCode.code && costCode.description && costCode.type) {
          costCodesToProcess.push({
            code: costCode.code,
            description: costCode.description,
            type: costCode.type,
            company_id: currentCompany?.id,
            is_active: true,
            job_id: null // General cost code template
          });
        }
      }

      if (costCodesToProcess.length > 0) {
        // Handle different upload modes
        if (csvUploadMode === 'replace') {
          // Replace: Deactivate all existing cost codes, then insert new ones
          const { error: deactivateError } = await supabase
            .from('cost_codes')
            .update({ is_active: false })
            .is('job_id', null)
            .eq('company_id', currentCompany?.id);

          if (deactivateError) throw deactivateError;

          const { error: insertError } = await supabase
            .from('cost_codes')
            .insert(costCodesToProcess);

          if (insertError) throw insertError;

          toast({
            title: "Cost Codes Replaced",
            description: `All existing cost codes deactivated and ${costCodesToProcess.length} new cost codes imported`,
          });
        } else if (csvUploadMode === 'add') {
          // Add: Insert new cost codes (ignore duplicates)
          const { error } = await supabase
            .from('cost_codes')
            .insert(costCodesToProcess);

          if (error) throw error;

          toast({
            title: "Cost Codes Added",
            description: `${costCodesToProcess.length} new cost code templates added`,
          });
        } else if (csvUploadMode === 'update') {
          // Update: Update existing cost codes based on code, insert new ones
          let updatedCount = 0;
          let insertedCount = 0;

          for (const costCode of costCodesToProcess) {
            // Check if cost code exists
            const { data: existing, error: selectError } = await supabase
              .from('cost_codes')
              .select('id')
              .eq('code', costCode.code)
              .is('job_id', null)
              .eq('company_id', currentCompany?.id)
              .maybeSingle();

            if (selectError) {
              console.error('Error checking for existing cost code:', selectError);
              continue;
            }

            if (existing) {
              // Update existing
              const { error } = await supabase
                .from('cost_codes')
                .update({
                  description: costCode.description,
                  type: costCode.type,
                  is_active: true
                })
                .eq('id', existing.id);

              if (!error) updatedCount++;
            } else {
              // Insert new
              const { error } = await supabase
                .from('cost_codes')
                .insert(costCode);

              if (!error) insertedCount++;
            }
          }

          toast({
            title: "Cost Codes Updated",
            description: `${updatedCount} cost codes updated, ${insertedCount} new cost codes added`,
          });
        }

        setCsvUploadDialogOpen(false);
        setCsvFile(null);
        loadData();
      }
    } catch (error) {
      console.error('Error uploading CSV:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload CSV file",
        variant: "destructive",
      });
    }
  };

  const downloadCsvTemplate = () => {
    const csvContent = "code,description,type\n1.01,TEMPORARY UTILITIES,other\n1.02,PROJECT OFFICE,other";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cost_codes_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportCostCodesToCsv = async () => {
    try {
      if (!currentCompany?.id) return;

      // Fetch all cost codes for the current company
      const { data: costCodesData, error } = await supabase
        .from('cost_codes')
        .select('code, description, type')
        .is('job_id', null)
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;

      if (!costCodesData || costCodesData.length === 0) {
        toast({
          title: "No Data",
          description: "No cost codes found to export",
          variant: "destructive",
        });
        return;
      }

      // Create CSV content
      const headers = ['code', 'description', 'type'];
      const csvRows = [headers.join(',')];
      
      costCodesData.forEach(code => {
        const row = [
          code.code,
          `"${code.description.replace(/"/g, '""')}"`,
          code.type
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cost_codes_backup_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Exported ${costCodesData.length} cost codes to CSV`,
      });
    } catch (error) {
      console.error('Error exporting cost codes:', error);
      toast({
        title: "Export Error",
        description: "Failed to export cost codes",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading job cost setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Cost Code Templates</h2>
          <p className="text-muted-foreground">Configure cost code templates and job costing settings</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Setup Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Job Cost Setup Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-create cost codes for new jobs</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically create cost codes from templates when a new job is created
                      </p>
                    </div>
                    <Switch
                      checked={autoCreateCostCodes}
                      onCheckedChange={setAutoCreateCostCodes}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Backup Cost Codes</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Export all cost codes for this company to a CSV file
                    </p>
                    <Button
                      variant="outline"
                      onClick={exportCostCodesToCsv}
                      className="w-full"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Cost Codes to CSV
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label>CSV Upload Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose how CSV uploads should handle existing cost codes
                    </p>
                    <RadioGroup value={csvUploadMode} onValueChange={(value: any) => setCsvUploadMode(value)}>
                      <div className="space-y-3">
                        <div className="flex items-start space-x-3 space-y-0 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                          <RadioGroupItem value="add" id="mode-add" className="mt-1" />
                          <div className="space-y-1 flex-1">
                            <Label htmlFor="mode-add" className="font-medium cursor-pointer">
                              Add to Current List
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Adds new cost codes from CSV to your existing list. Duplicate codes will cause an error.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start space-x-3 space-y-0 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                          <RadioGroupItem value="update" id="mode-update" className="mt-1" />
                          <div className="space-y-1 flex-1">
                            <Label htmlFor="mode-update" className="font-medium cursor-pointer">
                              Update Current List
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Updates existing cost codes that match by code, and adds any new codes not found in your list.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start space-x-3 space-y-0 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                          <RadioGroupItem value="replace" id="mode-replace" className="mt-1" />
                          <div className="space-y-1 flex-1">
                            <Label htmlFor="mode-replace" className="font-medium cursor-pointer">
                              Replace Current List
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Deactivates all existing cost codes and replaces them completely with the codes from the CSV file.
                            </p>
                          </div>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => {
                    setSettingsDialogOpen(false);
                    toast({
                      title: "Settings Saved",
                      description: "Job cost setup settings have been saved",
                    });
                  }}>
                    Save Settings
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={csvUploadDialogOpen} onOpenChange={setCsvUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Cost Code Templates CSV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="csv-file">CSV File</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={downloadCsvTemplate}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Required columns: code, description, type
                    <br />
                    Valid types: material, labor, sub, equipment, other
                  </p>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setCsvUploadDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCsvUpload} disabled={!csvFile}>
                    Upload CSV
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={addTemplateDialogOpen} onOpenChange={setAddTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Cost Code Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Cost Code Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="template_code">Code *</Label>
                    <Input
                      id="template_code"
                      value={newTemplate.code}
                      onChange={(e) => setNewTemplate({ ...newTemplate, code: e.target.value })}
                      placeholder="e.g., MAT-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template_type">Type</Label>
                    <Select value={newTemplate.type} onValueChange={(value: any) => setNewTemplate({ ...newTemplate, type: value })}>
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
                  <Label htmlFor="template_description">Description *</Label>
                  <Textarea
                    id="template_description"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    placeholder="Enter description"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setAddTemplateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddTemplate}>
                    Add Template
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Template Dialog */}
          <Dialog open={editTemplateDialogOpen} onOpenChange={setEditTemplateDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Cost Code Template</DialogTitle>
              </DialogHeader>
              {editingCode && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_code">Code *</Label>
                      <Input
                        id="edit_code"
                        value={editingCode.code}
                        onChange={(e) => setEditingCode({ ...editingCode, code: e.target.value })}
                        placeholder="e.g., MAT-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_type">Type</Label>
                      <Select 
                        value={editingCode.type} 
                        onValueChange={(value: any) => setEditingCode({ ...editingCode, type: value })}
                      >
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
                    <Label htmlFor="edit_description">Description *</Label>
                    <Textarea
                      id="edit_description"
                      value={editingCode.description}
                      onChange={(e) => setEditingCode({ ...editingCode, description: e.target.value })}
                      placeholder="Enter description"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => {
                      setEditTemplateDialogOpen(false);
                      setEditingCode(null);
                    }}>
                      Cancel
                    </Button>
                    <Button onClick={handleEditTemplate}>
                      Save Changes
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* View Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Cost Code Templates ({filteredCostCodes.length})</h3>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">View:</label>
          <Select value="list" onValueChange={() => {}}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">List</SelectItem>
              <SelectItem value="compact">Compact List</SelectItem>
              <SelectItem value="very-compact">Very Compact List</SelectItem>
              <SelectItem value="default">Default View</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search cost code templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
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

      {/* Cost Code Templates Table */}
      <Card>
        <CardHeader>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
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
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingCode(code);
                          setEditTemplateDialogOpen(true);
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
                            <AlertDialogTitle>Deactivate Cost Code Template</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to deactivate this cost code template? This will prevent it from being used in new jobs.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTemplate(code.id)}>
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
              <p className="text-muted-foreground">No cost code templates found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}