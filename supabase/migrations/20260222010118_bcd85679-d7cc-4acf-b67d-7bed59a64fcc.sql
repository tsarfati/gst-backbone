
-- Populate user_job_access and user_job_cost_codes from employee_timecard_settings
-- for all migrated employees in company f64fff8d

-- Helper: granted_by = dcdfec98 (admin)

-- 1. Christiano Almeida (f97ba443) - jobs: cf42bcc1, 05f68132
INSERT INTO user_job_access (user_id, job_id, granted_by) VALUES
  ('f97ba443-050f-49b6-8469-8223ababa143', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('f97ba443-050f-49b6-8469-8223ababa143', '05f68132-18a2-4a2f-a86f-cb3d433d6263', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id) DO NOTHING;

INSERT INTO user_job_cost_codes (user_id, job_id, cost_code_id, granted_by) VALUES
  ('f97ba443-050f-49b6-8469-8223ababa143', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '4d010e89-576d-4bf5-8632-d57d5c05df9b', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('f97ba443-050f-49b6-8469-8223ababa143', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '84b4bf9c-8aeb-4ccf-9393-23c11f13ab50', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('f97ba443-050f-49b6-8469-8223ababa143', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '84b52735-524c-4a51-a655-45e50240ef77', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('f97ba443-050f-49b6-8469-8223ababa143', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'e62ea3e1-977a-44c9-bb87-78678dcd7009', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('f97ba443-050f-49b6-8469-8223ababa143', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'f1807c9a-ed5c-46c0-a181-d73afb98616a', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('f97ba443-050f-49b6-8469-8223ababa143', '05f68132-18a2-4a2f-a86f-cb3d433d6263', '118300d4-f9a4-4e1f-95b1-bd7cf5b7b923', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id, cost_code_id) DO NOTHING;

-- 2. Rafael Antonio Quintao (b4e2a962) - jobs: cf42bcc1, 05f68132
INSERT INTO user_job_access (user_id, job_id, granted_by) VALUES
  ('b4e2a962-671c-4fea-89c2-d994935513cf', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b4e2a962-671c-4fea-89c2-d994935513cf', '05f68132-18a2-4a2f-a86f-cb3d433d6263', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id) DO NOTHING;

INSERT INTO user_job_cost_codes (user_id, job_id, cost_code_id, granted_by) VALUES
  ('b4e2a962-671c-4fea-89c2-d994935513cf', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '84b4bf9c-8aeb-4ccf-9393-23c11f13ab50', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b4e2a962-671c-4fea-89c2-d994935513cf', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '84b52735-524c-4a51-a655-45e50240ef77', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b4e2a962-671c-4fea-89c2-d994935513cf', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'e62ea3e1-977a-44c9-bb87-78678dcd7009', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b4e2a962-671c-4fea-89c2-d994935513cf', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'f1807c9a-ed5c-46c0-a181-d73afb98616a', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b4e2a962-671c-4fea-89c2-d994935513cf', '05f68132-18a2-4a2f-a86f-cb3d433d6263', '118300d4-f9a4-4e1f-95b1-bd7cf5b7b923', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id, cost_code_id) DO NOTHING;

-- 3. Victor Lopez (cecfc0fb) - jobs: cf42bcc1, 05f68132
INSERT INTO user_job_access (user_id, job_id, granted_by) VALUES
  ('cecfc0fb-acbb-4eba-bebe-f564def0d0dc', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('cecfc0fb-acbb-4eba-bebe-f564def0d0dc', '05f68132-18a2-4a2f-a86f-cb3d433d6263', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id) DO NOTHING;

INSERT INTO user_job_cost_codes (user_id, job_id, cost_code_id, granted_by) VALUES
  ('cecfc0fb-acbb-4eba-bebe-f564def0d0dc', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '4d010e89-576d-4bf5-8632-d57d5c05df9b', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('cecfc0fb-acbb-4eba-bebe-f564def0d0dc', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '84b4bf9c-8aeb-4ccf-9393-23c11f13ab50', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('cecfc0fb-acbb-4eba-bebe-f564def0d0dc', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '84b52735-524c-4a51-a655-45e50240ef77', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('cecfc0fb-acbb-4eba-bebe-f564def0d0dc', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'e62ea3e1-977a-44c9-bb87-78678dcd7009', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('cecfc0fb-acbb-4eba-bebe-f564def0d0dc', '05f68132-18a2-4a2f-a86f-cb3d433d6263', '118300d4-f9a4-4e1f-95b1-bd7cf5b7b923', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id, cost_code_id) DO NOTHING;

-- 4. Dionicio Lopez Flores (8029eb18) - jobs: cf42bcc1, 05f68132
INSERT INTO user_job_access (user_id, job_id, granted_by) VALUES
  ('8029eb18-6f13-453d-b4cc-28a05eff102d', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('8029eb18-6f13-453d-b4cc-28a05eff102d', '05f68132-18a2-4a2f-a86f-cb3d433d6263', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id) DO NOTHING;

INSERT INTO user_job_cost_codes (user_id, job_id, cost_code_id, granted_by) VALUES
  ('8029eb18-6f13-453d-b4cc-28a05eff102d', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '4d010e89-576d-4bf5-8632-d57d5c05df9b', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('8029eb18-6f13-453d-b4cc-28a05eff102d', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '84b4bf9c-8aeb-4ccf-9393-23c11f13ab50', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('8029eb18-6f13-453d-b4cc-28a05eff102d', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'b0a736d7-b9a5-4f69-99ea-c847b653def3', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('8029eb18-6f13-453d-b4cc-28a05eff102d', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'e62ea3e1-977a-44c9-bb87-78678dcd7009', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('8029eb18-6f13-453d-b4cc-28a05eff102d', '05f68132-18a2-4a2f-a86f-cb3d433d6263', '118300d4-f9a4-4e1f-95b1-bd7cf5b7b923', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id, cost_code_id) DO NOTHING;

-- 5. Pedro Martinez Sandoval (92b2d989) - jobs: cf42bcc1
INSERT INTO user_job_access (user_id, job_id, granted_by) VALUES
  ('92b2d989-86e2-4c4e-aab0-e5c9070f62a3', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id) DO NOTHING;

INSERT INTO user_job_cost_codes (user_id, job_id, cost_code_id, granted_by) VALUES
  ('92b2d989-86e2-4c4e-aab0-e5c9070f62a3', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '4d010e89-576d-4bf5-8632-d57d5c05df9b', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('92b2d989-86e2-4c4e-aab0-e5c9070f62a3', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'e62ea3e1-977a-44c9-bb87-78678dcd7009', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('92b2d989-86e2-4c4e-aab0-e5c9070f62a3', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'b0a736d7-b9a5-4f69-99ea-c847b653def3', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id, cost_code_id) DO NOTHING;

-- 6. Ronaldy Menjivar (344d4796) - jobs: cf42bcc1
INSERT INTO user_job_access (user_id, job_id, granted_by) VALUES
  ('344d4796-8bfb-47fb-bc3f-b919c2763fcd', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id) DO NOTHING;

INSERT INTO user_job_cost_codes (user_id, job_id, cost_code_id, granted_by) VALUES
  ('344d4796-8bfb-47fb-bc3f-b919c2763fcd', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '84b4bf9c-8aeb-4ccf-9393-23c11f13ab50', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('344d4796-8bfb-47fb-bc3f-b919c2763fcd', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '84b52735-524c-4a51-a655-45e50240ef77', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('344d4796-8bfb-47fb-bc3f-b919c2763fcd', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'e62ea3e1-977a-44c9-bb87-78678dcd7009', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id, cost_code_id) DO NOTHING;

-- 7. Michael Sigma (2b272abe) - jobs: cf42bcc1, cd7a8023, 05f68132
INSERT INTO user_job_access (user_id, job_id, granted_by) VALUES
  ('2b272abe-69d1-4730-9502-52a968092f35', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('2b272abe-69d1-4730-9502-52a968092f35', 'cd7a8023-8c73-4728-953c-52fb590e8a0f', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('2b272abe-69d1-4730-9502-52a968092f35', '05f68132-18a2-4a2f-a86f-cb3d433d6263', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id) DO NOTHING;

INSERT INTO user_job_cost_codes (user_id, job_id, cost_code_id, granted_by) VALUES
  ('2b272abe-69d1-4730-9502-52a968092f35', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '4d010e89-576d-4bf5-8632-d57d5c05df9b', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('2b272abe-69d1-4730-9502-52a968092f35', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '84b4bf9c-8aeb-4ccf-9393-23c11f13ab50', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('2b272abe-69d1-4730-9502-52a968092f35', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'b0a736d7-b9a5-4f69-99ea-c847b653def3', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('2b272abe-69d1-4730-9502-52a968092f35', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'e62ea3e1-977a-44c9-bb87-78678dcd7009', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('2b272abe-69d1-4730-9502-52a968092f35', 'cd7a8023-8c73-4728-953c-52fb590e8a0f', '8bcfaa64-dd97-4aff-ac99-4fdf5ba3f552', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('2b272abe-69d1-4730-9502-52a968092f35', '05f68132-18a2-4a2f-a86f-cb3d433d6263', '118300d4-f9a4-4e1f-95b1-bd7cf5b7b923', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id, cost_code_id) DO NOTHING;

-- 8. Sandbox Sigma (b9026662) - jobs: cf42bcc1, 05f68132
INSERT INTO user_job_access (user_id, job_id, granted_by) VALUES
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', '05f68132-18a2-4a2f-a86f-cb3d433d6263', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id) DO NOTHING;

INSERT INTO user_job_cost_codes (user_id, job_id, cost_code_id, granted_by) VALUES
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '4d010e89-576d-4bf5-8632-d57d5c05df9b', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '84b4bf9c-8aeb-4ccf-9393-23c11f13ab50', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '84b52735-524c-4a51-a655-45e50240ef77', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'b0a736d7-b9a5-4f69-99ea-c847b653def3', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'e62ea3e1-977a-44c9-bb87-78678dcd7009', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'f1807c9a-ed5c-46c0-a181-d73afb98616a', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '63e93845-4a88-4e15-8177-93834cbb4eda', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '90caf5ba-1563-489d-af80-e8b2cd4e7e4d', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '99c7aa81-eec8-4519-b85b-3a1bdb66cb99', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'e20212ef-1798-4bc0-b638-f290927ce80d', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'f6ff7efb-05a3-41c0-bf37-95968b598f9f', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('b9026662-3a4d-4e1b-aadb-91d75890f514', '05f68132-18a2-4a2f-a86f-cb3d433d6263', '118300d4-f9a4-4e1f-95b1-bd7cf5b7b923', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id, cost_code_id) DO NOTHING;

-- 9. Osvaldo Sanchez (ca630f73) - jobs: cf42bcc1, 05f68132
INSERT INTO user_job_access (user_id, job_id, granted_by) VALUES
  ('ca630f73-effd-4d32-8ed6-ba4434921baa', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('ca630f73-effd-4d32-8ed6-ba4434921baa', '05f68132-18a2-4a2f-a86f-cb3d433d6263', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id) DO NOTHING;

INSERT INTO user_job_cost_codes (user_id, job_id, cost_code_id, granted_by) VALUES
  ('ca630f73-effd-4d32-8ed6-ba4434921baa', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '4d010e89-576d-4bf5-8632-d57d5c05df9b', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('ca630f73-effd-4d32-8ed6-ba4434921baa', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', '84b52735-524c-4a51-a655-45e50240ef77', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('ca630f73-effd-4d32-8ed6-ba4434921baa', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'e62ea3e1-977a-44c9-bb87-78678dcd7009', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('ca630f73-effd-4d32-8ed6-ba4434921baa', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'f1807c9a-ed5c-46c0-a181-d73afb98616a', 'dcdfec98-5141-4559-adb2-fe1d70bfce98'),
  ('ca630f73-effd-4d32-8ed6-ba4434921baa', '05f68132-18a2-4a2f-a86f-cb3d433d6263', '118300d4-f9a4-4e1f-95b1-bd7cf5b7b923', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id, cost_code_id) DO NOTHING;

-- Rodrigo Rodriguez (d73909c6) already has entries in user_job_access/user_job_cost_codes
-- Add cost code c51f727d for job cf42bcc1 if missing
INSERT INTO user_job_cost_codes (user_id, job_id, cost_code_id, granted_by) VALUES
  ('d73909c6-a3a1-48f7-a63d-651b7c310e8d', 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9', 'c51f727d-fb4e-4d96-a424-4bf818419b11', 'dcdfec98-5141-4559-adb2-fe1d70bfce98')
ON CONFLICT (user_id, job_id, cost_code_id) DO NOTHING;
