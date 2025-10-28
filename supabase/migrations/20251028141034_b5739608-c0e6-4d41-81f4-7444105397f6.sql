-- Fix FK error when deleting invoices: avoid inserting audit rows referencing a deleted invoice
-- Update audit function to set invoice_id NULL on document delete events
CREATE OR REPLACE FUNCTION public.create_invoice_document_audit_entry()
RETURNS trigger AS $$
BEGIN
  -- Handle INSERT (file upload)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.invoice_audit_trail (
      invoice_id,
      changed_by,
      change_type,
      field_name,
      new_value,
      reason
    ) VALUES (
      NEW.invoice_id,
      NEW.uploaded_by,
      'upload',
      'document',
      NEW.file_name,
      'Document uploaded: ' || NEW.file_name
    );
    RETURN NEW;
  END IF;
  
  -- Handle DELETE (file removal)
  IF TG_OP = 'DELETE' THEN
    -- Parent invoice may already be deleted via cascade; set invoice_id to NULL to avoid FK violations
    INSERT INTO public.invoice_audit_trail (
      invoice_id,
      changed_by,
      change_type,
      field_name,
      old_value,
      reason
    ) VALUES (
      NULL,
      auth.uid(),
      'delete',
      'document',
      OLD.file_name,
      'Document deleted: ' || OLD.file_name || ' (from invoice ' || OLD.invoice_id::text || ')'
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';