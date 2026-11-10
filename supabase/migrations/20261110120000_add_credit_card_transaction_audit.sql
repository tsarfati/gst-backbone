-- Preserve a field-level history for credit card transactions so exported
-- receipt packages can include authoritative BuilderLYNK provenance.
CREATE OR REPLACE FUNCTION public.create_credit_card_transaction_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid;
  field_name_value text;
  old_json jsonb;
  new_json jsonb;
BEGIN
  actor_id := COALESCE(
    auth.uid(),
    CASE WHEN TG_OP = 'DELETE' THEN OLD.created_by ELSE NEW.created_by END
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.company_audit_log (
      company_id, table_name, record_id, action, changed_by, reason
    ) VALUES (
      NEW.company_id,
      'credit_card_transactions',
      NEW.id,
      'create',
      actor_id,
      'Credit card transaction created'
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR field_name_value, new_json IN
      SELECT key, value
      FROM jsonb_each(to_jsonb(NEW) - 'updated_at')
    LOOP
      old_json := to_jsonb(OLD) -> field_name_value;
      IF old_json IS DISTINCT FROM new_json THEN
        INSERT INTO public.company_audit_log (
          company_id,
          table_name,
          record_id,
          action,
          field_name,
          old_value,
          new_value,
          changed_by,
          reason
        ) VALUES (
          NEW.company_id,
          'credit_card_transactions',
          NEW.id,
          'update',
          field_name_value,
          CASE WHEN old_json = 'null'::jsonb THEN NULL ELSE old_json #>> '{}' END,
          CASE WHEN new_json = 'null'::jsonb THEN NULL ELSE new_json #>> '{}' END,
          actor_id,
          'Credit card transaction updated'
        );
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  INSERT INTO public.company_audit_log (
    company_id, table_name, record_id, action, changed_by, reason
  ) VALUES (
    OLD.company_id,
    'credit_card_transactions',
    OLD.id,
    'delete',
    actor_id,
    'Credit card transaction deleted'
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS credit_card_transaction_audit_trigger
  ON public.credit_card_transactions;

CREATE TRIGGER credit_card_transaction_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_card_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_credit_card_transaction_audit_entry();

CREATE INDEX IF NOT EXISTS idx_company_audit_log_credit_card_transaction
  ON public.company_audit_log (record_id, created_at)
  WHERE table_name = 'credit_card_transactions';
