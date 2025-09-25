-- Create employee groups table
CREATE TABLE public.employee_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_groups ENABLE ROW LEVEL SECURITY;

-- Create policies for employee groups
CREATE POLICY "Admins and controllers can manage employee groups" 
ON public.employee_groups 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

CREATE POLICY "Users can view employee groups for their company" 
ON public.employee_groups 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Add group_id to profiles table
ALTER TABLE public.profiles ADD COLUMN group_id UUID REFERENCES public.employee_groups(id);

-- Add group_id to pin_employees table  
ALTER TABLE public.pin_employees ADD COLUMN group_id UUID REFERENCES public.employee_groups(id);

-- Add avatar_url to pin_employees table for first punch photo
ALTER TABLE public.pin_employees ADD COLUMN avatar_url TEXT;

-- Update existing pin employee validation function to be compatible with login
CREATE OR REPLACE FUNCTION public.validate_pin_for_login(p_pin text)
RETURNS TABLE(user_id uuid, first_name text, last_name text, role user_role, is_pin_employee boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- First check regular profiles
  SELECT p.user_id, p.first_name, p.last_name, p.role, false as is_pin_employee
  FROM public.profiles p
  WHERE p.pin_code = p_pin
  
  UNION ALL
  
  -- Then check PIN employees, treating them as regular employees
  SELECT pe.id as user_id, pe.first_name, pe.last_name, 'employee'::user_role as role, true as is_pin_employee
  FROM public.pin_employees pe
  WHERE pe.pin_code = p_pin AND pe.is_active = true
  
  LIMIT 1;
$$;

-- Create trigger to update updated_at for employee_groups
CREATE TRIGGER update_employee_groups_updated_at
BEFORE UPDATE ON public.employee_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();