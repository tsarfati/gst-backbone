-- Check current RLS policies on role_permissions table
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'role_permissions';