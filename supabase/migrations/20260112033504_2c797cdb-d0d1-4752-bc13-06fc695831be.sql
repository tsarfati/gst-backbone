-- Add phone column to profiles table for owner contact information
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Add an index for searching by phone
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);