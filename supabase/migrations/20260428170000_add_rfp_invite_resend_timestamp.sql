ALTER TABLE public.rfp_invited_vendors
  ADD COLUMN IF NOT EXISTS last_resent_at timestamptz;
