-- Create RPC function to get job subcontractors without TypeScript type issues
CREATE OR REPLACE FUNCTION get_job_subcontractors(p_job_id UUID)
RETURNS TABLE (
  id UUID,
  vendor_id UUID,
  vendor_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.vendor_id,
    v.name as vendor_name
  FROM subcontracts s
  LEFT JOIN vendors v ON s.vendor_id = v.id
  WHERE s.job_id = p_job_id
    AND s.is_active = true;
END;
$$;