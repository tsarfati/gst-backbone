-- Add default page for vendor role
-- Use a system UUID for created_by since this is a system-level setting
INSERT INTO role_default_pages (role, default_page, created_by)
VALUES ('vendor', '/vendor/dashboard', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (role) DO UPDATE SET default_page = '/vendor/dashboard';