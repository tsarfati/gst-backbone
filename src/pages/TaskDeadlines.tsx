import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlarmClock, Search, Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface TaskDeadline {
  id: string;
  title: string;
  description: string;
  project_name: string;
  assignee: string;
  due_date: string;
  status: 'completed' | 'in_progress' | 'overdue' | 'upcoming';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  days_until_due: number;
}

// Mock data - in a real app, this would come from your database
const mockDeadlines: TaskDeadline[] = [
  {
    id: '1',
    title: 'Safety Inspection Report',
    description: 'Submit monthly safety inspection report to regulatory board',
    project_name: 'Downtown Office Building',
    assignee: 'John Smith',
    due_date: '2024-01-12',
    status: 'overdue',
    priority: 'urgent',
    days_until_due: -2
  },
  {
    id: '2',
    title: 'Material Order Approval',
    description: 'Get approval for additional concrete order',
    project_name: 'Residential Complex',
    assignee: 'Sarah Johnson',
    due_date: '2024-01-14',
    status: 'upcoming',
    priority: 'high',
    days_until_due: 1
  },
  {
    id: '3',
    title: 'Equipment Maintenance',
    description: 'Complete scheduled maintenance on excavator',
    project_name: 'Bridge Construction',
    assignee: 'Mike Brown',
    due_date: '2024-01-16',
    status: 'in_progress',
    priority: 'normal',
    days_until_due: 3
  },
  {
    id: '4',
    title: 'Client Presentation',
    description: 'Present project progress to client stakeholders',
    project_name: 'Downtown Office Building',
    assignee: 'Lisa Wilson',
    due_date: '2024-01-10',
    status: 'completed',
    priority: 'high',
    days_until_due: -3
  }
];

export default function TaskDeadlines() {
  const [deadlines, setDeadlines] = useState<TaskDeadline[]>(mockDeadlines);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const { user } = useAuth();

  const filteredDeadlines = deadlines.filter(deadline => {
    const matchesSearch = deadline.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         deadline.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         deadline.project_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || deadline.status === statusFilter;
    const matchesUrgency = urgencyFilter === 'all' || 
                          (urgencyFilter === 'overdue' && deadline.days_until_due < 0) ||
                          (urgencyFilter === 'this_week' && deadline.days_until_due >= 0 && deadline.days_until_due <= 7) ||
                          (urgencyFilter === 'next_week' && deadline.days_until_due > 7 && deadline.days_until_due <= 14);
    return matchesSearch && matchesStatus && matchesUrgency;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'upcoming': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUrgencyIndicator = (daysUntilDue: number, status: string) => {
    if (status === 'completed') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (daysUntilDue < 0) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (daysUntilDue <= 2) return <AlarmClock className="h-4 w-4 text-orange-500" />;
    if (daysUntilDue <= 7) return <Clock className="h-4 w-4 text-yellow-500" />;
    return <Calendar className="h-4 w-4 text-blue-500" />;
  };

  const getDueDateText = (daysUntilDue: number, status: string) => {
    if (status === 'completed') return 'Completed';
    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} days overdue`;
    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue === 1) return 'Due tomorrow';
    return `Due in ${daysUntilDue} days`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'secondary';
      case 'normal': return 'outline';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  // Sort deadlines by urgency (overdue first, then by days until due)
  const sortedDeadlines = [...filteredDeadlines].sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (b.status === 'overdue' && a.status !== 'overdue') return 1;
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (b.status === 'completed' && a.status !== 'completed') return -1;
    return a.days_until_due - b.days_until_due;
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <AlarmClock className="h-7 w-7" />
            Task Deadlines
          </h1>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deadlines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Urgency filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Deadlines</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="next_week">Next Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold">{deadlines.filter(d => d.days_until_due < 0).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlarmClock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Due Today</p>
                <p className="text-2xl font-bold">{deadlines.filter(d => d.days_until_due === 0).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">{deadlines.filter(d => d.days_until_due >= 0 && d.days_until_due <= 7).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{deadlines.filter(d => d.status === 'completed').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deadlines List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Task Deadlines
            <Badge variant="outline" className="ml-2">
              {sortedDeadlines.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading deadlines...</div>
          ) : sortedDeadlines.length === 0 ? (
            <div className="text-center py-8">
              <AlarmClock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No deadlines found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try adjusting your search criteria' : 'No deadlines to display'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedDeadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className={`p-4 border rounded-lg hover:bg-primary/10 hover:border-primary transition-colors ${
                    deadline.status === 'overdue' ? 'border-red-200 bg-red-50/50' :
                    deadline.days_until_due === 0 ? 'border-orange-200 bg-orange-50/50' :
                    deadline.days_until_due <= 2 ? 'border-yellow-200 bg-yellow-50/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {getUrgencyIndicator(deadline.days_until_due, deadline.status)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{deadline.title}</h3>
                          <Badge variant={getPriorityColor(deadline.priority)} className="text-xs">
                            {deadline.priority.toUpperCase()}
                          </Badge>
                          <div className={`px-2 py-1 rounded-md text-xs border ${getStatusColor(deadline.status)}`}>
                            {deadline.status.replace('_', ' ').toUpperCase()}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {deadline.description}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="font-medium text-blue-600">{deadline.project_name}</span>
                          <span>Assigned to: {deadline.assignee}</span>
                          <span className={`font-medium ${
                            deadline.status === 'overdue' ? 'text-red-600' :
                            deadline.days_until_due === 0 ? 'text-orange-600' :
                            deadline.days_until_due <= 2 ? 'text-yellow-600' :
                            'text-muted-foreground'
                          }`}>
                            {getDueDateText(deadline.days_until_due, deadline.status)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Due: {new Date(deadline.due_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                      <Button size="sm" variant="outline">
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}