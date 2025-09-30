-- Clean up orphaned job budget entries that reference master cost codes (job_id = null)
DELETE FROM job_budgets 
WHERE job_id = 'c99bbd25-3501-4ff5-9e21-d53e83e89f4f' 
AND cost_code_id IN (
  SELECT cc.id FROM cost_codes cc 
  WHERE cc.id = job_budgets.cost_code_id 
  AND cc.job_id IS NULL
);