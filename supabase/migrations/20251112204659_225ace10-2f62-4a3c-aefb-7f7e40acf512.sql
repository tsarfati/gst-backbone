-- Delete SIGMA2 company and all related data

-- Update profiles to remove company reference
UPDATE profiles 
SET current_company_id = NULL 
WHERE current_company_id = 'bb37e820-68d3-41f4-af72-596a5bc30d93';

-- Delete jobs (will cascade to job-related data)
DELETE FROM jobs 
WHERE company_id = 'bb37e820-68d3-41f4-af72-596a5bc30d93';

-- Delete cost codes
DELETE FROM cost_codes 
WHERE company_id = 'bb37e820-68d3-41f4-af72-596a5bc30d93';

-- Delete chart of accounts
DELETE FROM chart_of_accounts 
WHERE company_id = 'bb37e820-68d3-41f4-af72-596a5bc30d93';

-- Delete user company access
DELETE FROM user_company_access 
WHERE company_id = 'bb37e820-68d3-41f4-af72-596a5bc30d93';

-- Finally, delete the company itself
DELETE FROM companies 
WHERE id = 'bb37e820-68d3-41f4-af72-596a5bc30d93';