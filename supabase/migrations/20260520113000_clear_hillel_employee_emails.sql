-- Clear duplicate/colliding emails from Hillel employee-only profiles.
-- Leave the admin account intact.
UPDATE public.profiles
SET email = NULL,
    updated_at = now()
WHERE id IN (
  '4bb1063a-71e5-4e1c-b8e1-4af36fb0466b',
  'c20a0862-eeaf-4def-847f-86bfcf4e4258'
)
  AND role = 'employee';
