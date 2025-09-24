-- Allow PIN lookups for unauthenticated users
CREATE POLICY "Allow PIN verification for punch clock" 
ON profiles 
FOR SELECT 
USING (
  -- Allow reading profiles for PIN verification (limited fields only at application level)
  pin_code IS NOT NULL
);