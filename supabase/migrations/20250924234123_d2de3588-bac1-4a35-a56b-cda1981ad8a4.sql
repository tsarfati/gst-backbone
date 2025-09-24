-- Create table for PIN-only employees (punch clock access only)
CREATE TABLE public.pin_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  pin_code TEXT NOT NULL UNIQUE,
  department TEXT,
  phone TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pin_employees ENABLE ROW LEVEL SECURITY;

-- Create policies for PIN employees
CREATE POLICY "Admins and controllers can manage PIN employees" 
ON public.pin_employees 
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

CREATE POLICY "PIN employees are viewable by authenticated users" 
ON public.pin_employees 
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow public access for PIN validation (needed for punch clock)
CREATE POLICY "Allow PIN validation for punch clock" 
ON public.pin_employees 
FOR SELECT
USING (pin_code IS NOT NULL);

-- Create function to validate PIN for punch clock (returns pin employee data)
CREATE OR REPLACE FUNCTION public.validate_pin_employee(p_pin text)
RETURNS TABLE(employee_id uuid, first_name text, last_name text, display_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id, first_name, last_name, display_name
  FROM public.pin_employees
  WHERE pin_code = p_pin AND is_active = true
  LIMIT 1
$$;