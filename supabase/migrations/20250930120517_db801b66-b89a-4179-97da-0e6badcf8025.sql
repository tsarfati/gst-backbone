-- Add dynamic_group and dynamic_parent to cost_code_type enum
ALTER TYPE public.cost_code_type ADD VALUE IF NOT EXISTS 'dynamic_group';
ALTER TYPE public.cost_code_type ADD VALUE IF NOT EXISTS 'dynamic_parent';