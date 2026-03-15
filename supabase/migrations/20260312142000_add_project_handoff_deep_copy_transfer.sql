-- Deep project handoff helper for DesignPro -> Builder workflows.
-- Performs shell copy/transfer on jobs plus best-effort propagation of rows
-- in public tables that contain both (job_id, company_id).

CREATE OR REPLACE FUNCTION public.design_pro_handoff_project_deep(
  p_job_id uuid,
  p_target_company_id uuid,
  p_mode text,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text := lower(coalesce(p_mode, ''));
  v_source_job public.jobs%ROWTYPE;
  v_target_job_id uuid;
  v_table_name text;
  v_insert_cols text;
  v_select_cols text;
  v_sql text;
  v_row_count integer;
  v_updated_tables integer := 0;
  v_copied_rows bigint := 0;
  v_transfer_rows bigint := 0;
  v_warning text;
  v_warnings text[] := ARRAY[]::text[];
BEGIN
  IF v_mode NOT IN ('copy', 'transfer') THEN
    RAISE EXCEPTION 'Invalid mode. Expected copy|transfer';
  END IF;

  SELECT *
  INTO v_source_job
  FROM public.jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source project not found';
  END IF;

  IF v_source_job.company_id = p_target_company_id THEN
    RAISE EXCEPTION 'Target company must be different from source company';
  END IF;

  IF v_mode = 'copy' THEN
    INSERT INTO public.jobs (
      name,
      project_number,
      customer_id,
      client,
      address,
      job_type,
      status,
      start_date,
      end_date,
      budget,
      budget_total,
      description,
      company_id,
      project_manager_user_id,
      created_by,
      is_active,
      banner_url
    )
    VALUES (
      CASE
        WHEN coalesce(v_source_job.name, '') ILIKE '%(copy)%' THEN v_source_job.name
        ELSE coalesce(v_source_job.name, 'Project') || ' (Copy)'
      END,
      v_source_job.project_number,
      NULL, -- Customer references are company-specific
      v_source_job.client,
      v_source_job.address,
      v_source_job.job_type,
      v_source_job.status,
      v_source_job.start_date,
      v_source_job.end_date,
      v_source_job.budget,
      v_source_job.budget_total,
      v_source_job.description,
      p_target_company_id,
      NULL, -- PM may not exist in target company
      p_actor_user_id,
      true,
      v_source_job.banner_url
    )
    RETURNING id INTO v_target_job_id;

    -- Copy explicit user job access rows.
    BEGIN
      INSERT INTO public.user_job_access (user_id, job_id, can_access)
      SELECT uja.user_id, v_target_job_id, uja.can_access
      FROM public.user_job_access uja
      WHERE uja.job_id = p_job_id
      ON CONFLICT (user_id, job_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      v_warnings := array_append(v_warnings, 'user_job_access copy failed: ' || SQLERRM);
    END;
  ELSE
    v_target_job_id := p_job_id;

    UPDATE public.jobs
    SET
      company_id = p_target_company_id,
      customer_id = NULL, -- Customer references are company-specific
      project_manager_user_id = NULL
    WHERE id = p_job_id;
  END IF;

  -- Process every table that has both job_id and company_id.
  FOR v_table_name IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    GROUP BY c.table_name
    HAVING
      bool_or(c.column_name = 'job_id')
      AND bool_or(c.column_name = 'company_id')
      AND c.table_name <> 'jobs'
  LOOP
    BEGIN
      IF v_mode = 'transfer' THEN
        v_sql := format(
          'UPDATE public.%I SET company_id = $1 WHERE job_id = $2 AND company_id = $3',
          v_table_name
        );
        EXECUTE v_sql USING p_target_company_id, p_job_id, v_source_job.company_id;
        GET DIAGNOSTICS v_row_count = ROW_COUNT;
        IF v_row_count > 0 THEN
          v_updated_tables := v_updated_tables + 1;
          v_transfer_rows := v_transfer_rows + v_row_count;
        END IF;
      ELSE
        SELECT
          string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position),
          string_agg(
            CASE
              WHEN column_name = 'job_id' THEN quote_literal(v_target_job_id::text) || '::uuid AS job_id'
              WHEN column_name = 'company_id' THEN quote_literal(p_target_company_id::text) || '::uuid AS company_id'
              ELSE format('%I', column_name)
            END,
            ', '
            ORDER BY ordinal_position
          )
        INTO v_insert_cols, v_select_cols
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = v_table_name
          AND column_name <> 'id';

        IF v_insert_cols IS NULL OR v_select_cols IS NULL THEN
          CONTINUE;
        END IF;

        v_sql := format(
          'INSERT INTO public.%I (%s) SELECT %s FROM public.%I WHERE job_id = $1 AND company_id = $2',
          v_table_name,
          v_insert_cols,
          v_select_cols,
          v_table_name
        );
        EXECUTE v_sql USING p_job_id, v_source_job.company_id;
        GET DIAGNOSTICS v_row_count = ROW_COUNT;
        IF v_row_count > 0 THEN
          v_updated_tables := v_updated_tables + 1;
          v_copied_rows := v_copied_rows + v_row_count;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_warning := format('%s %s failed: %s', v_mode, v_table_name, SQLERRM);
      v_warnings := array_append(v_warnings, v_warning);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'mode', v_mode,
    'source_job_id', p_job_id,
    'result_job_id', v_target_job_id,
    'source_company_id', v_source_job.company_id,
    'target_company_id', p_target_company_id,
    'tables_touched', v_updated_tables,
    'copied_rows', v_copied_rows,
    'transferred_rows', v_transfer_rows,
    'warnings', to_jsonb(v_warnings)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.design_pro_handoff_project_deep(uuid, uuid, text, uuid) TO service_role;
