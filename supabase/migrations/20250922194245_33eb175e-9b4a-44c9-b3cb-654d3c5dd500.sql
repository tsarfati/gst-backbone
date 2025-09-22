-- Ensure profiles are created on new users and backfill existing
-- 1) Create trigger to auto-insert profiles on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2) Backfill missing profiles for existing users
INSERT INTO public.profiles (user_id, first_name, last_name, display_name, role, profile_completed)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'first_name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data->>'last_name',
  COALESCE(u.raw_user_meta_data->>'full_name', u.email),
  'employee',
  true
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;