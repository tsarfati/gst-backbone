import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Phone, Building, Key, Edit, Calendar, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

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

interface EmployeeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

const roleColors = {
  admin: 'destructive',
  controller: 'secondary',
  project_manager: 'default',
  employee: 'outline',
  view_only: 'outline'
} as const;

const roleLabels = {
  admin: 'Administrator',
  controller: 'Controller',
  project_manager: 'Project Manager',
  employee: 'Employee',
  view_only: 'View Only'
} as const;

export default function EmployeeDetailDialog({ open, onOpenChange, employee }: EmployeeDetailDialogProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const canManageEmployees = profile?.role === 'admin' || profile?.role === 'controller';

  if (!employee) return null;

  const handleEdit = () => {
    onOpenChange(false);
    if (employee.user_id) {
      navigate(`/settings/users/${employee.user_id}/edit`);
    } else {
      // Navigate to PIN employee edit page
      navigate(`/pin-employees/${employee.id}/edit`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Employee Details
            </span>
            {canManageEmployees && (
              <Button onClick={handleEdit} size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={employee.avatar_url} />
                  <AvatarFallback className="text-lg">
                    {`${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">
                    {employee.display_name || `${employee.first_name} ${employee.last_name}`}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={roleColors[employee.role as keyof typeof roleColors]}>
                      {roleLabels[employee.role as keyof typeof roleLabels] || employee.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                    {employee.is_pin_employee && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Key className="h-3 w-3" />
                        PIN Only Employee
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employee Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Employee Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">First Name</h4>
                  <p className="font-medium">{employee.first_name}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground">Last Name</h4>
                  <p className="font-medium">{employee.last_name}</p>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Display Name</h4>
                <p className="font-medium">{employee.display_name}</p>
              </div>

              {employee.is_pin_employee ? (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">PIN Code: {employee.pin_code}</span>
                    </div>
                    {employee.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{employee.phone}</span>
                      </div>
                    )}
                    {employee.department && (
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{employee.department}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Email and additional details available in full profile
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Employee Type:</span>
                <span className="font-medium">
                  {employee.is_pin_employee ? 'PIN Only Employee' : 'Full System User'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Added to System:</span>
                <span className="font-medium">{new Date(employee.created_at).toLocaleDateString()}</span>
              </div>
              {employee.user_id && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User ID:</span>
                  <span className="font-mono text-xs">{employee.user_id}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}