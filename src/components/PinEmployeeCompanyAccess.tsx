import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PinEmployeeCompanyAccessProps {
  pinEmployeeId: string;
}

interface CompanyAccess {
  id: string;
  company_id: string;
  role: string;
  granted_at: string;
  company?: {
    id: string;
    name: string;
  };
}

interface Company {
  id: string;
  name: string;
}

export default function PinEmployeeCompanyAccess({ pinEmployeeId }: PinEmployeeCompanyAccessProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [companyAccesses, setCompanyAccesses] = useState<CompanyAccess[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('employee');
  const [accessToRemove, setAccessToRemove] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanyAccesses();
    fetchAllCompanies();
  }, [pinEmployeeId]);

  const fetchCompanyAccesses = async () => {
    try {
      const { data, error } = await supabase
        .from('user_company_access')
        .select(`
          id,
          company_id,
          role,
          companies (
            id,
            name
          )
        `)
        .eq('user_id', pinEmployeeId);

      if (error) throw error;
      
      setCompanyAccesses(data?.map(item => ({
        id: item.id,
        company_id: item.company_id,
        role: item.role,
        granted_at: new Date().toISOString(), // Will display properly even without DB timestamp
        company: Array.isArray(item.companies) ? item.companies[0] : item.companies
      })) || []);
    } catch (error) {
      console.error('Error fetching company accesses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load company access',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAllCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleAddAccess = async () => {
    if (!selectedCompanyId || !selectedRole) {
      toast({
        title: 'Error',
        description: 'Please select a company and role',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('user_company_access')
        .insert({
          user_id: pinEmployeeId,
          company_id: selectedCompanyId,
          role: selectedRole as 'admin' | 'controller' | 'project_manager' | 'employee',
          granted_by: currentUser?.id || pinEmployeeId,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Company access granted successfully',
      });

      setShowAddDialog(false);
      setSelectedCompanyId('');
      setSelectedRole('employee');
      fetchCompanyAccesses();
    } catch (error: any) {
      console.error('Error adding company access:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to grant company access',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateRole = async (accessId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_company_access')
        .update({ role: newRole as 'admin' | 'controller' | 'project_manager' | 'employee' })
        .eq('id', accessId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Role updated successfully',
      });

      fetchCompanyAccesses();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update role',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveAccess = async () => {
    if (!accessToRemove) return;

    try {
      const { error } = await supabase
        .from('user_company_access')
        .delete()
        .eq('id', accessToRemove);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Company access removed successfully',
      });

      setAccessToRemove(null);
      fetchCompanyAccesses();
    } catch (error) {
      console.error('Error removing access:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove company access',
        variant: 'destructive',
      });
    }
  };

  const roleOptions = [
    { value: 'employee', label: 'Employee', variant: 'secondary' as const },
    { value: 'project_manager', label: 'Project Manager', variant: 'default' as const },
    { value: 'controller', label: 'Controller', variant: 'default' as const },
    { value: 'admin', label: 'Admin', variant: 'destructive' as const }
  ];

  const getRoleBadgeVariant = (role: string) => {
    const option = roleOptions.find(opt => opt.value === role);
    return option?.variant || 'secondary';
  };

  const getRoleLabel = (role: string) => {
    const option = roleOptions.find(opt => opt.value === role);
    return option?.label || role;
  };

  const availableCompanies = allCompanies.filter(
    company => !companyAccesses.some(access => access.company_id === company.id)
  );

  if (loading) {
    return <div className="text-center p-4">Loading company access...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Company Access</h3>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Company Access
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grant Company Access</DialogTitle>
              <DialogDescription>
                Give this PIN employee access to another company and set their role.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Company</label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCompanies.map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddAccess}>
                Grant Access
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {companyAccesses.length === 0 ? (
        <div className="text-center p-8 border rounded-lg border-dashed">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">
            This PIN employee doesn't have access to any companies yet.
          </p>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Company Access
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Granted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companyAccesses.map((access) => (
              <TableRow key={access.id}>
                <TableCell className="font-medium">
                  {access.company?.name || 'Unknown Company'}
                </TableCell>
                <TableCell>
                  <Select
                    value={access.role}
                    onValueChange={(newRole) => handleUpdateRole(access.id, newRole)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue>
                        <Badge variant={getRoleBadgeVariant(access.role)}>
                          {getRoleLabel(access.role)}
                        </Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(access.granted_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAccessToRemove(access.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={!!accessToRemove} onOpenChange={() => setAccessToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Company Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this company access? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveAccess}>
              Remove Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
