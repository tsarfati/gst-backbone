-- Add visitor_photo_url column to visitor_logs table
ALTER TABLE public.visitor_logs
ADD COLUMN IF NOT EXISTS visitor_photo_url TEXT;