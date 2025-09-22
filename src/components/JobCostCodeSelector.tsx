import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, X, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CostCode {
  id: string;
  code: string;
  description: string;
}

interface JobCostCodeSelectorProps {
  jobId?: string;
  selectedCostCodes: CostCode[];
  onSelectedCostCodesChange: (codes: CostCode[]) => void;
}

export default function JobCostCodeSelector({ 
  jobId, 
  selectedCostCodes, 
  onSelectedCostCodesChange 
}: JobCostCodeSelectorProps) {
  const [masterCostCodes, setMasterCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCodeId, setSelectedCodeId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    loadMasterCostCodes();
  }, []);

  const loadMasterCostCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('*')
        .is('job_id', null) // Get company master cost codes (not job-specific)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setMasterCostCodes(data || []);
    } catch (error) {
      console.error('Error loading master cost codes:', error);
      toast({
        title: "Error",
        description: "Failed to load company cost codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCostCode = () => {
    if (!selectedCodeId) return;

    const costCode = masterCostCodes.find(cc => cc.id === selectedCodeId);
    if (!costCode) return;

    // Check if already selected
    if (selectedCostCodes.some(sc => sc.id === costCode.id)) {
      toast({
        title: "Already Selected",
        description: "This cost code is already selected for this job",
        variant: "destructive",
      });
      return;
    }

    onSelectedCostCodesChange([...selectedCostCodes, costCode]);
    setSelectedCodeId("");
    
    toast({
      title: "Cost Code Added",
      description: `${costCode.code} - ${costCode.description} added to job`,
    });
  };

  const handleRemoveCostCode = (costCodeId: string) => {
    const updatedCodes = selectedCostCodes.filter(cc => cc.id !== costCodeId);
    onSelectedCostCodesChange(updatedCodes);
    
    const removedCode = selectedCostCodes.find(cc => cc.id === costCodeId);
    toast({
      title: "Cost Code Removed",
      description: `${removedCode?.code} removed from job`,
    });
  };

  const availableCostCodes = masterCostCodes.filter(
    mc => !selectedCostCodes.some(sc => sc.id === mc.id)
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">Loading cost codes...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Job Cost Codes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Cost Code Section */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Select value={selectedCodeId} onValueChange={setSelectedCodeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a cost code from company master list" />
              </SelectTrigger>
              <SelectContent>
                {availableCostCodes.map((costCode) => (
                  <SelectItem key={costCode.id} value={costCode.id}>
                    {costCode.code} - {costCode.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleAddCostCode} 
            disabled={!selectedCodeId}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Cost Code
          </Button>
        </div>

        {/* Selected Cost Codes */}
        {selectedCostCodes.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Selected Cost Codes:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedCostCodes.map((costCode) => (
                <Badge key={costCode.id} variant="secondary" className="flex items-center gap-2 pr-1">
                  <span className="font-mono text-xs">{costCode.code}</span>
                  <span className="text-xs">{costCode.description}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0 hover:bg-destructive/20"
                    onClick={() => handleRemoveCostCode(costCode.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              {selectedCostCodes.length} cost code{selectedCostCodes.length !== 1 ? 's' : ''} selected
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-6">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No cost codes selected for this job</p>
            <p className="text-sm">Select cost codes from the company master list above</p>
          </div>
        )}

        {availableCostCodes.length === 0 && selectedCostCodes.length > 0 && (
          <div className="text-sm text-muted-foreground text-center py-2">
            All company cost codes have been selected for this job
          </div>
        )}
      </CardContent>
    </Card>
  );
}