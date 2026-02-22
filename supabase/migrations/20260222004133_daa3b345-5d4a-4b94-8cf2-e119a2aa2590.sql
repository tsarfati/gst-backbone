
-- Remap punch_records and time_cards from old pin_employee IDs to new auth user IDs
-- This preserves all data, just updates the user_id reference

-- First, save pin_employee_id on punch_records for historical reference
UPDATE public.punch_records SET pin_employee_id = user_id
WHERE user_id IN (
  'b8b3711e-228e-448c-b22a-41ce5ba1c8cc', -- Christiano Almeida
  '248e99c0-c547-4860-9fb5-f084b16efa8f', -- Rafael Antonio Quintao
  'dbcd9080-8067-475b-8047-4ba343ed0e28', -- Sebastian Chrispen
  'a0edde77-d0cd-4b7d-95d0-8eb6072da8ae', -- Victor Lopez
  'e65dceed-eb26-496d-83ec-d20f48b9ddb1', -- Dionicio Lopez Flores
  '45162990-155a-4c0e-8a6f-ee04cd320702', -- Pedro Martinez Sandoval
  'd4741d55-2bf9-476a-90fa-3bc1c297102e', -- Ronaldy Menjivar
  '163498dc-d490-4cfd-82d8-40befd37be8c', -- Rodrigo Rodriguez
  '0560bd83-77b9-4314-8388-9c5d67a27354', -- Osvaldo Sanchez
  '05993ad2-ae3b-4620-979c-809441de8ac6', -- Michael Sigma
  '3c6566d5-b9ba-4837-907a-8631a18ffebc', -- Sandbox Sigma
  '6664b7ab-64ab-416b-b0c7-ed9ff0d1af73', -- Emilio Solis
  'f3b7fc41-7617-42b5-ab8d-6f6d0162aed3', -- Isidro Solis
  'a8d1dfe8-2f9c-4c23-ad23-58517fd2b318', -- Michael Tsarfati
  'd0010001-0001-0001-0001-000000000001', -- Carlos Rodriguez (demo)
  'd0010001-0001-0001-0001-000000000002'  -- James Thompson (demo)
) AND pin_employee_id IS NULL;

-- Now remap punch_records.user_id to new auth user IDs
UPDATE public.punch_records SET user_id = 'f97ba443-050f-49b6-8469-8223ababa143' WHERE user_id = 'b8b3711e-228e-448c-b22a-41ce5ba1c8cc'; -- Christiano Almeida
UPDATE public.punch_records SET user_id = 'b4e2a962-671c-4fea-89c2-d994935513cf' WHERE user_id = '248e99c0-c547-4860-9fb5-f084b16efa8f'; -- Rafael Antonio Quintao
UPDATE public.punch_records SET user_id = 'e5340116-4b97-4dbe-84ae-675f2ff8af72' WHERE user_id = 'dbcd9080-8067-475b-8047-4ba343ed0e28'; -- Sebastian Chrispen
UPDATE public.punch_records SET user_id = 'cecfc0fb-acbb-4eba-bebe-f564def0d0dc' WHERE user_id = 'a0edde77-d0cd-4b7d-95d0-8eb6072da8ae'; -- Victor Lopez
UPDATE public.punch_records SET user_id = '8029eb18-6f13-453d-b4cc-28a05eff102d' WHERE user_id = 'e65dceed-eb26-496d-83ec-d20f48b9ddb1'; -- Dionicio Lopez Flores
UPDATE public.punch_records SET user_id = '92b2d989-86e2-4c4e-aab0-e5c9070f62a3' WHERE user_id = '45162990-155a-4c0e-8a6f-ee04cd320702'; -- Pedro Martinez Sandoval
UPDATE public.punch_records SET user_id = '344d4796-8bfb-47fb-bc3f-b919c2763fcd' WHERE user_id = 'd4741d55-2bf9-476a-90fa-3bc1c297102e'; -- Ronaldy Menjivar
UPDATE public.punch_records SET user_id = 'b23e0628-ab02-4f12-a313-6e79807dc120' WHERE user_id = '163498dc-d490-4cfd-82d8-40befd37be8c'; -- Rodrigo Rodriguez
UPDATE public.punch_records SET user_id = 'ca630f73-effd-4d32-8ed6-ba4434921baa' WHERE user_id = '0560bd83-77b9-4314-8388-9c5d67a27354'; -- Osvaldo Sanchez
UPDATE public.punch_records SET user_id = '2b272abe-69d1-4730-9502-52a968092f35' WHERE user_id = '05993ad2-ae3b-4620-979c-809441de8ac6'; -- Michael Sigma
UPDATE public.punch_records SET user_id = 'b9026662-3a4d-4e1b-aadb-91d75890f514' WHERE user_id = '3c6566d5-b9ba-4837-907a-8631a18ffebc'; -- Sandbox Sigma
UPDATE public.punch_records SET user_id = '8855c1c0-db14-4819-b106-1562b35505f4' WHERE user_id = '6664b7ab-64ab-416b-b0c7-ed9ff0d1af73'; -- Emilio Solis
UPDATE public.punch_records SET user_id = 'bbc0b8cd-ece3-4005-9cc3-d4cbd2bbf593' WHERE user_id = 'f3b7fc41-7617-42b5-ab8d-6f6d0162aed3'; -- Isidro Solis
UPDATE public.punch_records SET user_id = 'dcdfec98-5141-4559-adb2-fe1d70bfce98' WHERE user_id = 'a8d1dfe8-2f9c-4c23-ad23-58517fd2b318'; -- Michael Tsarfati -> his real admin account
UPDATE public.punch_records SET user_id = '8c42ec6d-fd00-49f9-b847-b8619767ed14' WHERE user_id = 'd0010001-0001-0001-0001-000000000001'; -- Carlos Rodriguez
UPDATE public.punch_records SET user_id = 'f3babe48-5efe-4196-b856-5c9b6e9ea835' WHERE user_id = 'd0010001-0001-0001-0001-000000000002'; -- James Thompson

-- Now remap time_cards.user_id to new auth user IDs
UPDATE public.time_cards SET user_id = 'f97ba443-050f-49b6-8469-8223ababa143' WHERE user_id = 'b8b3711e-228e-448c-b22a-41ce5ba1c8cc'; -- Christiano Almeida
UPDATE public.time_cards SET user_id = 'b4e2a962-671c-4fea-89c2-d994935513cf' WHERE user_id = '248e99c0-c547-4860-9fb5-f084b16efa8f'; -- Rafael Antonio Quintao
UPDATE public.time_cards SET user_id = 'e5340116-4b97-4dbe-84ae-675f2ff8af72' WHERE user_id = 'dbcd9080-8067-475b-8047-4ba343ed0e28'; -- Sebastian Chrispen
UPDATE public.time_cards SET user_id = 'cecfc0fb-acbb-4eba-bebe-f564def0d0dc' WHERE user_id = 'a0edde77-d0cd-4b7d-95d0-8eb6072da8ae'; -- Victor Lopez
UPDATE public.time_cards SET user_id = '8029eb18-6f13-453d-b4cc-28a05eff102d' WHERE user_id = 'e65dceed-eb26-496d-83ec-d20f48b9ddb1'; -- Dionicio Lopez Flores
UPDATE public.time_cards SET user_id = '92b2d989-86e2-4c4e-aab0-e5c9070f62a3' WHERE user_id = '45162990-155a-4c0e-8a6f-ee04cd320702'; -- Pedro Martinez Sandoval
UPDATE public.time_cards SET user_id = '344d4796-8bfb-47fb-bc3f-b919c2763fcd' WHERE user_id = 'd4741d55-2bf9-476a-90fa-3bc1c297102e'; -- Ronaldy Menjivar
UPDATE public.time_cards SET user_id = 'b23e0628-ab02-4f12-a313-6e79807dc120' WHERE user_id = '163498dc-d490-4cfd-82d8-40befd37be8c'; -- Rodrigo Rodriguez
UPDATE public.time_cards SET user_id = 'ca630f73-effd-4d32-8ed6-ba4434921baa' WHERE user_id = '0560bd83-77b9-4314-8388-9c5d67a27354'; -- Osvaldo Sanchez
UPDATE public.time_cards SET user_id = '2b272abe-69d1-4730-9502-52a968092f35' WHERE user_id = '05993ad2-ae3b-4620-979c-809441de8ac6'; -- Michael Sigma
UPDATE public.time_cards SET user_id = 'b9026662-3a4d-4e1b-aadb-91d75890f514' WHERE user_id = '3c6566d5-b9ba-4837-907a-8631a18ffebc'; -- Sandbox Sigma
UPDATE public.time_cards SET user_id = '8855c1c0-db14-4819-b106-1562b35505f4' WHERE user_id = '6664b7ab-64ab-416b-b0c7-ed9ff0d1af73'; -- Emilio Solis
UPDATE public.time_cards SET user_id = 'bbc0b8cd-ece3-4005-9cc3-d4cbd2bbf593' WHERE user_id = 'f3b7fc41-7617-42b5-ab8d-6f6d0162aed3'; -- Isidro Solis
UPDATE public.time_cards SET user_id = 'dcdfec98-5141-4559-adb2-fe1d70bfce98' WHERE user_id = 'a8d1dfe8-2f9c-4c23-ad23-58517fd2b318'; -- Michael Tsarfati -> his real admin account
UPDATE public.time_cards SET user_id = '8c42ec6d-fd00-49f9-b847-b8619767ed14' WHERE user_id = 'd0010001-0001-0001-0001-000000000001'; -- Carlos Rodriguez
UPDATE public.time_cards SET user_id = 'f3babe48-5efe-4196-b856-5c9b6e9ea835' WHERE user_id = 'd0010001-0001-0001-0001-000000000002'; -- James Thompson
