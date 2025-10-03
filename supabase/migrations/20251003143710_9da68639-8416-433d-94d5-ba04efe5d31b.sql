-- Fix the vendors foreign key constraint to reference companies table instead of users
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_company_id_fkey;
ALTER TABLE vendors ADD CONSTRAINT vendors_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES companies(id);