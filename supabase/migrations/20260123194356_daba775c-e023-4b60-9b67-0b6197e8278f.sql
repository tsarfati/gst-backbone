-- Remove demo user from super_admins (they should only be company admin)
DELETE FROM public.super_admins WHERE user_id = '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7';