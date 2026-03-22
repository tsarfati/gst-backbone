import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Calendar,
  CheckSquare,
  Clock,
  Copy,
  Download,
  FolderKanban,
  Mail,
  Paperclip,
  Plus,
  Send,
  Settings,
  Target,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';

import DragDropUpload from '@/components/DragDropUpload';
import MentionTextarea from '@/components/MentionTextarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { useWebsiteJobAccess } from '@/hooks/useWebsiteJobAccess';
import { canAccessAssignedJobOnly } from '@/utils/jobAccess';
import { createMentionNotifications } from '@/utils/mentions';
import { createTaskNotifications } from '@/utils/taskNotifications';
import { extractHashTags } from '@/utils/tags';
import { toast } from 'sonner';

type TaskRecord = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  is_due_asap: boolean | null;
  completion_percentage: number | null;
  created_by: string;
  created_at: string;
  job_id: string | null;
  leader_user_id?: string | null;
  jobs?: { name: string } | null;
};

type UserSummary = {
  user_id: string;
  name: string;
  avatar_url?: string | null;
};

type TaskAssignee = {
  id: string;
  task_id: string;
  user_id: string;
  assigned_at: string;
  user_name: string;
  avatar_url?: string | null;
};

type TaskComment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name: string;
  avatar_url?: string | null;
  tags?: string[];
};

type TaskAttachment = {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string;
  uploaded_at: string;
  user_name?: string;
  avatar_url?: string | null;
};

type ChecklistItem = {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  due_date: string | null;
  assigned_user_id: string | null;
  sort_order: number;
  completed_at: string | null;
  assigned_user_name?: string;
  assigned_user_avatar?: string | null;
};

type ActivityItem = {
  id: string;
  task_id: string;
  activity_type: string;
  actor_user_id: string | null;
  content: string;
  metadata: Record<string, any> | null;
  created_at: string;
  actor_name?: string;
  actor_avatar?: string | null;
};

type TaskEmailMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  from_email: string | null;
  to_emails: string[];
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  created_at: string;
};

type JobOption = {
  id: string;
  name: string;
};

type TaskDraft = {
  title: string;
  description: string;
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  is_due_asap: boolean;
  job_id: string;
  completion_percentage: number;
};

type TimelineEntry =
  | { id: string; kind: 'comment'; created_at: string; actorName: string; actorAvatar?: string | null; body: string; tags?: string[] }
  | { id: string; kind: 'attachment'; created_at: string; actorName: string; actorAvatar?: string | null; body: string; fileName: string; fileUrl: string }
  | { id: string; kind: 'email'; created_at: string; actorName: string; actorAvatar?: string | null; body: string; subject: string; fromEmail: string; toEmails: string[] }
  | { id: string; kind: 'activity'; created_at: string; actorName: string; actorAvatar?: string | null; body: string };

const EMPTY_TASK_DRAFT: TaskDraft = {
  title: '',
  description: '',
  status: 'not_started',
  priority: 'normal',
  start_date: '',
  due_date: '',
  is_due_asap: false,
  job_id: '',
  completion_percentage: 0,
};

const NO_JOB_VALUE = '__no_job__';
const NO_ASSIGNEE_VALUE = '__no_assignee__';
const DEFAULT_TASK_EMAIL_INBOUND_DOMAIN = 'send.builderlynk.com';

export default function TaskDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { settings } = useSettings();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveReadyRef = useRef(false);

  const [task, setTask] = useState<TaskRecord | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(EMPTY_TASK_DRAFT);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [emailMessages, setEmailMessages] = useState<TaskEmailMessage[]>([]);
  const [companyUsers, setCompanyUsers] = useState<UserSummary[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [savingTask, setSavingTask] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newChecklistDueDate, setNewChecklistDueDate] = useState('');
  const [newChecklistAssignedUser, setNewChecklistAssignedUser] = useState('');
  const [trackingEmail, setTrackingEmail] = useState('');
  const [activeEmailPreview, setActiveEmailPreview] = useState<TaskEmailMessage | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [pendingLeaderSelection, setPendingLeaderSelection] = useState(false);

  const actorName =
    (user as any)?.user_metadata?.full_name ||
    (user as any)?.user_metadata?.name ||
    (user as any)?.email ||
    'A teammate';

  useEffect(() => {
    if (id && currentCompany?.id && !websiteJobAccessLoading) {
      void loadTaskWorkspace();
    }
  }, [id, currentCompany?.id, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(',')]);

  const ensureTrackingEmail = async (taskId: string, companyId: string) => {
    const invokeResult = await supabase.functions.invoke('get-task-email-channel', {
      body: { taskId },
    });

    const invokedTrackingEmail = String((invokeResult.data as any)?.trackingEmail || '').trim().toLowerCase();
    if (invokedTrackingEmail) return invokedTrackingEmail;

    if (invokeResult.error) {
      console.error('Error invoking get-task-email-channel:', invokeResult.error);
    }

    const { data: existingChannel, error: existingChannelError } = await supabase
      .from('task_email_channels' as any)
      .select('tracking_email')
      .eq('task_id', taskId)
      .maybeSingle();

    if (existingChannelError) {
      console.error('Error loading existing task email channel:', existingChannelError);
    }

    const existingTrackingEmail = String((existingChannel as any)?.tracking_email || '').trim().toLowerCase();
    if (existingTrackingEmail) return existingTrackingEmail;

    const localPart = `task-${taskId.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;
    const trackingEmail = `${localPart}@${DEFAULT_TASK_EMAIL_INBOUND_DOMAIN}`.toLowerCase();

    const { data: insertedChannel, error: insertChannelError } = await supabase
      .from('task_email_channels' as any)
      .insert({
        task_id: taskId,
        company_id: companyId,
        tracking_local_part: localPart,
        tracking_email: trackingEmail,
        created_by: user?.id || null,
      })
      .select('tracking_email')
      .single();

    if (insertChannelError) {
      console.error('Error creating fallback task email channel:', insertChannelError);
      return '';
    }

    return String((insertedChannel as any)?.tracking_email || trackingEmail).trim().toLowerCase();
  };

  const loadTaskWorkspace = async () => {
    if (!id || !currentCompany) return;
    setLoading(true);
    setLoadingEmails(true);
    try {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*, jobs(name)')
        .eq('id', id)
        .single();

      if (taskError) throw taskError;

      if (
        taskData?.job_id &&
        !canAccessAssignedJobOnly([taskData.job_id], isPrivileged, allowedJobIds)
      ) {
        toast.error('You do not have access to this task.');
        navigate('/tasks');
        return;
      }

      const taskRecord = taskData as TaskRecord;

      const [
        assigneesResult,
        commentsResult,
        commentTagsResult,
        attachmentsResult,
        companyAccessResult,
        jobsResult,
        checklistResult,
        activityResult,
        taskEmailResult,
      ] = await Promise.all([
        supabase
          .from('task_assignees')
          .select('id, task_id, user_id, assigned_at')
          .eq('task_id', id),
        supabase
          .from('task_comments')
          .select('id, user_id, content, created_at')
          .eq('task_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('task_comment_tags' as any)
          .select('task_comment_id, tag')
          .eq('task_id', id),
        supabase
          .from('task_attachments')
          .select('id, file_name, file_url, file_size, file_type, uploaded_by, uploaded_at')
          .eq('task_id', id)
          .order('uploaded_at', { ascending: false }),
        supabase
          .from('user_company_access')
          .select('user_id, role, is_active')
          .eq('company_id', currentCompany.id),
        (() => {
          let query = supabase
            .from('jobs')
            .select('id, name')
            .eq('company_id', currentCompany.id)
            .eq('is_active', true)
            .order('name');
          if (!isPrivileged) {
            query = query.in('id', allowedJobIds);
          }
          return query;
        })(),
        supabase
          .from('task_checklist_items' as any)
          .select('id, task_id, title, is_completed, due_date, assigned_user_id, sort_order, completed_at')
          .eq('task_id', id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('task_activity' as any)
          .select('id, task_id, activity_type, actor_user_id, content, metadata, created_at')
          .eq('task_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('task_email_messages' as any)
          .select('id, direction, from_email, to_emails, subject, body_text, body_html, created_at')
          .eq('task_id', id)
          .order('created_at', { ascending: false }),
      ]);

      const companyAccessRows = ((companyAccessResult.data || []) as any[]).filter(
        (row: any) => row?.is_active !== false,
      );
      const companyAccessMap = new Map(
        companyAccessRows.map((row: any) => [String(row.user_id), String(row.role || '').trim().toLowerCase()]),
      );
      const userIds = Array.from(
        new Set(
          [
            ...companyAccessRows.map((row: any) => String(row.user_id)),
            taskRecord.created_by,
            taskRecord.leader_user_id || '',
            ...(assigneesResult.data || []).map((row: any) => row.user_id),
            ...(commentsResult.data || []).map((row: any) => row.user_id),
            ...(attachmentsResult.data || []).map((row: any) => row.uploaded_by),
            ...((checklistResult.data || []).map((row: any) => row.assigned_user_id || '')),
            ...((activityResult.data || []).map((row: any) => row.actor_user_id || '')),
          ].filter(Boolean),
        ),
      );

      const { data: profileRows } = userIds.length > 0
        ? await supabase
            .from('profiles')
            .select('user_id, display_name, first_name, last_name, avatar_url, custom_role_id')
            .in('user_id', userIds)
        : { data: [] as any[] };

      const profileMap = new Map(
        (profileRows || []).map((profile: any) => [
          String(profile.user_id),
          {
            name:
              String(
                profile.display_name ||
                  `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
                  'Unknown User',
              ),
            avatar_url: profile.avatar_url || null,
          },
        ]),
      );

      const commentTagsMap = new Map<string, string[]>();
      ((commentTagsResult.data || []) as any[]).forEach((row) => {
        const commentId = String(row.task_comment_id || '');
        const tag = String(row.tag || '').trim().toLowerCase();
        if (!commentId || !tag) return;
        const existing = commentTagsMap.get(commentId) || [];
        if (!existing.includes(tag)) existing.push(tag);
        commentTagsMap.set(commentId, existing);
      });

      setTask(taskRecord);
      setTaskDraft({
        title: taskRecord.title || '',
        description: taskRecord.description || '',
        status: taskRecord.status || 'not_started',
        priority: taskRecord.priority || 'normal',
        start_date: taskRecord.start_date || '',
        due_date: taskRecord.due_date || '',
        is_due_asap: Boolean(taskRecord.is_due_asap),
        job_id: taskRecord.job_id || '',
        completion_percentage: Number(taskRecord.completion_percentage || 0),
      });

      const eligibleCompanyUserIds = companyAccessRows
        .filter((row: any) => {
          const userId = String(row.user_id);
          const companyRole = companyAccessMap.get(userId) || '';
          const profile = (profileRows || []).find((entry: any) => String(entry.user_id) === userId);
          const hasCustomRole = Boolean((profile as any)?.custom_role_id);
          return companyRole !== 'employee' || hasCustomRole;
        })
        .map((row: any) => String(row.user_id));

      setCompanyUsers(
        eligibleCompanyUserIds.map((userId) => ({
          user_id: userId,
          name: profileMap.get(userId)?.name || 'Unknown User',
          avatar_url: profileMap.get(userId)?.avatar_url || null,
        })),
      );

      setAssignees(
        ((assigneesResult.data || []) as any[]).map((row) => ({
          id: String(row.id),
          task_id: String(row.task_id),
          user_id: String(row.user_id),
          assigned_at: row.assigned_at,
          user_name: profileMap.get(String(row.user_id))?.name || 'Unknown User',
          avatar_url: profileMap.get(String(row.user_id))?.avatar_url || null,
        })),
      );

      setComments(
        ((commentsResult.data || []) as any[]).map((row) => ({
          id: String(row.id),
          user_id: String(row.user_id),
          content: String(row.content || ''),
          created_at: row.created_at,
          user_name: profileMap.get(String(row.user_id))?.name || 'Unknown User',
          avatar_url: profileMap.get(String(row.user_id))?.avatar_url || null,
          tags: commentTagsMap.get(String(row.id)) || [],
        })),
      );

      setAttachments(
        ((attachmentsResult.data || []) as any[]).map((row) => ({
          id: String(row.id),
          file_name: String(row.file_name || ''),
          file_url: String(row.file_url || ''),
          file_size: row.file_size,
          file_type: row.file_type,
          uploaded_by: String(row.uploaded_by),
          uploaded_at: row.uploaded_at,
          user_name: profileMap.get(String(row.uploaded_by))?.name || 'Unknown User',
          avatar_url: profileMap.get(String(row.uploaded_by))?.avatar_url || null,
        })),
      );

      setChecklistItems(
        ((checklistResult.data || []) as any[]).map((row) => ({
          id: String(row.id),
          task_id: String(row.task_id),
          title: String(row.title || ''),
          is_completed: Boolean(row.is_completed),
          due_date: row.due_date || null,
          assigned_user_id: row.assigned_user_id || null,
          sort_order: Number(row.sort_order || 0),
          completed_at: row.completed_at || null,
          assigned_user_name: row.assigned_user_id ? profileMap.get(String(row.assigned_user_id))?.name || 'Unknown User' : undefined,
          assigned_user_avatar: row.assigned_user_id ? profileMap.get(String(row.assigned_user_id))?.avatar_url || null : null,
        })),
      );

      setActivities(
        ((activityResult.data || []) as any[]).map((row) => ({
          id: String(row.id),
          task_id: String(row.task_id),
          activity_type: String(row.activity_type || 'update'),
          actor_user_id: row.actor_user_id || null,
          content: String(row.content || ''),
          metadata: row.metadata || null,
          created_at: row.created_at,
          actor_name: row.actor_user_id ? profileMap.get(String(row.actor_user_id))?.name || 'Unknown User' : 'System',
          actor_avatar: row.actor_user_id ? profileMap.get(String(row.actor_user_id))?.avatar_url || null : null,
        })),
      );

      setJobs((jobsResult.data || []) as JobOption[]);
      setEmailMessages(((taskEmailResult.data || []) as TaskEmailMessage[]) || []);
      setTrackingEmail(await ensureTrackingEmail(id, currentCompany.id));
    } catch (error) {
      console.error('Error loading task workspace:', error);
      toast.error('Failed to load task details');
    } finally {
      setLoading(false);
      setLoadingEmails(false);
    }
  };

  const logTaskActivity = async (activityType: string, content: string, metadata?: Record<string, any>) => {
    if (!id || !user) return;
    try {
      await supabase.from('task_activity' as any).insert({
        task_id: id,
        activity_type: activityType,
        actor_user_id: user.id,
        content,
        metadata: metadata || null,
      });
    } catch (error) {
      console.error('Error logging task activity:', error);
    }
  };

  const notifyTaskTeam = async (title: string, message: string, additionalRecipientUserIds?: string[]) => {
    if (!id || !currentCompany?.id) return;
    try {
      await createTaskNotifications({
        taskId: id,
        companyId: currentCompany.id,
        actorUserId: user?.id,
        title,
        message,
        additionalRecipientUserIds,
      });
    } catch (error) {
      console.error('Error creating task notifications:', error);
    }
  };

  const handleSaveTask = async () => {
    if (!id || !task) return;
    if (!taskDraft.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    setSavingTask(true);
    try {
      const updates = {
        title: taskDraft.title.trim(),
        description: taskDraft.description.trim() || null,
        status: taskDraft.status,
        priority: taskDraft.priority,
        start_date: taskDraft.start_date || null,
        due_date: taskDraft.is_due_asap ? null : taskDraft.due_date || null,
        is_due_asap: taskDraft.is_due_asap,
        job_id: taskDraft.job_id || null,
        completion_percentage: taskDraft.completion_percentage,
      };

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      const changedFields: string[] = [];
      if (task.title !== updates.title) changedFields.push('title');
      if ((task.description || '') !== (updates.description || '')) changedFields.push('description');
      if (task.status !== updates.status) changedFields.push('status');
      if (task.priority !== updates.priority) changedFields.push('priority');
      if ((task.start_date || '') !== (updates.start_date || '')) changedFields.push('start date');
      if ((task.due_date || '') !== (updates.due_date || '')) changedFields.push('due date');
      if (Boolean(task.is_due_asap) !== updates.is_due_asap) changedFields.push('due date mode');
      if ((task.job_id || '') !== (updates.job_id || '')) changedFields.push('project');
      if (Number(task.completion_percentage || 0) !== updates.completion_percentage) changedFields.push('progress');

      await logTaskActivity(
        'task_updated',
        changedFields.length > 0 ? `Updated ${changedFields.join(', ')}` : 'Updated task details',
        { changedFields },
      );
      await notifyTaskTeam('Task updated', `${actorName} updated ${taskDraft.title || 'this task'}.`);

      toast.success('Task updated');
      await loadTaskWorkspace();
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error('Failed to update task');
    } finally {
      setSavingTask(false);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !user || !id) return;
    setSendingComment(true);
    try {
      const content = newComment.trim();
      const { data: insertedComment, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: id,
          user_id: user.id,
          content,
        })
        .select('id')
        .single();

      if (error) throw error;

      const commentId = String((insertedComment as any)?.id || '');
      const tags = extractHashTags(content);
      if (commentId && tags.length > 0 && currentCompany?.id) {
        const { error: tagError } = await supabase
          .from('task_comment_tags' as any)
          .insert(
            tags.map((tag) => ({
              company_id: currentCompany.id,
              task_id: id,
              task_comment_id: commentId,
              tag,
              created_by: user.id,
            })),
          );
        if (tagError) throw tagError;
      }

      if (currentCompany?.id) {
        await createMentionNotifications({
          companyId: currentCompany.id,
          actorUserId: user.id,
          actorName,
          content,
          contextLabel: 'Task Comments',
          targetPath: `/tasks/${id}`,
        });
      }

      await logTaskActivity('comment_added', 'Added a comment');
      await notifyTaskTeam('New task comment', `${actorName} commented on ${taskDraft.title || 'a task'}.`);
      setNewComment('');
      await loadTaskWorkspace();
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

      const { error: insertError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id,
        });
      if (insertError) throw insertError;

      await logTaskActivity('attachment_added', `Uploaded ${file.name}`, {
        file_name: file.name,
        file_url: urlData.publicUrl,
      });
      await notifyTaskTeam('Task attachment added', `${actorName} added ${file.name} to ${taskDraft.title || 'a task'}.`);
      await loadTaskWorkspace();
      toast.success('Attachment uploaded');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachment: TaskAttachment) => {
    try {
      const urlParts = attachment.file_url.split('/task-attachments/');
      if (urlParts[1]) {
        await supabase.storage.from('task-attachments').remove([urlParts[1]]);
      }

      const { error } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachment.id);
      if (error) throw error;

      await logTaskActivity('attachment_deleted', `Removed ${attachment.file_name}`, {
        file_name: attachment.file_name,
      });
      await notifyTaskTeam('Task attachment removed', `${actorName} removed ${attachment.file_name} from ${taskDraft.title || 'a task'}.`);
      await loadTaskWorkspace();
      toast.success('Attachment deleted');
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Failed to delete attachment');
    }
  };

  const handleAddAssignee = async (options?: { userId?: string; makeLead?: boolean }) => {
    const userId = options?.userId || selectedAssignee;
    const makeLead = Boolean(options?.makeLead);
    if (!userId || !user || !id) return;
    try {
      const userRecord = companyUsers.find((entry) => entry.user_id === userId);
      const { error } = await supabase
        .from('task_assignees')
        .insert({
          task_id: id,
          user_id: userId,
          assigned_by: user.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('User already assigned');
          return;
        }
        throw error;
      }

      if (makeLead) {
        const { error: leadError } = await supabase
          .from('tasks')
          .update({ leader_user_id: userId })
          .eq('id', id);
        if (leadError) throw leadError;
      }

      await logTaskActivity('assignee_added', `Added ${userRecord?.name || 'an assignee'} to the task`);
      if (makeLead) {
        await logTaskActivity('lead_assigned', `Assigned ${userRecord?.name || 'a teammate'} as task lead`);
      }
      await notifyTaskTeam(
        makeLead ? 'Task team updated' : 'Added to task team',
        makeLead
          ? `${actorName} added ${userRecord?.name || 'a teammate'} to ${taskDraft.title || 'a task'} and made them the task lead.`
          : `${actorName} added ${userRecord?.name || 'a teammate'} to ${taskDraft.title || 'a task'}.`,
        [userId],
      );
      setSelectedAssignee('');
      setPendingLeaderSelection(false);
      setTeamModalOpen(false);
      await loadTaskWorkspace();
      toast.success(makeLead ? 'Person added as task lead' : 'Person added');
    } catch (error) {
      console.error('Error adding assignee:', error);
      toast.error('Failed to add assignee');
    }
  };

  const handleRemoveAssignee = async (assignee: TaskAssignee) => {
    try {
      const { error } = await supabase.from('task_assignees').delete().eq('id', assignee.id);
      if (error) throw error;

      if (task?.leader_user_id === assignee.user_id) {
        const { error: leaderError } = await supabase
          .from('tasks')
          .update({ leader_user_id: null })
          .eq('id', assignee.task_id);
        if (leaderError) throw leaderError;
      }

      await logTaskActivity('assignee_removed', `Removed ${assignee.user_name} from the task`);
      await notifyTaskTeam('Task team updated', `${actorName} removed ${assignee.user_name} from ${taskDraft.title || 'a task'}.`);
      await loadTaskWorkspace();
      toast.success('Person removed');
    } catch (error) {
      console.error('Error removing assignee:', error);
      toast.error('Failed to remove assignee');
    }
  };

  const handleAddChecklistItem = async () => {
    if (!id || !user || !newChecklistTitle.trim()) {
      toast.error('Checklist item title is required');
      return;
    }
    try {
      const nextSortOrder = checklistItems.length;
      const assignedUserName = companyUsers.find((entry) => entry.user_id === newChecklistAssignedUser)?.name;
      const { error } = await supabase
        .from('task_checklist_items' as any)
        .insert({
          task_id: id,
          title: newChecklistTitle.trim(),
          due_date: newChecklistDueDate || null,
          assigned_user_id: newChecklistAssignedUser || null,
          sort_order: nextSortOrder,
          created_by: user.id,
        });
      if (error) throw error;

      await logTaskActivity(
        'checklist_item_added',
        `Added checklist item "${newChecklistTitle.trim()}"`,
        {
          assigned_user_name: assignedUserName || null,
          due_date: newChecklistDueDate || null,
        },
      );
      await notifyTaskTeam('Task checklist updated', `${actorName} added a checklist item to ${taskDraft.title || 'a task'}.`);

      setNewChecklistTitle('');
      setNewChecklistDueDate('');
      setNewChecklistAssignedUser('');
      await loadTaskWorkspace();
      toast.success('Checklist item added');
    } catch (error) {
      console.error('Error adding checklist item:', error);
      toast.error('Failed to add checklist item');
    }
  };

  const handleToggleChecklistItem = async (item: ChecklistItem, checked: boolean) => {
    try {
      const { error } = await supabase
        .from('task_checklist_items' as any)
        .update({
          is_completed: checked,
          completed_at: checked ? new Date().toISOString() : null,
          completed_by: checked ? user?.id || null : null,
        })
        .eq('id', item.id);
      if (error) throw error;

      await logTaskActivity(
        checked ? 'checklist_item_completed' : 'checklist_item_reopened',
        `${checked ? 'Completed' : 'Reopened'} checklist item "${item.title}"`,
      );
      await notifyTaskTeam(
        checked ? 'Checklist item completed' : 'Checklist item reopened',
        `${actorName} ${checked ? 'completed' : 'reopened'} "${item.title}" on ${taskDraft.title || 'a task'}.`,
      );
      await loadTaskWorkspace();
    } catch (error) {
      console.error('Error updating checklist item:', error);
      toast.error('Failed to update checklist item');
    }
  };

  const handleDeleteChecklistItem = async (item: ChecklistItem) => {
    try {
      const { error } = await supabase
        .from('task_checklist_items' as any)
        .delete()
        .eq('id', item.id);
      if (error) throw error;

      await logTaskActivity('checklist_item_deleted', `Removed checklist item "${item.title}"`);
      await notifyTaskTeam('Task checklist updated', `${actorName} removed a checklist item from ${taskDraft.title || 'a task'}.`);
      await loadTaskWorkspace();
      toast.success('Checklist item removed');
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      toast.error('Failed to remove checklist item');
    }
  };

  const timeline = useMemo<TimelineEntry[]>(() => {
    const commentEntries: TimelineEntry[] = comments.map((comment) => ({
      id: `comment-${comment.id}`,
      kind: 'comment',
      created_at: comment.created_at,
      actorName: comment.user_name,
      actorAvatar: comment.avatar_url || null,
      body: comment.content,
      tags: comment.tags || [],
    }));

    const attachmentEntries: TimelineEntry[] = attachments.map((attachment) => ({
      id: `attachment-${attachment.id}`,
      kind: 'attachment',
      created_at: attachment.uploaded_at,
      actorName: attachment.user_name || 'Unknown User',
      actorAvatar: attachment.avatar_url || null,
      body: `Uploaded ${attachment.file_name}`,
      fileName: attachment.file_name,
      fileUrl: attachment.file_url,
    }));

    const emailEntries: TimelineEntry[] = emailMessages.map((email) => ({
      id: `email-${email.id}`,
      kind: 'email',
      created_at: email.created_at,
      actorName: email.direction === 'inbound' ? (email.from_email || 'External Email') : 'Task Email',
      actorAvatar: null,
      body: email.body_text || `Email ${email.direction}`,
      subject: email.subject || '(No subject)',
      fromEmail: email.from_email || '-',
      toEmails: email.to_emails || [],
    }));

    const activityEntries: TimelineEntry[] = activities.map((activity) => ({
      id: `activity-${activity.id}`,
      kind: 'activity',
      created_at: activity.created_at,
      actorName: activity.actor_name || 'System',
      actorAvatar: activity.actor_avatar || null,
      body: activity.content,
    }));

    return [...commentEntries, ...attachmentEntries, ...emailEntries, ...activityEntries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [activities, attachments, comments, emailMessages]);

  const availableAssignees = companyUsers.filter(
    (entry) => !assignees.some((assignee) => assignee.user_id === entry.user_id),
  );
  const checklistAssignableUsers = companyUsers.filter((entry) =>
    assignees.some((assignee) => assignee.user_id === entry.user_id),
  );
  const completedChecklistCount = checklistItems.filter((item) => item.is_completed).length;
  const isTaskLead = Boolean(user?.id && task && (task.leader_user_id ? task.leader_user_id === user.id : task.created_by === user.id));
  const isTaskDirty = Boolean(
    task && (
      task.title !== taskDraft.title ||
      (task.description || '') !== taskDraft.description ||
      task.status !== taskDraft.status ||
      task.priority !== taskDraft.priority ||
      (task.start_date || '') !== taskDraft.start_date ||
      (task.due_date || '') !== taskDraft.due_date ||
      Boolean(task.is_due_asap) !== taskDraft.is_due_asap ||
      (task.job_id || '') !== taskDraft.job_id ||
      Number(task.completion_percentage || 0) !== taskDraft.completion_percentage
    )
  );
  const dueDateLabel = taskDraft.is_due_asap
    ? 'ASAP'
    : taskDraft.due_date
      ? format(new Date(taskDraft.due_date), 'MMM d, yyyy')
      : 'Not set';
  const dueDateSentence = taskDraft.is_due_asap
    ? 'Due ASAP'
    : taskDraft.due_date
      ? `Due ${format(new Date(taskDraft.due_date), 'MMM d, yyyy')}`
      : 'No due date set';

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    if (!task?.id || loading) return;
    autoSaveReadyRef.current = true;
  }, [task?.id, loading]);

  useEffect(() => {
    if (!settings.autoSave || !isTaskLead || !isTaskDirty || savingTask || loading || !task?.id || !autoSaveReadyRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void handleSaveTask();
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [
    settings.autoSave,
    isTaskLead,
    isTaskDirty,
    savingTask,
    loading,
    task?.id,
    taskDraft.title,
    taskDraft.description,
    taskDraft.status,
    taskDraft.priority,
    taskDraft.start_date,
    taskDraft.due_date,
    taskDraft.is_due_asap,
    taskDraft.job_id,
    taskDraft.completion_percentage,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center">
          <span className="loading-dots">Loading task workspace</span>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="py-10 text-center">
          <h2 className="text-xl font-semibold">Task not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tasks
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{timeline.length} updates</Badge>
          {isTaskLead ? (
            <>
              <Button variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Task Settings
              </Button>
              {!settings.autoSave ? (
                <Button onClick={handleSaveTask} disabled={savingTask}>
                  {savingTask ? 'Saving...' : 'Save Task'}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl">{taskDraft.title || 'Untitled Task'}</CardTitle>
                  {taskDraft.description ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {taskDraft.description}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">No description provided.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={taskDraft.priority === 'urgent' ? 'destructive' : taskDraft.priority === 'high' ? 'secondary' : 'outline'}>
                    {taskDraft.priority.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {taskDraft.status.replace('_', ' ')}
                  </Badge>
                  {task.jobs?.name ? <Badge variant="outline">{task.jobs.name}</Badge> : null}
                  <Badge variant="outline">
                    Start {taskDraft.start_date ? format(new Date(taskDraft.start_date), 'MMM d, yyyy') : 'Not set'}
                  </Badge>
                  <Badge variant="outline">{taskDraft.completion_percentage}% complete</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-medium uppercase tracking-wide">Due</span>
                  <span className="text-foreground">{dueDateLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium uppercase tracking-wide">Lead</span>
                  <span className="text-foreground">
                    {companyUsers.find((entry) => entry.user_id === task.leader_user_id)?.name || 'Assign from Task Team'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex shrink-0 items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Progress</span>
                </div>
                <div className="min-w-0 flex-1">
                  <Slider
                    value={[taskDraft.completion_percentage]}
                    min={0}
                    max={100}
                    step={1}
                    disabled={!isTaskLead}
                    onValueChange={(value) =>
                      setTaskDraft((prev) => ({ ...prev, completion_percentage: value[0] ?? 0 }))
                    }
                  />
                </div>
                <span className="shrink-0 text-sm font-semibold">{taskDraft.completion_percentage}%</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Created {format(new Date(task.created_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="timeline" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="timeline">Task Timeline</TabsTrigger>
              <TabsTrigger value="attachments">Attachments</TabsTrigger>
              <TabsTrigger value="checklist">Task Checklist</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <Card className="min-h-[760px]">
                <CardContent className="space-y-4">
                  <div className="flex justify-end">
                    <Badge variant="outline">{timeline.length} entries</Badge>
                  </div>
                  <div className="space-y-2">
                    <MentionTextarea
                      value={newComment}
                      onValueChange={setNewComment}
                      companyId={currentCompany?.id}
                      currentUserId={user?.id}
                      placeholder="Enter a comment. Use @ to tag teammates or #tags for search..."
                      rows={1}
                      className="min-h-0 h-11 resize-none overflow-hidden"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleSendComment();
                        }
                      }}
                    />
                    <div className="flex justify-end">
                      <Button onClick={handleSendComment} disabled={sendingComment || !newComment.trim()}>
                        <Send className="mr-2 h-4 w-4" />
                        Comment
                      </Button>
                    </div>
                  </div>

                  {timeline.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                      No updates yet. Start the conversation or upload an attachment to create the first timeline entry.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {timeline.map((entry) => (
                        <div key={entry.id} className="flex gap-3 rounded-xl border p-5">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={entry.actorAvatar || undefined} alt={entry.actorName} />
                            <AvatarFallback>{entry.actorName.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{entry.actorName}</span>
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {entry.kind}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{entry.body}</p>
                            {entry.kind === 'comment' && entry.tags && entry.tags.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {entry.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-[11px]">
                                    #{tag}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                            {entry.kind === 'attachment' ? (
                              <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                                <a
                                  href={entry.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                                >
                                  <Paperclip className="h-4 w-4" />
                                  {entry.fileName}
                                </a>
                              </div>
                            ) : null}
                            {entry.kind === 'email' ? (
                              <button
                                type="button"
                                onClick={() => setActiveEmailPreview(emailMessages.find((email) => `email-${email.id}` === entry.id) || null)}
                                className="mt-3 rounded-lg border bg-muted/30 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-muted/50"
                              >
                                Open email
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attachments">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5" />
                    Attachments
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <DragDropUpload
                    onFileSelect={(file) => void handleFileUpload(file)}
                    size="compact"
                    maxSize={20}
                    title="Drag files here"
                    subtitle="or click to choose files"
                    disabled={uploadingFile}
                  />

                  {attachments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No attachments yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{attachment.file_name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatFileSize(attachment.file_size)} • Uploaded by {attachment.user_name || 'Unknown User'}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button type="button" size="sm" variant="ghost" asChild>
                                <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => void handleDeleteAttachment(attachment)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="checklist">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                      <CheckSquare className="h-5 w-5" />
                      Task Checklist
                    </CardTitle>
                    <Badge variant="outline">
                      {completedChecklistCount}/{checklistItems.length} done
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),180px,180px,auto]">
                    <Input
                      value={newChecklistTitle}
                      onChange={(event) => setNewChecklistTitle(event.target.value)}
                      placeholder="Add a checklist item"
                    />
                    <Input
                      type="date"
                      value={newChecklistDueDate}
                      onChange={(event) => setNewChecklistDueDate(event.target.value)}
                    />
                    <Select
                      value={newChecklistAssignedUser || NO_ASSIGNEE_VALUE}
                      onValueChange={(value) => setNewChecklistAssignedUser(value === NO_ASSIGNEE_VALUE ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Assign to" />
                      </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ASSIGNEE_VALUE}>No Assignee</SelectItem>
                      {checklistAssignableUsers.map((entry) => (
                        <SelectItem key={entry.user_id} value={entry.user_id}>
                          {entry.name}
                        </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" onClick={handleAddChecklistItem}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  </div>

                  {checklistItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No checklist items yet. Add steps so the team can track what still needs to get done.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {checklistItems.map((item) => (
                        <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                          <input
                            type="checkbox"
                            checked={item.is_completed}
                            onChange={(event) => void handleToggleChecklistItem(item, event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`font-medium ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                              {item.title}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>{item.due_date ? `Due ${format(new Date(item.due_date), 'MMM d, yyyy')}` : 'No due date'}</span>
                              <span>{item.assigned_user_name ? `Assigned to ${item.assigned_user_name}` : 'Unassigned'}</span>
                            </div>
                          </div>
                          {item.assigned_user_name ? (
                            <div className="flex items-center gap-2 rounded-full border px-2 py-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={item.assigned_user_avatar || undefined} alt={item.assigned_user_name} />
                                <AvatarFallback>{item.assigned_user_name.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium">{item.assigned_user_name}</span>
                            </div>
                          ) : null}
                          <Button type="button" size="sm" variant="ghost" onClick={() => void handleDeleteChecklistItem(item)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Task Team
                </CardTitle>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setTeamModalOpen(true)}
                  title="Add team member"
                  disabled={availableAssignees.length === 0}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Team Members</Label>
                </div>
                {assignees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No one is assigned yet.</p>
                ) : (
                  <div className="space-y-2">
                    {assignees.map((assignee) => (
                      <div key={assignee.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={assignee.avatar_url || undefined} alt={assignee.user_name} />
                            <AvatarFallback>{assignee.user_name.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{assignee.user_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.leader_user_id === assignee.user_id ? 'Task lead' : 'Task member'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {task.leader_user_id === assignee.user_id ? (
                            <Badge variant="outline">Lead</Badge>
                          ) : null}
                          {isTaskLead ? (
                            <Button type="button" size="sm" variant="ghost" onClick={() => void handleRemoveAssignee(assignee)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>At a Glance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(task.created_at), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Project</span>
                <span className="text-right">{jobs.find((job) => job.id === taskDraft.job_id)?.name || task.jobs?.name || 'No project'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Due Date</span>
                <span>{dueDateLabel}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">People</span>
                <span>{assignees.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Attachments</span>
                <span>{attachments.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Checklist</span>
                <span>{completedChecklistCount}/{checklistItems.length}</span>
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                <div className="text-muted-foreground">Tracking Email</div>
                {trackingEmail ? (
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 break-all text-xs text-foreground">{trackingEmail}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => navigator.clipboard?.writeText(trackingEmail)}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Unavailable</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Task Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border p-4">
              <div className="mb-3 text-sm font-medium">Task Details</div>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="task-settings-title">Task Title</Label>
                  <Input
                    id="task-settings-title"
                    value={taskDraft.title}
                    onChange={(event) => setTaskDraft((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Task title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-settings-description">Description</Label>
                  <Textarea
                    id="task-settings-description"
                    value={taskDraft.description}
                    onChange={(event) => setTaskDraft((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Describe the task, expectations, and anything the team should know."
                    rows={5}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={taskDraft.status} onValueChange={(value) => setTaskDraft((prev) => ({ ...prev, status: value }))}>
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

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={taskDraft.priority} onValueChange={(value) => setTaskDraft((prev) => ({ ...prev, priority: value }))}>
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

                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select
                    value={taskDraft.job_id || NO_JOB_VALUE}
                    onValueChange={(value) => setTaskDraft((prev) => ({ ...prev, job_id: value === NO_JOB_VALUE ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_JOB_VALUE}>No Project</SelectItem>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-settings-start-date">Start Date</Label>
                  <Input
                    id="task-settings-start-date"
                    type="date"
                    value={taskDraft.start_date}
                    onChange={(event) => setTaskDraft((prev) => ({ ...prev, start_date: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-settings-due-date">Due Date</Label>
                  <Input
                    id="task-settings-due-date"
                    type="date"
                    value={taskDraft.due_date}
                    onChange={(event) => setTaskDraft((prev) => ({ ...prev, due_date: event.target.value }))}
                    disabled={taskDraft.is_due_asap}
                  />
                </div>

                <div className="space-y-2 md:col-span-2 xl:col-span-1">
                  <Label>Due Date Mode</Label>
                  <div className="flex h-10 items-center gap-3 rounded-md border px-3">
                    <Checkbox
                      id="task-settings-due-asap"
                      checked={taskDraft.is_due_asap}
                      onCheckedChange={(checked) =>
                        setTaskDraft((prev) => ({
                          ...prev,
                          is_due_asap: Boolean(checked),
                          due_date: checked ? '' : prev.due_date,
                        }))
                      }
                    />
                    <Label htmlFor="task-settings-due-asap" className="cursor-pointer text-sm font-normal">
                      Mark this task as ASAP
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Mail className="h-4 w-4" />
                Task Tracking Email
              </div>
              {trackingEmail ? (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="break-all text-muted-foreground">{trackingEmail}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => navigator.clipboard?.writeText(trackingEmail)}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Include this address on task emails to funnel replies and inbound messages back into this task.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-muted-foreground">Tracking email unavailable.</p>
              )}
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Tracked Email Log</span>
                <Badge variant="outline">{emailMessages.length}</Badge>
              </div>
              {loadingEmails ? (
                <p className="text-sm text-muted-foreground"><span className="loading-dots">Loading</span></p>
              ) : emailMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tracked emails yet.</p>
              ) : (
                <div className="space-y-2">
                  {emailMessages.map((email) => (
                    <button
                      key={email.id}
                      type="button"
                      onClick={() => setActiveEmailPreview(email)}
                      className="w-full rounded-md border p-3 text-left hover:bg-muted/30"
                    >
                      <div className="text-xs text-muted-foreground">
                        {email.direction === 'inbound' ? 'Inbound' : 'Outbound'} • {format(new Date(email.created_at), 'MMM d, yyyy h:mm a')}
                      </div>
                      <div className="mt-1 text-sm font-medium">{email.subject || '(No subject)'}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        From: {email.from_email || '-'} | To: {(email.to_emails || []).join(', ') || '-'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={teamModalOpen} onOpenChange={setTeamModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add To Task Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Add Team Member</Label>
              <Select value={selectedAssignee || NO_ASSIGNEE_VALUE} onValueChange={(value) => setSelectedAssignee(value === NO_ASSIGNEE_VALUE ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a teammate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ASSIGNEE_VALUE}>Select a teammate</SelectItem>
                  {availableAssignees.map((entry) => (
                    <SelectItem key={entry.user_id} value={entry.user_id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={pendingLeaderSelection}
                onCheckedChange={(checked) => setPendingLeaderSelection(Boolean(checked))}
              />
              <div>
                <div className="font-medium">Make task lead</div>
                <div className="text-xs text-muted-foreground">
                  If a lead already exists, this selection will replace the current task lead.
                </div>
              </div>
            </label>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTeamModalOpen(false);
                  setSelectedAssignee('');
                  setPendingLeaderSelection(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleAddAssignee({ userId: selectedAssignee, makeLead: pendingLeaderSelection })}
                disabled={!selectedAssignee}
              >
                Add To Team
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeEmailPreview} onOpenChange={(open) => !open && setActiveEmailPreview(null)}>
        <DialogContent className="max-w-4xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>{activeEmailPreview?.subject || '(No subject)'}</DialogTitle>
          </DialogHeader>
          {activeEmailPreview ? (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                <div>Direction: {activeEmailPreview.direction === 'inbound' ? 'Inbound' : 'Outbound'}</div>
                <div>From: {activeEmailPreview.from_email || '-'}</div>
                <div>To: {(activeEmailPreview.to_emails || []).join(', ') || '-'}</div>
                <div>Sent: {format(new Date(activeEmailPreview.created_at), 'MMM d, yyyy h:mm a')}</div>
              </div>
              {activeEmailPreview.body_html ? (
                <iframe
                  title={`task-email-preview-${activeEmailPreview.id}`}
                  sandbox=""
                  srcDoc={activeEmailPreview.body_html}
                  className="h-[65vh] w-full rounded border bg-white"
                />
              ) : activeEmailPreview.body_text ? (
                <p className="max-h-[65vh] overflow-y-auto whitespace-pre-wrap rounded border bg-background p-3 text-sm">
                  {activeEmailPreview.body_text}
                </p>
              ) : (
                <p className="rounded border bg-background p-3 text-sm text-muted-foreground">
                  No body available for this message.
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
