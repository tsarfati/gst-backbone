
-- Restore pin_employee timecard settings to employee_timecard_settings
-- Mapping: pin_employee_id -> user_id (matched by name)

-- Christiano Almeida -> f97ba443
INSERT INTO employee_timecard_settings (user_id, company_id, assigned_jobs, assigned_cost_codes, require_location, require_photo, auto_lunch_deduction, created_by)
VALUES ('f97ba443-050f-49b6-8469-8223ababa143', 'f64fff8d-16f4-4a07-81b3-e470d7e2d560',
  ARRAY['cf42bcc1-d025-46b5-a40e-ecf6546a23d9','05f68132-18a2-4a2f-a86f-cb3d433d6263']::uuid[],
  ARRAY['118300d4-f9a4-4e1f-95b1-bd7cf5b7b923','4d010e89-576d-4bf5-8632-d57d5c05df9b','84b4bf9c-8aeb-4ccf-9393-23c11f13ab50','84b52735-524c-4a51-a655-45e50240ef77','e62ea3e1-977a-44c9-bb87-78678dcd7009','f1807c9a-ed5c-46c0-a181-d73afb98616a']::uuid[],
  true, true, true, 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, company_id) DO UPDATE SET assigned_jobs = EXCLUDED.assigned_jobs, assigned_cost_codes = EXCLUDED.assigned_cost_codes, updated_at = now();

-- Rafael Antonio Quintao -> b4e2a962
INSERT INTO employee_timecard_settings (user_id, company_id, assigned_jobs, assigned_cost_codes, require_location, require_photo, auto_lunch_deduction, created_by)
VALUES ('b4e2a962-671c-4fea-89c2-d994935513cf', 'f64fff8d-16f4-4a07-81b3-e470d7e2d560',
  ARRAY['cf42bcc1-d025-46b5-a40e-ecf6546a23d9','05f68132-18a2-4a2f-a86f-cb3d433d6263']::uuid[],
  ARRAY['84b4bf9c-8aeb-4ccf-9393-23c11f13ab50','84b52735-524c-4a51-a655-45e50240ef77','e62ea3e1-977a-44c9-bb87-78678dcd7009','f1807c9a-ed5c-46c0-a181-d73afb98616a','118300d4-f9a4-4e1f-95b1-bd7cf5b7b923']::uuid[],
  true, true, true, 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, company_id) DO UPDATE SET assigned_jobs = EXCLUDED.assigned_jobs, assigned_cost_codes = EXCLUDED.assigned_cost_codes, updated_at = now();

-- Victor Lopez -> cecfc0fb
INSERT INTO employee_timecard_settings (user_id, company_id, assigned_jobs, assigned_cost_codes, require_location, require_photo, auto_lunch_deduction, created_by)
VALUES ('cecfc0fb-acbb-4eba-bebe-f564def0d0dc', 'f64fff8d-16f4-4a07-81b3-e470d7e2d560',
  ARRAY['cf42bcc1-d025-46b5-a40e-ecf6546a23d9','05f68132-18a2-4a2f-a86f-cb3d433d6263']::uuid[],
  ARRAY['4d010e89-576d-4bf5-8632-d57d5c05df9b','84b4bf9c-8aeb-4ccf-9393-23c11f13ab50','84b52735-524c-4a51-a655-45e50240ef77','e62ea3e1-977a-44c9-bb87-78678dcd7009','118300d4-f9a4-4e1f-95b1-bd7cf5b7b923']::uuid[],
  true, true, true, 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, company_id) DO UPDATE SET assigned_jobs = EXCLUDED.assigned_jobs, assigned_cost_codes = EXCLUDED.assigned_cost_codes, updated_at = now();

-- Dionicio Lopez Flores -> 8029eb18
INSERT INTO employee_timecard_settings (user_id, company_id, assigned_jobs, assigned_cost_codes, require_location, require_photo, auto_lunch_deduction, created_by)
VALUES ('8029eb18-6f13-453d-b4cc-28a05eff102d', 'f64fff8d-16f4-4a07-81b3-e470d7e2d560',
  ARRAY['cf42bcc1-d025-46b5-a40e-ecf6546a23d9','05f68132-18a2-4a2f-a86f-cb3d433d6263']::uuid[],
  ARRAY['4d010e89-576d-4bf5-8632-d57d5c05df9b','84b4bf9c-8aeb-4ccf-9393-23c11f13ab50','b0a736d7-b9a5-4f69-99ea-c847b653def3','e62ea3e1-977a-44c9-bb87-78678dcd7009','118300d4-f9a4-4e1f-95b1-bd7cf5b7b923']::uuid[],
  true, true, true, 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, company_id) DO UPDATE SET assigned_jobs = EXCLUDED.assigned_jobs, assigned_cost_codes = EXCLUDED.assigned_cost_codes, updated_at = now();

-- Pedro Martinez Sandoval -> 92b2d989
INSERT INTO employee_timecard_settings (user_id, company_id, assigned_jobs, assigned_cost_codes, require_location, require_photo, auto_lunch_deduction, created_by)
VALUES ('92b2d989-86e2-4c4e-aab0-e5c9070f62a3', 'f64fff8d-16f4-4a07-81b3-e470d7e2d560',
  ARRAY['cf42bcc1-d025-46b5-a40e-ecf6546a23d9']::uuid[],
  ARRAY['4d010e89-576d-4bf5-8632-d57d5c05df9b','e62ea3e1-977a-44c9-bb87-78678dcd7009','b0a736d7-b9a5-4f69-99ea-c847b653def3']::uuid[],
  true, true, true, 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, company_id) DO UPDATE SET assigned_jobs = EXCLUDED.assigned_jobs, assigned_cost_codes = EXCLUDED.assigned_cost_codes, updated_at = now();

-- Ronaldy Menjivar -> 344d4796
INSERT INTO employee_timecard_settings (user_id, company_id, assigned_jobs, assigned_cost_codes, require_location, require_photo, auto_lunch_deduction, created_by)
VALUES ('344d4796-8bfb-47fb-bc3f-b919c2763fcd', 'f64fff8d-16f4-4a07-81b3-e470d7e2d560',
  ARRAY['cf42bcc1-d025-46b5-a40e-ecf6546a23d9']::uuid[],
  ARRAY['84b4bf9c-8aeb-4ccf-9393-23c11f13ab50','84b52735-524c-4a51-a655-45e50240ef77','e62ea3e1-977a-44c9-bb87-78678dcd7009']::uuid[],
  true, true, true, 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, company_id) DO UPDATE SET assigned_jobs = EXCLUDED.assigned_jobs, assigned_cost_codes = EXCLUDED.assigned_cost_codes, updated_at = now();

-- Rodrigo Rodriguez -> d73909c6 (update existing)
UPDATE employee_timecard_settings SET
  assigned_jobs = ARRAY['cf42bcc1-d025-46b5-a40e-ecf6546a23d9','05f68132-18a2-4a2f-a86f-cb3d433d6263']::uuid[],
  assigned_cost_codes = ARRAY['0f47ca8a-9a3e-4940-af27-e611b0d4a40a','c51f727d-fb4e-4d96-a424-4bf818419b11','97fa4c91-61ab-44f2-ba39-325288cfbe67']::uuid[],
  updated_at = now()
WHERE user_id = 'd73909c6-a3a1-48f7-a63d-651b7c310e8d' AND company_id = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560';

-- Michael Sigma -> 2b272abe
INSERT INTO employee_timecard_settings (user_id, company_id, assigned_jobs, assigned_cost_codes, require_location, require_photo, auto_lunch_deduction, created_by)
VALUES ('2b272abe-69d1-4730-9502-52a968092f35', 'f64fff8d-16f4-4a07-81b3-e470d7e2d560',
  ARRAY['cf42bcc1-d025-46b5-a40e-ecf6546a23d9','cd7a8023-8c73-4728-953c-52fb590e8a0f','05f68132-18a2-4a2f-a86f-cb3d433d6263']::uuid[],
  ARRAY['4d010e89-576d-4bf5-8632-d57d5c05df9b','84b4bf9c-8aeb-4ccf-9393-23c11f13ab50','b0a736d7-b9a5-4f69-99ea-c847b653def3','e62ea3e1-977a-44c9-bb87-78678dcd7009','8bcfaa64-dd97-4aff-ac99-4fdf5ba3f552','118300d4-f9a4-4e1f-95b1-bd7cf5b7b923']::uuid[],
  true, true, true, 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, company_id) DO UPDATE SET assigned_jobs = EXCLUDED.assigned_jobs, assigned_cost_codes = EXCLUDED.assigned_cost_codes, updated_at = now();

-- Sandbox Sigma -> b9026662
INSERT INTO employee_timecard_settings (user_id, company_id, assigned_jobs, assigned_cost_codes, require_location, require_photo, auto_lunch_deduction, created_by)
VALUES ('b9026662-3a4d-4e1b-aadb-91d75890f514', 'f64fff8d-16f4-4a07-81b3-e470d7e2d560',
  ARRAY['cf42bcc1-d025-46b5-a40e-ecf6546a23d9','05f68132-18a2-4a2f-a86f-cb3d433d6263']::uuid[],
  ARRAY['118300d4-f9a4-4e1f-95b1-bd7cf5b7b923','4d010e89-576d-4bf5-8632-d57d5c05df9b','63e93845-4a88-4e15-8177-93834cbb4eda','84b4bf9c-8aeb-4ccf-9393-23c11f13ab50','84b52735-524c-4a51-a655-45e50240ef77','90caf5ba-1563-489d-af80-e8b2cd4e7e4d','99c7aa81-eec8-4519-b85b-3a1bdb66cb99','b0a736d7-b9a5-4f69-99ea-c847b653def3','e20212ef-1798-4bc0-b638-f290927ce80d','e62ea3e1-977a-44c9-bb87-78678dcd7009','f1807c9a-ed5c-46c0-a181-d73afb98616a','f6ff7efb-05a3-41c0-bf37-95968b598f9f']::uuid[],
  true, true, true, 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, company_id) DO UPDATE SET assigned_jobs = EXCLUDED.assigned_jobs, assigned_cost_codes = EXCLUDED.assigned_cost_codes, updated_at = now();

-- Osvaldo Sanchez -> ca630f73
INSERT INTO employee_timecard_settings (user_id, company_id, assigned_jobs, assigned_cost_codes, require_location, require_photo, auto_lunch_deduction, created_by)
VALUES ('ca630f73-effd-4d32-8ed6-ba4434921baa', 'f64fff8d-16f4-4a07-81b3-e470d7e2d560',
  ARRAY['cf42bcc1-d025-46b5-a40e-ecf6546a23d9','05f68132-18a2-4a2f-a86f-cb3d433d6263']::uuid[],
  ARRAY['4d010e89-576d-4bf5-8632-d57d5c05df9b','84b52735-524c-4a51-a655-45e50240ef77','e62ea3e1-977a-44c9-bb87-78678dcd7009','f1807c9a-ed5c-46c0-a181-d73afb98616a','118300d4-f9a4-4e1f-95b1-bd7cf5b7b923']::uuid[],
  true, true, true, 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, company_id) DO UPDATE SET assigned_jobs = EXCLUDED.assigned_jobs, assigned_cost_codes = EXCLUDED.assigned_cost_codes, updated_at = now();

-- Emilio Solis -> 8855c1c0 (from pin f6664b7ab, check if settings exist)
-- Isidro Solis -> bbc0b8cd (from pin f3b7fc41)
-- These two didn't have pin_employee_timecard_settings in the f64fff8d company, skipping
