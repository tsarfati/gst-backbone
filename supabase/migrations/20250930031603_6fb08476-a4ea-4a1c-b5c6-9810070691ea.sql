-- Add purchase_order_id column to invoices table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'purchase_order_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.invoices 
        ADD COLUMN purchase_order_id uuid REFERENCES public.purchase_orders(id);
        
        COMMENT ON COLUMN public.invoices.purchase_order_id IS 'Reference to purchase order for bills against purchase orders';
    END IF;
END $$;