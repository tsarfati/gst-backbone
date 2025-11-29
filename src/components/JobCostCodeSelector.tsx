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
  is_dynamic_group?: boolean;
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
  const [budgetMap, setBudgetMap] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const { currentCompany } = useCompany();

  // Helpers
  const normalizeType = (t?: string | null) => (t ?? 'other');

  useEffect(() => {
    loadMasterCostCodes();
    loadPreviousJobs();
  }, [currentCompany]);

  useEffect(() => {
    const loadBudgets = async () => {
      if (!jobId || selectedCostCodes.length === 0) return;
      const ids = selectedCostCodes.map((c) => c.id);
      try {
        const { data, error } = await supabase
          .from('job_budgets')
          .select('cost_code_id, budgeted_amount')
          .eq('job_id', jobId)
          .in('cost_code_id', ids);
        if (!error && data) {
          const map: Record<string, number> = {};
          data.forEach((row) => { map[row.cost_code_id] = row.budgeted_amount; });
          setBudgetMap(map);
        }
      } catch (e) {
        console.error('Error loading budgets for selected codes', e);
      }
    };
    loadBudgets();
  }, [jobId, selectedCostCodes]);

  const loadMasterCostCodes = async () => {
    if (!currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('id, code, description, type')
        .eq('company_id', currentCompany.id)
        .is('job_id', null)
        .eq('is_active', true)
        .eq('is_dynamic_group', false)
        .neq('type', 'dynamic_group')
        .neq('type', 'dynamic_parent')
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

    // Look for an existing job-specific cost code with the SAME code and type
    let existingQuery = supabase
      .from('cost_codes')
      .select('id, code, description, type, is_active')
      .eq('job_id', jobId)
      .eq('code', master.code) as any;

    if (master.type) {
      existingQuery = existingQuery.eq('type', master.type as any);
    } else {
      existingQuery = existingQuery.is('type', null);
    }

    const { data: existing } = await (existingQuery as any).maybeSingle();

    if (existing) {
      const { data: updated, error: updErr } = await supabase
        .from('cost_codes')
        .update({ 
          is_active: true,
          description: master.description || existing.description
        })
        .eq('id', existing.id)
        .select('id, code, description, type')
        .maybeSingle();
      if (updErr) {
        console.error('Error reactivating job cost code', updErr);
        toast({ title: 'Error', description: 'You do not have permission to modify cost codes', variant: 'destructive' });
        return null;
      }
      return updated as CostCode;
    }

    const { data: created, error: createErr } = await supabase
      .from('cost_codes')
      .insert([
        {
          company_id: currentCompany.id,
          job_id: jobId,
          code: master.code,
          description: master.description,
          type: (master.type as any),
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

  const ensureJobCostCodeByCodeType = async (code: string, type?: string | null, description?: string | null) => {
    if (!jobId || !currentCompany) return null;
    // Look for existing with same code AND type
    let existingQuery = supabase
      .from('cost_codes')
      .select('id, code, description, type, is_active')
      .eq('job_id', jobId)
      .eq('code', code) as any;

    if (type) {
      existingQuery = existingQuery.eq('type', type as any);
    } else {
      existingQuery = existingQuery.is('type', null);
    }

    const { data: existing } = await (existingQuery as any).maybeSingle();

    if (existing) {
      const { data: updated } = await supabase
        .from('cost_codes')
        .update({ 
          is_active: true,
          description: description || existing.description
        })
        .eq('id', existing.id)
        .select('id, code, description, type')
        .maybeSingle();
      return (updated as any) || existing;
    }

    const { data: created, error } = await supabase
      .from('cost_codes')
      .insert([
        {
          company_id: currentCompany.id,
          job_id: jobId,
          code,
          description,
          type: (type as any),
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

    // Pre-check by master code to avoid false duplicate toasts and extra writes
    const master = masterCostCodes.find((cc) => cc.id === codeId);
    if (!master) return;
    const isDup = selectedCostCodes.some(
      (sc) => sc.code === master.code && normalizeType(sc.type) === normalizeType(master.type)
    );
    console.log("Checking duplicate for", master.code, master.type, "isDup:", isDup, "existing codes:", selectedCostCodes.map(sc => `${sc.code}-${sc.type}`));
    if (isDup) {
      toast({ title: 'Already Selected', description: 'This cost code is already selected for this job', variant: 'destructive' });
      return;
    }

    const jobCode = await ensureJobCostCode(codeId);
    if (!jobCode) return;

    if (jobId) {
      const user = await supabase.auth.getUser();
      const { error: budgetErr } = await supabase
        .from('job_budgets')
        .upsert(
          {
            job_id: jobId,
            cost_code_id: jobCode.id,
            budgeted_amount: 0,
            actual_amount: 0,
            committed_amount: 0,
            is_dynamic: false,
            created_by: user.data.user?.id,
          },
          { onConflict: 'job_id,cost_code_id' }
        );
      if (budgetErr) {
        console.error('Error creating budget line', budgetErr);
      }
    }

    onSelectedCostCodesChange([...selectedCostCodes, jobCode].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' })));
    console.log("Added cost code, new list:", [...selectedCostCodes, jobCode].map(cc => `${cc.code}-${cc.type}`));
    setSelectedCodeId("");
    setCostCodePopoverOpen(false);

    // Reload the list from database to ensure parent is synced
    setTimeout(async () => {
      const { data: refreshed } = await supabase
        .from('cost_codes')
        .select('id, code, description, type')
        .eq('job_id', jobId)
        .eq('is_active', true);
      if (refreshed) {
        onSelectedCostCodesChange(refreshed as CostCode[]);
      }
    }, 100);

    toast({ title: 'Cost Code Added', description: `${master.code} - ${master.description} added to job` });
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
      mc => !selectedCostCodes.some(sc => sc.code === mc.code)
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
        .eq('is_active', true)
        .eq('is_dynamic_group', false)
        .neq('type', 'dynamic_group')
        .neq('type', 'dynamic_parent');

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "No Cost Codes",
          description: "The selected job has no cost codes",
          variant: "destructive",
        });
        return;
      }

      // Find which codes are new by code + type (not by id, since we'll recreate for this job)
      const toCreate = data.filter(
        (cc) => !selectedCostCodes.some(sc => sc.code === cc.code && normalizeType(sc.type) === normalizeType(cc.type))
      );

      if (toCreate.length === 0) {
        toast({
          title: "Already Selected",
          description: "All cost codes from this job are already selected",
        });
        return;
      }

      const created = (
        await Promise.all(
          toCreate.map(cc => ensureJobCostCodeByCodeType(cc.code, cc.type, cc.description))
        )
      ).filter(Boolean) as CostCode[];

      const merged = [...selectedCostCodes, ...created].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
      onSelectedCostCodesChange(merged);
      setSelectedPreviousJobId("");

      toast({
        title: "Cost Codes Copied",
        description: `${created.length} cost codes copied from previous job`,
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
    mc => !selectedCostCodes.some(sc => sc.code === mc.code && normalizeType(sc.type) === normalizeType(mc.type))
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
        <div className="pb-4 border-b">
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
                  className="w-full justify-between transition-colors hover:bg-primary/10 hover:text-primary"
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
                          className="hover:bg-primary/10"
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

        {/* Selected Cost Codes - Column Display */}
        {selectedCostCodes.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Selected Cost Codes ({selectedCostCodes.length}):</h4>
            <div className="grid grid-cols-1 gap-2">
              {[...selectedCostCodes]
                .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }))
                .map((costCode) => {
                const budget = budgetMap[costCode.id];
                const getBadgeVariant = (type?: string) => {
                  switch (type?.toLowerCase()) {
                    case 'labor': return 'default';
                    case 'material': return 'secondary';
                    case 'subcontract': return 'outline';
                    case 'equipment': return 'destructive';
                    default: return 'secondary';
                  }
                };

                return (
                  <div 
                    key={`${costCode.id}-${costCode.code}-${normalizeType(costCode.type)}`} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="font-mono text-sm font-medium min-w-[80px]">{costCode.code}</span>
                      <span className="text-sm flex-1">{costCode.description}</span>
                      {costCode.type && (
                        <Badge variant={getBadgeVariant(costCode.type)} className="text-xs">
                          {costCode.type}
                        </Badge>
                      )}
                      {budget !== undefined ? (
                        <span className="text-sm font-medium text-muted-foreground min-w-[100px] text-right">
                          ${budget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground min-w-[100px] text-right">Not set</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2 h-8 w-8 p-0 hover:bg-destructive/20 hover:text-destructive"
                      onClick={() => handleRemoveCostCode(costCode.id)}
                      disabled={disabled}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
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