import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Upload, X, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface CostCode {
  id: string;
  code: string;
  description: string;
}

interface CostCodeManagerProps {
  jobId?: string;
  costCodes: CostCode[];
  onCostCodesChange: (codes: CostCode[]) => void;
}

export default function CostCodeManager({ jobId, costCodes, onCostCodesChange }: CostCodeManagerProps) {
  const { toast } = useToast();
  const [newCode, setNewCode] = useState({ code: '', description: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddCode = () => {
    if (!newCode.code.trim() || !newCode.description.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter both code and description',
        variant: 'destructive',
      });
      return;
    }

    const code: CostCode = {
      id: Date.now().toString(),
      code: newCode.code.trim(),
      description: newCode.description.trim(),
    };

    onCostCodesChange([...costCodes, code]);
    setNewCode({ code: '', description: '' });
    setShowAddForm(false);
    
    toast({
      title: 'Cost Code Added',
      description: 'New cost code has been added successfully',
    });
  };

  const handleRemoveCode = (id: string) => {
    onCostCodesChange(costCodes.filter(c => c.id !== id));
    toast({
      title: 'Cost Code Removed',
      description: 'Cost code has been removed',
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a CSV or Excel file',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Skip header if present
        const dataLines = lines.slice(1);
        const newCodes: CostCode[] = [];

        dataLines.forEach((line, index) => {
          const [code, description] = line.split(',').map(item => item.trim().replace(/"/g, ''));
          if (code && description) {
            newCodes.push({
              id: `upload-${Date.now()}-${index}`,
              code,
              description,
            });
          }
        });

        if (newCodes.length > 0) {
          onCostCodesChange([...costCodes, ...newCodes]);
          toast({
            title: 'File Uploaded',
            description: `${newCodes.length} cost codes imported successfully`,
          });
        } else {
          toast({
            title: 'No Data Found',
            description: 'No valid cost codes found in the file',
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'Upload Error',
          description: 'Failed to parse the uploaded file',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Cost Codes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload and Add Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Cost Code
          </Button>
          
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild>
              <div>
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV/Excel
              </div>
            </Button>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <Card className="border-dashed">
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="costCode">Cost Code</Label>
                  <Input
                    id="costCode"
                    value={newCode.code}
                    onChange={(e) => setNewCode(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="e.g., 001, FRAME, ELEC"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codeDescription">Description</Label>
                  <Input
                    id="codeDescription"
                    value={newCode.description}
                    onChange={(e) => setNewCode(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g., Framing, Electrical Work"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddCode}>
                  Add Code
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cost Codes List */}
        {costCodes.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {costCodes.map((code) => (
              <div key={code.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-mono font-medium text-sm">{code.code}</span>
                  <span className="text-muted-foreground ml-3">{code.description}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveCode(code.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-6">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No cost codes added yet</p>
            <p className="text-sm">Add codes manually or upload a CSV/Excel file</p>
          </div>
        )}

        {costCodes.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Total: {costCodes.length} cost code{costCodes.length !== 1 ? 's' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  );
}