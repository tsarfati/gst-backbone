
-- Add Stripe identifiers to subscription_tiers
ALTER TABLE public.subscription_tiers
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- Add Stripe customer ID to companies for quick lookup
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;
