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
  { value: '/jobs', label: 'Jobs' },
  { value: '/time-tracking', label: 'Time Tracking' },
  { value: '/vendors', label: 'Vendors' },
  { value: '/bills', label: 'Bills' },
  { value: '/coded-receipts', label: 'Coded Receipts' },
  { value: '/uncoded-receipts', label: 'Uncoded Receipts' },
  { value: '/timesheets', label: 'Timesheets' },
  { value: '/timecard-reports', label: 'Timecard Reports' },
  { value: '/all-employees', label: 'All Employees' },
];

const ROLE_LABELS = {
  admin: 'Administrator',
  controller: 'Controller',
  project_manager: 'Project Manager',
  employee: 'Employee',
  view_only: 'View Only'
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
        role: rolePage.role as 'admin' | 'controller' | 'project_manager' | 'employee' | 'view_only',
        default_page: rolePage.default_page,
        created_by: profile?.user_id || ''
      }));

      const { error } = await supabase
        .from('role_default_pages')
        .upsert(updates, {
          onConflict: 'role'
        });

      if (error) throw error;

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