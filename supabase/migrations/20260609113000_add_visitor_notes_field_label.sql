ALTER TABLE public.job_visitor_settings
ADD COLUMN IF NOT EXISTS notes_field_label text;

UPDATE public.job_visitor_settings
SET notes_field_label = COALESCE(NULLIF(notes_field_label, ''), 'Additional Notes')
WHERE notes_field_label IS NULL OR notes_field_label = '';
