-- Fix job_photos uploaded_by to match the actual photographer based on pin_employee_id
-- This corrects photos that were uploaded via the PIN punch clock system where
-- the admin (Michael Tsarfati) was the authenticated user but different employees took the photos

-- Rafael Antonio Quintao
UPDATE job_photos SET uploaded_by = 'b4e2a962-671c-4fea-89c2-d994935513cf' 
WHERE pin_employee_id = '248e99c0-c547-4860-9fb5-f084b16efa8f';

-- Christiano Almeida
UPDATE job_photos SET uploaded_by = 'f97ba443-050f-49b6-8469-8223ababa143' 
WHERE pin_employee_id = 'b8b3711e-228e-448c-b22a-41ce5ba1c8cc';

-- Osvaldo Sanchez
UPDATE job_photos SET uploaded_by = 'ca630f73-effd-4d32-8ed6-ba4434921baa' 
WHERE pin_employee_id = '0560bd83-77b9-4314-8388-9c5d67a27354';

-- Dionicio Lopez Flores
UPDATE job_photos SET uploaded_by = '8029eb18-6f13-453d-b4cc-28a05eff102d' 
WHERE pin_employee_id = 'e65dceed-eb26-496d-83ec-d20f48b9ddb1';

-- Victor Lopez
UPDATE job_photos SET uploaded_by = 'cecfc0fb-acbb-4eba-bebe-f564def0d0dc' 
WHERE pin_employee_id = 'a0edde77-d0cd-4b7d-95d0-8eb6072da8ae';

-- Rodrigo Rodriguez (active profile)
UPDATE job_photos SET uploaded_by = 'b23e0628-ab02-4f12-a313-6e79807dc120' 
WHERE pin_employee_id = '163498dc-d490-4cfd-82d8-40befd37be8c';

-- Pedro Martinez Sandoval
UPDATE job_photos SET uploaded_by = '92b2d989-86e2-4c4e-aab0-e5c9070f62a3' 
WHERE pin_employee_id = '45162990-155a-4c0e-8a6f-ee04cd320702';

-- Michael Sigma
UPDATE job_photos SET uploaded_by = '2b272abe-69d1-4730-9502-52a968092f35' 
WHERE pin_employee_id = '05993ad2-ae3b-4620-979c-809441de8ac6';

-- Michael Tsarfati (keep as-is, already correct)
-- pin_employee_id = 'a8d1dfe8-2f9c-4c23-ad23-58517fd2b318' -> dcdfec98-5141-4559-adb2-fe1d70bfce98
