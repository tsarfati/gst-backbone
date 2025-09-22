-- Check if has_role function exists and its definition
SELECT routine_name, routine_definition, security_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'has_role';