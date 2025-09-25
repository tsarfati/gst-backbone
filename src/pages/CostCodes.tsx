import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Trash2, Loader2, Wrench, Hammer, Users, Truck, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CostCode {
  id: string;
  code: string;
  description: string;
  type: 'material' | 'labor' | 'sub' | 'equipment' | 'other';
  is_active: boolean;
  job_id?: string | null;
}

export default function CostCodes() {
  const { toast } = useToast();
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState<{
    code: string;
    description: string;
    type: 'material' | 'labor' | 'sub' | 'equipment' | 'other';
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
    loadCostCodes();
  }, []);

  const loadCostCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('*')
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
          is_active: true,
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

      {/* Cost Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Company Cost Codes ({costCodes.length})</CardTitle>
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