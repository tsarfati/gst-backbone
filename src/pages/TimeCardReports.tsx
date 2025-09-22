import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BarChart3, Clock, FileText, Download, CalendarIcon, Search, User, Users, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface TimeRecord {
  id: string;
  user_id: string;
  punch_in: string;
  punch_out: string;
  total_hours: number;
  job_name: string;
  cost_code: string;
  status: 'approved' | 'pending' | 'corrected';
}

interface Employee {
  id: string;
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
}

export default function TimeCardReports() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(startOfWeek(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfWeek(new Date()));
  const [searchTerm, setSearchTerm] = useState('');

  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    loadEmployees();
    loadTimeRecords();
  }, [selectedEmployee, startDate, endDate]);

  const loadEmployees = async () => {
    if (!isManager) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, first_name, last_name')
        .order('display_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadTimeRecords = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('time_cards')
        .select(`
          id,
          user_id,
          punch_in_time,
          punch_out_time,
          total_hours,
          overtime_hours,
          status,
          job_id,
          cost_code_id
        `)
        .order('punch_in_time', { ascending: false });

      // Filter by employee if selected and user is manager
      if (isManager && selectedEmployee !== 'all') {
        query = query.eq('user_id', selectedEmployee);
      } else if (!isManager) {
        // Non-managers can only see their own records
        query = query.eq('user_id', user?.id);
      }

      // Filter by date range
      if (startDate) {
        query = query.gte('punch_in_time', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('punch_out_time', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get job and cost code names separately
      const jobIds = [...new Set((data || []).map(r => r.job_id).filter(Boolean))];
      const costCodeIds = [...new Set((data || []).map(r => r.cost_code_id).filter(Boolean))];

      const [jobsData, costCodesData] = await Promise.all([
        jobIds.length > 0 ? supabase.from('jobs').select('id, name').in('id', jobIds) : { data: [] },
        costCodeIds.length > 0 ? supabase.from('cost_codes').select('id, code, description').in('id', costCodeIds) : { data: [] }
      ]);

      const jobsMap = new Map((jobsData.data || []).map(job => [job.id, job]));
      const costCodesMap = new Map((costCodesData.data || []).map(code => [code.id, code]));

      // Transform the data to match our interface
      const transformedRecords: TimeRecord[] = (data || []).map(record => {
        const job = jobsMap.get(record.job_id);
        const costCode = costCodesMap.get(record.cost_code_id);
        
        return {
          id: record.id,
          user_id: record.user_id,
          punch_in: record.punch_in_time,
          punch_out: record.punch_out_time,
          total_hours: parseFloat(record.total_hours.toString()) || 0,
          job_name: job?.name || 'Unknown Job',
          cost_code: costCode ? `${costCode.code} - ${costCode.description}` : 'Unknown Code',
          status: record.status as 'approved' | 'pending' | 'corrected'
        };
      });

      setTimeRecords(transformedRecords);
    } catch (error) {
      console.error('Error loading time records:', error);
      toast({
        title: "Error",
        description: "Failed to load time records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportReports = (format: 'pdf' | 'csv') => {
    toast({
      title: "Export Started",
      description: `Generating ${format.toUpperCase()} report...`,
    });
  };

  const filteredRecords = timeRecords.filter(record => {
    if (selectedEmployee !== 'all' && record.user_id !== selectedEmployee) return false;
    if (searchTerm && !record.job_name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !record.cost_code.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const totalHours = filteredRecords.reduce((sum, record) => sum + record.total_hours, 0);
  const overtimeHours = filteredRecords.reduce((sum, record) => sum + Math.max(0, record.total_hours - 8), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'pending': return 'secondary';
      case 'corrected': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading time card reports...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-7 w-7" />
            Time Card Reports
          </h1>
          <p className="text-muted-foreground">
            Detailed time tracking reports and analytics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportReports('csv')}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={() => exportReports('pdf')}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isManager && (
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.user_id}>
                        {employee.display_name || `${employee.first_name} ${employee.last_name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs or cost codes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {totalHours.toFixed(1)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overtime Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {overtimeHours.toFixed(1)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredRecords.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Daily Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredRecords.length > 0 ? (totalHours / filteredRecords.length).toFixed(1) : '0'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Tabs */}
      <Tabs defaultValue="detailed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="detailed" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Detailed Report
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Summary Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detailed">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Time Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredRecords.map((record) => (
                  <div key={record.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold">{record.job_name}</h3>
                          <p className="text-sm text-muted-foreground">Cost Code: {record.cost_code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={getStatusColor(record.status)}>
                          {record.status.toUpperCase()}
                        </Badge>
                        <div className="text-right">
                          <div className="font-semibold">{record.total_hours} hours</div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(record.punch_in), 'MMM d, h:mm a')} - 
                            {format(new Date(record.punch_out), 'h:mm a')}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {record.total_hours > 8 && (
                      <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                        <strong>Overtime:</strong> {(record.total_hours - 8).toFixed(1)} hours
                      </div>
                    )}
                  </div>
                ))}
                
                {filteredRecords.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No time records found for the selected criteria.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Summary by Employee</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <h3 className="font-semibold">{profile?.display_name || 'Current User'}</h3>
                        <p className="text-sm text-muted-foreground">Employee</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{totalHours.toFixed(1)} hours</div>
                      <div className="text-sm text-muted-foreground">
                        {filteredRecords.length} entries
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}