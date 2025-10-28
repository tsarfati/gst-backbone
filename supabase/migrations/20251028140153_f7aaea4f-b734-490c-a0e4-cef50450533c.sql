-- Fix 409 delete conflicts on invoices by adjusting audit FK and document triggers
-- 1) Make invoice_audit_trail.invoice_id nullable and change FK to ON DELETE SET NULL so audit rows persist
ALTER TABLE public.invoice_audit_trail
  ALTER COLUMN invoice_id DROP NOT NULL;

ALTER TABLE public.invoice_audit_trail 
  DROP CONSTRAINT IF EXISTS invoice_audit_trail_invoice_id_fkey;

ALTER TABLE public.invoice_audit_trail
  ADD CONSTRAINT invoice_audit_trail_invoice_id_fkey
  FOREIGN KEY (invoice_id)
  REFERENCES public.invoices(id)
  ON DELETE SET NULL;

-- 2) Recreate invoice document audit triggers to avoid referencing a just-deleted invoice
--    Use AFTER INSERT (unchanged) and BEFORE DELETE for safe audit logging during cascades
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'invoice_document_audit_trigger'
  ) THEN
    DROP TRIGGER IF EXISTS invoice_document_audit_trigger ON public.invoice_documents;
  END IF;
END$$;

-- Create separate triggers with correct timing
DROP TRIGGER IF EXISTS invoice_document_audit_trigger_ins ON public.invoice_documents;
CREATE TRIGGER invoice_document_audit_trigger_ins
  AFTER INSERT ON public.invoice_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.create_invoice_document_audit_entry();

DROP TRIGGER IF EXISTS invoice_document_audit_trigger_del ON public.invoice_documents;
CREATE TRIGGER invoice_document_audit_trigger_del
  BEFORE DELETE ON public.invoice_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.create_invoice_document_audit_entry();