-- Insert default role permissions for vendor role
-- Vendors should have limited access: dashboard, bills they submitted, messages, documents

INSERT INTO role_permissions (role, menu_item, can_access)
VALUES
  -- Dashboard
  ('vendor', 'dashboard', true),
  
  -- Jobs - limited view
  ('vendor', 'jobs', true),
  ('vendor', 'jobs-view', true),
  
  -- Bills - can view and submit
  ('vendor', 'bills', true),
  ('vendor', 'bills-view', true),
  ('vendor', 'bills-add', true),
  
  -- Messages
  ('vendor', 'messages', true),
  
  -- Documents
  ('vendor', 'company-files', true),
  
  -- Purchase Orders - view only
  ('vendor', 'purchase-orders', true),
  
  -- Subcontracts - view only
  ('vendor', 'subcontracts', true)
ON CONFLICT (role, menu_item) DO NOTHING;

-- Insert default landing page for vendor role
INSERT INTO role_default_pages (role, default_page, created_by)
SELECT 'vendor', '/dashboard', (SELECT user_id FROM profiles WHERE role = 'admin' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM role_default_pages WHERE role = 'vendor');