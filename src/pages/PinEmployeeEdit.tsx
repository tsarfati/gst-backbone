import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, User, Key, Camera, Briefcase, Code, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import PinEmployeeCompanyAccess from '@/components/PinEmployeeCompanyAccess';

interface PinEmployee {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  pin_code: string;
  phone?: string;
  department?: string;
  avatar_url?: string;
  group_id?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

interface EmployeeGroup {
  id: string;
  name: string;
  color: string;
}

export default function PinEmployeeEdit() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [employee, setEmployee] = useState<PinEmployee | null>(null);
  const [groups, setGroups] = useState<EmployeeGroup[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [costCodes, setCostCodes] = useState<any[]>([]);
  const [assignedJobs, setAssignedJobs] = useState<string[]>([]);
  const [assignedCostCodes, setAssignedCostCodes] = useState<string[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [costCodeSearch, setCostCodeSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const canManageEmployees = profile?.role === 'admin' || profile?.role === 'controller';

  useEffect(() => {
    if (employeeId && currentCompany) {
      fetchEmployee();
      fetchGroups();
      fetchJobs();
      fetchAssignments();
    }
  }, [employeeId, currentCompany]);

  useEffect(() => {
    if (selectedJobId) {
      fetchCostCodes();
    } else {
      setCostCodes([]);
      setAssignedCostCodes([]);
    }
  }, [selectedJobId]);

  const fetchEmployee = async () => {
    if (!employeeId) return;

    try {
      const { data, error } = await supabase
        .from('pin_employees')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (error) throw error;
      setEmployee(data);
    } catch (error) {
      console.error('Error fetching PIN employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employee details',
        variant: 'destructive',
      });
      navigate('/employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_groups')
        .select('*')
        .order('name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchJobs = async () => {
    if (!currentCompany) return;
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, client, status')
        .eq('company_id', currentCompany.id)
        .order('name');

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchCostCodes = async () => {
    if (!currentCompany || !selectedJobId) {
      setCostCodes([]);
      return;
    }
    
    try {
      // Fetch job-specific labor cost codes
      const { data, error } = await supabase
        .from('cost_codes')
        .select('id, code, description, type')
        .eq('company_id', currentCompany.id)
        .eq('job_id', selectedJobId)
        .eq('type', 'labor')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setCostCodes(data || []);
    } catch (error) {
      console.error('Error fetching cost codes:', error);
    }
  };

  const fetchAssignments = async () => {
    if (!employeeId || !currentCompany) return;
    
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from('employee_timecard_settings')
        .select('assigned_jobs, assigned_cost_codes')
        .eq('user_id', employeeId)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (settingsError) throw settingsError;

      setAssignedJobs(settingsData?.assigned_jobs || []);
      if (settingsData?.assigned_cost_codes) {
        setAssignedCostCodes(settingsData.assigned_cost_codes);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const fetchAssignedCostCodesForJob = async (jobId: string) => {
    if (!employeeId) return;
    
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from('employee_timecard_settings')
        .select('assigned_cost_codes, assigned_jobs')
        .eq('user_id', employeeId)
        .maybeSingle();

      if (settingsError) throw settingsError;
      
      // Filter cost codes to only those for the selected job
      const allAssignedCodes = settingsData?.assigned_cost_codes || [];
      const jobCodes = costCodes
        .filter(cc => allAssignedCodes.includes(cc.id))
        .map(cc => cc.id);
      
      setAssignedCostCodes(jobCodes);
    } catch (error) {
      console.error('Error fetching assigned cost codes:', error);
    }
  };

  const handleSave = async () => {
    if (!employee || !canManageEmployees || !currentCompany) return;

    try {
      setSaving(true);
      
      // Update employee profile
      const { error: employeeError } = await supabase
        .from('pin_employees')
        .update({
          first_name: employee.first_name,
          last_name: employee.last_name,
          display_name: employee.display_name,
          pin_code: employee.pin_code,
          phone: employee.phone || null,
          department: employee.department || null,
          group_id: employee.group_id || null,
          notes: employee.notes || null,
          is_active: employee.is_active
        })
        .eq('id', employee.id);

      if (employeeError) throw employeeError;

      // Job assignments are saved via employee_timecard_settings below

      // Update cost code assignments
      const { error: settingsError } = await supabase
        .from('employee_timecard_settings')
        .upsert({
          user_id: employee.id,
          company_id: currentCompany.id,
          assigned_jobs: assignedJobs,
          assigned_cost_codes: assignedCostCodes,
          created_by: profile?.user_id
        }, {
          onConflict: 'user_id,company_id'
        });

      if (settingsError) throw settingsError;

      toast({
        title: 'Success',
        description: 'PIN employee updated successfully',
      });
      
      navigate('/employees');
    } catch (error) {
      console.error('Error updating PIN employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to update employee',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleJobAssignment = (jobId: string) => {
    setAssignedJobs(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const toggleCostCodeAssignment = (costCodeId: string) => {
    setAssignedCostCodes(prev => 
      prev.includes(costCodeId) 
        ? prev.filter(id => id !== costCodeId)
        : [...prev, costCodeId]
    );
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !employee) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 2MB",
        variant: "destructive"
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `pin-employees/${employee.id}/avatar.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('pin_employees')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', employee.id);

      if (updateError) throw updateError;

      setEmployee(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : null);
      
      toast({
        title: "Success", 
        description: "Avatar updated successfully"
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Error",
        description: "Failed to upload avatar",
        variant: "destructive"
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const generateRandomPin = () => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setEmployee(prev => prev ? { ...prev, pin_code: pin } : null);
  };

  if (!canManageEmployees) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to edit employees.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading employee details...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Employee Not Found</h1>
          <Button onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Employees
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => navigate('/employees')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Employees
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit PIN Employee</h1>
          <p className="text-muted-foreground">
            Manage PIN employee profile and settings
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee Profile */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6 mb-6">
                <div className="flex flex-col items-center gap-2">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={employee.avatar_url} alt={employee.display_name} />
                    <AvatarFallback className="text-lg">
                      {`${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingAvatar}
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                  >
                    {uploadingAvatar ? (
                      <>Uploading...</>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 mr-2" />
                        Upload Avatar
                      </>
                    )}
                  </Button>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        value={employee.first_name}
                        onChange={(e) => setEmployee(prev => prev ? { ...prev, first_name: e.target.value } : null)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={employee.last_name}
                        onChange={(e) => setEmployee(prev => prev ? { ...prev, last_name: e.target.value } : null)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="display_name">Display Name</Label>
                    <Input
                      id="display_name"
                      value={employee.display_name}
                      onChange={(e) => setEmployee(prev => prev ? { ...prev, display_name: e.target.value } : null)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                PIN & Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pin_code">PIN Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pin_code"
                      value={employee.pin_code}
                      onChange={(e) => setEmployee(prev => prev ? { ...prev, pin_code: e.target.value } : null)}
                      maxLength={6}
                      pattern="[0-9]{6}"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generateRandomPin}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={employee.phone || ''}
                    onChange={(e) => setEmployee(prev => prev ? { ...prev, phone: e.target.value } : null)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={employee.department || ''}
                    onChange={(e) => setEmployee(prev => prev ? { ...prev, department: e.target.value } : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="group_id">Employee Group</Label>
                  <Select 
                    value={employee.group_id || 'no-group'} 
                    onValueChange={(value) => setEmployee(prev => prev ? { ...prev, group_id: value === 'no-group' ? null : value } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-group">No Group</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={employee.notes || ''}
                  onChange={(e) => setEmployee(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  rows={3}
                />
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
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Select which jobs this employee can access
              </p>
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No jobs available</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {jobs.map((job) => (
                    <div key={job.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`job-${job.id}`}
                        checked={assignedJobs.includes(job.id)}
                        onCheckedChange={() => toggleJobAssignment(job.id)}
                      />
                      <Label
                        htmlFor={`job-${job.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {job.name}
                        {job.client && (
                          <span className="text-muted-foreground ml-2">({job.client})</span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost Code Assignments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Cost Code Assignments (Job-Specific Labor Codes)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Job First</Label>
                <Select value={selectedJobId} onValueChange={(value) => {
                  setSelectedJobId(value);
                  setAssignedCostCodes([]);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job to view cost codes" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                        {job.client && <span className="text-muted-foreground ml-2">({job.client})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {selectedJobId && (
                <>
                  <div className="space-y-2">
                    <Label>Search Cost Codes</Label>
                    <Input
                      placeholder="Search by code or description..."
                      value={costCodeSearch}
                      onChange={(e) => setCostCodeSearch(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Showing labor cost codes for selected job
                    </Label>
                    {costCodes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No labor cost codes available for this job</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg divide-y">
                        {costCodes
                          .filter(costCode => 
                            costCodeSearch === '' ||
                            costCode.code.toLowerCase().includes(costCodeSearch.toLowerCase()) ||
                            costCode.description.toLowerCase().includes(costCodeSearch.toLowerCase())
                          )
                          .map((costCode) => (
                            <div key={costCode.id} className="flex items-center space-x-2 p-3">
                              <Checkbox
                                id={`costcode-${costCode.id}`}
                                checked={assignedCostCodes.includes(costCode.id)}
                                onCheckedChange={() => toggleCostCodeAssignment(costCode.id)}
                              />
                              <Label
                                htmlFor={`costcode-${costCode.id}`}
                                className="text-sm font-normal cursor-pointer flex-1"
                              >
                                <span className="font-mono font-medium">{costCode.code}</span>
                                <span className="text-muted-foreground ml-2">- {costCode.description}</span>
                              </Label>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Employee Info & Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Employee Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                  <Key className="h-3 w-3" />
                  PIN Only Employee
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <p><strong>Employee ID:</strong> {employee.id}</p>
                <p><strong>Created:</strong> {new Date(employee.created_at).toLocaleDateString()}</p>
                <p><strong>Status:</strong> {employee.is_active ? 'Active' : 'Inactive'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/employees')}
                className="w-full"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Company Access Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PinEmployeeCompanyAccess pinEmployeeId={employeeId!} />
        </CardContent>
      </Card>
    </div>
  );
}