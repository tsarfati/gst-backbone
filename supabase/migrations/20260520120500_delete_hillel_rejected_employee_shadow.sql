-- Safely neutralize the bogus rejected GreenStar employee shadow profile for Hillel.
-- The user_id is still referenced by jobs, so we cannot hard-delete it.
UPDATE public.profiles
SET first_name = 'Archived',
    last_name = 'Legacy User',
    display_name = 'Archived Legacy User',
    email = NULL,
    pin_code = NULL,
    punch_clock_access = false,
    pm_lynk_access = false,
    current_company_id = NULL,
    updated_at = now()
WHERE id = 'c20a0862-eeaf-4def-847f-86bfcf4e4258'
  AND role = 'employee'
  AND status = 'rejected';
