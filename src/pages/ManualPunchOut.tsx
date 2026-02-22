import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, MapPin, LogOut, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface PunchedInEmployee {
  id: string;
  user_id: string;
  punch_in_time: string;
  job_id?: string;
  cost_code_id?: string;
  company_id?: string;
  punch_in_location_lat?: number;
  punch_in_location_lng?: number;
  profiles?: {
    display_name: string;
    avatar_url?: string;
  };
  jobs?: {
    name: string;
  };
  cost_codes?: {
    code: string;
    description: string;
  };
}

interface CostCode {
  id: string;
  code: string;
  description: string;
}

export default function ManualPunchOut() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [punchedInEmployees, setPunchedInEmployees] = useState<PunchedInEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [punchingOut, setPunchingOut] = useState<string | null>(null);
  
  // Dialog state for cost code selection
  const [punchOutDialogOpen, setPunchOutDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<PunchedInEmployee | null>(null);
  const [jobCostCodes, setJobCostCodes] = useState<CostCode[]>([]);
  const [selectedCostCodeId, setSelectedCostCodeId] = useState<string>('');
  const [loadingCostCodes, setLoadingCostCodes] = useState(false);

  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    if (!isManager) {
      toast({
        title: "Access Denied",
        description: "Only managers can manually punch out employees.",
        variant: "destructive",
      });
      navigate('/time-sheets');
      return;
    }
    loadPunchedInEmployees();
  }, [isManager, navigate, toast]);

  const loadPunchedInEmployees = async () => {
    try {
      setLoading(true);
      
      const { data: currentPunchData, error } = await supabase
        .from('current_punch_status')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      // Fetch related data for each punched in employee
      const employeesWithDetails = await Promise.all(
        currentPunchData.map(async (punch) => {
          const [profileData, jobData, costCodeData] = await Promise.all([
            supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('user_id', punch.user_id)
              .single(),
            punch.job_id ? supabase
              .from('jobs')
              .select('name')
              .eq('id', punch.job_id)
              .single() : Promise.resolve({ data: null }),
            punch.cost_code_id ? supabase
              .from('cost_codes')
              .select('code, description')
              .eq('id', punch.cost_code_id)
              .single() : Promise.resolve({ data: null })
          ]);

          return {
            ...punch,
            profiles: profileData.data,
            jobs: jobData.data,
            cost_codes: costCodeData.data
          };
        })
      );

      setPunchedInEmployees(employeesWithDetails);
    } catch (error) {
      console.error('Error loading punched in employees:', error);
      toast({
        title: "Error",
        description: "Failed to load punched in employees.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadJobCostCodes = async (jobId: string) => {
    try {
      setLoadingCostCodes(true);
      
      // Fetch cost codes that are assigned to this specific job
      const { data, error } = await supabase
        .from('cost_codes')
        .select('id, code, description')
        .eq('job_id', jobId)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      
      setJobCostCodes(data || []);
    } catch (error) {
      console.error('Error loading job cost codes:', error);
      toast({
        title: "Error",
        description: "Failed to load cost codes for this job.",
        variant: "destructive",
      });
      setJobCostCodes([]);
    } finally {
      setLoadingCostCodes(false);
    }
  };

  const openPunchOutDialog = async (employee: PunchedInEmployee) => {
    setSelectedEmployee(employee);
    setSelectedCostCodeId(employee.cost_code_id || '');
    setPunchOutDialogOpen(true);
    
    if (employee.job_id) {
      await loadJobCostCodes(employee.job_id);
    } else {
      setJobCostCodes([]);
    }
  };

  const handleManualPunchOut = async () => {
    if (!selectedEmployee) return;
    
    try {
      setPunchingOut(selectedEmployee.id);

      // Create punch out record with selected cost code
      const { error: punchError } = await supabase
        .from('punch_records')
        .insert({
          user_id: selectedEmployee.user_id,
          job_id: selectedEmployee.job_id,
          cost_code_id: selectedCostCodeId || selectedEmployee.cost_code_id,
          company_id: selectedEmployee.company_id || '',
          punch_type: 'punched_out',
          punch_time: new Date().toISOString(),
          notes: 'Manual punch out by manager',
          user_agent: navigator.userAgent,
          ip_address: null
        });

      if (punchError) throw punchError;

      // Remove from current punch status
      const { error: statusError } = await supabase
        .from('current_punch_status')
        .update({ is_active: false })
        .eq('id', selectedEmployee.id);

      if (statusError) throw statusError;

      toast({
        title: "Employee Punched Out",
        description: `${selectedEmployee.profiles?.display_name} has been successfully punched out.`,
      });

      setPunchOutDialogOpen(false);
      setSelectedEmployee(null);
      setJobCostCodes([]);
      setSelectedCostCodeId('');
      
      // Reload the list
      loadPunchedInEmployees();
    } catch (error) {
      console.error('Error punching out employee:', error);
      toast({
        title: "Error",
        description: "Failed to punch out employee. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPunchingOut(null);
    }
  };

  const formatPunchInTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
      duration: `${diffHours}h ${diffMinutes}m`
    };
  };

  if (!isManager) {
    return null;
  }

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
          <h1 className="text-2xl font-bold text-foreground">Manual Punch Out</h1>
          <p className="text-muted-foreground">
            Manually punch out employees who are currently clocked in
          </p>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Clock className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading punched in employees...</span>
            </div>
          </CardContent>
        </Card>
      ) : punchedInEmployees.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Employees Punched In</h3>
              <p className="text-muted-foreground">
                All employees are currently punched out.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {punchedInEmployees.map((employee) => {
            const timeInfo = formatPunchInTime(employee.punch_in_time);
            
            return (
              <Card key={employee.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={employee.profiles?.avatar_url} />
                        <AvatarFallback>
                          {employee.profiles?.display_name?.substring(0, 2) || 'UN'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">
                          {employee.profiles?.display_name || 'Unknown Employee'}
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                          <div>
                            <p className="text-sm text-muted-foreground">Punch In Time</p>
                            <p className="font-medium">{timeInfo.time}</p>
                          </div>
                          
                          <div>
                            <p className="text-sm text-muted-foreground">Duration</p>
                            <Badge variant="secondary" className="font-mono">
                              {timeInfo.duration}
                            </Badge>
                          </div>
                          
                          <div>
                            <p className="text-sm text-muted-foreground">Job</p>
                            <p className="font-medium">
                              {employee.jobs?.name || 'No Job Selected'}
                            </p>
                          </div>
                        </div>

                        {employee.cost_codes && (
                          <div className="mt-2">
                            <p className="text-sm text-muted-foreground">Cost Code</p>
                            <p className="font-medium">
                              {employee.cost_codes.code} - {employee.cost_codes.description}
                            </p>
                          </div>
                        )}

                        {employee.punch_in_location_lat && employee.punch_in_location_lng && (
                          <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>
                              Location: {employee.punch_in_location_lat.toFixed(4)}, {employee.punch_in_location_lng.toFixed(4)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Punched In
                      </Badge>
                      
                      <Button
                        variant="outline"
                        onClick={() => openPunchOutDialog(employee)}
                        disabled={punchingOut === employee.id}
                        className="gap-2"
                      >
                        <LogOut className="h-4 w-4" />
                        {punchingOut === employee.id ? 'Punching Out...' : 'Punch Out'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Punch Out Dialog with Cost Code Selection */}
      <Dialog open={punchOutDialogOpen} onOpenChange={setPunchOutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Punch Out {selectedEmployee?.profiles?.display_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedEmployee?.jobs?.name && (
              <div>
                <Label className="text-muted-foreground">Job</Label>
                <p className="font-medium">{selectedEmployee.jobs.name}</p>
              </div>
            )}
            
            {selectedEmployee?.job_id && (
              <div className="space-y-2">
                <Label htmlFor="cost-code">Cost Code</Label>
                {loadingCostCodes ? (
                  <p className="text-sm text-muted-foreground">Loading cost codes...</p>
                ) : jobCostCodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No cost codes assigned to this job</p>
                ) : (
                  <Select 
                    value={selectedCostCodeId} 
                    onValueChange={setSelectedCostCodeId}
                  >
                    <SelectTrigger id="cost-code">
                      <SelectValue placeholder="Select a cost code" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobCostCodes.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.code} - {cc.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPunchOutDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleManualPunchOut}
              disabled={punchingOut !== null}
            >
              {punchingOut ? 'Punching Out...' : 'Confirm Punch Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}