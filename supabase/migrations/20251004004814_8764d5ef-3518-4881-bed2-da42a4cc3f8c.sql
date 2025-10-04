-- Create secure Vault entries table for storing encrypted credentials/notes
CREATE TABLE IF NOT EXISTS public.vault_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Metadata (non-sensitive)
  title TEXT NOT NULL,
  username TEXT,
  url TEXT,
  -- Encrypted payload (base64-encoded strings)
  data_ciphertext TEXT NOT NULL,      -- JSON string encrypted (e.g., {password, notes, fields})
  notes_ciphertext TEXT,              -- Optional additional encrypted notes
  iv TEXT NOT NULL,                   -- AES-GCM IV (base64)
  salt TEXT NOT NULL,                 -- PBKDF2 salt (base64)
  algo TEXT NOT NULL DEFAULT 'AES-GCM-256',
  version INTEGER NOT NULL DEFAULT 1
);

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_vault_entries_company_id ON public.vault_entries(company_id);

-- Enable RLS
ALTER TABLE public.vault_entries ENABLE ROW LEVEL SECURITY;

-- Policies: only controllers and admins of the company can access/manage
DROP POLICY IF EXISTS "Admins/controllers can view vault entries" ON public.vault_entries;
CREATE POLICY "Admins/controllers can view vault entries"
ON public.vault_entries
FOR SELECT
USING (
  company_id IN (
    SELECT uc.company_id
    FROM public.get_user_companies(auth.uid()) AS uc(company_id, company_name, role)
    WHERE uc.role = ANY(ARRAY['admin'::public.user_role, 'controller'::public.user_role])
  )
);

DROP POLICY IF EXISTS "Admins/controllers can manage vault entries" ON public.vault_entries;
CREATE POLICY "Admins/controllers can manage vault entries"
ON public.vault_entries
FOR ALL
USING (
  company_id IN (
    SELECT uc.company_id
    FROM public.get_user_companies(auth.uid()) AS uc(company_id, company_name, role)
    WHERE uc.role = ANY(ARRAY['admin'::public.user_role, 'controller'::public.user_role])
  )
)
WITH CHECK (
  company_id IN (
    SELECT uc.company_id
    FROM public.get_user_companies(auth.uid()) AS uc(company_id, company_name, role)
    WHERE uc.role = ANY(ARRAY['admin'::public.user_role, 'controller'::public.user_role])
  )
);

-- Update timestamp trigger
DROP TRIGGER IF EXISTS update_vault_entries_updated_at ON public.vault_entries;
CREATE TRIGGER update_vault_entries_updated_at
BEFORE UPDATE ON public.vault_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();