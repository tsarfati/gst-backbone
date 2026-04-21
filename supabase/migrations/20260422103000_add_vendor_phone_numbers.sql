ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS phone_numbers jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.vendors.phone_numbers IS
  'Structured vendor phone numbers with label and number entries.';

UPDATE public.vendors
SET phone_numbers = jsonb_build_array(
  jsonb_build_object(
    'type', 'office',
    'number', phone
  )
)
WHERE COALESCE(phone, '') <> ''
  AND (
    phone_numbers IS NULL
    OR phone_numbers = '[]'::jsonb
  );
