-- Fix critical security vulnerability: Remove public access to profiles table
-- The validate_pin function is SECURITY DEFINER so it doesn't need this policy

-- Drop the overly permissive policy that allows anyone to read profiles with PIN codes
DROP POLICY IF EXISTS "Allow PIN verification for punch clock" ON public.profiles;

-- Ensure the profiles table has proper RLS policies:
-- 1. Users can view their own profile
-- 2. Users can view profiles of others in their companies
-- 3. Admins and controllers have full access
-- (These policies already exist and are properly restrictive)