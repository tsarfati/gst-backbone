-- Add pin_employee_id column to punch_records table
ALTER TABLE public.punch_records ADD COLUMN IF NOT EXISTS pin_employee_id uuid REFERENCES public.pin_employees(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_punch_records_pin_employee ON public.punch_records(pin_employee_id) WHERE pin_employee_id IS NOT NULL;