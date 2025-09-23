import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, FileText, Download, Plus, Clock, Loader2, User, Eye, List, LayoutGrid, Settings, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import TimeCardDetailView from '@/components/TimeCardDetailView';

interface TimeCard {
  id: string;
  user_id: string;
  job_id: string;
  cost_code_id: string;
  punch_in_time: string;
  punch_out_time: string;
  total_hours: number;
  overtime_hours: number;
  status: string;
  break_minutes: number;
  notes?: string;
  requires_approval?: boolean;
  distance_warning?: boolean;
  created_via_punch_clock?: boolean;
  jobs?: { name: string } | null;
  cost_codes?: { code: string; description: string } | null;
  profiles?: { first_name: string; last_name: string; display_name: string } | null;
}

type ViewMode = 'list' | 'compact' | 'super-compact';

type SupabaseTimeCard = {
  id: string;
  user_id: string;
  job_id: string;
  cost_code_id: string;
  punch_in_time: string;
  punch_out_time: string;
  total_hours: number;
  overtime_hours: number;
  status: string;
  break_minutes: number;
  notes?: string | null;
  jobs?: { name: string } | null;
  cost_codes?: { code: string; description: string } | null;
  profiles?: { first_name: string; last_name: string; display_name: string } | null;
}

export default function TimeSheets() {
  const [timeCards, setTimeCards] = useState<TimeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Array<{id: string, name: string}>>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTimeCardId, setSelectedTimeCardId] = useState<string>('');
  const [showDetailView, setShowDetailView] = useState(false);
  const { profile, user } = useAuth();

  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    if (isManager) {
      loadEmployees();
    }
    loadTimeCards();
  }, [user, profile]);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadTimeCards();
    }
  }, [selectedEmployeeId]);

  const loadEmployees = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, display_name')
        .order('first_name');

      if (error) {
        console.error('Error loading employees:', error);
        return;
      }

      const employeeOptions = (data || []).map(emp => ({
        id: emp.user_id,
        name: emp.display_name || 
              (emp.first_name && emp.last_name ? `${emp.first_name} ${emp.last_name}` : 
               emp.first_name || emp.last_name || 'Unknown Employee')
      }));

      setEmployees(employeeOptions);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadTimeCards = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      let query = supabase
        .from('time_cards')
        .select('*')
        .order('punch_in_time', { ascending: false })
        .limit(100);

      // Filter records based on user role and selection
      if (!isManager) {
        query = query.eq('user_id', user.id);
      } else if (selectedEmployeeId && selectedEmployeeId !== 'all') {
        query = query.eq('user_id', selectedEmployeeId);
      }

      const { data: timeCardData, error } = await query;

      if (error) {
        console.error('Error loading time cards:', error);
        toast({
          title: 'Error',
          description: 'Failed to load time sheets',
          variant: 'destructive',
        });
        return;
      }

      // Get unique user IDs, job IDs, and cost code IDs
      const userIds = [...new Set((timeCardData || []).map(tc => tc.user_id))];
      const jobIds = [...new Set((timeCardData || []).map(tc => tc.job_id).filter(Boolean))];
      const costCodeIds = [...new Set((timeCardData || []).map(tc => tc.cost_code_id).filter(Boolean))];

      // Fetch related data separately
      const [profilesData, jobsData, costCodesData] = await Promise.all([
        userIds.length > 0 ? supabase
          .from('profiles')
          .select('user_id, first_name, last_name, display_name')
          .in('user_id', userIds) : Promise.resolve({ data: [] }),
        jobIds.length > 0 ? supabase
          .from('jobs')
          .select('id, name')
          .in('id', jobIds) : Promise.resolve({ data: [] }),
        costCodeIds.length > 0 ? supabase
          .from('cost_codes')
          .select('id, code, description')
          .in('id', costCodeIds) : Promise.resolve({ data: [] })
      ]);

      // Create lookup maps
      const profilesMap = new Map((profilesData.data || []).map(p => [p.user_id, p]));
      const jobsMap = new Map((jobsData.data || []).map(j => [j.id, j]));
      const costCodesMap = new Map((costCodesData.data || []).map(c => [c.id, c]));

      // Transform data with relationships
      const transformedData: TimeCard[] = (timeCardData || []).map(tc => {
        const profile = profilesMap.get(tc.user_id);
        const job = jobsMap.get(tc.job_id);
        const costCode = costCodesMap.get(tc.cost_code_id);

        return {
          ...tc,
          jobs: job ? { name: job.name } : null,
          cost_codes: costCode ? { code: costCode.code, description: costCode.description } : null,
          profiles: profile ? {
            first_name: profile.first_name,
            last_name: profile.last_name,
            display_name: profile.display_name
          } : null
        };
      });

      setTimeCards(transformedData);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): 'outline' | 'secondary' | 'default' | 'destructive' => {
    switch (status) {
      case 'draft': return 'outline';
      case 'submitted': return 'secondary';
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const handleApproval = async (timeCardId: string, approved: boolean) => {
    if (!isManager) return;

    try {
      const { error } = await supabase
        .from('time_cards')
        .update({ 
          status: approved ? 'approved' : 'rejected',
          approved_at: approved ? new Date().toISOString() : null,
          approved_by: approved ? user?.id : null
        })
        .eq('id', timeCardId);

      if (error) throw error;

      setTimeCards(prev => 
        prev.map(tc => 
          tc.id === timeCardId 
            ? { ...tc, status: approved ? 'approved' : 'rejected' }
            : tc
        )
      );

      toast({
        title: 'Success',
        description: `Time card ${approved ? 'approved' : 'rejected'}`,
      });
    } catch (error) {
      console.error('Error updating time card:', error);
      toast({
        title: 'Error',
        description: 'Failed to update time card',
        variant: 'destructive',
      });
    }
  };

  const handleViewDetails = (timeCardId: string) => {
    setSelectedTimeCardId(timeCardId);
    setShowDetailView(true);
  };

  const formatWeekRange = (date: string) => {
    const d = new Date(date);
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const getEmployeeName = (timeCard: TimeCard) => {
    if (timeCard.profiles?.display_name) return timeCard.profiles.display_name;
    if (timeCard.profiles?.first_name && timeCard.profiles?.last_name) {
      return `${timeCard.profiles.first_name} ${timeCard.profiles.last_name}`;
    }
    return 'Unknown Employee';
  };

  // Calculate summary statistics
  const thisWeekCards = timeCards.filter(tc => {
    const cardDate = new Date(tc.punch_in_time);
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    return cardDate >= startOfWeek;
  });

  const totalHoursThisWeek = thisWeekCards.reduce((sum, tc) => sum + tc.total_hours, 0);
  const approvedHoursThisWeek = thisWeekCards
    .filter(tc => tc.status === 'approved')
    .reduce((sum, tc) => sum + tc.total_hours, 0);
  const pendingCards = timeCards.filter(tc => tc.status === 'submitted' || tc.status === 'draft').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading time sheets...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FileText className="h-8 w-8" />
            Time Sheets
          </h1>
          <p className="text-muted-foreground text-lg">
            {isManager ? 'Manage employee time sheets and approvals' : 'View your time tracking history'}
          </p>
        </div>
        <div className="flex gap-3">
          {isManager && (
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger className="w-64 h-11">
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {emp.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
            <SelectTrigger className="w-48 h-11">
              <SelectValue placeholder="View Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  List View
                </div>
              </SelectItem>
              <SelectItem value="compact">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Compact List
                </div>
              </SelectItem>
              <SelectItem value="super-compact">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Super Compact
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-11">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {isManager && (
            <Button className="h-11">
              <Plus className="h-4 w-4 mr-2" />
              New Time Sheet
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {isManager && (
          <Card className="shadow-elevation-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">
                {pendingCards}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Requires review</p>
            </CardContent>
          </Card>
        )}
        
        <Card className="shadow-elevation-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Week Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {totalHoursThisWeek.toFixed(1)} hrs
            </div>
            <p className="text-xs text-muted-foreground mt-1">Current week</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-elevation-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {approvedHoursThisWeek.toFixed(1)} hrs
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ready for payroll</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-elevation-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Daily</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {thisWeekCards.length > 0 ? (totalHoursThisWeek / thisWeekCards.length).toFixed(1) : '0'} hrs
            </div>
            <p className="text-xs text-muted-foreground mt-1">This week</p>
          </CardContent>
        </Card>
      </div>

      {/* Time Cards List */}
      <Card className="shadow-elevation-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Calendar className="h-6 w-6" />
            Recent Time Cards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {timeCards.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">No time cards found</h3>
                <p className="text-muted-foreground">Start tracking time to see your records here.</p>
              </div>
            ) : (
              timeCards.map((timeCard) => (
                <div key={timeCard.id} className="border rounded-xl p-6 hover-card">
                   <div className="flex items-start justify-between mb-4">
                     <div className="space-y-1">
                       {isManager && (
                         <div className="flex items-center gap-2">
                           <h3 className="font-semibold text-lg">{getEmployeeName(timeCard)}</h3>
                           {timeCard.distance_warning && (
                             <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                               <AlertTriangle className="h-3 w-3" />
                               Distance
                             </Badge>
                           )}
                           {!timeCard.requires_approval && timeCard.created_via_punch_clock && (
                             <Badge variant="outline" className="text-xs">
                               Auto-Approved
                             </Badge>
                           )}
                         </div>
                       )}
                       <div className="flex items-center gap-2 text-muted-foreground">
                         <Calendar className="h-4 w-4" />
                         <span className="text-sm">{formatWeekRange(timeCard.punch_in_time)}</span>
                       </div>
                       <div className="text-sm text-muted-foreground">
                         {new Date(timeCard.punch_in_time).toLocaleDateString('en-US', { 
                           weekday: 'long', 
                           month: 'short', 
                           day: 'numeric' 
                         })}
                       </div>
                     </div>
                    <div className="text-right space-y-2">
                      <div className="font-bold text-xl flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        {timeCard.total_hours.toFixed(1)} hrs
                      </div>
                      {timeCard.overtime_hours > 0 && (
                        <div className="text-sm text-warning font-medium">
                          +{timeCard.overtime_hours.toFixed(1)} OT
                        </div>
                      )}
                      <Badge variant={getStatusColor(timeCard.status)} className="ml-auto">
                        {timeCard.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Job Details</h4>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="font-medium">{timeCard.jobs?.name || 'Unknown Job'}</div>
                        <div className="text-sm text-muted-foreground">
                          {timeCard.cost_codes?.code} - {timeCard.cost_codes?.description}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Time Details</h4>
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                        <div className="text-sm">
                          In: {new Date(timeCard.punch_in_time).toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit' 
                          })}
                        </div>
                        <div className="text-sm">
                          Out: {new Date(timeCard.punch_out_time).toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit' 
                          })}
                        </div>
                        {timeCard.break_minutes > 0 && (
                          <div className="text-sm text-muted-foreground">
                            Break: {timeCard.break_minutes} min
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {timeCard.notes && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Notes</h4>
                      <div className="bg-muted/30 rounded-lg p-3 text-sm">
                        {timeCard.notes}
                      </div>
                    </div>
                  )}

                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-lg"
                        onClick={() => handleViewDetails(timeCard.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                      {(user?.id === timeCard.user_id || isManager) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-lg"
                          onClick={() => {
                            // TODO: Open edit time card dialog
                            console.log('Edit time card:', timeCard.id);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                     {isManager && timeCard.status === 'submitted' && (timeCard.requires_approval !== false) && (
                       <>
                         <Button 
                           size="sm" 
                           onClick={() => handleApproval(timeCard.id, true)}
                           className="rounded-lg"
                         >
                           Approve
                         </Button>
                         <Button 
                           size="sm" 
                           variant="destructive"
                           onClick={() => handleApproval(timeCard.id, false)}
                           className="rounded-lg"
                         >
                           Reject
                         </Button>
                       </>
                     )}
                     <Button variant="outline" size="sm" className="rounded-lg">
                       <Download className="h-4 w-4 mr-1" />
                       PDF
                     </Button>
                   </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <TimeCardDetailView
        open={showDetailView}
        onOpenChange={setShowDetailView}
        timeCardId={selectedTimeCardId}
      />
    </div>
  );
}