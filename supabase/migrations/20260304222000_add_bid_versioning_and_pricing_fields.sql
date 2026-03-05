-- Add bid versioning + pricing metadata fields and allow multiple versions per vendor per RFP.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS version_number integer,
  ADD COLUMN IF NOT EXISTS bid_version_group_id uuid,
  ADD COLUMN IF NOT EXISTS bid_contact_name text,
  ADD COLUMN IF NOT EXISTS bid_contact_email text,
  ADD COLUMN IF NOT EXISTS bid_contact_phone text,
  ADD COLUMN IF NOT EXISTS shipping_included boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_amount numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxes_included boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(15,2) NOT NULL DEFAULT 0;

UPDATE public.bids
SET
  version_number = COALESCE(version_number, 1),
  bid_version_group_id = COALESCE(bid_version_group_id, id)
WHERE version_number IS NULL OR bid_version_group_id IS NULL;

ALTER TABLE public.bids
  ALTER COLUMN version_number SET DEFAULT 1,
  ALTER COLUMN version_number SET NOT NULL,
  ALTER COLUMN bid_version_group_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN bid_version_group_id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bids_rfp_id_vendor_id_key'
      AND conrelid = 'public.bids'::regclass
  ) THEN
    ALTER TABLE public.bids DROP CONSTRAINT bids_rfp_id_vendor_id_key;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bids_rfp_id_vendor_id_version_number_key'
      AND conrelid = 'public.bids'::regclass
  ) THEN
    ALTER TABLE public.bids
      ADD CONSTRAINT bids_rfp_id_vendor_id_version_number_key UNIQUE (rfp_id, vendor_id, version_number);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_bids_rfp_vendor_version_desc
  ON public.bids (rfp_id, vendor_id, version_number DESC);

