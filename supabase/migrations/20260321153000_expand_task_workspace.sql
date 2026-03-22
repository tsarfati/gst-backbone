ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS leader_user_id uuid NULL;

CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date NULL,
  assigned_user_id uuid NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  completed_by uuid NULL
);

CREATE TABLE IF NOT EXISTS public.task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_user_id uuid NULL,
  activity_type text NOT NULL CHECK (
    activity_type IN (
      'comment_added',
      'attachment_added',
      'attachment_deleted',
      'assignee_added',
      'assignee_removed',
      'checklist_item_added',
      'checklist_item_completed',
      'checklist_item_reopened',
      'checklist_item_deleted',
      'lead_assigned',
      'lead_cleared',
      'task_updated'
    )
  ),
  content text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view task checklist items" ON public.task_checklist_items;
CREATE POLICY "Users can view task checklist items" ON public.task_checklist_items
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE company_id IN (
        SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage task checklist items" ON public.task_checklist_items;
CREATE POLICY "Users can manage task checklist items" ON public.task_checklist_items
  FOR ALL USING (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE company_id IN (
        SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE company_id IN (
        SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can view task activity" ON public.task_activity;
CREATE POLICY "Users can view task activity" ON public.task_activity
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE company_id IN (
        SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can create task activity" ON public.task_activity;
CREATE POLICY "Users can create task activity" ON public.task_activity
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT id FROM public.tasks
      WHERE company_id IN (
        SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task_id ON public.task_checklist_items(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON public.task_activity(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_leader_user_id ON public.tasks(leader_user_id);

DROP TRIGGER IF EXISTS update_task_checklist_items_updated_at ON public.task_checklist_items;
CREATE TRIGGER update_task_checklist_items_updated_at
  BEFORE UPDATE ON public.task_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
