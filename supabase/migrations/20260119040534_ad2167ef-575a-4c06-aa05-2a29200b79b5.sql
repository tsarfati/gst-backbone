-- ============================================
-- Fix: Remove public data exposure on properties table
-- The policy "Anyone can view active properties by QR code" exposes all 
-- active properties to unauthenticated users including addresses, owner IDs, and QR codes.
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'properties'
  ) THEN
    DROP POLICY IF EXISTS "Anyone can view active properties by QR code" ON public.properties;

    CREATE OR REPLACE FUNCTION public.validate_property_qr(input_qr TEXT)
    RETURNS TABLE(
      property_id UUID,
      property_name TEXT,
      property_address TEXT
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
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
    $fn$;

    GRANT EXECUTE ON FUNCTION public.validate_property_qr(TEXT) TO anon;
    GRANT EXECUTE ON FUNCTION public.validate_property_qr(TEXT) TO authenticated;

    COMMENT ON FUNCTION public.validate_property_qr IS 'Securely validates a property QR code and returns minimal property info. Replaces the previous overly permissive RLS policy that exposed all active properties.';
  END IF;
END;
$$;
