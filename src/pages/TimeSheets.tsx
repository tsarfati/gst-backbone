import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, FileText, Download, Plus, Clock, Loader2, User, Eye, List, LayoutGrid, Settings, AlertTriangle, Edit, LogOut, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Camera, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import TimeCardDetailView from '@/components/TimeCardDetailView';
import EditTimeCardDialog from '@/components/EditTimeCardDialog';
import TimeSheetsViewSelector, { TimeSheetsViewType } from '@/components/TimeSheetsViewSelector';
import { useTimeSheetsViewPreference } from '@/hooks/useTimeSheetsViewPreference';

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
  punch_in_photo_url?: string | null;
  punch_out_photo_url?: string | null;
  punch_in_location_lat?: number | null;
  punch_in_location_lng?: number | null;
  punch_out_location_lat?: number | null;
  punch_out_location_lng?: number | null;
  jobs?: { name: string } | null;
  cost_codes?: { code: string; description: string } | null;
  profiles?: { first_name: string; last_name: string; display_name: string } | null;
}

type SortField = 'employee' | 'job' | 'date' | 'hours' | 'status' | 'overtime';
type SortDirection = 'asc' | 'desc';

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
  punch_in_photo_url?: string | null;
  punch_out_photo_url?: string | null;
  punch_in_location_lat?: number | null;
  punch_in_location_lng?: number | null;
  punch_out_location_lat?: number | null;
  punch_out_location_lng?: number | null;
  jobs?: { name: string } | null;
  cost_codes?: { code: string; description: string } | null;
  profiles?: { first_name: string; last_name: string; display_name: string } | null;
}

export default function TimeSheets() {
  const [timeCards, setTimeCards] = useState<TimeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Array<{id: string, name: string}>>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedTimeCardId, setSelectedTimeCardId] = useState<string>('');
  const [showDetailView, setShowDetailView] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteTimeCardId, setDeleteTimeCardId] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  
  // Use view preference hook with local storage
  const viewPreference = useTimeSheetsViewPreference('timesheet-view', 'list');
  const currentView = viewPreference.currentView;

  const isManager = ['admin', 'controller', 'project_manager', 'manager'].includes(profile?.role as string);

  useEffect(() => {
    if (isManager) {
      loadEmployees();
    }
    loadTimeCards();

    // Set up real-time subscription for time cards
    const channel = supabase
      .channel('time-cards-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'time_cards'
        },
        (payload) => {
          console.log('Time card change detected:', payload);
          // Reload time cards when changes occur
          loadTimeCards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadTimeCards();
    }
  }, [selectedEmployeeId]);

  const loadEmployees = async () => {
    if (!user) return;

    try {
      // Load both regular users and PIN employees
      const [profilesResponse, pinEmployeesResponse] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, first_name, last_name, display_name')
          .order('first_name'),
        supabase
          .from('pin_employees')
          .select('id, first_name, last_name, display_name')
          .eq('is_active', true)
          .order('first_name')
      ]);

      const employeeOptions = [];

      // Add regular users
      if (profilesResponse.data) {
        employeeOptions.push(...profilesResponse.data.map(emp => ({
          id: emp.user_id,
          name: emp.display_name || 
                (emp.first_name && emp.last_name ? `${emp.first_name} ${emp.last_name}` : 
                 emp.first_name || emp.last_name || 'Unknown Employee')
        })));
      }

      // Add PIN employees
      if (pinEmployeesResponse.data) {
        employeeOptions.push(...pinEmployeesResponse.data.map(emp => ({
          id: emp.id,
          name: emp.display_name || 
                (emp.first_name && emp.last_name ? `${emp.first_name} ${emp.last_name}` : 
                 emp.first_name || emp.last_name || 'Unknown Employee')
        })));
      }

      // Sort combined list by name
      employeeOptions.sort((a, b) => a.name.localeCompare(b.name));

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
        .select(`
          id,
          user_id,
          job_id,
          cost_code_id,
          punch_in_time,
          punch_out_time,
          total_hours,
          overtime_hours,
          status,
          break_minutes,
          notes,
          punch_in_photo_url,
          punch_out_photo_url,
          punch_in_location_lat,
          punch_in_location_lng,
          punch_out_location_lat,
          punch_out_location_lng
        `)
        .neq('status', 'deleted')
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
      const [profilesData, pinEmployeesData, jobsData, costCodesData] = await Promise.all([
        userIds.length > 0 ? supabase
          .from('profiles')
          .select('user_id, first_name, last_name, display_name')
          .in('user_id', userIds) : Promise.resolve({ data: [] }),
        userIds.length > 0 ? supabase
          .from('pin_employees')
          .select('id, first_name, last_name, display_name')
          .in('id', userIds) : Promise.resolve({ data: [] }),
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
      const pinEmployeesMap = new Map((pinEmployeesData.data || []).map(p => [p.id, p]));
      const jobsMap = new Map((jobsData.data || []).map(j => [j.id, j]));
      const costCodesMap = new Map((costCodesData.data || []).map(c => [c.id, c]));

      // Transform data with relationships
      const transformedData: TimeCard[] = (timeCardData || []).map(tc => {
        const profile = profilesMap.get(tc.user_id);
        const pinEmployee = pinEmployeesMap.get(tc.user_id);
        const job = jobsMap.get(tc.job_id);
        const costCode = costCodesMap.get(tc.cost_code_id);

        // Use either profile or PIN employee data
        const employeeData = profile || pinEmployee;

        return {
          ...tc,
          punch_in_photo_url: tc.punch_in_photo_url,
          punch_out_photo_url: tc.punch_out_photo_url,
          jobs: job ? { name: job.name } : null,
          cost_codes: costCode ? { code: costCode.code, description: costCode.description } : null,
          profiles: employeeData ? {
            first_name: employeeData.first_name,
            last_name: employeeData.last_name,
            display_name: employeeData.display_name
          } : null
        };
      });

      // Backfill missing photos/locations from punch_records for PIN employees and others
      const enrichedData: TimeCard[] = await Promise.all(transformedData.map(async (tc) => {
        const needsInPhoto = !tc.punch_in_photo_url;
        const needsOutPhoto = !tc.punch_out_photo_url && tc.punch_out_time;
        const needsInLoc = (!tc.punch_in_location_lat || !tc.punch_in_location_lng);
        const needsOutLoc = tc.punch_out_time && (!tc.punch_out_location_lat || !tc.punch_out_location_lng);
        
        if (!needsInPhoto && !needsOutPhoto && !needsInLoc && !needsOutLoc) return tc;

        const from = new Date(new Date(tc.punch_in_time).getTime() - 60_000).toISOString();
        const to = new Date(new Date(tc.punch_out_time || tc.punch_in_time).getTime() + 60_000).toISOString();
        const { data: punches } = await supabase
          .from('punch_records')
          .select('punch_type, photo_url, latitude, longitude, punch_time')
          .eq('user_id', tc.user_id)
          .gte('punch_time', from)
          .lte('punch_time', to)
          .order('punch_time', { ascending: true });

        const punchIn = (punches || []).find(p => p.punch_type === 'punched_in');
        const punchOut = (punches || []).find(p => p.punch_type === 'punched_out');

        const updated: TimeCard = {
          ...tc,
          punch_in_photo_url: tc.punch_in_photo_url || punchIn?.photo_url || null,
          punch_out_photo_url: tc.punch_out_photo_url || punchOut?.photo_url || null,
          punch_in_location_lat: tc.punch_in_location_lat ?? (punchIn?.latitude ?? null),
          punch_in_location_lng: tc.punch_in_location_lng ?? (punchIn?.longitude ?? null),
          punch_out_location_lat: tc.punch_out_location_lat ?? (punchOut?.latitude ?? null),
          punch_out_location_lng: tc.punch_out_location_lng ?? (punchOut?.longitude ?? null),
        };

        // Storage fallback if photos are still missing
        const normalize = (path?: string | null) => {
          if (!path) return null;
          if (path.startsWith('http')) return path;
          const { data: pub } = supabase.storage.from('punch-photos').getPublicUrl(path);
          return pub?.publicUrl || null;
        };
        const findClosestInStorage = async (userId: string, targetIso: string) => {
          try {
            const { data: files } = await supabase.storage.from('punch-photos').list('punch-photos', { limit: 1000, search: userId });
            const list = (files || []).filter((f: any) => f.name?.startsWith(`${userId}-`));
            if (list.length === 0) return null;
            const target = new Date(targetIso).getTime();
            let best: any = null, bestDelta = Number.POSITIVE_INFINITY;
            for (const f of list) {
              const m = f.name.match(/-(\d+)\./);
              const ts = m ? parseInt(m[1], 10) : NaN;
              if (!isNaN(ts)) {
                const d = Math.abs(ts - target);
                if (d < bestDelta) { best = f; bestDelta = d; }
              }
            }
            return best ? `punch-photos/${best.name}` : null;
          } catch (e) {
            console.warn('Storage fallback failed:', e);
            return null;
          }
        };

        if (!updated.punch_in_photo_url) {
          const path = await findClosestInStorage(tc.user_id, tc.punch_in_time);
          if (path) updated.punch_in_photo_url = normalize(path);
        }
        if (!updated.punch_out_photo_url && tc.punch_out_time) {
          const path = await findClosestInStorage(tc.user_id, tc.punch_out_time);
          if (path) updated.punch_out_photo_url = normalize(path);
        }

        // Persist backfilled fields so photos/maps stay linked next load
        if (
          (needsInPhoto && updated.punch_in_photo_url) ||
          (needsOutPhoto && updated.punch_out_photo_url) ||
          (needsInLoc && (updated.punch_in_location_lat || updated.punch_in_location_lng)) ||
          (needsOutLoc && (updated.punch_out_location_lat || updated.punch_out_location_lng))
        ) {
          await supabase
            .from('time_cards')
            .update({
              punch_in_photo_url: updated.punch_in_photo_url,
              punch_out_photo_url: updated.punch_out_photo_url,
              punch_in_location_lat: updated.punch_in_location_lat,
              punch_in_location_lng: updated.punch_in_location_lng,
              punch_out_location_lat: updated.punch_out_location_lat,
              punch_out_location_lng: updated.punch_out_location_lng,
            })
            .eq('id', tc.id);
        }

        return updated;
      }));

      setTimeCards(enrichedData);
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

  const handleEditTimeCard = (timeCardId: string) => {
    setSelectedTimeCardId(timeCardId);
    setShowEditDialog(true);
  };

  const handleDeleteTimeCard = async () => {
    if (!deleteTimeCardId || !isManager) return;

    try {
      // Soft delete: keep audit trail, mark as deleted
      const { error } = await supabase
        .from('time_cards')
        .update({ status: 'deleted' })
        .eq('id', deleteTimeCardId);

      if (error) throw error;

      setTimeCards(prev => prev.filter(tc => tc.id !== deleteTimeCardId));
      setDeleteTimeCardId('');

      toast({
        title: 'Removed',
        description: 'Time card moved to trash',
      });
    } catch (error: any) {
      console.error('Error deleting time card:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete time card',
        variant: 'destructive',
      });
    }
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedTimeCards = () => {
    const sorted = [...timeCards].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'employee':
          aValue = getEmployeeName(a).toLowerCase();
          bValue = getEmployeeName(b).toLowerCase();
          break;
        case 'job':
          aValue = a.jobs?.name?.toLowerCase() || '';
          bValue = b.jobs?.name?.toLowerCase() || '';
          break;
        case 'date':
          aValue = new Date(a.punch_in_time).getTime();
          bValue = new Date(b.punch_in_time).getTime();
          break;
        case 'hours':
          aValue = a.total_hours;
          bValue = b.total_hours;
          break;
        case 'overtime':
          aValue = a.overtime_hours;
          bValue = b.overtime_hours;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          aValue = a.punch_in_time;
          bValue = b.punch_in_time;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </TableHead>
  );

  const PhotoDisplay = ({ url, type }: { url?: string; type: 'in' | 'out' }) => {
    if (!url) return null;
    
    // Normalize photo URL to handle Supabase storage paths
    const normalizePhotoUrl = (photoUrl: string) => {
      if (!photoUrl) return null;
      
      // If it's already a full URL, use it as is
      if (photoUrl.startsWith('http')) return photoUrl;
      
      // If it's a storage path, get the public URL
      const { data } = supabase.storage.from('punch-photos').getPublicUrl(photoUrl);
      return data.publicUrl;
    };

    const normalizedUrl = normalizePhotoUrl(url);
    if (!normalizedUrl) return null;
    
    return (
      <div className="relative">
        <img 
          src={normalizedUrl} 
          alt={`Punch ${type} photo`}
          className="h-8 w-8 rounded object-cover cursor-pointer hover:scale-110 transition-transform"
          onClick={() => window.open(normalizedUrl, '_blank')}
        />
        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1">
          <Camera className="h-2 w-2" />
        </div>
      </div>
    );
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
          <TimeSheetsViewSelector
            currentView={currentView}
            onViewChange={viewPreference.setCurrentView}
            onSetDefault={viewPreference.setDefaultView}
            isDefault={viewPreference.isDefault}
          />
          <Button variant="outline" className="h-11">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {isManager && (
            <>
              <Button 
                className="h-11 gap-2"
                onClick={() => navigate('/manual-time-entry')}
              >
                <Plus className="h-4 w-4" />
                New Time Sheet
              </Button>
              <Button 
                variant="outline" 
                className="h-11 gap-2"
                onClick={() => navigate('/manual-punch-out')}
              >
                <LogOut className="h-4 w-4" />
                Punch Out Employees
              </Button>
            </>
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
              <div className="space-y-4">
                {/* Render different views based on viewMode */}
                {currentView === 'table' && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {isManager && (
                          <SortableHeader field="employee">Employee</SortableHeader>
                        )}
                        <SortableHeader field="job">Job</SortableHeader>
                        <SortableHeader field="date">Date</SortableHeader>
                        <TableHead>Time In/Out</TableHead>
                        <SortableHeader field="hours">Hours</SortableHeader>
                        <SortableHeader field="overtime">Overtime</SortableHeader>
                        <SortableHeader field="status">Status</SortableHeader>
                        <TableHead>Photos</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getSortedTimeCards().map((timeCard) => (
                        <TableRow key={timeCard.id} onClick={() => handleViewDetails(timeCard.id)} className="cursor-pointer hover:bg-muted/30">
                          {isManager && (
                            <TableCell className="font-medium">
                              {getEmployeeName(timeCard)}
                            </TableCell>
                          )}
                          <TableCell>
                            <div>
                              <div className="font-medium">{timeCard.jobs?.name || 'Unknown Job'}</div>
                              <div className="text-sm text-muted-foreground">
                                {timeCard.cost_codes?.code} - {timeCard.cost_codes?.description}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(timeCard.punch_in_time).toLocaleDateString('en-US', { 
                              weekday: 'short',
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>
                                In: {new Date(timeCard.punch_in_time).toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit' 
                                })}
                              </div>
                              <div>
                                Out: {new Date(timeCard.punch_out_time).toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit' 
                                })}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {timeCard.total_hours.toFixed(1)}h
                          </TableCell>
                          <TableCell>
                            {timeCard.overtime_hours > 0 ? (
                              <span className="text-warning font-medium">
                                {timeCard.overtime_hours.toFixed(1)}h
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant={getStatusColor(timeCard.status)}>
                                {timeCard.status.toUpperCase()}
                              </Badge>
                              {timeCard.distance_warning && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <PhotoDisplay url={timeCard.punch_in_photo_url || undefined} type="in" />
                              <PhotoDisplay url={timeCard.punch_out_photo_url || undefined} type="out" />
                              {!timeCard.punch_in_photo_url && !timeCard.punch_out_photo_url && (
                                <span className="text-muted-foreground text-sm">No photos</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {timeCard.punch_in_location_lat && timeCard.punch_in_location_lng ? (
                                <a
                                  href={`https://www.openstreetmap.org/?mlat=${timeCard.punch_in_location_lat}&mlon=${timeCard.punch_in_location_lng}&zoom=15`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline text-primary"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  In
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                              {timeCard.punch_out_location_lat && timeCard.punch_out_location_lng ? (
                                <a
                                  href={`https://www.openstreetmap.org/?mlat=${timeCard.punch_out_location_lat}&mlon=${timeCard.punch_out_location_lng}&zoom=15`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline text-primary"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Out
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleViewDetails(timeCard.id); }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {(isManager || timeCard.user_id === user?.id) && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); handleEditTimeCard(timeCard.id); }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {isManager && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={(e) => { e.stopPropagation(); setDeleteTimeCardId(timeCard.id); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                
                {currentView === 'list' && timeCards.map((timeCard) => (
                  <div key={timeCard.id} className="border rounded-xl p-6 hover-card cursor-pointer" onClick={() => handleViewDetails(timeCard.id)}>
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

                     {/* Locations */}
                     {(timeCard.punch_in_location_lat && timeCard.punch_in_location_lng) || (timeCard.punch_out_location_lat && timeCard.punch_out_location_lng) ? (
                       <div className="mb-4">
                         <h4 className="text-sm font-medium text-muted-foreground mb-2">Locations</h4>
                         <div className="flex gap-4 text-sm">
                           <div className="flex items-center gap-1">
                             <MapPin className="h-4 w-4" />
                             {timeCard.punch_in_location_lat && timeCard.punch_in_location_lng ? (
                               <a href={`https://www.openstreetmap.org/?mlat=${timeCard.punch_in_location_lat}&mlon=${timeCard.punch_in_location_lng}&zoom=15`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline text-primary">In</a>
                             ) : (
                               <span className="text-muted-foreground">In: -</span>
                             )}
                           </div>
                           <div className="flex items-center gap-1">
                             <MapPin className="h-4 w-4" />
                             {timeCard.punch_out_location_lat && timeCard.punch_out_location_lng ? (
                               <a href={`https://www.openstreetmap.org/?mlat=${timeCard.punch_out_location_lat}&mlon=${timeCard.punch_out_location_lng}&zoom=15`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline text-primary">Out</a>
                             ) : (
                               <span className="text-muted-foreground">Out: -</span>
                             )}
                           </div>
                         </div>
                       </div>
                     ) : null}

                     {timeCard.notes && (
                       <div className="mb-4">
                         <h4 className="text-sm font-medium text-muted-foreground mb-2">Notes</h4>
                         <div className="bg-muted/30 rounded-lg p-3 text-sm">
                           {timeCard.notes}
                         </div>
                       </div>
                     )}

                     {/* Photo Display */}
                     {(timeCard.punch_in_photo_url || timeCard.punch_out_photo_url) && (
                       <div className="mb-4">
                         <h4 className="text-sm font-medium text-muted-foreground mb-2">Photos</h4>
                         <div className="flex gap-4">
                           {timeCard.punch_in_photo_url && (
                             <div className="space-y-2">
                               <div className="text-xs text-muted-foreground">Punch In</div>
                               <img 
                                 src={timeCard.punch_in_photo_url} 
                                 alt="Punch in photo"
                                 className="w-20 h-20 rounded object-cover cursor-pointer hover:scale-105 transition-transform"
                                 onClick={() => window.open(timeCard.punch_in_photo_url, '_blank')}
                               />
                             </div>
                           )}
                           {timeCard.punch_out_photo_url && (
                             <div className="space-y-2">
                               <div className="text-xs text-muted-foreground">Punch Out</div>
                               <img 
                                 src={timeCard.punch_out_photo_url} 
                                 alt="Punch out photo"
                                 className="w-20 h-20 rounded object-cover cursor-pointer hover:scale-105 transition-transform"
                                 onClick={() => window.open(timeCard.punch_out_photo_url, '_blank')}
                               />
                             </div>
                           )}
                         </div>
                       </div>
                     )}

                      <div className="flex gap-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-lg"
                           onClick={(e) => { e.stopPropagation(); handleViewDetails(timeCard.id); }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                        {(isManager || timeCard.user_id === user?.id) && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-lg"
                             onClick={(e) => { e.stopPropagation(); handleEditTimeCard(timeCard.id); }}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        )}
                        {isManager && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-lg text-red-600 hover:text-red-700"
                             onClick={(e) => { e.stopPropagation(); setDeleteTimeCardId(timeCard.id); }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
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
                ))}

                {/* Compact View */}
                {currentView === 'compact' && timeCards.map((timeCard) => (
                  <div key={timeCard.id} className="border rounded-lg p-4 hover-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {isManager && (
                          <div className="min-w-0">
                            <div className="font-medium truncate">{getEmployeeName(timeCard)}</div>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{timeCard.jobs?.name || 'Unknown Job'}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(timeCard.punch_in_time).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusColor(timeCard.status)} className="text-xs">
                            {timeCard.status.toUpperCase()}
                          </Badge>
                          {timeCard.distance_warning && (
                            <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                              <AlertTriangle className="h-3 w-3" />
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold">{timeCard.total_hours.toFixed(1)} hrs</div>
                          {timeCard.overtime_hours > 0 && (
                            <div className="text-xs text-warning">+{timeCard.overtime_hours.toFixed(1)} OT</div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                             onClick={(e) => { e.stopPropagation(); handleViewDetails(timeCard.id); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(isManager || timeCard.user_id === user?.id) && (
                            <Button 
                              variant="outline" 
                              size="sm"
                               onClick={(e) => { e.stopPropagation(); handleEditTimeCard(timeCard.id); }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {isManager && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                               onClick={(e) => { e.stopPropagation(); setDeleteTimeCardId(timeCard.id); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Super Compact View */}
                {currentView === 'super-compact' && (
                  <div className="space-y-1">
                    {timeCards.map((timeCard) => (
                      <div key={timeCard.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {isManager && (
                            <div className="min-w-0 w-32">
                              <div className="text-sm font-medium truncate">{getEmployeeName(timeCard)}</div>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm truncate">{timeCard.jobs?.name || 'Unknown Job'}</div>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(timeCard.punch_in_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="font-medium whitespace-nowrap">
                            {timeCard.total_hours.toFixed(1)}h
                          </div>
                          <Badge variant={getStatusColor(timeCard.status)} className="text-xs whitespace-nowrap">
                            {timeCard.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-6 w-6 p-0"
                             onClick={(e) => { e.stopPropagation(); handleViewDetails(timeCard.id); }}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          {(isManager || timeCard.user_id === user?.id) && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => { e.stopPropagation(); handleEditTimeCard(timeCard.id); }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                          {isManager && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                              onClick={(e) => { e.stopPropagation(); setDeleteTimeCardId(timeCard.id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedTimeCardId && (
        <TimeCardDetailView
          open={showDetailView}
          onOpenChange={setShowDetailView}
          timeCardId={selectedTimeCardId}
        />
      )}

      {selectedTimeCardId && (
        <EditTimeCardDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          timeCardId={selectedTimeCardId}
          onSave={() => {
            setShowEditDialog(false);
            loadTimeCards();
          }}
        />
      )}

      <AlertDialog open={!!deleteTimeCardId} onOpenChange={() => setDeleteTimeCardId('')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this time card? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTimeCard}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}