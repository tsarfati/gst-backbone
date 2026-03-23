DO $$
DECLARE
  v_sigma_company_id constant uuid := 'f64fff8d-16f4-4a07-81b3-e470d7e2d560';
  v_michael_tsarfati_id constant uuid := 'dcdfec98-5141-4559-adb2-fe1d70bfce98';
  v_michael_sigma_id constant uuid := '2b272abe-69d1-4730-9502-52a968092f35';
BEGIN
  -- Any Sigma task created by Michael Tsarfati should always include him on the task
  -- team and prefer him as lead if the lead is blank or still points to the employee
  -- placeholder user.
  UPDATE public.tasks t
  SET leader_user_id = v_michael_tsarfati_id
  WHERE t.company_id = v_sigma_company_id
    AND t.created_by = v_michael_tsarfati_id
    AND (
      t.leader_user_id IS NULL
      OR t.leader_user_id = v_michael_sigma_id
    );

  INSERT INTO public.task_assignees (task_id, user_id, assigned_by)
  SELECT t.id, v_michael_tsarfati_id, v_michael_tsarfati_id
  FROM public.tasks t
  WHERE t.company_id = v_sigma_company_id
    AND t.created_by = v_michael_tsarfati_id
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
    AND t.created_by = v_michael_tsarfati_id
    AND ta.user_id = v_michael_sigma_id;
END $$;
