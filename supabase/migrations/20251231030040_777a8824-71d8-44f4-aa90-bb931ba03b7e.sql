-- Insert Axria customer (using first admin user as created_by)
INSERT INTO public.customers (company_id, name, display_name, created_by) 
SELECT 
  'f64fff8d-16f4-4a07-81b3-e470d7e2d560', 
  'Axria', 
  'Axria',
  (SELECT user_id FROM public.profiles WHERE role = 'admin' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.customers WHERE name = 'Axria' AND company_id = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560'
);

-- Link the first job to Axria
UPDATE public.jobs 
SET customer_id = (SELECT id FROM public.customers WHERE name = 'Axria' LIMIT 1)
WHERE id = (SELECT id FROM public.jobs LIMIT 1)
AND customer_id IS NULL;