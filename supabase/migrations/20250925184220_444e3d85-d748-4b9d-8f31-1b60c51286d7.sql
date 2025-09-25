-- Create audit trail table for invoices/bills
CREATE TABLE public.invoice_audit_trail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  change_type TEXT NOT NULL, -- 'create', 'update', 'approve', 'reject', 'payment'
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_audit_trail ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view audit trail for company invoices" 
ON public.invoice_audit_trail 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    JOIN public.vendors v ON v.id = i.vendor_id
    JOIN get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE i.id = invoice_audit_trail.invoice_id
  )
);

CREATE POLICY "System can insert audit entries" 
ON public.invoice_audit_trail 
FOR INSERT 
WITH CHECK (true);

-- Create trigger function for invoice audit
CREATE OR REPLACE FUNCTION public.create_invoice_audit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS invoice_audit_trigger ON public.invoices;
CREATE TRIGGER invoice_audit_trigger
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.create_invoice_audit_entry();