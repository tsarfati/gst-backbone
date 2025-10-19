-- Add new color and styling columns to pdf_templates table
ALTER TABLE pdf_templates
ADD COLUMN IF NOT EXISTS secondary_color TEXT,
ADD COLUMN IF NOT EXISTS table_header_bg TEXT,
ADD COLUMN IF NOT EXISTS table_border_color TEXT,
ADD COLUMN IF NOT EXISTS table_stripe_color TEXT;