import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, ArrowLeft, Save, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Job {
  id: string;
  name: string;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
}

interface Employee {
  user_id: string;
  display_name: string;
}

export default function ManualTimeEntry() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [formData, setFormData] = useState({
    user_id: user?.id || '',
    job_id: '',
    cost_code_id: '',
    date: new Date().toISOString().split('T')[0],
    punch_in_time: '',
    punch_out_time: '',
    break_minutes: 30,
    notes: ''
  });

  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [jobsResponse, costCodesResponse, employeesResponse] = await Promise.all([
        supabase.from('jobs').select('id, name').order('name'),
        supabase.from('cost_codes').select('id, code, description').eq('is_active', true).order('code'),
        isManager ? supabase.from('profiles').select('user_id, display_name').order('display_name') : Promise.resolve({ data: [] })
      ]);

      if (jobsResponse.data) setJobs(jobsResponse.data);
      if (costCodesResponse.data) setCostCodes(costCodesResponse.data);
      if (employeesResponse.data) setEmployees(employeesResponse.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load form data.",
        variant: "destructive",
      });
    }
  };

  const calculateHours = () => {
    if (!formData.punch_in_time || !formData.punch_out_time) return 0;
    
    const punchIn = new Date(`${formData.date}T${formData.punch_in_time}`);
    const punchOut = new Date(`${formData.date}T${formData.punch_out_time}`);
    
    if (punchOut <= punchIn) return 0;
    
    const diffMs = punchOut.getTime() - punchIn.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    
    // Subtract break time
    const breakHours = formData.break_minutes / 60;
    return Math.max(0, hours - breakHours);
  };

  const calculateOvertime = (totalHours: number) => {
    return Math.max(0, totalHours - 8);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.user_id || !formData.job_id || !formData.punch_in_time || !formData.punch_out_time) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const totalHours = calculateHours();
    if (totalHours <= 0) {
      toast({
        title: "Invalid Time",
        description: "Punch out time must be after punch in time.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const punchInDateTime = new Date(`${formData.date}T${formData.punch_in_time}`);
      const punchOutDateTime = new Date(`${formData.date}T${formData.punch_out_time}`);
      const overtimeHours = calculateOvertime(totalHours);

      const { error } = await supabase
        .from('time_cards')
        .insert({
          user_id: formData.user_id,
          job_id: formData.job_id,
          cost_code_id: formData.cost_code_id || null,
          punch_in_time: punchInDateTime.toISOString(),
          punch_out_time: punchOutDateTime.toISOString(),
          total_hours: totalHours,
          overtime_hours: overtimeHours,
          break_minutes: formData.break_minutes,
          notes: formData.notes || null,
          status: 'submitted',
          created_via_punch_clock: false
        });

      if (error) throw error;

      toast({
        title: "Time Entry Created",
        description: "Manual time entry has been created successfully.",
      });

      navigate('/time-sheets');
    } catch (error) {
      console.error('Error creating time entry:', error);
      toast({
        title: "Error",
        description: "Failed to create time entry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalHours = calculateHours();
  const overtimeHours = calculateOvertime(totalHours);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/time-sheets')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Time Sheets
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manual Time Entry</h1>
          <p className="text-muted-foreground">
            Create a time entry manually
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Entry Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Employee Selection (only for managers) */}
              {isManager && (
                <div className="space-y-2">
                  <Label htmlFor="employee">Employee *</Label>
                  <Select
                    value={formData.user_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, user_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.user_id} value={employee.user_id}>
                          {employee.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>

              {/* Job */}
              <div className="space-y-2">
                <Label htmlFor="job">Job *</Label>
                <Select
                  value={formData.job_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, job_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cost Code */}
              <div className="space-y-2">
                <Label htmlFor="cost-code">Cost Code</Label>
                <Select
                  value={formData.cost_code_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, cost_code_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cost code (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCodes.map((code) => (
                      <SelectItem key={code.id} value={code.id}>
                        {code.code} - {code.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Punch In Time */}
              <div className="space-y-2">
                <Label htmlFor="punch-in">Punch In Time *</Label>
                <Input
                  id="punch-in"
                  type="time"
                  value={formData.punch_in_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, punch_in_time: e.target.value }))}
                  required
                />
              </div>

              {/* Punch Out Time */}
              <div className="space-y-2">
                <Label htmlFor="punch-out">Punch Out Time *</Label>
                <Input
                  id="punch-out"
                  type="time"
                  value={formData.punch_out_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, punch_out_time: e.target.value }))}
                  required
                />
              </div>

              {/* Break Minutes */}
              <div className="space-y-2">
                <Label htmlFor="break">Break Minutes</Label>
                <Input
                  id="break"
                  type="number"
                  min="0"
                  value={formData.break_minutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, break_minutes: parseInt(e.target.value) || 0 }))}
                />
              </div>

              {/* Hours Summary */}
              <div className="space-y-2">
                <Label>Hours Summary</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Hours</p>
                      <p className="font-semibold text-lg">{totalHours.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Overtime</p>
                      <p className="font-semibold text-lg text-warning">{overtimeHours.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/time-sheets')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {loading ? 'Creating...' : 'Create Time Entry'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}