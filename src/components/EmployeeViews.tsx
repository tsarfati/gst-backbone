import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, Building, Users, Key, Phone } from "lucide-react";
import { UnifiedViewType } from "@/components/ui/unified-view-selector";
import { cn } from "@/lib/utils";

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

interface EmployeeViewsProps {
  employees: Employee[];
  currentView: UnifiedViewType;
  canManageEmployees: boolean;
  loading: boolean;
  onEmployeeClick: (employee: Employee) => void;
}

const roleColors = {
  admin: 'destructive',
  controller: 'secondary',
  project_manager: 'default',
  employee: 'outline',
  view_only: 'outline'
} as const;

export default function EmployeeViews({ employees, currentView, canManageEmployees, loading, onEmployeeClick }: EmployeeViewsProps) {
  if (loading) {
    return <div className="text-center py-8">Loading employees...</div>;
  }

  if (employees.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No employees found</h3>
        <p className="text-muted-foreground">
          Try adjusting your search criteria or add your first employee
        </p>
      </div>
    );
  }

  const renderEmployee = (employee: Employee) => {
    switch (currentView) {
      case 'list':
        return (
          <Card key={employee.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onEmployeeClick(employee)}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={employee.avatar_url} />
                  <AvatarFallback>
                    {`${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {employee.display_name || `${employee.first_name} ${employee.last_name}`}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={roleColors[employee.role as keyof typeof roleColors]}>
                      {employee.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                    {employee.is_pin_employee && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Key className="h-3 w-3" />
                        PIN Only
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {employee.is_pin_employee ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">PIN: {employee.pin_code}</span>
                    </div>
                    {employee.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{employee.phone}</span>
                      </div>
                    )}
                    {employee.department && (
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{employee.department}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Added {new Date(employee.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Email available in profile</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Member since {new Date(employee.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 'compact':
        return (
          <Card key={employee.id} className="hover:shadow-md transition-shadow p-4 cursor-pointer" onClick={() => onEmployeeClick(employee)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={employee.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {`${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">
                    {employee.display_name || `${employee.first_name} ${employee.last_name}`}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {employee.role.replace('_', ' ')} 
                    {employee.is_pin_employee ? ' • PIN Only' : ` • Member since ${new Date(employee.created_at).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={roleColors[employee.role as keyof typeof roleColors]} className="text-xs">
                  {employee.role.replace('_', ' ').toUpperCase()}
                </Badge>
                {employee.is_pin_employee && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    PIN
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        );

      case 'super-compact':
        return (
          <div key={employee.id} className="flex items-center justify-between p-3 border rounded hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => onEmployeeClick(employee)}>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={employee.avatar_url} />
                <AvatarFallback className="text-xs">
                  {`${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">
                {employee.display_name || `${employee.first_name} ${employee.last_name}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {employee.role.replace('_', ' ')}
                {employee.is_pin_employee && ' • PIN Only'}
              </span>
              <div className={cn("w-2 h-2 rounded-full", 
                employee.role === 'admin' ? 'bg-red-500' : 
                employee.role === 'controller' ? 'bg-blue-500' : 
                employee.is_pin_employee ? 'bg-orange-500' : 'bg-green-500'
              )} />
            </div>
          </div>
        );

      case 'icons':
        return (
          <Card key={employee.id} className="hover:shadow-md transition-shadow p-4 text-center cursor-pointer" onClick={() => onEmployeeClick(employee)}>
            <div className="space-y-3">
              <Avatar className="h-16 w-16 mx-auto">
                <AvatarImage src={employee.avatar_url} />
                <AvatarFallback>
                  {`${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-medium text-sm">
                  {employee.display_name || `${employee.first_name} ${employee.last_name}`}
                </h3>
                <div className="flex flex-col items-center gap-1 mt-1">
                  <Badge variant={roleColors[employee.role as keyof typeof roleColors]} className="text-xs">
                    {employee.role.replace('_', ' ').toUpperCase()}
                  </Badge>
                  {employee.is_pin_employee && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <Key className="h-3 w-3" />
                      PIN Only
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );

      default:
        return null;
    }
  };

  const gridClasses = currentView === 'icons'
    ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
    : currentView === 'list'
    ? "space-y-4"
    : currentView === 'compact'
    ? "space-y-2"
    : "space-y-1";

  return (
    <div className={gridClasses}>
      {employees.map(renderEmployee)}
    </div>
  );
}