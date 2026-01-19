-- ============================================
-- Fix: Remove public data exposure on properties table
-- The policy "Anyone can view active properties by QR code" exposes all 
-- active properties to unauthenticated users including addresses, owner IDs, and QR codes.
-- ============================================

-- Drop the problematic overly permissive policy
DROP POLICY IF EXISTS "Anyone can view active properties by QR code" ON public.properties;

-- Create a secure RPC function for QR code validation
-- This returns only the minimal data needed for QR validation
-- and uses SECURITY DEFINER with proper search_path to prevent schema hijacking
CREATE OR REPLACE FUNCTION public.validate_property_qr(input_qr TEXT)
RETURNS TABLE(
  property_id UUID,
  property_name TEXT,
  property_address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return only minimal required data for a single matching property
  RETURN QUERY 
  SELECT 
    p.id,
    p.name,
    p.address
  FROM public.properties p
  WHERE p.qr_code = input_qr 
    AND p.is_active = true 
  LIMIT 1;
END;
$$;

-- Grant execute permissions to both anonymous and authenticated users
-- This allows QR validation without exposing the full properties table
GRANT EXECUTE ON FUNCTION public.validate_property_qr(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_property_qr(TEXT) TO authenticated;

-- Add a comment explaining the function's purpose
COMMENT ON FUNCTION public.validate_property_qr IS 'Securely validates a property QR code and returns minimal property info. Replaces the previous overly permissive RLS policy that exposed all active properties.';