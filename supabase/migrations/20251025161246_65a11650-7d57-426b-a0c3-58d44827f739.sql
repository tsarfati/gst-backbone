-- Add expiration_date column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_compliance_documents' 
    AND column_name = 'expiration_date'
  ) THEN
    ALTER TABLE vendor_compliance_documents 
    ADD COLUMN expiration_date date;
  END IF;
END $$;

-- Create a function to prevent expiration date changes once set
CREATE OR REPLACE FUNCTION prevent_expiration_date_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If expiration_date is already set and not null, prevent changes
  IF OLD.expiration_date IS NOT NULL AND NEW.expiration_date IS DISTINCT FROM OLD.expiration_date THEN
    -- Only allow admins and controllers to change expiration dates
    IF NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'controller')
    ) THEN
      RAISE EXCEPTION 'Expiration date cannot be changed once set. Only admins and controllers can modify expiration dates.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to enforce expiration date immutability
DROP TRIGGER IF EXISTS check_expiration_date_change ON vendor_compliance_documents;
CREATE TRIGGER check_expiration_date_change
  BEFORE UPDATE ON vendor_compliance_documents
  FOR EACH ROW
  EXECUTE FUNCTION prevent_expiration_date_change();

-- Create a view for compliance warnings with real-time expiration checks
CREATE OR REPLACE VIEW vendor_compliance_warnings AS
SELECT 
  vcd.id,
  vcd.vendor_id,
  vcd.type,
  vcd.is_required,
  vcd.is_uploaded,
  vcd.file_name,
  vcd.file_url,
  vcd.uploaded_at,
  vcd.expiration_date,
  vcd.created_at,
  vcd.updated_at,
  v.name as vendor_name,
  v.company_id,
  -- Calculate if expired
  CASE 
    WHEN vcd.expiration_date IS NOT NULL AND vcd.expiration_date < CURRENT_DATE THEN true
    ELSE false
  END as is_expired,
  -- Calculate days until expiration
  CASE 
    WHEN vcd.expiration_date IS NOT NULL THEN (vcd.expiration_date - CURRENT_DATE)
    ELSE NULL
  END as days_until_expiration,
  -- Determine warning level
  CASE 
    WHEN vcd.is_required AND NOT vcd.is_uploaded THEN 'missing_required'
    WHEN vcd.expiration_date IS NOT NULL AND vcd.expiration_date < CURRENT_DATE THEN 'expired'
    WHEN vcd.expiration_date IS NOT NULL AND (vcd.expiration_date - CURRENT_DATE) <= 30 THEN 'expiring_soon'
    ELSE 'compliant'
  END as warning_level,
  -- Generate warning message
  CASE 
    WHEN vcd.is_required AND NOT vcd.is_uploaded THEN 'Required document not uploaded'
    WHEN vcd.expiration_date IS NOT NULL AND vcd.expiration_date < CURRENT_DATE THEN 
      'Document expired on ' || to_char(vcd.expiration_date, 'MM/DD/YYYY')
    WHEN vcd.expiration_date IS NOT NULL AND (vcd.expiration_date - CURRENT_DATE) <= 30 THEN 
      'Document expires in ' || (vcd.expiration_date - CURRENT_DATE) || ' days'
    ELSE 'Document is compliant'
  END as warning_message
FROM vendor_compliance_documents vcd
JOIN vendors v ON v.id = vcd.vendor_id
WHERE vcd.is_required = true
  AND (
    vcd.is_uploaded = false 
    OR (vcd.expiration_date IS NOT NULL AND vcd.expiration_date < CURRENT_DATE)
    OR (vcd.expiration_date IS NOT NULL AND (vcd.expiration_date - CURRENT_DATE) <= 30)
  );

-- Grant access to the view
GRANT SELECT ON vendor_compliance_warnings TO authenticated;

-- Add comment explaining the expiration date policy
COMMENT ON COLUMN vendor_compliance_documents.expiration_date IS 
'Expiration date for the document. Once set, can only be changed by admins or controllers to maintain compliance audit trail.';

-- Add index for performance on expiration checks
CREATE INDEX IF NOT EXISTS idx_vendor_compliance_expiration 
ON vendor_compliance_documents(vendor_id, expiration_date) 
WHERE expiration_date IS NOT NULL;

-- Add index for quick compliance status checks
CREATE INDEX IF NOT EXISTS idx_vendor_compliance_status 
ON vendor_compliance_documents(vendor_id, is_required, is_uploaded);