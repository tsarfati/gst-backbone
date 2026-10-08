-- Apply an approved time-card change request and its payroll calculations in one transaction.
CREATE OR REPLACE FUNCTION public.approve_time_card_change_request(
  p_request_id uuid,
  p_review_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer uuid := auth.uid();
  v_request public.time_card_change_requests%ROWTYPE;
  v_card public.time_cards%ROWTYPE;
  v_punch_in timestamptz;
  v_punch_out timestamptz;
  v_job_id uuid;
  v_cost_code_id uuid;
  v_gross_hours numeric;
  v_total_hours numeric;
  v_break_minutes integer := 30;
  v_break_wait_hours numeric := 6;
  v_calculate_overtime boolean := false;
  v_overtime_threshold numeric := 8;
  v_overtime_hours numeric := 0;
BEGIN
  IF v_reviewer IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_request
  FROM public.time_card_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Change request is no longer pending';
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = v_reviewer
        AND uca.company_id = v_request.company_id
        AND uca.is_active = true
        AND uca.role::text IN ('owner', 'company_admin', 'admin', 'controller', 'project_manager')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = v_reviewer
        AND p.role::text = 'super_admin'
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to approve this change request';
  END IF;

  SELECT *
  INTO v_card
  FROM public.time_cards
  WHERE id = v_request.time_card_id
    AND company_id = v_request.company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Time card not found';
  END IF;

  v_punch_in := COALESCE(v_request.proposed_punch_in_time, v_card.punch_in_time);
  v_punch_out := COALESCE(v_request.proposed_punch_out_time, v_card.punch_out_time);
  v_job_id := COALESCE(v_request.proposed_job_id, v_card.job_id);
  v_cost_code_id := COALESCE(v_request.proposed_cost_code_id, v_card.cost_code_id);

  IF v_punch_out <= v_punch_in THEN
    RAISE EXCEPTION 'Punch out must be after punch in';
  END IF;

  IF v_job_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = v_job_id AND j.company_id = v_request.company_id
  ) THEN
    RAISE EXCEPTION 'Requested job does not belong to this company';
  END IF;

  IF v_cost_code_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cost_codes cc
    WHERE cc.id = v_cost_code_id
      AND (v_job_id IS NULL OR cc.job_id = v_job_id)
  ) THEN
    RAISE EXCEPTION 'Requested cost code does not belong to the requested job';
  END IF;

  SELECT
    COALESCE(s.auto_break_duration, 30),
    COALESCE(s.auto_break_wait_hours, 6),
    COALESCE(s.calculate_overtime, false),
    COALESCE(s.overtime_threshold, 8)
  INTO
    v_break_minutes,
    v_break_wait_hours,
    v_calculate_overtime,
    v_overtime_threshold
  FROM public.job_punch_clock_settings s
  WHERE s.company_id = v_request.company_id
    AND (s.job_id = v_job_id OR s.job_id IS NULL)
  ORDER BY (s.job_id IS NOT NULL) DESC, s.updated_at DESC
  LIMIT 1;

  v_break_minutes := COALESCE(v_break_minutes, 30);
  v_break_wait_hours := COALESCE(v_break_wait_hours, 6);
  v_calculate_overtime := COALESCE(v_calculate_overtime, false);
  v_overtime_threshold := COALESCE(v_overtime_threshold, 8);

  v_gross_hours := GREATEST(0, EXTRACT(EPOCH FROM (v_punch_out - v_punch_in)) / 3600.0);
  IF v_gross_hours <= v_break_wait_hours THEN
    v_break_minutes := 0;
  END IF;
  v_total_hours := GREATEST(0, v_gross_hours - (v_break_minutes / 60.0));
  IF v_calculate_overtime THEN
    v_overtime_hours := GREATEST(0, v_total_hours - v_overtime_threshold);
  END IF;

  UPDATE public.time_cards
  SET punch_in_time = v_punch_in,
      punch_out_time = v_punch_out,
      job_id = v_job_id,
      cost_code_id = v_cost_code_id,
      break_minutes = v_break_minutes,
      total_hours = v_total_hours,
      overtime_hours = v_overtime_hours,
      status = 'approved-edited',
      approved_by = v_reviewer,
      approved_at = now(),
      updated_at = now()
  WHERE id = v_card.id;

  UPDATE public.time_card_change_requests
  SET status = 'approved',
      reviewed_by = v_reviewer,
      reviewed_at = now(),
      review_notes = p_review_notes,
      updated_at = now()
  WHERE id = v_request.id;

  -- Double-taps can create identical requests. Close those siblings so the card
  -- does not continue to appear as though another approval is required.
  UPDATE public.time_card_change_requests sibling
  SET status = 'superseded',
      reviewed_by = v_reviewer,
      reviewed_at = now(),
      review_notes = COALESCE(p_review_notes, 'Superseded by an identical approved request'),
      updated_at = now()
  WHERE sibling.time_card_id = v_request.time_card_id
    AND sibling.id <> v_request.id
    AND sibling.status = 'pending'
    AND sibling.proposed_punch_in_time IS NOT DISTINCT FROM v_request.proposed_punch_in_time
    AND sibling.proposed_punch_out_time IS NOT DISTINCT FROM v_request.proposed_punch_out_time
    AND sibling.proposed_job_id IS NOT DISTINCT FROM v_request.proposed_job_id
    AND sibling.proposed_cost_code_id IS NOT DISTINCT FROM v_request.proposed_cost_code_id;

  RETURN jsonb_build_object(
    'time_card_id', v_card.id,
    'request_id', v_request.id,
    'punch_in_time', v_punch_in,
    'punch_out_time', v_punch_out,
    'break_minutes', v_break_minutes,
    'total_hours', v_total_hours,
    'overtime_hours', v_overtime_hours,
    'status', 'approved-edited'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_time_card_change_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_time_card_change_request(uuid, text) TO authenticated;
