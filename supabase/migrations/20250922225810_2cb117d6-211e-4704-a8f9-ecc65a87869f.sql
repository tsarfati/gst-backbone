-- Insert default permissions for new punch clock menu items
INSERT INTO public.role_permissions (role, menu_item, can_access) VALUES
-- Punch Clock Settings - Only admins and controllers by default
('admin', 'punch-clock-settings', true),
('controller', 'punch-clock-settings', true),
('project_manager', 'punch-clock-settings', false),
('employee', 'punch-clock-settings', false),
('view_only', 'punch-clock-settings', false),

-- Timecard Reports - Admins, controllers, and project managers
('admin', 'timecard-reports', true),
('controller', 'timecard-reports', true),
('project_manager', 'timecard-reports', true),
('employee', 'timecard-reports', false),
('view_only', 'timecard-reports', false),

-- Employee Time Settings - Admins and controllers only
('admin', 'employee-timecard-settings', true),
('controller', 'employee-timecard-settings', true),
('project_manager', 'employee-timecard-settings', false),
('employee', 'employee-timecard-settings', false),
('view_only', 'employee-timecard-settings', false),

-- Time Corrections - Admins, controllers, and project managers
('admin', 'time-corrections', true),
('controller', 'time-corrections', true),
('project_manager', 'time-corrections', true),
('employee', 'time-corrections', false),
('view_only', 'time-corrections', false),

-- Punch Records - Admins and controllers, employees can view their own
('admin', 'punch-records', true),
('controller', 'punch-records', true),
('project_manager', 'punch-records', true),
('employee', 'punch-records', true),
('view_only', 'punch-records', false)

ON CONFLICT (role, menu_item) DO NOTHING;