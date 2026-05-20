CREATE OR REPLACE FUNCTION public.enforce_unique_profile_pin_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pin_code IS NULL OR btrim(NEW.pin_code) = '' THEN
    RETURN NEW;
  END IF;

  NEW.pin_code := btrim(NEW.pin_code);

  IF NEW.pin_code !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'PIN code must be exactly 6 digits'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.pin_code = NEW.pin_code
      AND p.user_id <> NEW.user_id
  ) THEN
    RAISE EXCEPTION 'PIN code is already assigned to another user'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_unique_profile_pin_code ON public.profiles;

CREATE TRIGGER trg_enforce_unique_profile_pin_code
BEFORE INSERT OR UPDATE OF pin_code
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_unique_profile_pin_code();
