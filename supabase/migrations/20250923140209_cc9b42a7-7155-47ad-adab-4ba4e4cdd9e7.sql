-- Add admin permission for punch-clock-dashboard
INSERT INTO role_permissions (role, menu_item, can_access) 
VALUES ('admin', 'punch-clock-dashboard', true) 
ON CONFLICT (role, menu_item) DO UPDATE SET can_access = true;