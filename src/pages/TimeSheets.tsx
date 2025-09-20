import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, Download, Plus, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface TimeSheet {
  id: string;
  employee: string;
  week: string;
  totalHours: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  projects: Array<{
    name: string;
    hours: number;
  }>;
}

export default function TimeSheets() {
  const [timeSheets, setTimeSheets] = useState<TimeSheet[]>([
    {
      id: '1',
      employee: 'John Doe',
      week: 'Jan 8-14, 2024',
      totalHours: 40,
      status: 'submitted',
      projects: [
        { name: 'Office Renovation', hours: 25 },
        { name: 'Warehouse Project', hours: 15 }
      ]
    },
    {
      id: '2',
      employee: 'Jane Smith',
      week: 'Jan 8-14, 2024',
      totalHours: 38,
      status: 'approved',
      projects: [
        { name: 'Retail Buildout', hours: 20 },
        { name: 'Office Renovation', hours: 18 }
      ]
    },
    {
      id: '3',
      employee: 'John Doe',
      week: 'Jan 1-7, 2024',
      totalHours: 42,
      status: 'approved',
      projects: [
        { name: 'Office Renovation', hours: 30 },
        { name: 'Planning', hours: 12 }
      ]
    }
  ]);

  const { profile } = useAuth();
  const isManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'outline';
      case 'submitted': return 'secondary';
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const handleApproval = (timesheetId: string, approved: boolean) => {
    setTimeSheets(prev => 
      prev.map(ts => 
        ts.id === timesheetId 
          ? { ...ts, status: approved ? 'approved' : 'rejected' }
          : ts
      )
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-7 w-7" />
            Time Sheets
          </h1>
          <p className="text-muted-foreground">
            Manage employee time sheets and approvals
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Time Sheet
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeSheets.filter(ts => ts.status === 'submitted').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Week Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeSheets
                .filter(ts => ts.week === 'Jan 8-14, 2024')
                .reduce((sum, ts) => sum + ts.totalHours, 0)} hrs
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeSheets
                .filter(ts => ts.week === 'Jan 8-14, 2024' && ts.status === 'approved')
                .reduce((sum, ts) => sum + ts.totalHours, 0)} hrs
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Weekly</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">39.5 hrs</div>
          </CardContent>
        </Card>
      </div>

      {/* Time Sheets List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Time Sheets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {timeSheets.map((timeSheet) => (
              <div key={timeSheet.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{timeSheet.employee}</h3>
                    <p className="text-sm text-muted-foreground">{timeSheet.week}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-semibold flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {timeSheet.totalHours} hours
                      </div>
                    </div>
                    <Badge variant={getStatusColor(timeSheet.status)}>
                      {timeSheet.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                
                <div className="mb-3">
                  <h4 className="text-sm font-medium mb-2">Project Breakdown:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {timeSheet.projects.map((project, index) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium">{project.name}:</span>
                        <span className="text-muted-foreground ml-1">{project.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                  {isManager && timeSheet.status === 'submitted' && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => handleApproval(timeSheet.id, true)}
                      >
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleApproval(timeSheet.id, false)}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}