-- Check current storage policies for avatars bucket
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';