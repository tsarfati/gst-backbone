import React, { useState, useEffect, useMemo } from 'react';
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
import { Checkbox } from "@/components/ui/checkbox";
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
  ,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import Papa from "papaparse";
import DragDropUpload from "@/components/DragDropUpload";

interface CostCode {
  id: string;
  code: string;
  description: string;
  type: 'material' | 'labor' | 'sub' | 'equipment' | 'other';
  is_active: boolean;
  job_id?: string | null;
  chart_account_id?: string | null;
  chart_account_number?: string | null;
  require_attachment?: boolean;
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
  const [sortBy, setSortBy] = useState<'code' | 'description' | 'type' | 'require_attachment'>('code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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
        job_id: null, // General cost code template
        require_attachment: true
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
      // Get the original cost code to find all related codes with the same code pattern
      const { data: originalCode } = await supabase
        .from('cost_codes')
        .select('code')
        .eq('id', editingCode.id)
        .single();

      const updateData: any = {
        code: editingCode.code,
        description: editingCode.description,
        type: editingCode.type,
      };

      // Update all cost codes with the same original code in this company
      // This propagates the change to both templates (job_id IS NULL) and job-specific codes
      const { error } = await supabase
        .from('cost_codes')
        .update(updateData)
        .eq('company_id', currentCompany?.id)
        .eq('code', originalCode?.code || editingCode.code);

      if (error) throw error;

      toast({
        title: "Cost Code Updated",
        description: "Cost code has been updated across all jobs",
      });

      setEditingCode(null);
      setEditTemplateDialogOpen(false);
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

  const sortedCostCodes = useMemo(() => {
    const sorted = [...filteredCostCodes];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'code':
          comparison = a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
          break;
        case 'description':
          comparison = a.description.localeCompare(b.description, undefined, { sensitivity: 'base' });
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type, undefined, { sensitivity: 'base' });
          break;
        case 'require_attachment': {
          const aValue = a.require_attachment ?? true;
          const bValue = b.require_attachment ?? true;
          comparison = Number(aValue) - Number(bValue);
          break;
        }
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredCostCodes, sortBy, sortDirection]);

  const setSort = (column: 'code' | 'description' | 'type' | 'require_attachment') => {
    if (sortBy === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(column);
    setSortDirection('asc');
  };

  const renderSortIcon = (column: 'code' | 'description' | 'type' | 'require_attachment') => {
    if (sortBy !== column) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-foreground" />
      : <ArrowDown className="h-3.5 w-3.5 text-foreground" />;
  };

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
      if (!currentCompany?.id) {
        toast({ title: "No company selected", description: "Select a company before importing cost codes", variant: "destructive" });
        return;
      }
      const allowed = ['material','labor','sub','equipment','other'] as const;
      type AllowedType = typeof allowed[number];
      let costCodesToProcess: Array<{ code: string; description: string; type: AllowedType; company_id: string; is_active: boolean; job_id: null }> = [];

      await new Promise<void>((resolve, reject) => {
        Papa.parse<Record<string, string>>(csvFile, {
          header: true,
          skipEmptyLines: 'greedy',
          complete: (results) => {
            costCodesToProcess = (results.data || [])
              .map((r) => ({
                code: (r.code || '').trim(),
                description: (r.description || '').trim(),
                type: ((r.type || 'other').trim().toLowerCase())
              }))
              .filter(r => r.code && r.description)
              .map(r => ({
                code: r.code,
                description: r.description,
                type: allowed.includes(r.type) ? r.type : 'other',
                company_id: currentCompany?.id,
                is_active: true,
                job_id: null
              }));
            resolve();
          },
          error: (err) => reject(err)
        });
      });

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

  const downloadCsiStarterCsv = () => {
    const csiStarterRows = [
      ["code", "description", "type"],
      ["01.10", "Summary", "other"],
      ["01.20", "Price and Payment Procedures", "other"],
      ["01.30", "Administrative Requirements", "other"],
      ["01.50", "Temporary Facilities and Controls", "other"],
      ["01.70", "Execution and Closeout Requirements", "other"],
      ["02.20", "Site Demolition", "other"],
      ["03.30", "Cast-in-Place Concrete", "material"],
      ["04.20", "Unit Masonry", "material"],
      ["05.10", "Structural Metal Framing", "material"],
      ["06.10", "Rough Carpentry", "labor"],
      ["07.20", "Thermal Protection", "material"],
      ["07.50", "Membrane Roofing", "sub"],
      ["08.10", "Doors and Frames", "material"],
      ["08.80", "Glazing", "sub"],
      ["09.20", "Plaster and Gypsum Board", "labor"],
      ["09.90", "Painting and Coating", "sub"],
      ["10.20", "Interior Specialties", "material"],
      ["11.40", "Foodservice Equipment", "equipment"],
      ["12.30", "Casework", "material"],
      ["13.30", "Special Structures", "sub"],
      ["14.20", "Elevators", "equipment"],
      ["21.10", "Fire Suppression", "sub"],
      ["22.10", "Plumbing Piping", "sub"],
      ["23.00", "HVAC", "sub"],
      ["26.00", "Electrical", "sub"],
      ["27.00", "Communications", "sub"],
      ["28.00", "Electronic Safety and Security", "sub"],
      ["31.20", "Earth Moving", "equipment"],
      ["32.10", "Paving", "sub"],
      ["33.10", "Utilities", "sub"],
    ];

    const csvContent = csiStarterRows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "csi_masterformat_cost_codes_starter.csv";
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
      <div className="p-4 md:p-6">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground"><span className="loading-dots">Loading job cost setup</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cost codes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

          <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Setup Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cost Code Setup Settings</DialogTitle>
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
                        <div className="flex items-start space-x-3 space-y-0 p-3 rounded-lg border bg-card hover:bg-primary/10 hover:border-primary transition-colors">
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
                        
                        <div className="flex items-start space-x-3 space-y-0 p-3 rounded-lg border bg-card hover:bg-primary/10 hover:border-primary transition-colors">
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
                        
                        <div className="flex items-start space-x-3 space-y-0 p-3 rounded-lg border bg-card hover:bg-primary/10 hover:border-primary transition-colors">
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
                  <DragDropUpload
                    onFileSelect={(file) => setCsvFile(file)}
                    accept=".csv"
                    maxSize={10}
                    size="compact"
                    title="Drop cost code template CSV"
                    subtitle="or click to choose CSV file"
                    helperText="Required columns: code, description, type"
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadCsiStarterCsv}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download CSI Starter List
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Required columns: code, description, type
                    <br />
                    Valid types: material, labor, sub, equipment, other
                  </p>
                  <p className="text-sm text-muted-foreground">
                    New to setup? Start with the CSI/MasterFormat starter list, edit it for your workflow, then upload it.
                    <br />
                    Reference:
                    {" "}
                    <a
                      href="https://www.csiresources.org/standards/masterformat"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      CSI MasterFormat overview and resources
                    </a>
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
                Add Cost Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Cost Code</DialogTitle>
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
                    Add Cost Code
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

      {/* Cost Code Templates Table */}
      <Card>
        <CardHeader>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="h-8">
                <TableHead className="py-0.5">
                  <Button type="button" variant="ghost" className="h-auto p-0 font-medium" onClick={() => setSort('code')}>
                    Code
                    <span className="ml-1.5">{renderSortIcon('code')}</span>
                  </Button>
                </TableHead>
                <TableHead className="py-0.5">
                  <Button type="button" variant="ghost" className="h-auto p-0 font-medium" onClick={() => setSort('description')}>
                    Description
                    <span className="ml-1.5">{renderSortIcon('description')}</span>
                  </Button>
                </TableHead>
                <TableHead className="py-0.5">
                  <Button type="button" variant="ghost" className="h-auto p-0 font-medium" onClick={() => setSort('type')}>
                    Type
                    <span className="ml-1.5">{renderSortIcon('type')}</span>
                  </Button>
                </TableHead>
                <TableHead className="text-center py-0.5">
                  <div className="flex justify-center">
                    <Button type="button" variant="ghost" className="h-auto p-0 font-medium" onClick={() => setSort('require_attachment')}>
                      Require Attachment
                      <span className="ml-1.5">{renderSortIcon('require_attachment')}</span>
                    </Button>
                  </div>
                </TableHead>
                <TableHead className="text-center py-0.5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCostCodes.map((code) => (
                <TableRow key={code.id} className="h-8">
                  <TableCell className="font-mono font-medium py-0.5">{code.code}</TableCell>
                  <TableCell className="py-0.5">{code.description}</TableCell>
                  <TableCell className="py-0.5">
                    <Badge variant="secondary" className={getCostTypeColor(code.type)}>
                      <span className="flex items-center space-x-1">
                        {getCostTypeIcon(code.type)}
                        <span>{costTypeOptions.find(t => t.value === code.type)?.label}</span>
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center py-0.5">
                    <Checkbox
                      checked={code.require_attachment ?? true}
                      onCheckedChange={async (checked) => {
                        const { error } = await supabase
                          .from('cost_codes')
                          .update({ require_attachment: !!checked })
                          .eq('id', code.id);
                        if (!error) {
                          setCostCodes(prev => prev.map(c => c.id === code.id ? { ...c, require_attachment: !!checked } : c));
                          toast({ title: 'Updated', description: 'Attachment requirement updated' });
                        } else {
                          toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-center py-0.5">
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
                            <AlertDialogTitle>Deactivate Cost Code</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to deactivate this cost code? This will prevent it from being used in new jobs.
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

          {sortedCostCodes.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No cost codes found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
