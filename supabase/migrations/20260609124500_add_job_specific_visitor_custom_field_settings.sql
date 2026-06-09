ALTER TABLE public.job_visitor_settings
ADD COLUMN IF NOT EXISTS notes_field_placeholder text,
ADD COLUMN IF NOT EXISTS notes_field_required boolean NOT NULL DEFAULT false;

UPDATE public.job_visitor_settings
SET
  notes_field_label = COALESCE(NULLIF(notes_field_label, ''), 'Additional Notes'),
  notes_field_placeholder = COALESCE(NULLIF(notes_field_placeholder, ''), 'Any additional information...'),
  notes_field_required = COALESCE(notes_field_required, false)
WHERE notes_field_label IS NULL
   OR notes_field_label = ''
   OR notes_field_placeholder IS NULL
   OR notes_field_placeholder = '';
