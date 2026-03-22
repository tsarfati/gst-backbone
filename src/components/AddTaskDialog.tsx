import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { createTaskNotifications } from '@/utils/taskNotifications';
import { toast } from 'sonner';
import { useWebsiteJobAccess } from '@/hooks/useWebsiteJobAccess';

interface Job {
  id: string;
  name: string;
}

interface AddTaskDialogProps {
  onTaskCreated?: () => void;
  children?: React.ReactNode;
}

export function AddTaskDialog({ onTaskCreated, children }: AddTaskDialogProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'normal',
    status: 'not_started',
    start_date: '',
    due_date: '',
    is_due_asap: false,
    job_id: ''
  });

  useEffect(() => {
    if (open && currentCompany && !websiteJobAccessLoading) {
      loadJobs();
    }
  }, [open, currentCompany, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(',')]);

  const loadJobs = async () => {
    if (!currentCompany) return;
    if (!isPrivileged && allowedJobIds.length === 0) {
      setJobs([]);
      return;
    }

    let query = supabase
      .from('jobs')
      .select('id, name')
      .eq('company_id', currentCompany.id)
      .eq('is_active', true)
      .order('name');
    if (!isPrivileged) {
      query = query.in('id', allowedJobIds);
    }
    const { data } = await query;
    setJobs(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentCompany) return;

    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    setLoading(true);
    try {
      const { data: insertedTask, error } = await supabase
        .from('tasks')
        .insert({
          company_id: currentCompany.id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          priority: formData.priority,
          status: formData.status,
          start_date: formData.start_date || null,
          due_date: formData.is_due_asap ? null : formData.due_date || null,
          is_due_asap: formData.is_due_asap,
          job_id: formData.job_id || null,
          created_by: user.id,
          leader_user_id: user.id,
        })
        .select('id, title')
        .single();

      if (error) throw error;

      const createdTaskId = String((insertedTask as any)?.id || '');
      if (createdTaskId) {
        const { error: assigneeError } = await supabase
          .from('task_assignees')
          .insert({
            task_id: createdTaskId,
            user_id: user.id,
            assigned_by: user.id,
          });

        if (assigneeError) throw assigneeError;

        await supabase.from('task_activity' as any).insert({
          task_id: createdTaskId,
          actor_user_id: user.id,
          activity_type: 'task_created',
          content: 'Created the task',
        });

        await supabase.from('task_activity' as any).insert([
          {
            task_id: createdTaskId,
            actor_user_id: user.id,
            activity_type: 'assignee_added',
            content: 'Added the creator to the task team',
          },
          {
            task_id: createdTaskId,
            actor_user_id: user.id,
            activity_type: 'lead_assigned',
            content: 'Assigned the creator as task lead',
          },
        ]);

        await createTaskNotifications({
          taskId: createdTaskId,
          companyId: currentCompany.id,
          actorUserId: user.id,
          title: 'New task',
          message: `${formData.title.trim()} was created and you’re on the task team.`,
          additionalRecipientUserIds: [user.id],
        });
      }

      toast.success('Task created successfully');
      setOpen(false);
      setFormData({
        title: '',
        description: '',
        priority: 'normal',
        status: 'not_started',
        start_date: '',
        due_date: '',
        is_due_asap: false,
        job_id: ''
      });
      onTaskCreated?.();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter task title"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Project (Optional)</Label>
            <Select
              value={formData.job_id || NO_PROJECT_VALUE}
              onValueChange={(value) =>
                setFormData(prev => ({ ...prev, job_id: value === NO_PROJECT_VALUE ? '' : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={websiteJobAccessLoading ? "Loading projects..." : "Select a project"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT_VALUE}>No Project</SelectItem>
                {jobs.map(job => (
                  <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                disabled={formData.is_due_asap}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
            <Checkbox
              id="task-due-asap"
              checked={formData.is_due_asap}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  is_due_asap: Boolean(checked),
                  due_date: checked ? '' : prev.due_date,
                }))
              }
            />
            <div className="space-y-0.5">
              <Label htmlFor="task-due-asap" className="cursor-pointer">
                Mark due date as ASAP
              </Label>
              <p className="text-xs text-muted-foreground">
                Use this when the task should be handled as soon as possible instead of on a fixed date.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
  const NO_PROJECT_VALUE = '__no_project__';
