-- Clean up mistakenly granted PIN employee access
-- Remove user_company_access entries for PIN employees where their creator
-- doesn't have access to the same company

DELETE FROM user_company_access uca
WHERE uca.user_id IN (
  -- Get all PIN employee IDs
  SELECT id FROM pin_employees WHERE is_active = true
)
AND NOT EXISTS (
  -- Check if the creator has access to this company
  SELECT 1 
  FROM pin_employees pe
  JOIN user_company_access creator_access ON creator_access.user_id = pe.created_by
  WHERE pe.id = uca.user_id
    AND creator_access.company_id = uca.company_id
    AND creator_access.is_active = true
);