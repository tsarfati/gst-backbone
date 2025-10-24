-- Add interval columns for notification settings
ALTER TABLE notification_settings 
ADD COLUMN IF NOT EXISTS overdue_bills_interval TEXT DEFAULT 'daily' CHECK (overdue_bills_interval IN ('daily', 'weekly', 'biweekly'));

ALTER TABLE notification_settings 
ADD COLUMN IF NOT EXISTS financial_overview_interval TEXT DEFAULT 'weekly' CHECK (financial_overview_interval IN ('daily', 'weekly', 'biweekly'));

-- Add comments for documentation
COMMENT ON COLUMN notification_settings.overdue_bills_interval IS 'Frequency for overdue bill notifications: daily, weekly, or biweekly';
COMMENT ON COLUMN notification_settings.financial_overview_interval IS 'Frequency for financial overview report: daily, weekly, or biweekly';