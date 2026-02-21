import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Phone, Building, Key, Edit, Calendar, Shield, Briefcase } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface Employee {
  id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: string;
  avatar_url?: string;
  created_at: string;
  is_pin_employee?: boolean;
  has_pin?: boolean;
  pin_code?: string;
  department?: string;
  phone?: string;
  group_id?: string;
  punch_clock_access?: boolean;
  pm_lynk_access?: boolean;
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
  view_only: 'outline',
  company_admin: 'destructive',
  vendor: 'secondary'
} as const;

const roleLabels = {
  admin: 'Administrator',
  controller: 'Controller',
  project_manager: 'Project Manager',
  employee: 'Employee',
  view_only: 'View Only',
  company_admin: 'Company Admin',
  vendor: 'Vendor'
} as const;

export default function EmployeeDetailDialog({ open, onOpenChange, employee }: EmployeeDetailDialogProps) {
  const { profile } = useAuth();
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const [assignedJobs, setAssignedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const canManageEmployees = profile?.role === 'admin' || profile?.role === 'controller';

  useEffect(() => {
    if (open && employee && currentCompany) {
      fetchAssignedJobs();
    }
  }, [open, employee, currentCompany]);

  const fetchAssignedJobs = async () => {
    if (!employee || !currentCompany) return;
    
    setLoading(true);
    try {
      const userId = employee.user_id || employee.id;
      
      const { data, error } = await supabase
        .from('user_job_access')
        .select('job_id, jobs(name)')
        .eq('user_id', userId);

      if (error) throw error;
      setAssignedJobs(data || []);
    } catch (error) {
      console.error('Error fetching assigned jobs:', error);
      setAssignedJobs([]);
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  const hasPinAccess = employee.has_pin || employee.is_pin_employee || !!employee.pin_code;

  const handleEdit = () => {
    onOpenChange(false);
    const userId = employee.user_id || employee.id;
    navigate(`/settings/users/${userId}`);
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
                    {hasPinAccess && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Key className="h-3 w-3" />
                        PIN Access
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

              <Separator />
              
              <div className="space-y-3">
                {hasPinAccess && employee.pin_code && (
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">PIN Code: {employee.pin_code}</span>
                  </div>
                )}
                {employee.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{employee.phone}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Job Assignments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Job Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading job assignments...</p>
              ) : assignedJobs.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {assignedJobs.map((access: any) => (
                    <Badge key={access.job_id} variant="secondary">
                      {access.jobs?.name || 'Unknown Job'}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No job assignments</p>
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
                <span className="font-medium">System User</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Punch Clock Access:</span>
                <span className="font-medium">{employee.punch_clock_access ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PM Lynk Access:</span>
                <span className="font-medium">{employee.pm_lynk_access ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Added to System:</span>
                <span className="font-medium">{new Date(employee.created_at).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
