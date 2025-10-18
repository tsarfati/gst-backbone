-- Create a comprehensive audit log table for all company actions
CREATE TABLE IF NOT EXISTS public.company_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow users to view audit logs for their companies
CREATE POLICY "Users can view audit logs for their companies"
ON public.company_audit_log
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM get_user_companies(auth.uid())
));

-- Allow system to insert audit entries
CREATE POLICY "System can insert audit entries"
ON public.company_audit_log
FOR INSERT
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_company_audit_log_company_id ON public.company_audit_log(company_id);
CREATE INDEX idx_company_audit_log_table_name ON public.company_audit_log(table_name);
CREATE INDEX idx_company_audit_log_created_at ON public.company_audit_log(created_at DESC);
CREATE INDEX idx_company_audit_log_changed_by ON public.company_audit_log(changed_by);

-- Function to create audit entries for jobs
CREATE OR REPLACE FUNCTION public.create_job_audit_entry()
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
      NEW.company_id, 'jobs', NEW.id, 'create', NEW.created_by, 'Job created: ' || NEW.name
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name IS DISTINCT FROM NEW.name THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by
      ) VALUES (
        NEW.company_id, 'jobs', NEW.id, 'update', 'name', OLD.name, NEW.name, auth.uid()
      );
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by
      ) VALUES (
        NEW.company_id, 'jobs', NEW.id, 'update', 'status', OLD.status, NEW.status, auth.uid()
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      OLD.company_id, 'jobs', OLD.id, 'delete', auth.uid(), 'Job deleted: ' || OLD.name
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to create audit entries for vendors
CREATE OR REPLACE FUNCTION public.create_vendor_audit_entry()
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
      NEW.company_id, 'vendors', NEW.id, 'create', NEW.created_by, 'Vendor created: ' || NEW.name
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name IS DISTINCT FROM NEW.name THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by
      ) VALUES (
        NEW.company_id, 'vendors', NEW.id, 'update', 'name', OLD.name, NEW.name, auth.uid()
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      OLD.company_id, 'vendors', OLD.id, 'delete', auth.uid(), 'Vendor deleted: ' || OLD.name
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to create audit entries for receipts
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
      NEW.company_id, 'receipts', NEW.id, 'upload', NEW.created_by, 'Receipt uploaded: ' || NEW.filename
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

-- Function to create audit entries for user role changes
CREATE OR REPLACE FUNCTION public.create_user_role_audit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      INSERT INTO public.company_audit_log (
        company_id, table_name, record_id, action, field_name, old_value, new_value, changed_by, reason
      ) VALUES (
        NEW.current_company_id, 'profiles', NEW.user_id, 'update', 'role', OLD.role::text, NEW.role::text, auth.uid(), 'User role changed'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers for audit logging
CREATE TRIGGER job_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.create_job_audit_entry();

CREATE TRIGGER vendor_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.create_vendor_audit_entry();

CREATE TRIGGER receipt_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_receipt_audit_entry();

CREATE TRIGGER user_role_audit_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_role_audit_entry();