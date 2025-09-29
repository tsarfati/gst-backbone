-- Add retainage fields to subcontracts table
ALTER TABLE public.subcontracts 
ADD COLUMN IF NOT EXISTS apply_retainage BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS retainage_percentage NUMERIC(5,2) DEFAULT NULL;