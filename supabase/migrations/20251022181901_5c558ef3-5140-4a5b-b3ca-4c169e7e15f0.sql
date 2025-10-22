-- Fix the subcontract audit trigger to use correct field names
-- Drop and recreate the update audit trigger function

DROP TRIGGER IF EXISTS subcontract_update_audit ON public.subcontracts;
DROP FUNCTION IF EXISTS public.update_subcontract_audit_entry();

CREATE OR REPLACE FUNCTION public.update_subcontract_audit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert audit entry for subcontract updates
  INSERT INTO public.audit_log (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_by
  ) VALUES (
    'subcontracts',
    NEW.id::text,
    'UPDATE',
    jsonb_build_object(
      'name', OLD.name,
      'contract_amount', OLD.contract_amount,
      'status', OLD.status,
      'vendor_id', OLD.vendor_id,
      'job_id', OLD.job_id,
      'apply_retainage', OLD.apply_retainage,
      'retainage_percentage', OLD.retainage_percentage,
      'total_distributed_amount', OLD.total_distributed_amount
    ),
    jsonb_build_object(
      'name', NEW.name,
      'contract_amount', NEW.contract_amount,
      'status', NEW.status,
      'vendor_id', NEW.vendor_id,
      'job_id', NEW.job_id,
      'apply_retainage', NEW.apply_retainage,
      'retainage_percentage', NEW.retainage_percentage,
      'total_distributed_amount', NEW.total_distributed_amount
    ),
    auth.uid()
  );
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER subcontract_update_audit
  AFTER UPDATE ON public.subcontracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subcontract_audit_entry();