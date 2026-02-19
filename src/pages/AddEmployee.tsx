import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function AddEmployee() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    department: '',
    phone: '',
    notes: '',
    pinCode: '',
    groupId: ''
  });
  const [groups, setGroups] = useState<Array<{id: string, name: string}>>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();

  const canManageEmployees = profile?.role === 'admin' || profile?.role === 'controller';

  useEffect(() => {
    loadGroups();
    // Auto-generate PIN on mount
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    setFormData(prev => ({ ...prev, pinCode: newPin }));
  }, []);

  const loadGroups = async () => {
    if (!currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from('employee_groups')
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .order('name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('employee_groups')
        .insert({
          name: newGroupName,
          company_id: currentCompany?.id || '',
          created_by: profile?.user_id || '',
        })
        .select('id, name')
        .single();

      if (error) throw error;

      setGroups(prev => [...prev, data]);
      setFormData(prev => ({ ...prev, groupId: data.id }));
      setNewGroupName('');
      setShowCreateGroup(false);
      
      toast({
        title: 'Success',
        description: 'Group created successfully',
      });
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        title: 'Error',
        description: 'Failed to create group',
        variant: 'destructive',
      });
    }
  };

  if (!canManageEmployees) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to add employees.
          </p>
        </div>
      </div>
    );
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateNewPin = () => {
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    setFormData(prev => ({ ...prev, pinCode: newPin }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields for PIN employee
      if (!formData.firstName || !formData.lastName || !formData.pinCode) {
        toast({
          title: 'Validation Error',
          description: 'First name, last name, and PIN code are required',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (!profile?.user_id) {
        toast({
          title: 'Error',
          description: 'User information is missing',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Create PIN-only employee in pin_employees table
      const { data: newEmployee, error: insertError } = await supabase
        .from('pin_employees')
        .insert({
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          display_name: formData.displayName?.trim() || `${formData.firstName.trim()} ${formData.lastName.trim()}`,
          pin_code: formData.pinCode.trim(),
          department: formData.department?.trim() || null,
          phone: formData.phone?.trim() || null,
          email: null,
          notes: formData.notes?.trim() || null,
          group_id: formData.groupId || null,
          created_by: profile.user_id,
          is_active: true,
          company_id: currentCompany?.id || null
        })
        .select()
        .single();

      if (insertError) {
        console.error('Supabase error:', insertError);
        throw insertError;
      }

      // Grant company access for the PIN employee using secure function
      if (newEmployee && currentCompany?.id) {
        const { error: accessError } = await supabase
          .rpc('admin_grant_company_access', {
            p_user_id: newEmployee.id,
            p_company_id: currentCompany.id,
            p_role: 'employee',
            p_granted_by: profile.user_id,
            p_is_active: true
          });

        if (accessError) {
          console.error('Error granting company access:', accessError);
          throw new Error('Failed to grant company access to employee');
        }
      }

      toast({
        title: 'PIN Employee Created',
        description: `${formData.displayName || formData.firstName} created with PIN: ${formData.pinCode}`,
      });
      
      navigate('/employees');
    } catch (error) {
      console.error('Error adding employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to create PIN employee',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link to="/employees" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to PIN Employees
        </Link>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Clock className="h-7 w-7" />
          Add PIN Employee
        </h1>
        <p className="text-muted-foreground">
          Create a PIN-only employee for punch clock access
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>PIN Employee Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* PIN Code Section */}
            <div className="space-y-2">
              <Label htmlFor="pinCode">PIN Code *</Label>
              <div className="flex gap-2">
                <Input
                  id="pinCode"
                  value={formData.pinCode}
                  onChange={(e) => handleInputChange('pinCode', e.target.value)}
                  placeholder="6-digit PIN"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                />
                <Button type="button" variant="outline" onClick={generateNewPin}>
                  Generate
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Employee will use this 6-digit PIN to access the punch clock
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  placeholder="Engineering"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="groupId">Employee Group</Label>
              <Select value={formData.groupId || "no_group"} onValueChange={(value) => {
                if (value === 'create_new') {
                  setShowCreateGroup(true);
                } else if (value === 'no_group') {
                  handleInputChange('groupId', '');
                } else {
                  handleInputChange('groupId', value);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a group (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_group">No Group</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="create_new" className="text-primary">
                    + Create New Group
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Additional information about the employee..."
                rows={3}
              />
            </div>

            {/* Create New Group Dialog */}
            {showCreateGroup && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium">Create New Group</h4>
                <div className="flex gap-2">
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Enter group name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateGroup();
                      }
                    }}
                  />
                  <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
                    Create
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setShowCreateGroup(false);
                    setNewGroupName('');
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button 
                type="submit" 
                disabled={loading || !formData.pinCode || formData.pinCode.length !== 6 || !formData.firstName || !formData.lastName}
              >
                {loading ? 'Creating Employee...' : 'Create PIN Employee'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/employees')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}