-- Fix update_subcontract_audit_entry by dropping in correct order
DROP TRIGGER IF EXISTS subcontract_update_audit ON public.subcontracts;
DROP FUNCTION IF EXISTS public.update_subcontract_audit_entry();