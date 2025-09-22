-- Check for existing theme-related storage policies
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND (policyname LIKE '%theme%' OR with_check LIKE '%theme%' OR qual LIKE '%theme%');