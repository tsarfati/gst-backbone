import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function AddEmployee() {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    displayName: '',
    phone: '',
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
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    setFormData(prev => ({ ...prev, pinCode: newPin }));
  }, []);

  const loadGroups = async () => {
    if (!currentCompany) return;
    const { data } = await supabase
      .from('employee_groups')
      .select('id, name')
      .eq('company_id', currentCompany.id)
      .order('name');
    setGroups(data || []);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    const { data, error } = await supabase
      .from('employee_groups')
      .insert({
        name: newGroupName,
        company_id: currentCompany?.id || '',
        created_by: profile?.user_id || '',
      })
      .select('id, name')
      .single();

    if (error) {
      toast({ title: 'Error', description: 'Failed to create group', variant: 'destructive' });
      return;
    }
    setGroups(prev => [...prev, data]);
    setFormData(prev => ({ ...prev, groupId: data.id }));
    setNewGroupName('');
    setShowCreateGroup(false);
    toast({ title: 'Success', description: 'Group created successfully' });
  };

  if (!canManageEmployees) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
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
      if (!formData.email || !formData.firstName || !formData.lastName) {
        toast({ title: 'Validation Error', description: 'Email, first name, and last name are required', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: {
          email: formData.email.trim(),
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          display_name: formData.displayName?.trim() || `${formData.firstName.trim()} ${formData.lastName.trim()}`,
          pin_code: formData.pinCode?.trim() || null,
          phone: formData.phone?.trim() || null,
          company_id: currentCompany?.id,
          group_id: formData.groupId || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Employee Created',
        description: `${formData.displayName || formData.firstName} has been added${formData.pinCode ? ` with PIN: ${formData.pinCode}` : ''}`,
      });
      
      navigate('/employees');
    } catch (error: any) {
      console.error('Error adding employee:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create employee',
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
          Back to Employees
        </Link>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <UserPlus className="h-7 w-7" />
          Add Employee
        </h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Employee Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="employee@company.com"
                required
              />
              <p className="text-sm text-muted-foreground">
                Used to create the employee's account
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
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pinCode">PIN Code (for Punch Clock)</Label>
                <div className="flex gap-2">
                  <Input
                    id="pinCode"
                    value={formData.pinCode}
                    onChange={(e) => handleInputChange('pinCode', e.target.value)}
                    placeholder="6-digit PIN"
                    maxLength={6}
                    pattern="[0-9]{6}"
                  />
                  <Button type="button" variant="outline" onClick={generateNewPin}>
                    Generate
                  </Button>
                </div>
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
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                  <SelectItem value="create_new" className="text-primary">+ Create New Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showCreateGroup && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium">Create New Group</h4>
                <div className="flex gap-2">
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Enter group name"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateGroup(); } }}
                  />
                  <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>Create</Button>
                  <Button variant="outline" onClick={() => { setShowCreateGroup(false); setNewGroupName(''); }}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={loading || !formData.email || !formData.firstName || !formData.lastName}>
                {loading ? 'Creating Employee...' : 'Create Employee'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/employees')}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
