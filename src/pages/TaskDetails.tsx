import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, Calendar, Users, Paperclip, MessageSquare, 
  Send, Upload, Trash2, Download, User, Clock, Target
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import DragDropUpload from '@/components/DragDropUpload';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  completion_percentage: number;
  created_by: string;
  created_at: string;
  job_id: string | null;
  jobs?: { name: string } | null;
}

interface TaskAssignee {
  id: string;
  user_id: string;
  assigned_at: string;
  user_name?: string;
}

interface TaskComment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string;
}

interface TaskAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

interface CompanyUser {
  user_id: string;
  name: string;
}

interface ProfileMap {
  [key: string]: string;
}

export default function TaskDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [task, setTask] = useState<Task | null>(null);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');

  useEffect(() => {
    if (id && currentCompany) {
      loadTaskData();
      loadCompanyUsers();
    }
  }, [id, currentCompany]);

  const fetchUserProfiles = async (userIds: string[]): Promise<ProfileMap> => {
    if (userIds.length === 0) return {};
    const { data } = await supabase
      .from('profiles')
      .select('user_id, display_name, first_name, last_name')
      .in('user_id', userIds);
    
    const profileMap: ProfileMap = {};
    (data || []).forEach((p: any) => {
      const name = p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown User';
      profileMap[p.user_id] = name;
    });
    return profileMap;
  };

  const loadTaskData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Load task
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*, jobs(name)')
        .eq('id', id)
        .single();

      if (taskError) throw taskError;
      setTask(taskData);

      // Load assignees
      const { data: assigneesData } = await supabase
        .from('task_assignees')
        .select('id, user_id, assigned_at')
        .eq('task_id', id);
      
      // Load comments
      const { data: commentsData } = await supabase
        .from('task_comments')
        .select('id, user_id, content, created_at')
        .eq('task_id', id)
        .order('created_at', { ascending: true });

      // Load attachments
      const { data: attachmentsData } = await supabase
        .from('task_attachments')
        .select('id, file_name, file_url, file_size, file_type, uploaded_by, uploaded_at')
        .eq('task_id', id)
        .order('uploaded_at', { ascending: false });

      // Collect all user IDs
      const userIds = new Set<string>();
      (assigneesData || []).forEach(a => userIds.add(a.user_id));
      (commentsData || []).forEach(c => userIds.add(c.user_id));
      
      // Fetch user profiles
      const profileMap = await fetchUserProfiles(Array.from(userIds));

      // Enrich assignees with names
      setAssignees((assigneesData || []).map(a => ({
        ...a,
        user_name: profileMap[a.user_id] || 'Unknown User'
      })));

      // Enrich comments with names
      setComments((commentsData || []).map(c => ({
        ...c,
        user_name: profileMap[c.user_id] || 'Unknown User'
      })));

      setAttachments(attachmentsData || []);

    } catch (error) {
      console.error('Error loading task:', error);
      toast.error('Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyUsers = async () => {
    if (!currentCompany) return;
    const { data: accessData } = await supabase
      .from('user_company_access')
      .select('user_id')
      .eq('company_id', currentCompany.id);
    
    if (!accessData || accessData.length === 0) {
      setCompanyUsers([]);
      return;
    }

    const userIds = accessData.map(a => a.user_id);
    const profileMap = await fetchUserProfiles(userIds);
    
    setCompanyUsers(userIds.map(uid => ({
      user_id: uid,
      name: profileMap[uid] || 'Unknown User'
    })));
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !user || !id) return;
    setSendingComment(true);
    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: id,
          user_id: user.id,
          content: newComment.trim()
        });

      if (error) throw error;
      setNewComment('');
      loadTaskData();
      toast.success('Comment added');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setSendingComment(false);
    }
  };

  const handleFileUpload = async (eventOrFile: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = eventOrFile instanceof File ? eventOrFile : eventOrFile.target.files?.[0];
    if (!file || !user || !id) return;

    setUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id
        });

      if (dbError) throw dbError;
      loadTaskData();
      toast.success('File uploaded');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, fileUrl: string) => {
    try {
      const urlParts = fileUrl.split('/task-attachments/');
      if (urlParts[1]) {
        await supabase.storage.from('task-attachments').remove([urlParts[1]]);
      }

      const { error } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
      loadTaskData();
      toast.success('Attachment deleted');
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Failed to delete attachment');
    }
  };

  const handleAddAssignee = async () => {
    if (!selectedAssignee || !user || !id) return;
    try {
      const { error } = await supabase
        .from('task_assignees')
        .insert({
          task_id: id,
          user_id: selectedAssignee,
          assigned_by: user.id
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('User already assigned');
        } else {
          throw error;
        }
        return;
      }
      setSelectedAssignee('');
      loadTaskData();
      toast.success('Assignee added');
    } catch (error) {
      console.error('Error adding assignee:', error);
      toast.error('Failed to add assignee');
    }
  };

  const handleRemoveAssignee = async (assigneeId: string) => {
    try {
      const { error } = await supabase
        .from('task_assignees')
        .delete()
        .eq('id', assigneeId);

      if (error) throw error;
      loadTaskData();
      toast.success('Assignee removed');
    } catch (error) {
      console.error('Error removing assignee:', error);
      toast.error('Failed to remove assignee');
    }
  };

  const handleUpdateProgress = async (value: number) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completion_percentage: value })
        .eq('id', id);

      if (error) throw error;
      setTask(prev => prev ? { ...prev, completion_percentage: value } : null);
    } catch (error) {
      console.error('Error updating progress:', error);
      toast.error('Failed to update progress');
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      setTask(prev => prev ? { ...prev, status } : null);
      toast.success('Status updated');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'not_started': return 'bg-gray-100 text-gray-800';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'secondary';
      default: return 'outline';
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">Loading task details...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="text-center py-8">
          <h2 className="text-xl font-semibold">Task not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Tasks
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-2">{task.title}</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={getPriorityColor(task.priority)}>
                      {task.priority.toUpperCase()}
                    </Badge>
                    <div className={`px-2 py-1 rounded-md text-xs ${getStatusColor(task.status)}`}>
                      {task.status.replace('_', ' ').toUpperCase()}
                    </div>
                    {task.jobs?.name && (
                      <Badge variant="outline">{task.jobs.name}</Badge>
                    )}
                  </div>
                </div>
                <Select value={task.status} onValueChange={handleUpdateStatus}>
                  <SelectTrigger className="w-[150px]">
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
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {task.description || 'No description provided.'}
              </p>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                {task.start_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Start: {format(new Date(task.start_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
                {task.due_date && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Due: {format(new Date(task.due_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Completion</span>
                  <span className="text-sm font-bold">{task.completion_percentage}%</span>
                </div>
                <Progress value={task.completion_percentage} className="h-3" />
                <div className="flex gap-2 flex-wrap">
                  {[0, 25, 50, 75, 100].map(val => (
                    <Button
                      key={val}
                      size="sm"
                      variant={task.completion_percentage === val ? 'default' : 'outline'}
                      onClick={() => handleUpdateProgress(val)}
                    >
                      {val}%
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs for Comments and Attachments */}
          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments" className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                Chat ({comments.length})
              </TabsTrigger>
              <TabsTrigger value="attachments" className="flex items-center gap-1">
                <Paperclip className="h-4 w-4" />
                Attachments ({attachments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comments">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4 max-h-[400px] overflow-y-auto mb-4">
                    {comments.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No comments yet. Start the conversation!
                      </p>
                    ) : (
                      comments.map(comment => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {comment.user_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {comment.user_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                              </span>
                            </div>
                            <p className="text-sm mt-1">{comment.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Write a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[80px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendComment();
                        }
                      }}
                    />
                    <Button onClick={handleSendComment} disabled={sendingComment || !newComment.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attachments">
              <Card>
                <CardContent className="p-4">
                  <div className="mb-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingFile ? 'Uploading...' : 'Upload File'}
                    </Button>
                    <div className="mt-3">
                      <DragDropUpload
                        onFileSelect={(file) => void handleFileUpload(file)}
                        size="compact"
                        maxSize={20}
                        title="Drop attachment file"
                        subtitle="or click to choose file"
                        helperText="Upload task attachment"
                        disabled={uploadingFile}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {attachments.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No attachments yet. Upload files to share with the team.
                      </p>
                    ) : (
                      attachments.map(attachment => (
                        <div 
                          key={attachment.id} 
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{attachment.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(attachment.file_size)} • 
                                Uploaded {format(new Date(attachment.uploaded_at), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              asChild
                            >
                              <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteAttachment(attachment.id, attachment.file_url)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Assignees */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Assignees ({assignees.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                {assignees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assignees yet</p>
                ) : (
                  assignees.map(assignee => (
                    <div key={assignee.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {assignee.user_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {assignee.user_name}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveAssignee(assignee.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {companyUsers
                      .filter(u => !assignees.some(a => a.user_id === u.user_id))
                      .map(u => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddAssignee} disabled={!selectedAssignee}>
                  <User className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Task Info */}
          <Card>
            <CardHeader>
              <CardTitle>Task Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(task.created_at), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority</span>
                <Badge variant={getPriorityColor(task.priority)}>
                  {task.priority}
                </Badge>
              </div>
              {task.jobs?.name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project</span>
                  <span>{task.jobs.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
