-- Add type field to cost_codes table for categorization
CREATE TYPE public.cost_code_type AS ENUM ('material', 'labor', 'sub', 'equipment', 'other');

ALTER TABLE public.cost_codes 
ADD COLUMN type public.cost_code_type DEFAULT 'other';

-- Update existing cost codes to have appropriate types based on common patterns
UPDATE public.cost_codes 
SET type = CASE 
  WHEN lower(code) LIKE '%labor%' OR lower(description) LIKE '%labor%' THEN 'labor'::public.cost_code_type
  WHEN lower(code) LIKE '%material%' OR lower(description) LIKE '%material%' THEN 'material'::public.cost_code_type
  WHEN lower(code) LIKE '%sub%' OR lower(description) LIKE '%subcontract%' THEN 'sub'::public.cost_code_type
  WHEN lower(code) LIKE '%equipment%' OR lower(description) LIKE '%equipment%' THEN 'equipment'::public.cost_code_type
  ELSE 'other'::public.cost_code_type
END;