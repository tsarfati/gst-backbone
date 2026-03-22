import { supabase } from '@/integrations/supabase/client';

type CreateTaskNotificationsParams = {
  taskId: string;
  companyId: string;
  actorUserId?: string | null;
  title: string;
  message: string;
  additionalRecipientUserIds?: string[];
};

const uniq = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

export async function createTaskNotifications(params: CreateTaskNotificationsParams): Promise<number> {
  const { taskId, companyId, actorUserId, title, message, additionalRecipientUserIds = [] } = params;

  const { data: taskRow, error: taskError } = await supabase
    .from('tasks')
    .select('leader_user_id')
    .eq('id', taskId)
    .maybeSingle();
  if (taskError) throw taskError;

  const { data: assigneeRows, error: assigneeError } = await supabase
    .from('task_assignees')
    .select('user_id')
    .eq('task_id', taskId);
  if (assigneeError) throw assigneeError;

  const recipientUserIds = uniq([
    (taskRow as any)?.leader_user_id,
    ...((assigneeRows || []) as any[]).map((row) => row.user_id),
    ...additionalRecipientUserIds,
  ]).filter((userId) => userId !== actorUserId);

  if (recipientUserIds.length === 0) return 0;

  const { data: settingsRows, error: settingsError } = await supabase
    .from('notification_settings')
    .select('user_id, in_app_enabled')
    .eq('company_id', companyId)
    .in('user_id', recipientUserIds);
  if (settingsError) throw settingsError;

  const settingsMap = new Map(
    ((settingsRows || []) as any[]).map((row) => [String(row.user_id), row]),
  );

  const allowedRecipients = recipientUserIds.filter((userId) => {
    const row = settingsMap.get(userId);
    return row?.in_app_enabled !== false;
  });

  if (allowedRecipients.length === 0) return 0;

  const notificationRows = allowedRecipients.map((userId) => ({
    user_id: userId,
    title,
    message,
    type: `/tasks/${taskId}`,
    read: false,
  }));

  const { error: insertError } = await supabase.from('notifications').insert(notificationRows as any);
  if (insertError) throw insertError;

  return notificationRows.length;
}
