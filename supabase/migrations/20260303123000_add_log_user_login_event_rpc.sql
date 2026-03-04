-- Centralized login audit writer so all clients (web/mobile) can log consistently.
-- Safe to call from authenticated clients; writes only for auth.uid().

CREATE OR REPLACE FUNCTION public.log_user_login_event(
  p_app_source text DEFAULT 'builderlynk_web',
  p_login_method text DEFAULT 'email',
  p_success boolean DEFAULT true,
  p_user_agent text DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_app_source text;
  v_recent_exists boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_app_source := lower(coalesce(nullif(trim(p_app_source), ''), 'builderlynk_web'));
  IF v_app_source NOT IN ('builderlynk_web', 'punch_clock', 'pmlynk') THEN
    v_app_source := 'builderlynk_web';
  END IF;

  -- Lightweight de-dupe window to avoid duplicate inserts from auth state replays.
  SELECT EXISTS (
    SELECT 1
    FROM public.user_login_audit ula
    WHERE ula.user_id = v_user_id
      AND coalesce(ula.app_source, 'builderlynk_web') = v_app_source
      AND ula.login_time >= (now() - interval '3 minutes')
  )
  INTO v_recent_exists;

  IF v_recent_exists THEN
    RETURN;
  END IF;

  INSERT INTO public.user_login_audit (
    user_id,
    login_time,
    login_method,
    success,
    user_agent,
    app_source
  ) VALUES (
    v_user_id,
    now(),
    coalesce(nullif(trim(p_login_method), ''), 'email'),
    coalesce(p_success, true),
    p_user_agent,
    v_app_source
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_user_login_event(text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_user_login_event(text, text, boolean, text) TO authenticated;

