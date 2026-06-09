DO $$
DECLARE
  sandbox_tenant_id CONSTANT uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  punch_clock_tier_id uuid;
BEGIN
  SELECT st.id
  INTO punch_clock_tier_id
  FROM public.subscription_tiers st
  JOIN public.tier_feature_access tfa ON tfa.tier_id = st.id
  JOIN public.feature_modules fm ON fm.id = tfa.feature_module_id
  WHERE st.is_active = true
    AND fm.key = 'punch_clock_app'
  ORDER BY
    CASE
      WHEN lower(st.name) = 'professional' THEN 0
      WHEN st.is_default THEN 1
      ELSE 2
    END,
    st.sort_order,
    st.created_at
  LIMIT 1;

  IF punch_clock_tier_id IS NULL THEN
    RAISE EXCEPTION 'No active subscription tier with punch_clock_app feature found';
  END IF;

  INSERT INTO public.company_subscriptions (
    company_id,
    tier_id,
    status,
    start_date,
    billing_cycle,
    notes,
    assigned_by
  )
  SELECT
    c.id,
    punch_clock_tier_id,
    'active',
    now(),
    'monthly',
    'Backfill: enable Punch Clock access for BuilderLYNK sandbox demo companies',
    c.created_by
  FROM public.companies c
  WHERE c.tenant_id = sandbox_tenant_id
    AND c.is_active = true
  ON CONFLICT (company_id) DO UPDATE
  SET
    tier_id = EXCLUDED.tier_id,
    status = 'active',
    end_date = NULL,
    updated_at = now(),
    notes = EXCLUDED.notes;
END $$;
