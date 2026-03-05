CREATE TABLE IF NOT EXISTS public.company_file_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system_folder BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_files
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.company_file_folders(id) ON DELETE SET NULL;

ALTER TABLE public.company_files
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.company_file_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company file folders in their company" ON public.company_file_folders;
CREATE POLICY "Users can view company file folders in their company"
ON public.company_file_folders FOR SELECT
TO authenticated
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can create company file folders in their company" ON public.company_file_folders;
CREATE POLICY "Users can create company file folders in their company"
ON public.company_file_folders FOR INSERT
TO authenticated
WITH CHECK (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can update company file folders in their company" ON public.company_file_folders;
CREATE POLICY "Users can update company file folders in their company"
ON public.company_file_folders FOR UPDATE
TO authenticated
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can delete company file folders in their company" ON public.company_file_folders;
CREATE POLICY "Users can delete company file folders in their company"
ON public.company_file_folders FOR DELETE
TO authenticated
USING (company_id IN (
  SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
));

CREATE INDEX IF NOT EXISTS idx_company_file_folders_company_sort
  ON public.company_file_folders (company_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_company_files_folder_id
  ON public.company_files (folder_id);

CREATE INDEX IF NOT EXISTS idx_company_files_company_sort
  ON public.company_files (company_id, sort_order);

DROP TRIGGER IF EXISTS update_company_file_folders_updated_at ON public.company_file_folders;
CREATE TRIGGER update_company_file_folders_updated_at
BEFORE UPDATE ON public.company_file_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
