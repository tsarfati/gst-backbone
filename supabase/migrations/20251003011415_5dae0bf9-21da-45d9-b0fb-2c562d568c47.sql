-- Add email column to pin_employees table
ALTER TABLE public.pin_employees
ADD COLUMN IF NOT EXISTS email TEXT;