-- Restore Michael Tsarfati's original super-admin/tenant-owner profile.
-- This profile was accidentally overwritten by a rejected employee shadow flow.

update public.profiles
set
  first_name = 'Michael',
  last_name = 'Tsarfati',
  display_name = 'Michael Tsarfati',
  role = 'admin',
  status = 'approved',
  has_global_job_access = true,
  current_company_id = 'dcdfec98-5141-4559-adb2-fe1d70bfce98',
  default_company_id = 'dcdfec98-5141-4559-adb2-fe1d70bfce98',
  nickname = 'MichaelT',
  birthday = '1983-04-11',
  pin_code = null,
  group_id = null,
  custom_role_id = null,
  vendor_id = null,
  phone = '2676254866',
  zodiac_sign = null,
  profile_completed = true,
  profile_completed_at = coalesce(profile_completed_at, now()),
  profile_avatar_url = coalesce(
    profile_avatar_url,
    'https://watxvzoolmfjfijrgcvq.supabase.co/storage/v1/object/public/avatars/dcdfec98-5141-4559-adb2-fe1d70bfce98/avatar.png'
  ),
  punch_clock_access = true,
  pm_lynk_access = true,
  email = 'mtsarfati@gmail.com',
  vendor_portal_role = null,
  updated_at = now()
where user_id = 'dcdfec98-5141-4559-adb2-fe1d70bfce98';

-- Remove stale rejected external-access signup records tied to that founder account.
delete from public.company_access_requests
where user_id = 'dcdfec98-5141-4559-adb2-fe1d70bfce98'
  and status = 'rejected'
  and notes like '%"requestType":"external_access_signup"%';
