import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Building2, DollarSign, Loader2, Save, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface PayrollEmployeeRate {
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  role: string;
  hourly_rate: string;
  settings_id?: string | null;
}

export default function EmployeePayroll() {
  const { currentCompany } = useCompany();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [ratesOpen, setRatesOpen] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesSaving, setRatesSaving] = useState(false);
  const [employeeRates, setEmployeeRates] = useState<PayrollEmployeeRate[]>([]);

  useEffect(() => {
    if (ratesOpen) {
      void loadEmployeeRates();
    }
  }, [ratesOpen, currentCompany?.id]);

  const loadEmployeeRates = async () => {
    if (!currentCompany?.id) return;
    setRatesLoading(true);
    try {
      const { data: companyUsers, error: accessError } = await supabase
        .from('user_company_access')
        .select('user_id, role, is_active')
        .eq('company_id', currentCompany.id)
        .or('is_active.eq.true,is_active.is.null')
        .not('role', 'in', '("vendor","design_professional")');

      if (accessError) throw accessError;

      const { data: companyProfilesFallback, error: companyProfilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, last_name, role')
        .eq('current_company_id', currentCompany.id)
        .not('role', 'in', '("vendor","design_professional")');

      if (companyProfilesError) throw companyProfilesError;

      const userIds = Array.from(new Set([
        ...(companyUsers || []).map((row: any) => row.user_id),
        ...(companyProfilesFallback || []).map((row: any) => row.user_id),
      ].filter(Boolean)));

      if (userIds.length === 0) {
        setEmployeeRates([]);
        return;
      }

      const [{ data: profilesData, error: profilesError }, { data: settingsData, error: settingsError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, display_name, first_name, last_name, role')
          .in('user_id', userIds),
        supabase
          .from('employee_timecard_settings')
          .select('id, user_id, hourly_rate')
          .eq('company_id', currentCompany.id)
          .in('user_id', userIds),
      ]);

      if (profilesError) throw profilesError;
      if (settingsError) throw settingsError;

      const roleByUserId = new Map((companyUsers || []).map((row: any) => [String(row.user_id), String(row.role || 'employee')]));
      const settingsByUserId = new Map((settingsData || []).map((row: any) => [String(row.user_id), row]));
      const profilesByUserId = new Map((companyProfilesFallback || []).map((row: any) => [String(row.user_id), row]));
      (profilesData || []).forEach((row: any) => {
        profilesByUserId.set(String(row.user_id), row);
      });

      const rows = Array.from(profilesByUserId.values())
        .map((profileRow: any) => {
          const settings = settingsByUserId.get(String(profileRow.user_id));
          const displayName = profileRow.display_name
            || `${profileRow.first_name || ''} ${profileRow.last_name || ''}`.trim()
            || 'Unnamed Employee';

          return {
            user_id: profileRow.user_id,
            display_name: displayName,
            first_name: profileRow.first_name || '',
            last_name: profileRow.last_name || '',
            role: roleByUserId.get(String(profileRow.user_id)) || profileRow.role || 'employee',
            hourly_rate: settings?.hourly_rate === null || typeof settings?.hourly_rate === 'undefined' ? '' : String(settings.hourly_rate),
            settings_id: settings?.id || null,
          } as PayrollEmployeeRate;
        })
        .sort((a, b) => a.display_name.localeCompare(b.display_name));

      setEmployeeRates(rows);
    } catch (error) {
      console.error('Error loading employee rates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employee payroll rates.',
        variant: 'destructive',
      });
    } finally {
      setRatesLoading(false);
    }
  };

  const updateRate = (userId: string, value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    setEmployeeRates((prev) => prev.map((row) => (
      row.user_id === userId ? { ...row, hourly_rate: sanitized } : row
    )));
  };

  const saveEmployeeRates = async () => {
    if (!currentCompany?.id) return;
    setRatesSaving(true);
    try {
      for (const employee of employeeRates) {
        const parsedRate = employee.hourly_rate === '' ? null : Number(employee.hourly_rate);
        if (employee.hourly_rate !== '' && Number.isNaN(parsedRate)) {
          throw new Error(`Hourly rate for ${employee.display_name} must be a valid number.`);
        }

        if (employee.settings_id) {
          const { error } = await supabase
            .from('employee_timecard_settings')
            .update({ hourly_rate: parsedRate } as any)
            .eq('id', employee.settings_id);
          if (error) throw error;
          continue;
        }

        const { data, error } = await supabase
          .from('employee_timecard_settings')
          .insert({
            user_id: employee.user_id,
            company_id: currentCompany.id,
            hourly_rate: parsedRate,
            assigned_jobs: [],
            assigned_cost_codes: [],
            require_location: true,
            require_photo: true,
            auto_lunch_deduction: true,
            created_by: profile?.user_id || employee.user_id,
          } as any)
          .select('id')
          .single();

        if (error) throw error;
        employee.settings_id = data?.id || null;
      }

      toast({
        title: 'Rates Saved',
        description: 'Employee hourly rates were updated.',
      });
      setRatesOpen(false);
    } catch (error: any) {
      console.error('Error saving employee rates:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save employee payroll rates.',
        variant: 'destructive',
      });
    } finally {
      setRatesSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employee Payroll</h1>
          <p className="text-sm text-muted-foreground">Manage payroll inputs and employee labor rates.</p>
        </div>
        <Button onClick={() => setRatesOpen(true)} className="gap-2">
          <Settings className="h-4 w-4" />
          Payroll Settings
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Payroll management features coming soon. Use Payroll Settings to manage employee hourly rates.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={ratesOpen} onOpenChange={setRatesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Employee Payroll Rates</DialogTitle>
            <DialogDescription>
              Set hourly rates for company employees. These rates are used for labor cost reporting.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
            {ratesLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading employee rates...
              </div>
            ) : employeeRates.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No employees found for this company.</div>
            ) : (
              <div className="divide-y">
                <div className="grid grid-cols-[1fr_150px] gap-4 bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Employee</span>
                  <span>Hourly Rate</span>
                </div>
                {employeeRates.map((employee) => (
                  <div key={employee.user_id} className="grid grid-cols-[1fr_150px] items-center gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{employee.display_name}</div>
                      <Badge variant="outline" className="mt-1 text-xs">{employee.role}</Badge>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`rate-${employee.user_id}`} className="sr-only">Hourly rate</Label>
                      <div className="relative">
                        <DollarSign className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id={`rate-${employee.user_id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          className="pl-7"
                          value={employee.hourly_rate}
                          onChange={(event) => updateRate(employee.user_id, event.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRatesOpen(false)} disabled={ratesSaving}>Cancel</Button>
            <Button onClick={saveEmployeeRates} disabled={ratesSaving || ratesLoading} className="gap-2">
              {ratesSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Rates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
