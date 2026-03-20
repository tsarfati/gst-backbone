CREATE TABLE IF NOT EXISTS public.non_direct_message_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  message_source TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, message_source, source_record_id)
);

ALTER TABLE public.non_direct_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their non-direct message reads"
ON public.non_direct_message_reads
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
);

CREATE POLICY "Users can insert their non-direct message reads"
ON public.non_direct_message_reads
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
);

CREATE POLICY "Users can update their non-direct message reads"
ON public.non_direct_message_reads
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
);

CREATE INDEX IF NOT EXISTS idx_non_direct_message_reads_user_company
  ON public.non_direct_message_reads (user_id, company_id, created_at DESC);
