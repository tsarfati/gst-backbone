import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { FileText, X, Plus, Copy, CheckSquare, Check, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';

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
  disabled?: boolean;
}

export default function JobCostCodeSelector({
  jobId,
  selectedCostCodes,
  onSelectedCostCodesChange,
  disabled = false
}: JobCostCodeSelectorProps) {
  const [masterCostCodes, setMasterCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCodeId, setSelectedCodeId] = useState<string>("");
  const [previousJobs, setPreviousJobs] = useState<any[]>([]);
  const [selectedPreviousJobId, setSelectedPreviousJobId] = useState<string>("");
  const [costCodePopoverOpen, setCostCodePopoverOpen] = useState(false);
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

  // Ensure a job-specific cost code exists for this job based on a master cost code id
  const ensureJobCostCode = async (masterCostCodeId: string) => {
    if (!jobId || !currentCompany) return null;
    const master = masterCostCodes.find(cc => cc.id === masterCostCodeId);
    if (!master) return null;

    // Check if a job-specific code already exists (by code+type)
  const { data: existing } = await supabase
      .from('cost_codes')
      .select('id, code, description, type, is_active')
      .eq('job_id', jobId)
      .eq('code', master.code)
      .maybeSingle();

    if (existing) {
      // Reactivate and align metadata with master
      await supabase
        .from('cost_codes')
        .update({ 
          is_active: true,
          // Keep code stable, align type/description when missing or different
          type: (master.type || existing.type || null) as any,
          description: master.description || existing.description
        })
        .eq('id', existing.id);
      return existing as CostCode;
    }

    // Create job-specific record cloned from master
    const { data: created, error: createErr } = await supabase
      .from('cost_codes')
      .insert([
        {
          company_id: currentCompany.id,
          job_id: jobId,
          code: master.code,
          description: master.description,
          type: (master.type || null) as any,
          is_active: true,
        } as any
      ] as any)
      .select('id, code, description, type')
      .maybeSingle();
    if (createErr) {
      console.error('Error creating job cost code', createErr);
      toast({ title: 'Error', description: 'Failed to add cost code to job', variant: 'destructive' });
      return null;
    }
    return created as CostCode;
  };

  // Ensure by code/type (used when copying from previous job)
  const ensureJobCostCodeByCodeType = async (code: string, type?: string | null, description?: string | null) => {
    if (!jobId || !currentCompany) return null;
  const { data: existing } = await supabase
      .from('cost_codes')
      .select('id, code, description, type, is_active')
      .eq('job_id', jobId)
      .eq('code', code)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('cost_codes')
        .update({ 
          is_active: true,
          type: (type || existing.type || null) as any,
          description: description || existing.description
        })
        .eq('id', existing.id);
      return existing as CostCode;
    }

    const { data: created, error } = await supabase
      .from('cost_codes')
      .insert([
        {
          company_id: currentCompany.id,
          job_id: jobId,
          code,
          description,
          type: (type || null) as any,
          is_active: true,
        } as any
      ] as any)
      .select('id, code, description, type')
      .maybeSingle();
    if (error) {
      console.error('Error creating job cost code', error);
      toast({ title: 'Error', description: 'Failed to add cost code to job', variant: 'destructive' });
      return null;
    }
    return created as CostCode;
  };

  const handleAddCostCode = async (costCodeId?: string) => {
    const codeId = costCodeId || selectedCodeId;
    if (!codeId) return;

    // Get the master cost code to check its type
    const masterCode = masterCostCodes.find(cc => cc.id === codeId);
    
    // Check if this is a dynamic group or dynamic parent that requires child codes
    if (masterCode && jobId) {
      const isDynamicGroup = masterCode.code.match(/^\d+\.0$/);
      const isDynamicParent = masterCode.code.match(/^\d+\.\d+$/) && !isDynamicGroup;
      
      if (isDynamicGroup || isDynamicParent) {
        // Count existing child codes in this job
        const codePrefix = masterCode.code.replace(/\.0$/, '');
        const childPattern = isDynamicGroup 
          ? `${codePrefix}.`
          : `${masterCode.code}-`;
        
        const { data: childCodes, error: childError } = await supabase
          .from('cost_codes')
          .select('id')
          .eq('job_id', jobId)
          .eq('is_active', true)
          .like('code', `${childPattern}%`);
        
        if (childError) {
          console.error('Error checking child codes:', childError);
        } else if (!childCodes || childCodes.length < 2) {
          toast({ 
            title: 'Validation Error', 
            description: `A ${isDynamicGroup ? 'dynamic group' : 'dynamic parent'} must have at least 2 child cost codes assigned to this job first`,
            variant: 'destructive' 
          });
          return;
        }
      }
    }

    const jobCode = await ensureJobCostCode(codeId);
    if (!jobCode) return;

    if (selectedCostCodes.some(sc => sc.id === jobCode.id)) {
      toast({ title: 'Already Selected', description: 'This cost code is already selected for this job', variant: 'destructive' });
      return;
    }

    onSelectedCostCodesChange([...selectedCostCodes, jobCode]);
    setSelectedCodeId("");
    setCostCodePopoverOpen(false);

    toast({ title: 'Cost Code Added', description: `${jobCode.code} - ${jobCode.description} added to job` });
  };

  const handleRemoveCostCode = async (costCodeId: string) => {
    if (!jobId) return;
    await supabase.from('cost_codes').update({ is_active: true ? false : false }).eq('id', costCodeId).eq('job_id', jobId);
    const updatedCodes = selectedCostCodes.filter(cc => cc.id !== costCodeId);
    onSelectedCostCodesChange(updatedCodes);
    const removedCode = selectedCostCodes.find(cc => cc.id === costCodeId);
    toast({ title: 'Cost Code Removed', description: `${removedCode?.code} removed from job` });
  };

  const handleSelectAll = async () => {
    const candidates = masterCostCodes.filter(
      mc => !selectedCostCodes.some(sc => sc.code === mc.code && sc.type === mc.type)
    );

    if (candidates.length === 0) {
      toast({ title: 'All Selected', description: 'All cost codes are already selected' });
      return;
    }

    const created = (await Promise.all(candidates.map(c => ensureJobCostCode(c.id)))).filter(Boolean) as CostCode[];
    const merged = [...selectedCostCodes, ...created.filter(c => !selectedCostCodes.some(sc => sc.id === c.id))];
    onSelectedCostCodesChange(merged);
    toast({ title: 'Cost Codes Added', description: `${created.length} cost codes added to job` });
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
    mc => !selectedCostCodes.some(sc => sc.code === mc.code && sc.type === mc.type)
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
              <Select value={selectedPreviousJobId} onValueChange={setSelectedPreviousJobId} disabled={disabled}>
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
                disabled={!selectedPreviousJobId || disabled}
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
              disabled={disabled}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Select All ({availableCostCodes.length} available)
            </Button>
          </div>
        </div>

        {/* Add Cost Code Section */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Popover open={costCodePopoverOpen} onOpenChange={setCostCodePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={costCodePopoverOpen}
                  className="w-full justify-between"
                  disabled={disabled}
                >
                  {selectedCodeId
                    ? (() => {
                        const selected = availableCostCodes.find(cc => cc.id === selectedCodeId);
                        return selected ? `${selected.code} - ${selected.description}${selected.type ? ` (${selected.type})` : ''}` : "Select a cost code...";
                      })()
                    : "Select a cost code from company master list"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[600px] p-0">
                <Command>
                  <CommandInput placeholder="Search cost codes..." />
                  <CommandList>
                    <CommandEmpty>No cost code found.</CommandEmpty>
                    <CommandGroup>
                      {availableCostCodes.map((costCode) => (
                        <CommandItem
                          key={costCode.id}
                          value={`${costCode.code} ${costCode.description} ${costCode.type || ''}`}
                          onSelect={() => {
                            setSelectedCodeId(costCode.id);
                            handleAddCostCode(costCode.id);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCodeId === costCode.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="font-mono text-sm mr-2">{costCode.code}</span>
                          <span className="flex-1">{costCode.description}</span>
                          {costCode.type && (
                            <span className="text-xs text-muted-foreground ml-2">({costCode.type})</span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
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
                    disabled={disabled}
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