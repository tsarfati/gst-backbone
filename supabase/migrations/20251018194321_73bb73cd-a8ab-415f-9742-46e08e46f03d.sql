-- Fix receipt audit trigger to use correct field name
CREATE OR REPLACE FUNCTION public.create_receipt_audit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      NEW.company_id, 'receipts', NEW.id, 'upload', NEW.created_by, 'Receipt uploaded: ' || NEW.file_name
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by, reason
      ) VALUES (
        NEW.company_id, 'receipts', NEW.id, 'update', 'status', OLD.status, NEW.status, auth.uid(),
        CASE WHEN NEW.status = 'coded' THEN 'Receipt coded' ELSE 'Receipt status changed' END
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      OLD.company_id, 'receipts', OLD.id, 'delete', auth.uid(), 'Receipt deleted'
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;