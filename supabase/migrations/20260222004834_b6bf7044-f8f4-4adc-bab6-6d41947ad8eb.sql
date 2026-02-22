
-- Remove stale user_company_access entries for old pin_employee IDs that have no matching profile
DELETE FROM public.user_company_access 
WHERE company_id = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560'
AND user_id IN (
  '0560bd83-77b9-4314-8388-9c5d67a27354',
  '163498dc-d490-4cfd-82d8-40befd37be8c',
  '45162990-155a-4c0e-8a6f-ee04cd320702',
  'b8b3711e-228e-448c-b22a-41ce5ba1c8cc',
  '3c6566d5-b9ba-4837-907a-8631a18ffebc',
  'e65dceed-eb26-496d-83ec-d20f48b9ddb1',
  'a0edde77-d0cd-4b7d-95d0-8eb6072da8ae',
  '248e99c0-c547-4860-9fb5-f084b16efa8f',
  '05993ad2-ae3b-4620-979c-809441de8ac6',
  'd4741d55-2bf9-476a-90fa-3bc1c297102e',
  'a8d1dfe8-2f9c-4c23-ad23-58517fd2b318'
);

-- Also add missing employee company access for Emilio Solis and Isidro Solis
INSERT INTO public.user_company_access (user_id, company_id, role, granted_by, is_active)
VALUES 
  ('8855c1c0-db14-4819-b106-1562b35505f4', 'f64fff8d-16f4-4a07-81b3-e470d7e2d560', 'employee', 'dcdfec98-5141-4559-adb2-fe1d70bfce98', true),
  ('bbc0b8cd-ece3-4005-9cc3-d4cbd2bbf593', 'f64fff8d-16f4-4a07-81b3-e470d7e2d560', 'employee', 'dcdfec98-5141-4559-adb2-fe1d70bfce98', true)
ON CONFLICT (user_id, company_id) DO NOTHING;

-- Also add the duplicate Michael Tsarfati employee account (201df05e) - remove it to avoid confusion
DELETE FROM public.user_company_access 
WHERE user_id = '201df05e-50ca-4208-b49c-58a441280122'
AND company_id = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560';
