DELETE FROM public.task_activity
WHERE activity_type = 'task_updated'
  AND content LIKE 'Inbound email received from %';
