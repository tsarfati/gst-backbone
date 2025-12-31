-- Add cost_code_id column to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN cost_code_id uuid REFERENCES public.cost_codes(id);

-- Create an index for better query performance
CREATE INDEX idx_purchase_orders_cost_code_id ON public.purchase_orders(cost_code_id);