-- Drop and recreate the invoice audit entry trigger with enhanced tracking
CREATE OR REPLACE FUNCTION public.create_invoice_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Handle INSERT (new invoice)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.invoice_audit_trail (
      invoice_id,
      changed_by,
      change_type,
      reason
    ) VALUES (
      NEW.id,
      NEW.created_by,
      'create',
      'Invoice created'
    );
    RETURN NEW;
  END IF;
  
  -- Handle UPDATE (invoice changes)
  IF TG_OP = 'UPDATE' THEN
    -- Status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.invoice_audit_trail (
        invoice_id,
        changed_by,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        auth.uid(),
        CASE NEW.status 
          WHEN 'pending_payment' THEN 'approve'
          WHEN 'paid' THEN 'payment'
          WHEN 'rejected' THEN 'reject'
          ELSE 'update'
        END,
        'status',
        OLD.status,
        NEW.status
      );
    END IF;
    
    -- Amount changes
    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
      INSERT INTO public.invoice_audit_trail (
        invoice_id,
        changed_by,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        auth.uid(),
        'update',
        'amount',
        OLD.amount::text,
        NEW.amount::text
      );
    END IF;
    
    -- Due date changes
    IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
      INSERT INTO public.invoice_audit_trail (
        invoice_id,
        changed_by,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        auth.uid(),
        'update',
        'due_date',
        OLD.due_date::text,
        NEW.due_date::text
      );
    END IF;
    
    -- Issue date changes
    IF OLD.issue_date IS DISTINCT FROM NEW.issue_date THEN
      INSERT INTO public.invoice_audit_trail (
        invoice_id,
        changed_by,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        auth.uid(),
        'update',
        'issue_date',
        OLD.issue_date::text,
        NEW.issue_date::text
      );
    END IF;
    
    -- Invoice number changes
    IF OLD.invoice_number IS DISTINCT FROM NEW.invoice_number THEN
      INSERT INTO public.invoice_audit_trail (
        invoice_id,
        changed_by,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        auth.uid(),
        'update',
        'invoice_number',
        OLD.invoice_number,
        NEW.invoice_number
      );
    END IF;
    
    -- Vendor changes
    IF OLD.vendor_id IS DISTINCT FROM NEW.vendor_id THEN
      INSERT INTO public.invoice_audit_trail (
        invoice_id,
        changed_by,
        change_type,
        field_name,
        old_value,
        new_value,
        reason
      ) VALUES (
        NEW.id,
        auth.uid(),
        'update',
        'vendor_id',
        OLD.vendor_id::text,
        NEW.vendor_id::text,
        'Vendor changed'
      );
    END IF;
    
    -- Job changes
    IF OLD.job_id IS DISTINCT FROM NEW.job_id THEN
      INSERT INTO public.invoice_audit_trail (
        invoice_id,
        changed_by,
        change_type,
        field_name,
        old_value,
        new_value,
        reason
      ) VALUES (
        NEW.id,
        auth.uid(),
        'update',
        'job_id',
        OLD.job_id::text,
        NEW.job_id::text,
        'Job changed'
      );
    END IF;
    
    -- Cost code changes
    IF OLD.cost_code_id IS DISTINCT FROM NEW.cost_code_id THEN
      INSERT INTO public.invoice_audit_trail (
        invoice_id,
        changed_by,
        change_type,
        field_name,
        old_value,
        new_value,
        reason
      ) VALUES (
        NEW.id,
        auth.uid(),
        'update',
        'cost_code_id',
        OLD.cost_code_id::text,
        NEW.cost_code_id::text,
        'Cost code changed'
      );
    END IF;
    
    -- Payment terms changes
    IF OLD.payment_terms IS DISTINCT FROM NEW.payment_terms THEN
      INSERT INTO public.invoice_audit_trail (
        invoice_id,
        changed_by,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        auth.uid(),
        'update',
        'payment_terms',
        OLD.payment_terms,
        NEW.payment_terms
      );
    END IF;
    
    -- Description changes
    IF OLD.description IS DISTINCT FROM NEW.description THEN
      INSERT INTO public.invoice_audit_trail (
        invoice_id,
        changed_by,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        auth.uid(),
        'update',
        'description',
        OLD.description,
        NEW.description
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Create function to track invoice document changes
CREATE OR REPLACE FUNCTION public.create_invoice_document_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
    INSERT INTO public.invoice_audit_trail (
      invoice_id,
      changed_by,
      change_type,
      field_name,
      old_value,
      reason
    ) VALUES (
      OLD.invoice_id,
      auth.uid(),
      'delete',
      'document',
      OLD.file_name,
      'Document deleted: ' || OLD.file_name
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Create trigger for invoice document changes
DROP TRIGGER IF EXISTS invoice_document_audit_trigger ON public.invoice_documents;
CREATE TRIGGER invoice_document_audit_trigger
  AFTER INSERT OR DELETE ON public.invoice_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.create_invoice_document_audit_entry();