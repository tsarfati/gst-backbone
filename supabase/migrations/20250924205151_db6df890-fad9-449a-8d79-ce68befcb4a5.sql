-- Fix user_role enum to include missing values causing 400 errors
-- Add company_admin and controller to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'company_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'controller';