-- Enable leaked password protection for enhanced security
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth'
      AND table_name = 'config'
  ) THEN
    UPDATE auth.config
    SET password_min_length = 8,
        password_require_letters = true,
        password_require_upper = true,
        password_require_lower = true,
        password_require_numbers = true,
        password_require_symbols = true;
  END IF;
END
$$;
