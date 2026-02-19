-- Fix Sandbox Sigma PIN employee: set company_id to Sigma company
UPDATE public.pin_employees 
SET company_id = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560' 
WHERE id = '3c6566d5-b9ba-4837-907a-8631a18ffebc' 
AND company_id IS NULL;