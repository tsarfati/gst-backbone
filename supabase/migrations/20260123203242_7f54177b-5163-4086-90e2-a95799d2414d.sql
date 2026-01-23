-- Update vendor audit trigger to handle null auth.uid() for seed data
CREATE OR REPLACE FUNCTION create_vendor_audit_entry()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.company_audit_log (
    company_id, table_name, record_id, action, changed_by, reason
  ) VALUES (
    NEW.company_id, 'vendors', NEW.id, 'create', 
    COALESCE(auth.uid(), '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7'::uuid), 
    'Vendor created: ' || NEW.name
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;