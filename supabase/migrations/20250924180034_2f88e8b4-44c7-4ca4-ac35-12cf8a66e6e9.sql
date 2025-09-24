-- Add thread support to messages table
ALTER TABLE public.messages 
ADD COLUMN thread_id uuid REFERENCES public.messages(id),
ADD COLUMN is_reply boolean DEFAULT false;

-- Add indexes for better performance
CREATE INDEX idx_messages_thread_id ON public.messages(thread_id);
CREATE INDEX idx_messages_thread_created ON public.messages(thread_id, created_at);

-- Update delivery tickets with enhanced fields
ALTER TABLE public.delivery_tickets
ADD COLUMN received_by uuid REFERENCES auth.users(id),
ADD COLUMN delivery_slip_photo_url text,
ADD COLUMN material_photo_url text;

-- Create delivery ticket audit trail table
CREATE TABLE public.delivery_ticket_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_ticket_id uuid NOT NULL REFERENCES public.delivery_tickets(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  change_type text NOT NULL, -- 'create', 'update', 'delete'
  field_name text,
  old_value text,
  new_value text,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.delivery_ticket_audit ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for delivery ticket audit
CREATE POLICY "All authenticated users can view delivery ticket audit"
ON public.delivery_ticket_audit
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Project managers and admins can manage delivery ticket audit"
ON public.delivery_ticket_audit
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role) OR has_role(auth.uid(), 'project_manager'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role) OR has_role(auth.uid(), 'project_manager'::user_role));

-- Create trigger function for delivery ticket audit trail
CREATE OR REPLACE FUNCTION public.create_delivery_ticket_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle INSERT (new delivery ticket)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.delivery_ticket_audit (
      delivery_ticket_id,
      changed_by,
      change_type,
      reason
    ) VALUES (
      NEW.id,
      NEW.created_by,
      'create',
      'Delivery ticket created'
    );
    RETURN NEW;
  END IF;
  
  -- Handle UPDATE (delivery ticket changes)
  IF TG_OP = 'UPDATE' THEN
    -- Check each field that might have changed
    IF OLD.vendor_name IS DISTINCT FROM NEW.vendor_name THEN
      INSERT INTO public.delivery_ticket_audit (
        delivery_ticket_id,
        changed_by,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        auth.uid(),
        'update',
        'vendor_name',
        OLD.vendor_name,
        NEW.vendor_name
      );
    END IF;
    
    IF OLD.ticket_number IS DISTINCT FROM NEW.ticket_number THEN
      INSERT INTO public.delivery_ticket_audit (
        delivery_ticket_id,
        changed_by,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        auth.uid(),
        'update',
        'ticket_number',
        OLD.ticket_number,
        NEW.ticket_number
      );
    END IF;
    
    IF OLD.delivery_date IS DISTINCT FROM NEW.delivery_date THEN
      INSERT INTO public.delivery_ticket_audit (
        delivery_ticket_id,
        changed_by,
        change_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        auth.uid(),
        'update',
        'delivery_date',
        OLD.delivery_date::text,
        NEW.delivery_date::text
      );
    END IF;
    
    IF OLD.description IS DISTINCT FROM NEW.description THEN
      INSERT INTO public.delivery_ticket_audit (
        delivery_ticket_id,
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
$$;

-- Create trigger for delivery ticket audit trail
CREATE TRIGGER delivery_ticket_audit_trigger
AFTER INSERT OR UPDATE ON public.delivery_tickets
FOR EACH ROW
EXECUTE FUNCTION public.create_delivery_ticket_audit_entry();