-- Add logo_scale column and update instructions to support HTML
ALTER TABLE public.qr_card_customization 
  ADD COLUMN logo_scale numeric DEFAULT 1.0,
  ADD COLUMN instructions text;

-- Migrate existing data: combine instructions_line1 and instructions_line2
UPDATE public.qr_card_customization 
SET instructions = CONCAT(instructions_line1, '<br>', instructions_line2)
WHERE instructions_line1 IS NOT NULL OR instructions_line2 IS NOT NULL;

-- Set default if no existing instructions
UPDATE public.qr_card_customization 
SET instructions = 'Scan this QR code to access the Punch Clock<br>Then enter your PIN to clock in/out'
WHERE instructions IS NULL;