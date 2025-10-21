-- Add company_id column to journal_entries table
ALTER TABLE public.journal_entries
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_id 
ON public.journal_entries(company_id);

-- Update existing journal entries to set company_id based on created_by user's current company
UPDATE public.journal_entries je
SET company_id = p.current_company_id
FROM public.profiles p
WHERE je.created_by = p.user_id AND je.company_id IS NULL;

-- Make company_id required for new entries
ALTER TABLE public.journal_entries
ALTER COLUMN company_id SET NOT NULL;

-- Update RLS policies for journal_entries to use company_id
DROP POLICY IF EXISTS "Users can view journal entries for their companies" ON public.journal_entries;
DROP POLICY IF EXISTS "Admins and controllers can manage journal entries" ON public.journal_entries;

CREATE POLICY "Users can view journal entries for their companies"
ON public.journal_entries
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM get_user_companies(auth.uid())
));

CREATE POLICY "Admins and controllers can manage journal entries"
ON public.journal_entries
FOR ALL
USING (company_id IN (
  SELECT uc.company_id 
  FROM get_user_companies(auth.uid()) uc
  WHERE uc.role IN ('admin', 'controller')
))
WITH CHECK (company_id IN (
  SELECT uc.company_id 
  FROM get_user_companies(auth.uid()) uc
  WHERE uc.role IN ('admin', 'controller')
));