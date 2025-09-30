-- Clean up the broken job budget reference to master cost code
DELETE FROM job_budgets WHERE cost_code_id = '669c78d6-2d64-4b06-9a6b-bff4efa1b086' AND job_id = 'c99bbd25-3501-4ff5-9e21-d53e83e89f4f';