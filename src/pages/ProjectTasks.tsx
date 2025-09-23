import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Plus, Search, Calendar, Users, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ProjectTask {
  id: string;
  title: string;
  description: string;
  project_id: string;
  project_name: string;
  assignees: string[];
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  start_date: string;
  due_date: string;
  completion_percentage: number;
  dependencies: string[];
}

// Mock data - in a real app, this would come from your database
const mockProjectTasks: ProjectTask[] = [
  {
    id: '1',
    title: 'Foundation Inspection',
    description: 'Complete foundation inspection and obtain approval from city inspector',
    project_id: 'proj-1',
    project_name: 'Downtown Office Building',
    assignees: ['John Smith', 'Mike Brown'],
    status: 'in_progress',
    priority: 'high',
    start_date: '2024-01-10',
    due_date: '2024-01-15',
    completion_percentage: 65,
    dependencies: []
  },
  {
    id: '2',
    title: 'Electrical Rough-in',
    description: 'Install electrical wiring throughout the building',
    project_id: 'proj-1',
    project_name: 'Downtown Office Building',
    assignees: ['Lisa Wilson'],
    status: 'not_started',
    priority: 'normal',
    start_date: '2024-01-16',
    due_date: '2024-01-25',
    completion_percentage: 0,
    dependencies: ['1']
  },
  {
    id: '3',
    title: 'Material Delivery Coordination',
    description: 'Coordinate delivery of steel beams and concrete',
    project_id: 'proj-2',
    project_name: 'Residential Complex',
    assignees: ['Sarah Johnson', 'David Chen'],
    status: 'completed',
    priority: 'high',
    start_date: '2024-01-05',
    due_date: '2024-01-12',
    completion_percentage: 100,
    dependencies: []
  }
];

export default function ProjectTasks() {
  const [tasks, setTasks] = useState<ProjectTask[]>(mockProjectTasks);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { user } = useAuth();

  // Get unique projects
  const projects = Array.from(new Set(tasks.map(task => task.project_name)));

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.project_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject = selectedProject === 'all' || task.project_name === selectedProject;
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesProject && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'not_started': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-blue-500';
    if (percentage >= 25) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="h-7 w-7" />
            Project Tasks
          </h1>
          <p className="text-muted-foreground">
            Manage tasks organized by project
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Project Task
        </Button>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search project tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-full lg:w-[250px]">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project} value={project}>
                    {project}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
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
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{filteredTasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{filteredTasks.filter(t => t.status === 'completed').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{filteredTasks.filter(t => t.status === 'in_progress').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Projects</p>
                <p className="text-2xl font-bold">{projects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Project Tasks
            <Badge variant="outline" className="ml-2">
              {filteredTasks.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading project tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No project tasks found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try adjusting your search criteria' : 'No project tasks to display'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{task.title}</h3>
                        <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                          {task.priority.toUpperCase()}
                        </Badge>
                        <div className={`px-2 py-1 rounded-md text-xs border ${getStatusColor(task.status)}`}>
                          {task.status.replace('_', ' ').toUpperCase()}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {task.description}
                      </p>
                      <p className="text-sm font-medium text-blue-600 mb-2">
                        {task.project_name}
                      </p>
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

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span>{task.completion_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${getProgressColor(task.completion_percentage)}`}
                        style={{ width: `${task.completion_percentage}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Task Details */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{task.assignees.length} assignee{task.assignees.length > 1 ? 's' : ''}</span>
                    </div>
                    {task.dependencies.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Target className="h-4 w-4" />
                        <span>{task.dependencies.length} dependencies</span>
                      </div>
                    )}
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