import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, MapPin, LogOut, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

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

export default function ManualPunchOut() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [punchedInEmployees, setPunchedInEmployees] = useState<PunchedInEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [punchingOut, setPunchingOut] = useState<string | null>(null);

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

  const handleManualPunchOut = async (employee: PunchedInEmployee) => {
    try {
      setPunchingOut(employee.id);

      // Create punch out record
      const { error: punchError } = await supabase
        .from('punch_records')
        .insert({
          user_id: employee.user_id,
          job_id: employee.job_id,
          cost_code_id: employee.cost_code_id,
          company_id: employee.company_id || '',
          punch_type: 'punched_out',
          punch_time: new Date().toISOString(),
          notes: 'Manual punch out by manager',
          user_agent: navigator.userAgent,
          ip_address: null // Browser can't directly access IP
        });

      if (punchError) throw punchError;

      // Remove from current punch status
      const { error: statusError } = await supabase
        .from('current_punch_status')
        .update({ is_active: false })
        .eq('id', employee.id);

      if (statusError) throw statusError;

      toast({
        title: "Employee Punched Out",
        description: `${employee.profiles?.display_name} has been successfully punched out.`,
      });

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
                        onClick={() => handleManualPunchOut(employee)}
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
    </div>
  );
}