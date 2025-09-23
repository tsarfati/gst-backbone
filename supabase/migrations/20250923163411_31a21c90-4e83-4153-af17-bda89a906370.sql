-- Add new dashboard settings columns for comprehensive customization
ALTER TABLE dashboard_settings 
ADD COLUMN IF NOT EXISTS show_bills_overview BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_payment_status BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_invoice_summary BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_budget_tracking BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_punch_clock_status BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_timesheet_approval BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_overtime_alerts BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_employee_attendance BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_project_progress BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_task_deadlines BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_resource_allocation BOOLEAN DEFAULT false;