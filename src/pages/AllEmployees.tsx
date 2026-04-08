import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, Search } from 'lucide-react';
import UnifiedViewSelector from '@/components/ui/unified-view-selector';
import { useUnifiedViewPreference } from '@/hooks/useUnifiedViewPreference';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import EmployeeViews from '@/components/EmployeeViews';
import EmployeeGroupManager from '@/components/EmployeeGroupManager';
import RolePermissionsManager from '@/components/RolePermissionsManager';
import { useActionPermissions } from '@/hooks/useActionPermissions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';

interface Employee {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: string;
  custom_role_id?: string | null;
  custom_role_name?: string | null;
  avatar_url?: string;
  created_at: string;
  has_pin: boolean;
  pin_code?: string;
  phone?: string;
  punch_clock_access?: boolean;
  pm_lynk_access?: boolean;
  assigned_jobs?: Array<{ id: string; name: string }>;
}

const roleColors = {
  admin: 'destructive',
  controller: 'secondary',
  project_manager: 'default',
  employee: 'outline',
  view_only: 'outline'
} as const;

export default function AllEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const { currentView, setCurrentView, setDefaultView, isDefault } = useUnifiedViewPreference('employees-view');
  const { canCreateEmployees, hasElevatedAccess } = useActionPermissions();
  const navigate = useNavigate();

  const canManageEmployees = hasElevatedAccess();

  useEffect(() => {
    if (currentCompany?.id) {
      fetchEmployees();
    }
  }, [currentCompany?.id]);

  const fetchEmployees = async () => {
    if (!currentCompany?.id) return;

    try {
      // Get all internal users for this company. "All Employees" is the company roster,
      // not only rows whose company role is literally "employee".
      const { data: accessData, error: accessError } = await supabase
        .from('user_company_access')
        .select('user_id, role, is_active')
        .eq('company_id', currentCompany.id)
        .or('is_active.eq.true,is_active.is.null')
        .not('role', 'in', '("vendor","design_professional")');

      if (accessError) throw accessError;

      const userIds = Array.from(new Set((accessData || []).map(a => a.user_id).filter(Boolean)));

      const { data: companyProfilesFallback, error: companyProfilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, display_name, avatar_url, role, custom_role_id, pin_code, phone, punch_clock_access, pm_lynk_access, created_at')
        .eq('current_company_id', currentCompany.id)
        .not('role', 'in', '("vendor","design_professional")');

      if (companyProfilesError) throw companyProfilesError;

      for (const profile of companyProfilesFallback || []) {
        if (profile.user_id && !userIds.includes(profile.user_id)) {
          userIds.push(profile.user_id);
        }
      }

      if (userIds.length === 0) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, display_name, avatar_url, role, custom_role_id, pin_code, phone, punch_clock_access, pm_lynk_access, created_at')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const customRoleIds = Array.from(new Set((profilesData || []).map((p: any) => p.custom_role_id).filter(Boolean)));
      const { data: customRolesData, error: customRolesError } = customRoleIds.length > 0
        ? await supabase
            .from('custom_roles')
            .select('id, role_name')
            .in('id', customRoleIds)
        : { data: [], error: null };

      if (customRolesError) throw customRolesError;

      const customRoleNameById = new Map(
        ((customRolesData || []) as any[]).map((role) => [String(role.id), String(role.role_name)])
      );

      // Fetch job assignments
      const { data: jobAccessData } = await supabase
        .from('user_job_access')
        .select('user_id, job_id, jobs(name)')
        .in('user_id', userIds);

      const jobsMap = new Map<string, Array<{ id: string; name: string }>>();
      (jobAccessData || []).forEach((ja: any) => {
        const existing = jobsMap.get(ja.user_id) || [];
        existing.push({ id: ja.job_id, name: ja.jobs?.name || 'Unknown' });
        jobsMap.set(ja.user_id, existing);
      });

      const accessByUserId = new Map((accessData || []).map((access) => [String(access.user_id), access]));

      const allEmployees: Employee[] = (profilesData || []).map((p: any) => {
        const access = accessByUserId.get(String(p.user_id));
        const role = p.custom_role_id
          ? customRoleNameById.get(String(p.custom_role_id)) || access?.role || p.role || 'employee'
          : access?.role || p.role || 'employee';

        return ({
        id: p.user_id,
        user_id: p.user_id,
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        display_name: p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        role,
        custom_role_id: p.custom_role_id || null,
        custom_role_name: p.custom_role_id ? customRoleNameById.get(String(p.custom_role_id)) || null : null,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        has_pin: !!p.pin_code,
        pin_code: p.pin_code,
        phone: p.phone,
        punch_clock_access: p.punch_clock_access,
        pm_lynk_access: p.pm_lynk_access,
        assigned_jobs: jobsMap.get(p.user_id) || []
        });
      });

      // Sort by last name
      allEmployees.sort((a, b) => a.last_name.localeCompare(b.last_name));

      setEmployees(allEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employees',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(employee => {
    const searchLower = searchTerm.toLowerCase();
    return (
      `${employee.first_name} ${employee.last_name}`.toLowerCase().includes(searchLower) ||
      employee.display_name?.toLowerCase().includes(searchLower) ||
      employee.phone?.toLowerCase().includes(searchLower) ||
      (employee.has_pin && employee.pin_code?.includes(searchTerm))
    );
  });

  const handleEmployeeClick = (employee: any) => {
    const userId = employee.user_id || employee.id;
    navigate(`/settings/users/${userId}`, { state: { fromEmployees: true } });
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-7 w-7" />
            Employee Management
          </h1>
        </div>
        {canCreateEmployees() && (
          <div className="flex gap-2">
            <Link to="/add-employee">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </Link>
          </div>
        )}
      </div>

      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="employees" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors">Employees</TabsTrigger>
          <TabsTrigger value="groups" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors">Groups</TabsTrigger>
          {canManageEmployees && (
            <TabsTrigger value="permissions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors">Role Permissions</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="employees">
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees by name, phone, or PIN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <UnifiedViewSelector
                  currentView={currentView}
                  onViewChange={setCurrentView}
                  onSetDefault={setDefaultView}
                  isDefault={isDefault}
                />
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="text-center py-8"><span className="loading-dots">Loading employees</span></div>
          ) : (
            <EmployeeViews 
              employees={filteredEmployees}
              currentView={currentView}
              canManageEmployees={canManageEmployees}
              loading={loading}
              onEmployeeClick={handleEmployeeClick}
            />
          )}

          {filteredEmployees.length === 0 && !loading && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No employees found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding your first employee'}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="groups" className="space-y-6">
          <EmployeeGroupManager onGroupChange={fetchEmployees} />
        </TabsContent>

        {canManageEmployees && (
          <TabsContent value="permissions">
            <RolePermissionsManager />
          </TabsContent>
        )}
      </Tabs>


    </div>
  );
}
