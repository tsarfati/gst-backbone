-- Fix validate_journal_entry_balance to avoid failing on first line insert
CREATE OR REPLACE FUNCTION public.validate_journal_entry_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_line_count integer;
  v_balance numeric;
  v_entry_id uuid;
BEGIN
  v_entry_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  -- Compute current line count and balance for the entry
  SELECT COUNT(*), COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0)
    INTO v_line_count, v_balance
  FROM public.journal_entry_lines
  WHERE journal_entry_id = v_entry_id;

  -- Allow initial inserts to accumulate before enforcing balance
  IF v_line_count < 2 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Enforce balanced entry once there are at least two lines
  IF v_balance <> 0 THEN
    RAISE EXCEPTION 'Journal entry debits must equal credits';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
