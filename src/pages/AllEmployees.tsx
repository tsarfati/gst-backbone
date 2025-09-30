import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, Search, Mail, Phone, Building, Settings, Shield } from 'lucide-react';
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
import EmployeeDetailDialog from '@/components/EmployeeDetailDialog';

interface Employee {
  id: string;
  user_id?: string; // Optional for PIN employees
  first_name: string;
  last_name: string;
  display_name: string;
  role: string;
  avatar_url?: string;
  created_at: string;
  is_pin_employee?: boolean;
  pin_code?: string;
  department?: string;
  phone?: string;
  group_id?: string;
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
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeDetail, setShowEmployeeDetail] = useState(false);
  const { profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const { currentView, setCurrentView, setDefaultView, isDefault } = useUnifiedViewPreference('employees-view');

  const canManageEmployees = profile?.role === 'admin' || profile?.role === 'controller';

  useEffect(() => {
    if (currentCompany?.id) {
      fetchEmployees();
    }
  }, [currentCompany?.id]);

  const fetchEmployees = async () => {
    if (!currentCompany?.id) return;

    try {
      // Get user IDs for this company
      const { data: accessData, error: accessError } = await supabase
        .from('user_company_access')
        .select('user_id')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true);

      if (accessError) throw accessError;

      const userIds = (accessData || []).map(a => a.user_id);

      // Fetch regular employees from profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, display_name, role, avatar_url, created_at, group_id')
        .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      // Fetch PIN-only employees for this company (using type assertion for complex types)
      const pinQuery: any = supabase
        .from('pin_employees')
        .select('*')
        .eq('is_active', true);
      
      const { data: pinEmployeeData, error: pinError } = await pinQuery.eq('company_id', currentCompany.id);

      if (pinError) throw pinError;

      // Combine both datasets
      const allEmployees: Employee[] = [
        ...(profileData || []).map(profile => ({
          id: profile.id,
          user_id: profile.user_id || undefined,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          display_name: profile.display_name || `${profile.first_name || ''} ${profile.last_name || ''}`,
          role: profile.role || 'employee',
          avatar_url: profile.avatar_url || undefined,
          created_at: profile.created_at,
          is_pin_employee: false,
          group_id: profile.group_id || undefined
        })),
        ...(pinEmployeeData || []).map((pinEmployee: any) => ({
          id: pinEmployee.id,
          user_id: undefined,
          first_name: pinEmployee.first_name,
          last_name: pinEmployee.last_name,
          display_name: pinEmployee.display_name,
          role: 'employee' as const,
          avatar_url: pinEmployee.avatar_url,
          created_at: pinEmployee.created_at,
          is_pin_employee: true,
          pin_code: pinEmployee.pin_code,
          department: pinEmployee.department,
          phone: pinEmployee.phone,
          group_id: pinEmployee.group_id
        }))
      ];

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
      employee.role.toLowerCase().includes(searchLower) ||
      employee.department?.toLowerCase().includes(searchLower) ||
      (employee.is_pin_employee && employee.pin_code?.includes(searchTerm))
    );
  });

  const handleEmployeeClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeDetail(true);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-7 w-7" />
            Employee Management
          </h1>
          <p className="text-muted-foreground">
            Manage your team members, approvals, and permissions
          </p>
        </div>
        {canManageEmployees && (
          <Link to="/add-employee">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </Link>
        )}
      </div>

      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="employees">All Employees</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          {canManageEmployees && (
            <TabsTrigger value="permissions">Role Permissions</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="employees">
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees by name or role..."
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
            <div className="text-center py-8">Loading employees...</div>
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

      <EmployeeDetailDialog
        open={showEmployeeDetail}
        onOpenChange={setShowEmployeeDetail}
        employee={selectedEmployee}
      />
    </div>
  );
}
