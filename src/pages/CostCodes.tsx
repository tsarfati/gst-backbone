import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Trash2, Loader2, Wrench, Hammer, Users, Truck, Package, Upload, Download, FileSpreadsheet, Building, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";

interface CostCode {
  id: string;
  code: string;
  description: string;
  type: 'material' | 'labor' | 'sub' | 'equipment' | 'other' | 'dynamic_group' | 'dynamic_parent';
  is_active: boolean;
  job_id?: string | null;
  is_dynamic_group?: boolean;
}

export default function CostCodes() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [newCode, setNewCode] = useState<{
    code: string;
    description: string;
    type: 'material' | 'labor' | 'sub' | 'equipment' | 'other' | 'dynamic_group' | 'dynamic_parent';
  }>({
    code: "",
    description: "",
    type: "other"
  });

  const costTypeOptions = [
    { value: 'dynamic_group', label: 'Dynamic Group', icon: Building, color: 'bg-indigo-100 text-indigo-800' },
    { value: 'dynamic_parent', label: 'Dynamic Parent', icon: Calculator, color: 'bg-cyan-100 text-cyan-800' },
    { value: 'material', label: 'Material', icon: Package, color: 'bg-blue-100 text-blue-800' },
    { value: 'labor', label: 'Labor', icon: Users, color: 'bg-green-100 text-green-800' },
    { value: 'sub', label: 'Subcontractor', icon: Hammer, color: 'bg-purple-100 text-purple-800' },
    { value: 'equipment', label: 'Equipment', icon: Truck, color: 'bg-orange-100 text-orange-800' },
    { value: 'other', label: 'Other', icon: Wrench, color: 'bg-gray-100 text-gray-800' }
  ];

  useEffect(() => {
    loadCostCodes();
  }, []);

  const loadCostCodes = async () => {
    if (!currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('*')
        .eq('company_id', currentCompany.id)
        .is('job_id', null) // Only company-wide cost codes
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setCostCodes(data || []);
    } catch (error) {
      console.error('Error loading cost codes:', error);
      toast({
        title: "Error",
        description: "Failed to load cost codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCode = async () => {
    if (!newCode.code || !newCode.description) {
      toast({
        title: "Missing information",
        description: "Please fill in code and description",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cost_codes')
        .insert({
          code: newCode.code,
          description: newCode.description,
          type: newCode.type,
          company_id: currentCompany?.id || '',
          is_active: true,
          is_dynamic_group: newCode.type === 'dynamic_group',
          job_id: null // Company-wide cost code
        })
        .select()
        .single();

      if (error) throw error;

      setCostCodes(prev => [...prev, data]);
      setNewCode({ code: "", description: "", type: "other" });
      
      toast({
        title: "Cost code added",
        description: "New cost code has been added successfully",
      });
    } catch (error) {
      console.error('Error adding cost code:', error);
      toast({
        title: "Error",
        description: "Failed to add cost code",
        variant: "destructive",
      });
    }
  };

  const getTypeInfo = (type: string) => {
    return costTypeOptions.find(option => option.value === type) || costTypeOptions[4];
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Invalid CSV",
          description: "CSV must have at least a header row and one data row",
          variant: "destructive"
        });
        return;
      }

      // Parse CSV (expecting: code, description, type)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const preview = lines.slice(1, 6).map((line, index) => { // Show first 5 rows for preview
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        return {
          rowIndex: index + 2, // +2 because we skip header and array is 0-indexed
          code: values[0] || '',
          description: values[1] || '',
          type: values[2]?.toLowerCase() || 'other'
        };
      });

      setCsvPreview(preview);
      setCsvDialogOpen(true);
    };

    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    setCsvUploading(true);
    try {
      // Get full CSV data from the file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = fileInput?.files?.[0];
      
      if (!file) {
        toast({
          title: "Error",
          description: "No file selected",
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        const dataRows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          return {
            code: values[0] || '',
            description: values[1] || '',
            type: (['material', 'labor', 'sub', 'equipment', 'other'].includes(values[2]?.toLowerCase())) 
              ? values[2].toLowerCase() as 'material' | 'labor' | 'sub' | 'equipment' | 'other'
              : 'other' as const
          };
        }).filter(row => row.code && row.description); // Only include rows with code and description

        if (dataRows.length === 0) {
          toast({
            title: "No valid data",
            description: "No valid cost codes found in CSV",
            variant: "destructive"
          });
          return;
        }

        // Insert all cost codes
        const { error } = await supabase
          .from('cost_codes')
          .insert(dataRows.map(row => ({
            code: row.code,
            description: row.description,
            type: row.type,
            company_id: currentCompany?.id || '',
            is_active: true,
            job_id: null
          })));

        if (error) throw error;

        toast({
          title: "Import successful",
          description: `Imported ${dataRows.length} cost codes successfully`,
        });

        setCsvDialogOpen(false);
        setCsvPreview([]);
        loadCostCodes();
        
        // Clear file input
        if (fileInput) fileInput.value = '';
      };

      reader.readAsText(file);
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast({
        title: "Import failed",
        description: "Failed to import cost codes from CSV",
        variant: "destructive",
      });
    } finally {
      setCsvUploading(false);
    }
  };

  const downloadCsvTemplate = () => {
    const csvContent = "code,description,type\nLABOR-001,General Labor,labor\nMATERIAL-001,Construction Materials,material\nSUB-001,Electrical Subcontractor,sub\nEQUIP-001,Heavy Equipment,equipment\nOTHER-001,Miscellaneous,other";
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

  const exportCostCodes = () => {
    if (costCodes.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no cost codes to export",
        variant: "destructive"
      });
      return;
    }

    const csvContent = [
      "code,description,type",
      ...costCodes.map(code => 
        `"${code.code}","${code.description}","${code.type}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost_codes_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${costCodes.length} cost codes`,
    });
  };

  const handleDeleteCode = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cost_codes')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      setCostCodes(prev => prev.filter(code => code.id !== id));
      toast({
        title: "Cost code deleted",
        description: "Cost code has been deactivated",
      });
    } catch (error) {
      console.error('Error deleting cost code:', error);
      toast({
        title: "Error",
        description: "Failed to delete cost code",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Cost Codes</h1>
        <p className="text-muted-foreground">
          Manage company-wide cost codes for job tracking and reporting
        </p>
      </div>

      {/* Manual Add Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Cost Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="newCode">Code *</Label>
              <Input
                id="newCode"
                value={newCode.code}
                onChange={(e) => setNewCode(prev => ({ ...prev, code: e.target.value }))}
                placeholder="e.g., LABOR-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newDescription">Description *</Label>
              <Input
                id="newDescription"
                value={newCode.description}
                onChange={(e) => setNewCode(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., General Labor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newType">Type *</Label>
              <Select 
                value={newCode.type} 
                onValueChange={(value: 'material' | 'labor' | 'sub' | 'equipment' | 'other') => 
                  setNewCode(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {costTypeOptions.map(option => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleAddCode}>
            <Plus className="h-4 w-4 mr-2" />
            Add Cost Code
          </Button>
        </CardContent>
      </Card>

      {/* CSV Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Import from CSV
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="csvFile">Upload CSV File</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Expected format: code, description, type (material, labor, sub, equipment, or other)
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={downloadCsvTemplate}
              className="mt-6"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CSV Preview Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Preview CSV Import</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Preview of the first 5 rows. Please review before importing:
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvPreview.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell>
                      <Badge className={getTypeInfo(row.type).color}>
                        {getTypeInfo(row.type).label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCsvDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCsvImport} disabled={csvUploading}>
                {csvUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Import Cost Codes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cost Codes Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Company Cost Codes ({costCodes.length})</CardTitle>
            <Button 
              variant="outline" 
              onClick={exportCostCodes}
              disabled={costCodes.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading cost codes...</p>
            </div>
          ) : costCodes.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium">No cost codes defined</p>
              <p className="text-sm text-muted-foreground">
                Add cost codes to get started. These will be available for all your jobs.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costCodes.map((code) => {
                  const typeInfo = getTypeInfo(code.type);
                  const Icon = typeInfo.icon;
                  return (
                    <TableRow key={code.id}>
                      <TableCell className="font-medium">{code.code}</TableCell>
                      <TableCell>{code.description}</TableCell>
                      <TableCell>
                        <Badge className={typeInfo.color}>
                          <Icon className="h-3 w-3 mr-1" />
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeleteCode(code.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}