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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import EmployeeViews from '@/components/EmployeeViews';
import UserManagement from '@/components/UserManagement';
import RolePermissionsManager from '@/components/RolePermissionsManager';

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
  const { toast } = useToast();
  const { currentView, setCurrentView, setDefaultView, isDefault } = useUnifiedViewPreference('employees-view');

  const canManageEmployees = profile?.role === 'admin' || profile?.role === 'controller';

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      // Fetch regular employees from profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      // Fetch PIN-only employees
      const { data: pinEmployeeData, error: pinError } = await supabase
        .from('pin_employees')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (pinError) throw pinError;

      // Combine both datasets
      const allEmployees: Employee[] = [
        ...(profileData || []).map(profile => ({
          ...profile,
          is_pin_employee: false
        })),
        ...(pinEmployeeData || []).map(pinEmployee => ({
          id: pinEmployee.id,
          user_id: pinEmployee.id, // Use PIN employee ID as user_id
          first_name: pinEmployee.first_name,
          last_name: pinEmployee.last_name,
          display_name: pinEmployee.display_name,
          role: 'employee', // PIN employees are always regular employees
          created_at: pinEmployee.created_at,
          is_pin_employee: true,
          pin_code: pinEmployee.pin_code,
          department: pinEmployee.department,
          phone: pinEmployee.phone
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
          {canManageEmployees && (
            <>
              <TabsTrigger value="management">User Management</TabsTrigger>
              <TabsTrigger value="permissions">Role Permissions</TabsTrigger>
            </>
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

        {canManageEmployees && (
          <>
            <TabsContent value="management">
              <UserManagement />
            </TabsContent>

            <TabsContent value="permissions">
              <RolePermissionsManager />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}