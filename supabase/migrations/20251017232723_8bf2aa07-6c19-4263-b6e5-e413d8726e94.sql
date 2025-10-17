-- Update internal_notes to be a JSONB array for comment threads
ALTER TABLE public.invoices 
  ALTER COLUMN internal_notes TYPE jsonb USING 
    CASE 
      WHEN internal_notes IS NULL OR internal_notes = '' THEN '[]'::jsonb
      ELSE jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'user_id', created_by::text,
          'comment', internal_notes,
          'created_at', created_at::text
        )
      )
    END;