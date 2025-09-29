import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, X, Plus, Copy, CheckSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';

interface CostCode {
  id: string;
  code: string;
  description: string;
  type?: string;
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
  const [previousJobs, setPreviousJobs] = useState<any[]>([]);
  const [selectedPreviousJobId, setSelectedPreviousJobId] = useState<string>("");
  const { toast } = useToast();
  const { currentCompany } = useCompany();

  useEffect(() => {
    loadMasterCostCodes();
    loadPreviousJobs();
  }, [currentCompany]);

  const loadMasterCostCodes = async () => {
    if (!currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('id, code, description, type')
        .eq('company_id', currentCompany.id)
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

  const loadPreviousJobs = async () => {
    if (!currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .neq('id', jobId || '') // Exclude current job
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPreviousJobs(data || []);
    } catch (error) {
      console.error('Error loading previous jobs:', error);
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

  const handleSelectAll = () => {
    const newCodes = masterCostCodes.filter(
      mc => !selectedCostCodes.some(sc => sc.id === mc.id)
    );
    
    if (newCodes.length === 0) {
      toast({
        title: "All Selected",
        description: "All cost codes are already selected",
      });
      return;
    }

    onSelectedCostCodesChange([...selectedCostCodes, ...newCodes]);
    toast({
      title: "Cost Codes Added",
      description: `${newCodes.length} cost codes added to job`,
    });
  };

  const handleCopyFromPreviousJob = async () => {
    if (!selectedPreviousJobId) return;

    try {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('id, code, description, type')
        .eq('job_id', selectedPreviousJobId)
        .eq('is_active', true);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "No Cost Codes",
          description: "The selected job has no cost codes",
          variant: "destructive",
        });
        return;
      }

      // Find which codes are new (not already selected)
      const newCodes = data.filter(
        cc => !selectedCostCodes.some(sc => sc.id === cc.id)
      );

      if (newCodes.length === 0) {
        toast({
          title: "Already Selected",
          description: "All cost codes from this job are already selected",
        });
        return;
      }

      onSelectedCostCodesChange([...selectedCostCodes, ...newCodes]);
      setSelectedPreviousJobId("");
      
      toast({
        title: "Cost Codes Copied",
        description: `${newCodes.length} cost codes copied from previous job`,
      });
    } catch (error) {
      console.error('Error copying cost codes:', error);
      toast({
        title: "Error",
        description: "Failed to copy cost codes from previous job",
        variant: "destructive",
      });
    }
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
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
          <div className="space-y-2">
            <label className="text-sm font-medium">Copy from Previous Job</label>
            <div className="flex gap-2">
              <Select value={selectedPreviousJobId} onValueChange={setSelectedPreviousJobId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a previous job" />
                </SelectTrigger>
                <SelectContent>
                  {previousJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleCopyFromPreviousJob} 
                disabled={!selectedPreviousJobId}
                size="sm"
                variant="outline"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Select All Cost Codes</label>
            <Button 
              onClick={handleSelectAll} 
              variant="outline"
              size="sm"
              className="w-full"
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Select All ({availableCostCodes.length} available)
            </Button>
          </div>
        </div>

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
                    {costCode.code} - {costCode.description} {costCode.type && `(${costCode.type})`}
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
                  {costCode.type && <span className="text-xs opacity-70">({costCode.type})</span>}
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