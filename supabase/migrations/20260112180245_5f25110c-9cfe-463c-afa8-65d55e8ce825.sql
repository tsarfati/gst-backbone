-- Add missing menu items to role_permissions for all roles
-- These menu items exist in the RolePermissionsManager but are missing from the database

-- Admin role - full access
INSERT INTO role_permissions (role, menu_item, can_access) VALUES
  ('admin'::user_role, 'company-settings', TRUE),
  ('admin'::user_role, 'company-management', TRUE),
  ('admin'::user_role, 'user-settings', TRUE),
  ('admin'::user_role, 'theme-settings', TRUE),
  ('admin'::user_role, 'security-settings', TRUE),
  ('admin'::user_role, 'receivables', TRUE),
  ('admin'::user_role, 'jobs-view', TRUE),
  ('admin'::user_role, 'bills-view', TRUE),
  ('admin'::user_role, 'receipts', TRUE)
ON CONFLICT (role, menu_item) DO NOTHING;

-- Controller role - financial oversight
INSERT INTO role_permissions (role, menu_item, can_access) VALUES
  ('controller'::user_role, 'company-settings', TRUE),
  ('controller'::user_role, 'company-management', TRUE),
  ('controller'::user_role, 'user-settings', TRUE),
  ('controller'::user_role, 'theme-settings', TRUE),
  ('controller'::user_role, 'security-settings', TRUE),
  ('controller'::user_role, 'receivables', TRUE),
  ('controller'::user_role, 'jobs-view', TRUE),
  ('controller'::user_role, 'bills-view', TRUE),
  ('controller'::user_role, 'receipts', TRUE)
ON CONFLICT (role, menu_item) DO NOTHING;

-- Company Admin role - company-wide management
INSERT INTO role_permissions (role, menu_item, can_access) VALUES
  ('company_admin'::user_role, 'company-settings', TRUE),
  ('company_admin'::user_role, 'company-management', TRUE),
  ('company_admin'::user_role, 'user-settings', TRUE),
  ('company_admin'::user_role, 'theme-settings', TRUE),
  ('company_admin'::user_role, 'security-settings', TRUE),
  ('company_admin'::user_role, 'receivables', TRUE),
  ('company_admin'::user_role, 'jobs-view', TRUE),
  ('company_admin'::user_role, 'bills-view', TRUE),
  ('company_admin'::user_role, 'receipts', TRUE)
ON CONFLICT (role, menu_item) DO NOTHING;

-- Project Manager role - limited admin access
INSERT INTO role_permissions (role, menu_item, can_access) VALUES
  ('project_manager'::user_role, 'company-settings', FALSE),
  ('project_manager'::user_role, 'company-management', FALSE),
  ('project_manager'::user_role, 'user-settings', FALSE),
  ('project_manager'::user_role, 'theme-settings', TRUE),
  ('project_manager'::user_role, 'security-settings', FALSE),
  ('project_manager'::user_role, 'receivables', TRUE),
  ('project_manager'::user_role, 'jobs-view', TRUE),
  ('project_manager'::user_role, 'bills-view', TRUE),
  ('project_manager'::user_role, 'receipts', TRUE)
ON CONFLICT (role, menu_item) DO NOTHING;

-- Employee role - basic access
INSERT INTO role_permissions (role, menu_item, can_access) VALUES
  ('employee'::user_role, 'company-settings', FALSE),
  ('employee'::user_role, 'company-management', FALSE),
  ('employee'::user_role, 'user-settings', FALSE),
  ('employee'::user_role, 'theme-settings', FALSE),
  ('employee'::user_role, 'security-settings', FALSE),
  ('employee'::user_role, 'receivables', FALSE),
  ('employee'::user_role, 'jobs-view', TRUE),
  ('employee'::user_role, 'bills-view', FALSE),
  ('employee'::user_role, 'receipts', TRUE)
ON CONFLICT (role, menu_item) DO NOTHING;

-- View Only role - read-only
INSERT INTO role_permissions (role, menu_item, can_access) VALUES
  ('view_only'::user_role, 'company-settings', FALSE),
  ('view_only'::user_role, 'company-management', FALSE),
  ('view_only'::user_role, 'user-settings', FALSE),
  ('view_only'::user_role, 'theme-settings', FALSE),
  ('view_only'::user_role, 'security-settings', FALSE),
  ('view_only'::user_role, 'receivables', TRUE),
  ('view_only'::user_role, 'jobs-view', TRUE),
  ('view_only'::user_role, 'bills-view', TRUE),
  ('view_only'::user_role, 'receipts', TRUE)
ON CONFLICT (role, menu_item) DO NOTHING;

-- Vendor role - external vendor
INSERT INTO role_permissions (role, menu_item, can_access) VALUES
  ('vendor'::user_role, 'company-settings', FALSE),
  ('vendor'::user_role, 'company-management', FALSE),
  ('vendor'::user_role, 'user-settings', FALSE),
  ('vendor'::user_role, 'theme-settings', FALSE),
  ('vendor'::user_role, 'security-settings', FALSE),
  ('vendor'::user_role, 'receivables', FALSE),
  ('vendor'::user_role, 'jobs-view', TRUE),
  ('vendor'::user_role, 'bills-view', FALSE),
  ('vendor'::user_role, 'receipts', FALSE)
ON CONFLICT (role, menu_item) DO NOTHING;