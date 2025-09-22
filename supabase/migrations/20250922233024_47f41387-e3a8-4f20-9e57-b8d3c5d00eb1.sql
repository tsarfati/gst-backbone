-- Fix employee access to receipts - remove access for employees
UPDATE public.role_permissions 
SET can_access = false 
WHERE role = 'employee' 
AND menu_item = 'receipts';

-- Create delivery_tickets table for project managers
CREATE TABLE public.delivery_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  ticket_number TEXT,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_name TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery tickets
CREATE POLICY "Project managers and admins can manage delivery tickets"
ON public.delivery_tickets
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role) OR has_role(auth.uid(), 'project_manager'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role) OR has_role(auth.uid(), 'project_manager'::user_role));

CREATE POLICY "All authenticated users can view delivery tickets"
ON public.delivery_tickets
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Add delivery tickets menu permissions
INSERT INTO public.role_permissions (role, menu_item, can_access) VALUES
('admin', 'delivery-tickets', true),
('controller', 'delivery-tickets', true),
('project_manager', 'delivery-tickets', true),
('employee', 'delivery-tickets', false),
('view_only', 'delivery-tickets', false)
ON CONFLICT (role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;