-- Add deleted_at column to time_cards table for soft delete functionality
ALTER TABLE public.time_cards ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;

-- Create index for better performance when filtering deleted records
CREATE INDEX IF NOT EXISTS idx_time_cards_deleted_at ON public.time_cards(deleted_at) WHERE deleted_at IS NOT NULL;