import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useCompany } from '@/contexts/CompanyContext';

interface UserCompanyAccessProps {
  userId: string;
}

interface CompanyAccess {
  id: string;
  company_id: string;
  role: string;
  is_active: boolean | null;
  granted_at: string;
  company?: {
    id: string;
    name: string;
    display_name?: string;
  };
}

interface Company {
  id: string;
  name: string;
  display_name?: string;
}

const normalizeCompanyKey = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\b(llc|inc|corp|corporation|co|company)\b/g, ' ')
    .replace(/\s+/g, ' ');

const areCompanyNamesEquivalent = (left?: string | null, right?: string | null) => {
  const normalizedLeft = normalizeCompanyKey(left);
  const normalizedRight = normalizeCompanyKey(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftTokens = normalizedLeft.split(' ').filter(Boolean);
  const rightTokens = normalizedRight.split(' ').filter(Boolean);
  const shorterTokens = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longerTokens = leftTokens.length <= rightTokens.length ? rightTokens : leftTokens;

  if (shorterTokens.length < 2) return false;

  return shorterTokens.every((token, index) => longerTokens[index] === token);
};

const getRolePriority = (role?: string | null) => {
  switch (String(role || '').trim().toLowerCase()) {
    case 'owner':
      return 100;
    case 'company_admin':
    case 'admin':
      return 90;
    case 'controller':
      return 80;
    case 'project_manager':
      return 70;
    case 'employee':
      return 60;
    case 'view_only':
      return 50;
    default:
      return 0;
  }
};

export default function UserCompanyAccess({ userId }: UserCompanyAccessProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { currentTenant } = useTenant();
  const { userCompanies, currentCompany } = useCompany();
  const [companyAccesses, setCompanyAccesses] = useState<CompanyAccess[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('employee');

  const roleOptions = [
    { value: 'admin', label: 'Administrator', variant: 'destructive' as const },
    { value: 'controller', label: 'Controller', variant: 'secondary' as const },
    { value: 'company_admin', label: 'Company Admin', variant: 'secondary' as const },
    { value: 'project_manager', label: 'Project Manager', variant: 'default' as const },
    { value: 'employee', label: 'Employee', variant: 'outline' as const },
    { value: 'view_only', label: 'View Only', variant: 'outline' as const },
  ];

  useEffect(() => {
    fetchCompanyAccesses();
    if (currentTenant?.id) {
      fetchAllCompanies();
    }
  }, [userId, currentTenant?.id, userCompanies.map((company) => company.company_id).join(',')]);

  const fetchCompanyAccesses = async () => {
    try {
      const { data: accessRows, error: accessError } = await supabase
        .functions.invoke('get-user-company-access', {
          body: {
            userId,
            contextCompanyId: currentCompany?.id,
          },
        });

      if (accessError) throw accessError;
      setCompanyAccesses((((accessRows as any)?.accesses) || []) as CompanyAccess[]);
    } catch (error: any) {
      console.error('Error fetching company accesses:', error);
      console.error(`Error fetching company accesses details: ${JSON.stringify({
        message: error?.message || null,
        details: error?.details || null,
        hint: error?.hint || null,
        code: error?.code || null,
        name: error?.name || null,
        status: error?.status || null,
        userId,
      })}`);
      toast({
        title: "Error",
        description: "Failed to load company access information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCompanies = async () => {
    if (!currentTenant?.id) {
      setAllCompanies([]);
      return;
    }

    const accessibleCompanyIds = Array.from(
      new Set(
        (userCompanies || [])
          .map((company) => String(company.company_id || '').trim())
          .filter(Boolean),
      ),
    );

    if (accessibleCompanyIds.length === 0) {
      setAllCompanies([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, display_name')
        .eq('is_active', true)
        .eq('tenant_id', currentTenant.id)
        .in('id', accessibleCompanyIds)
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
        title: "Validation Error",
        description: "Please select a company and role",
        variant: "destructive",
      });
      return;
    }

    try {
      // Use upsert to handle re-adding previously removed access
      const { error } = await supabase
        .from('user_company_access')
        .upsert({
          user_id: userId,
          company_id: selectedCompanyId,
          role: selectedRole as 'admin' | 'controller' | 'company_admin' | 'project_manager' | 'employee' | 'view_only',
          granted_by: currentUser?.id || userId,
          is_active: true,
          granted_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,company_id',
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company access granted successfully",
      });

      setShowAddDialog(false);
      setSelectedCompanyId('');
      setSelectedRole('employee');
      fetchCompanyAccesses();
    } catch (error: any) {
      console.error('Error granting access:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to grant company access",
        variant: "destructive",
      });
    }
  };

  const handleUpdateRole = async (accessId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_company_access')
        .update({ role: newRole as 'admin' | 'controller' | 'company_admin' | 'project_manager' | 'employee' | 'view_only' })
        .eq('id', accessId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role updated successfully",
      });

      fetchCompanyAccesses();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAccess = async (accessId: string) => {
    try {
      const { error } = await supabase
        .from('user_company_access')
        .update({ is_active: false })
        .eq('id', accessId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company access removed",
      });

      fetchCompanyAccesses();
    } catch (error) {
      console.error('Error removing access:', error);
      toast({
        title: "Error",
        description: "Failed to remove company access",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    return roleOptions.find(r => r.value === role)?.variant || 'outline';
  };

  const getRoleLabel = (role: string) => {
    return roleOptions.find(r => r.value === role)?.label || role;
  };

  const normalizedCompanyAccesses = companyAccesses.reduce<CompanyAccess[]>((acc, access) => {
    const existingIndex = acc.findIndex((existingAccess) =>
      existingAccess.company_id === access.company_id ||
      areCompanyNamesEquivalent(
        existingAccess.company?.display_name || existingAccess.company?.name,
        access.company?.display_name || access.company?.name,
      ),
    );

    if (existingIndex === -1) {
      acc.push(access);
      return acc;
    }

    const existingAccess = acc[existingIndex];
    if (getRolePriority(access.role) >= getRolePriority(existingAccess.role)) {
      acc[existingIndex] = access;
    }

    return acc;
  }, []);

  const availableCompanies = allCompanies.filter(
    company => !companyAccesses.some(access => access.company_id === company.id)
  );

  if (loading) {
    return <div className="text-center py-4"><span className="loading-dots">Loading company access</span></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage which companies this user can access and their role in each company
        </p>
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
                Select a company and assign a role for this user
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
                        {company.display_name || company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddAccess}>
                Grant Access
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
          {normalizedCompanyAccesses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8">
                <div className="flex flex-col items-center gap-2">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground">No company access assigned</p>
                  <p className="text-sm text-muted-foreground">
                    Click "Add Company Access" to grant access to a company
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            normalizedCompanyAccesses.map((access) => (
              <TableRow key={access.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {access.company?.display_name || access.company?.name || 'Unknown'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={access.role}
                    onValueChange={(newRole) => handleUpdateRole(access.id, newRole)}
                  >
                    <SelectTrigger className="w-[180px]">
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
                <TableCell>
                  {new Date(access.granted_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAccess(access.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
