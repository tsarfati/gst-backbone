-- Clean up orphaned cost codes and job budget entries for job c99bbd25-3501-4ff5-9e21-d53e83e89f4f
-- Remove job budget entries first
DELETE FROM job_budgets WHERE job_id = 'c99bbd25-3501-4ff5-9e21-d53e83e89f4f';

-- Deactivate or remove cost codes for this job
UPDATE cost_codes 
SET is_active = false, updated_at = now()
WHERE job_id = 'c99bbd25-3501-4ff5-9e21-d53e83e89f4f' AND is_active = true;