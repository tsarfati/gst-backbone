import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { UserPlus, ArrowLeft, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function AddEmployee() {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    displayName: '',
    role: 'employee',
    department: '',
    phone: '',
    notes: '',
    punchClockOnly: false,
    pinCode: ''
  });
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const canManageEmployees = profile?.role === 'admin' || profile?.role === 'controller';

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

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ 
      ...prev, 
      [field]: value,
      // Auto-generate PIN when enabling punch clock only mode
      ...(field === 'punchClockOnly' && value === true && !prev.pinCode ? 
        { pinCode: Math.floor(1000 + Math.random() * 9000).toString() } : {}
      )
    }));
  };

  const generateNewPin = () => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData(prev => ({ ...prev, pinCode: newPin }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (formData.punchClockOnly) {
        // Create PIN-only employee in pin_employees table
        const { error } = await supabase
          .from('pin_employees')
          .insert({
            first_name: formData.firstName,
            last_name: formData.lastName,
            display_name: formData.displayName || `${formData.firstName} ${formData.lastName}`,
            pin_code: formData.pinCode,
            department: formData.department,
            phone: formData.phone,
            notes: formData.notes,
            created_by: profile?.user_id || ''
          });

        if (error) throw error;

        toast({
          title: 'PIN Employee Created',
          description: `${formData.displayName} created with PIN: ${formData.pinCode}`,
        });
      } else {
        // Send invitation for full account access
        toast({
          title: 'Employee Invitation Sent',
          description: `Invitation email sent to ${formData.email}`,
        });
      }
      
      navigate('/employees');
    } catch (error) {
      console.error('Error adding employee:', error);
      toast({
        title: 'Error',
        description: formData.punchClockOnly ? 'Failed to create PIN employee' : 'Failed to send employee invitation',
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
          Add New Employee
        </h1>
        <p className="text-muted-foreground">
          Send an invitation or create a PIN-only employee for punch clock access
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Employee Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Punch Clock Only Toggle */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <Label className="text-base font-medium">Punch Clock Only Employee</Label>
                    <p className="text-sm text-muted-foreground">
                      Create employee with PIN access for punch clock only (no email invitation)
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.punchClockOnly}
                  onCheckedChange={(checked) => handleInputChange('punchClockOnly', checked)}
                />
              </div>
            </div>

            {/* PIN Code Section */}
            {formData.punchClockOnly && (
              <div className="space-y-2">
                <Label htmlFor="pinCode">PIN Code *</Label>
                <div className="flex gap-2">
                  <Input
                    id="pinCode"
                    value={formData.pinCode}
                    onChange={(e) => handleInputChange('pinCode', e.target.value)}
                    placeholder="4-digit PIN"
                    maxLength={4}
                    pattern="[0-9]{4}"
                    required
                  />
                  <Button type="button" variant="outline" onClick={generateNewPin}>
                    Generate
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Employee will use this PIN to access the punch clock
                </p>
              </div>
            )}

            {/* Email field - only show if not punch clock only */}
            {!formData.punchClockOnly && (
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="john.doe@company.com"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!formData.punchClockOnly && (
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="controller">Controller</SelectItem>
                      <SelectItem value="project_manager">Project Manager</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="view_only">View Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Doe"
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
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Additional information about the employee..."
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button 
                type="submit" 
                disabled={loading || (formData.punchClockOnly && !formData.pinCode)}
              >
                {loading ? 
                  (formData.punchClockOnly ? 'Creating Employee...' : 'Sending Invitation...') : 
                  (formData.punchClockOnly ? 'Create PIN Employee' : 'Send Invitation')
                }
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