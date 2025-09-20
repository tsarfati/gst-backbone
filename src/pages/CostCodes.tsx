import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, FileText, Plus, Trash2, Edit, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CostCode {
  id: string;
  code: string;
  description: string;
  category: string;
  rate?: number;
}

export default function CostCodes() {
  const { toast } = useToast();
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [newCode, setNewCode] = useState({
    code: "",
    description: "",
    category: "",
    rate: ""
  });
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileUpload = (file: File) => {
    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file (.csv, .xls, .xlsx)",
        variant: "destructive"
      });
      return;
    }

    // In a real app, you would parse the file here
    toast({
      title: "File uploaded",
      description: `Processing ${file.name}...`,
    });

    // Simulate file processing and adding sample data
    setTimeout(() => {
      const sampleCodes: CostCode[] = [
        { id: "1", code: "LABOR-001", description: "General Labor", category: "Labor", rate: 25.00 },
        { id: "2", code: "MAT-001", description: "Lumber Materials", category: "Materials", rate: 0 },
        { id: "3", code: "EQUIP-001", description: "Equipment Rental", category: "Equipment", rate: 75.00 },
        { id: "4", code: "SUB-001", description: "Subcontractor Work", category: "Subcontractor", rate: 0 }
      ];
      
      setCostCodes(sampleCodes);
      toast({
        title: "Import successful",
        description: `Imported ${sampleCodes.length} cost codes from ${file.name}`,
      });
    }, 2000);
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

  const handleAddCode = () => {
    if (!newCode.code || !newCode.description) {
      toast({
        title: "Missing information",
        description: "Please fill in code and description",
        variant: "destructive"
      });
      return;
    }

    const newCostCode: CostCode = {
      id: Date.now().toString(),
      code: newCode.code,
      description: newCode.description,
      category: newCode.category || "General",
      rate: newCode.rate ? parseFloat(newCode.rate) : undefined
    };

    setCostCodes(prev => [...prev, newCostCode]);
    setNewCode({ code: "", description: "", category: "", rate: "" });
    
    toast({
      title: "Cost code added",
      description: "New cost code has been added successfully",
    });
  };

  const handleDeleteCode = (id: string) => {
    setCostCodes(prev => prev.filter(code => code.id !== id));
    toast({
      title: "Cost code deleted",
      description: "Cost code has been removed",
    });
  };

  const downloadTemplate = () => {
    const csvContent = "Code,Description,Category,Rate\nLABOR-001,General Labor,Labor,25.00\nMAT-001,Materials,Materials,0\nEQUIP-001,Equipment,Equipment,75.00";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cost-codes-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Cost Codes</h1>
        <p className="text-muted-foreground">
          Manage cost codes for job tracking and reporting
        </p>
      </div>

      {/* File Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Cost Codes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-center w-16 h-16 mx-auto bg-muted rounded-full">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium">Upload CSV or Excel File</p>
                <p className="text-sm text-muted-foreground">
                  Drag and drop your cost codes file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Supported formats: CSV, XLS, XLSX
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <div>
                  <input
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="cost-codes-upload"
                  />
                  <Button asChild>
                    <label htmlFor="cost-codes-upload" className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </label>
                  </Button>
                </div>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Expected columns: Code, Description, Category, Rate (optional)</span>
          </div>
        </CardContent>
      </Card>

      {/* Manual Add Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Cost Code Manually
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="newCode">Code</Label>
              <Input
                id="newCode"
                value={newCode.code}
                onChange={(e) => setNewCode(prev => ({ ...prev, code: e.target.value }))}
                placeholder="e.g., LABOR-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newDescription">Description</Label>
              <Input
                id="newDescription"
                value={newCode.description}
                onChange={(e) => setNewCode(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., General Labor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newCategory">Category</Label>
              <Input
                id="newCategory"
                value={newCode.category}
                onChange={(e) => setNewCode(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g., Labor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newRate">Rate (optional)</Label>
              <Input
                id="newRate"
                type="number"
                step="0.01"
                value={newCode.rate}
                onChange={(e) => setNewCode(prev => ({ ...prev, rate: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>
          <Button onClick={handleAddCode}>
            <Plus className="h-4 w-4 mr-2" />
            Add Cost Code
          </Button>
        </CardContent>
      </Card>

      {/* Cost Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Current Cost Codes ({costCodes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {costCodes.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium">No cost codes defined</p>
              <p className="text-sm text-muted-foreground">
                Upload a file or add cost codes manually to get started
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-medium">{code.code}</TableCell>
                    <TableCell>{code.description}</TableCell>
                    <TableCell>{code.category}</TableCell>
                    <TableCell>
                      {code.rate ? `$${code.rate.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}