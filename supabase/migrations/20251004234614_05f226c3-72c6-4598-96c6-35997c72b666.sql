
-- Drop and recreate the get_job_subcontractors function without the is_active filter
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
  ORDER BY v.name;
END;
$$;
