DO $$
DECLARE
  v_sigma_company_id constant uuid := 'f64fff8d-16f4-4a07-81b3-e470d7e2d560';
  v_michael_tsarfati_id constant uuid := 'dcdfec98-5141-4559-adb2-fe1d70bfce98';
BEGIN
  -- Backfill any Sigma task that currently has no assignees so it shows up for the
  -- creator-facing task workspace. Prefer Michael Tsarfati for the existing Sigma
  -- cleanup case where the task was created without team membership.
  UPDATE public.tasks t
  SET leader_user_id = v_michael_tsarfati_id
  WHERE t.company_id = v_sigma_company_id
    AND (
      t.leader_user_id IS NULL
      OR t.leader_user_id = '2b272abe-69d1-4730-9502-52a968092f35'::uuid
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.task_assignees ta
      WHERE ta.task_id = t.id
    );

  INSERT INTO public.task_assignees (task_id, user_id, assigned_by)
  SELECT t.id, v_michael_tsarfati_id, v_michael_tsarfati_id
  FROM public.tasks t
  WHERE t.company_id = v_sigma_company_id
    AND (
      t.leader_user_id = v_michael_tsarfati_id
      OR t.created_by = v_michael_tsarfati_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.task_assignees ta
      WHERE ta.task_id = t.id
        AND ta.user_id = v_michael_tsarfati_id
    );

  DELETE FROM public.task_assignees ta
  USING public.tasks t
  WHERE ta.task_id = t.id
    AND t.company_id = v_sigma_company_id
    AND ta.user_id = '2b272abe-69d1-4730-9502-52a968092f35'::uuid
    AND (
      t.leader_user_id = v_michael_tsarfati_id
      OR t.created_by = v_michael_tsarfati_id
    );
END $$;
