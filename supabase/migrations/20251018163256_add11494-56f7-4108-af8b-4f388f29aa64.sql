-- Add vendor_id column to receipts table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'receipts' 
    AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.receipts 
    ADD COLUMN vendor_id UUID REFERENCES public.vendors(id);
    
    CREATE INDEX IF NOT EXISTS idx_receipts_vendor_id ON public.receipts(vendor_id);
  END IF;
END $$;