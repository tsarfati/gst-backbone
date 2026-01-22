-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'on_hold')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  start_date DATE,
  due_date DATE,
  completion_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task assignees table
CREATE TABLE public.task_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID NOT NULL,
  UNIQUE(task_id, user_id)
);

-- Create task comments/chat table
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task attachments table
CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for tasks
CREATE POLICY "Users can view tasks in their company" ON public.tasks
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create tasks in their company" ON public.tasks
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update tasks in their company" ON public.tasks
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete tasks in their company" ON public.tasks
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid())
  );

-- RLS policies for task assignees
CREATE POLICY "Users can view task assignees" ON public.task_assignees
  FOR SELECT USING (
    task_id IN (SELECT id FROM public.tasks WHERE company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()))
  );

CREATE POLICY "Users can manage task assignees" ON public.task_assignees
  FOR ALL USING (
    task_id IN (SELECT id FROM public.tasks WHERE company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()))
  );

-- RLS policies for task comments
CREATE POLICY "Users can view task comments" ON public.task_comments
  FOR SELECT USING (
    task_id IN (SELECT id FROM public.tasks WHERE company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()))
  );

CREATE POLICY "Users can create task comments" ON public.task_comments
  FOR INSERT WITH CHECK (
    task_id IN (SELECT id FROM public.tasks WHERE company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()))
  );

CREATE POLICY "Users can update their own comments" ON public.task_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" ON public.task_comments
  FOR DELETE USING (user_id = auth.uid());

-- RLS policies for task attachments
CREATE POLICY "Users can view task attachments" ON public.task_attachments
  FOR SELECT USING (
    task_id IN (SELECT id FROM public.tasks WHERE company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()))
  );

CREATE POLICY "Users can manage task attachments" ON public.task_attachments
  FOR ALL USING (
    task_id IN (SELECT id FROM public.tasks WHERE company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()))
  );

-- Create indexes for performance
CREATE INDEX idx_tasks_company_id ON public.tasks(company_id);
CREATE INDEX idx_tasks_job_id ON public.tasks(job_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_task_assignees_task_id ON public.task_assignees(task_id);
CREATE INDEX idx_task_assignees_user_id ON public.task_assignees(user_id);
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);

-- Create updated_at trigger for tasks
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for task_comments
CREATE TRIGGER update_task_comments_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for task attachments
CREATE POLICY "Users can view task attachment files" ON storage.objects
  FOR SELECT USING (bucket_id = 'task-attachments');

CREATE POLICY "Users can upload task attachment files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete task attachment files" ON storage.objects
  FOR DELETE USING (bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL);