import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Edit3, Save, X, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

interface RoleDefinition {
  role: string;
  label: string;
  permissions: string[];
  color: string;
}

const defaultRoleDefinitions: RoleDefinition[] = [
  {
    role: 'admin',
    label: 'Administrator',
    color: 'destructive',
    permissions: [
      'Full system access',
      'Manage all users and roles',
      'Access all data and settings',
      'Create/edit/delete all records'
    ]
  },
  {
    role: 'controller',
    label: 'Controller',
    color: 'secondary',
    permissions: [
      'Financial oversight',
      'Manage user roles (except admin)',
      'Access all financial data',
      'Approve invoices and payments'
    ]
  },
  {
    role: 'project_manager',
    label: 'Project Manager',
    color: 'default',
    permissions: [
      'Manage assigned projects',
      'Create and edit jobs',
      'Assign vendors to projects',
      'View project financial data'
    ]
  },
  {
    role: 'employee',
    label: 'Employee',
    color: 'outline',
    permissions: [
      'Upload and code receipts',
      'View assigned jobs',
      'Basic vendor information',
      'Limited financial access'
    ]
  },
  {
    role: 'view_only',
    label: 'View Only',
    color: 'outline',
    permissions: [
      'Read-only access',
      'View reports and dashboards',
      'No editing capabilities',
      'Basic system navigation'
    ]
  }
];

export default function RoleDefinitions() {
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>(defaultRoleDefinitions);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editingPermission, setEditingPermission] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  const isAdmin = profile?.role === 'admin';

  const startEditRole = (role: string) => {
    setEditingRole(role);
  };

  const stopEditRole = () => {
    setEditingRole(null);
    setEditingPermission('');
  };

  const updateRoleLabel = (role: string, newLabel: string) => {
    setRoleDefinitions(prev => 
      prev.map(r => r.role === role ? { ...r, label: newLabel } : r)
    );
    setHasUnsavedChanges(true);
  };

  const addPermission = (role: string) => {
    if (!editingPermission.trim()) return;
    
    setRoleDefinitions(prev => 
      prev.map(r => 
        r.role === role 
          ? { ...r, permissions: [...r.permissions, editingPermission.trim()] }
          : r
      )
    );
    setEditingPermission('');
    setHasUnsavedChanges(true);
    toast({
      title: 'Permission Added',
      description: 'New permission has been added to the role',
    });
  };

  const removePermission = (role: string, permissionIndex: number) => {
    setRoleDefinitions(prev => 
      prev.map(r => 
        r.role === role 
          ? { ...r, permissions: r.permissions.filter((_, i) => i !== permissionIndex) }
          : r
      )
    );
    setHasUnsavedChanges(true);
    toast({
      title: 'Permission Removed',
      description: 'Permission has been removed from the role',
    });
  };

  const updatePermission = (role: string, permissionIndex: number, newText: string) => {
    setRoleDefinitions(prev => 
      prev.map(r => 
        r.role === role 
          ? { 
              ...r, 
              permissions: r.permissions.map((p, i) => i === permissionIndex ? newText : p)
            }
          : r
      )
    );
    setHasUnsavedChanges(true);
  };

  const saveChanges = () => {
    // In a real application, this would save to the database
    setHasUnsavedChanges(false);
    toast({
      title: 'Changes Saved',
      description: 'Role definitions have been updated successfully',
    });
  };

  return (
    <div className="space-y-6">
      {hasUnsavedChanges && isAdmin && (
        <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
          <p className="text-sm text-muted-foreground">You have unsaved changes to role definitions</p>
          <Button onClick={saveChanges} size="sm">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      )}
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {roleDefinitions.map((roleDef) => (
        <Card key={roleDef.role} className="relative">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <Badge variant={roleDef.color as any}>
                {roleDef.label}
              </Badge>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => 
                    editingRole === roleDef.role ? stopEditRole() : startEditRole(roleDef.role)
                  }
                >
                  {editingRole === roleDef.role ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {roleDef.permissions.map((permission, index) => (
                <div key={index} className="flex items-center gap-2">
                  {editingRole === roleDef.role ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={permission}
                        onChange={(e) => updatePermission(roleDef.role, index, e.target.value)}
                        className="text-sm h-8"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removePermission(roleDef.role, index)}
                        className="p-1 h-6 w-6"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <p>• {permission}</p>
                  )}
                </div>
              ))}
              
              {editingRole === roleDef.role && (
                <div className="flex items-center gap-2 mt-3">
                  <Input
                    placeholder="Add new permission..."
                    value={editingPermission}
                    onChange={(e) => setEditingPermission(e.target.value)}
                    className="text-sm h-8"
                    onKeyPress={(e) => e.key === 'Enter' && addPermission(roleDef.role)}
                  />
                  <Button
                    size="sm"
                    onClick={() => addPermission(roleDef.role)}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
}