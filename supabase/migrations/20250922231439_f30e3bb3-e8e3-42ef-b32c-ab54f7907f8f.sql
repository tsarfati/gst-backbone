-- Update employee permissions for punch clock access
UPDATE public.role_permissions 
SET can_access = true 
WHERE role = 'employee' 
AND menu_item IN ('time-tracking', 'timesheets');

-- Insert missing menu permissions if they don't exist
INSERT INTO public.role_permissions (role, menu_item, can_access) VALUES
-- Time Tracking (Punch Clock) - Allow employees to access
('admin', 'time-tracking', true),
('controller', 'time-tracking', true),
('project_manager', 'time-tracking', true),
('employee', 'time-tracking', true),
('view_only', 'time-tracking', false),

-- Timesheets - Allow employees to view their own
('admin', 'timesheets', true),
('controller', 'timesheets', true),
('project_manager', 'timesheets', true),
('employee', 'timesheets', true),
('view_only', 'timesheets', false)

ON CONFLICT (role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;