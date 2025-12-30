import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RoleDefaultPage {
  id: string;
  role: string;
  default_page: string;
}

const AVAILABLE_PAGES = [
  { value: '/dashboard', label: 'Dashboard' },
  { value: '/jobs', label: 'All Jobs' },
  { value: '/jobs/add', label: 'Add Job' },
  { value: '/jobs/cost-codes', label: 'Cost Codes' },
  { value: '/jobs/reports', label: 'Job Reports' },
  { value: '/delivery-tickets', label: 'Delivery Tickets' },
  { value: '/payables-dashboard', label: 'Payables Dashboard' },
  { value: '/time-tracking', label: 'Time Tracking' },
  { value: '/punch-clock-dashboard', label: 'Punch Clock Dashboard' },
  { value: '/time-sheets', label: 'Timesheets' },
  { value: '/punch-clock/reports', label: 'Time Card Reports' },
  { value: '/punch-clock/settings', label: 'Punch Clock Settings' },
  { value: '/vendors', label: 'All Vendors' },
  { value: '/vendors/add', label: 'Add Vendor' },
  { value: '/vendors/reports', label: 'Vendor Reports' },
  { value: '/bills', label: 'All Bills' },
  { value: '/bills/add', label: 'Add Bill' },
  { value: '/subcontracts/add', label: 'Add Sub Contract' },
  { value: '/purchase-orders/add', label: 'Add PO' },
  { value: '/bills/payments', label: 'Payment History' },
  { value: '/bills/payment-reports', label: 'Bill Reports' },
  { value: '/upload', label: 'Upload Receipts' },
  { value: '/uncoded', label: 'Uncoded Receipts' },
  { value: '/receipts', label: 'Coded Receipts' },
  { value: '/receipts/reports', label: 'Receipt Reports' },
  { value: '/employees', label: 'All Employees' },
  { value: '/employees/add', label: 'Add Employee' },
  { value: '/employees/payroll', label: 'Payroll' },
  { value: '/employees/performance', label: 'Performance' },
  { value: '/messages', label: 'All Messages' },
  { value: '/team-chat', label: 'Team Chat' },
  { value: '/announcements', label: 'Announcements' },
  { value: '/company-files', label: 'All Documents' },
  { value: '/company-files/contracts', label: 'Contracts' },
  { value: '/company-files/permits', label: 'Permits' },
  { value: '/company-files/insurance', label: 'Insurance' },
  { value: '/banking/accounts', label: 'Bank Accounts' },
  { value: '/banking/credit-cards', label: 'Credit Cards' },
  { value: '/banking/reports', label: 'Banking Reports' },
  { value: '/banking/journal-entries', label: 'Journal Entries' },
  { value: '/banking/deposits', label: 'Deposits' },
  { value: '/banking/print-checks', label: 'Print Checks' },
  { value: '/banking/reconcile', label: 'Reconcile' },
  { value: '/settings', label: 'General Settings' },
  { value: '/settings/company', label: 'Company Settings' },
  { value: '/settings/company-management', label: 'Company Management' },
  { value: '/settings/notifications', label: 'Notifications & Email' },
  { value: '/settings/security', label: 'Data & Security' },
  { value: '/settings/users', label: 'User Management' },
];

const ROLE_LABELS = {
  admin: 'Administrator',
  controller: 'Controller',
  project_manager: 'Project Manager',
  employee: 'Employee',
  view_only: 'View Only',
  company_admin: 'Company Admin',
  vendor: 'Vendor'
};

export default function RoleDefaultPageSettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [rolePages, setRolePages] = useState<RoleDefaultPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    loadRoleDefaultPages();
  }, []);

  const loadRoleDefaultPages = async () => {
    try {
      const { data, error } = await supabase
        .from('role_default_pages')
        .select('*')
        .order('role');

      if (error) throw error;
      setRolePages(data || []);
    } catch (error) {
      console.error('Error loading role default pages:', error);
      toast({
        title: "Error",
        description: "Failed to load role default pages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRolePage = (role: string, defaultPage: string) => {
    setRolePages(pages => 
      pages.map(page => 
        page.role === role 
          ? { ...page, default_page: defaultPage }
          : page
      )
    );
  };

  const saveRoleDefaultPages = async () => {
    if (!isAdmin) return;

    try {
      setSaving(true);

      const updates = rolePages.map(rolePage => ({
        role: rolePage.role as 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only' | 'company_admin' | 'vendor',
        default_page: rolePage.default_page,
        created_by: profile?.user_id || ''
      }));

      // Save each role setting individually to avoid ON CONFLICT requirement
      for (const u of updates) {
        const { data: existing, error: fetchErr } = await supabase
          .from('role_default_pages')
          .select('id')
          .eq('role', u.role)
          .maybeSingle();
        if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;

        if (existing?.id) {
          const { error: updErr } = await supabase
            .from('role_default_pages')
            .update({ default_page: u.default_page, created_by: u.created_by })
            .eq('id', existing.id);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase
            .from('role_default_pages')
            .insert(u);
          if (insErr) throw insErr;
        }
      }
      // All role defaults saved
      toast({
        title: "Settings Saved",
        description: "Role default pages have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving role default pages:', error);
      toast({
        title: "Error",
        description: "Failed to save role default pages",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-muted-foreground">Loading role settings...</div>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">Only administrators can manage role default pages.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Role Default Landing Pages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configure which page each role sees by default when they log in or navigate to the app.
          </p>

          <div className="space-y-4">
            {rolePages.map((rolePage) => (
              <div key={rolePage.role} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-lg">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    {ROLE_LABELS[rolePage.role as keyof typeof ROLE_LABELS] || rolePage.role}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <Label className="text-sm font-medium">Default Landing Page</Label>
                  </div>
                </div>
                
                <div className="min-w-48">
                  <Select 
                    value={rolePage.default_page} 
                    onValueChange={(value) => updateRolePage(rolePage.role, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select default page" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_PAGES.map((page) => (
                        <SelectItem key={page.value} value={page.value}>
                          {page.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Changes will apply to users when they next log in or refresh the page.
              </div>
              <Button onClick={saveRoleDefaultPages} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}